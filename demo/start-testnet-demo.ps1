#requires -Version 5.1
param([switch]$EnableTestnetSettlement)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (!$EnableTestnetSettlement) { throw 'Pass -EnableTestnetSettlement to explicitly start the local 1 CCD Testnet payment demo.' }
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$envFile = Join-Path $projectRoot '.env'
$statePath = Join-Path $env:TEMP 'countercheck-testnet-demo-state.json'
$network = 'ccd:4221332d34e1694168c2a0c0b3fd0f27'
if (!(Test-Path -LiteralPath $envFile)) { throw 'Create and privately configure .env before starting the paid Testnet demo.' }
if (Test-Path -LiteralPath $statePath) { throw 'A Testnet demo process record already exists. Run .\demo\stop-testnet-demo.ps1 first.' }

$nodePath = (Get-Command node -ErrorAction Stop).Source
$scripts = @{
    facilitator = Join-Path $projectRoot 'src\facilitator.mjs'
    seller = Join-Path $projectRoot 'src\seller-resource.mjs'
    app = Join-Path $projectRoot 'src\server.mjs'
}
$ports = @(4173, 4180, 4191)
$logs = @{}
$started = @{}
$saved = @{}

function Test-PortOccupied([int]$Port) {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    try { $listener.Start(); return $false }
    catch { return $true }
    finally { try { $listener.Stop() } catch { } }
}

function Get-LocalJson([string]$Url) {
    $request = [System.Net.HttpWebRequest]::Create($Url)
    $request.Method = 'GET'
    $request.Timeout = 2000
    $request.ReadWriteTimeout = 2000
    if ($Url -eq 'http://127.0.0.1:4173/api/status') {
        $request.Headers['Origin'] = 'http://127.0.0.1:4173'
        $request.Headers['x-countercheck-request'] = '1'
    }
    $response = $request.GetResponse()
    try {
        $reader = [System.IO.StreamReader]::new($response.GetResponseStream())
        try { return ($reader.ReadToEnd() | ConvertFrom-Json -ErrorAction Stop) }
        finally { $reader.Dispose() }
    } finally { $response.Dispose() }
}

function Post-LocalJson([string]$Url, [hashtable]$Body) {
    $request = [System.Net.HttpWebRequest]::Create($Url)
    $request.Method = 'POST'
    $request.ContentType = 'application/json'
    $request.Headers['Origin'] = 'http://127.0.0.1:4173'
    $request.Headers['x-countercheck-request'] = '1'
    $request.Timeout = 30000
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 8 -Compress))
    $request.ContentLength = $bytes.Length
    $stream = $request.GetRequestStream()
    try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
    $response = $request.GetResponse()
    try {
        $reader = [System.IO.StreamReader]::new($response.GetResponseStream())
        try { return ($reader.ReadToEnd() | ConvertFrom-Json -ErrorAction Stop) }
        finally { $reader.Dispose() }
    } finally { $response.Dispose() }
}

function Start-LocalService([string]$Role) {
    $runId = [guid]::NewGuid().ToString('N')
    $logs["${Role}Log"] = Join-Path $env:TEMP "countercheck-testnet-$runId-$Role.log"
    $logs["${Role}ErrorLog"] = Join-Path $env:TEMP "countercheck-testnet-$runId-$Role-error.log"
    $process = Start-Process -FilePath $nodePath -ArgumentList ('"' + $scripts[$Role] + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $logs["${Role}Log"] -RedirectStandardError $logs["${Role}ErrorLog"]
    $started[$Role] = $process.Id
    return $process
}

function Wait-LocalJson([System.Diagnostics.Process]$Process, [string]$Url) {
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        $Process.Refresh()
        if ($Process.HasExited) { throw 'A local demo service exited during startup.' }
        try { return Get-LocalJson $Url } catch { Start-Sleep -Milliseconds 500 }
    }
    throw 'A local demo service did not become ready.'
}

foreach ($port in $ports) { if (Test-PortOccupied $port) { throw "Local port $port is already in use. Stop that service before starting this demo." } }
foreach ($name in @('HOST','PORT','CONCORDIUM_NETWORK','PAYMENTS_ENABLED','FACILITATOR_SETTLEMENT_ENABLED','SELLER_RESOURCE_ENABLED','SELLER_CHALLENGE_ONLY','SELLER_RESOURCE_HOST','SELLER_RESOURCE_PORT','SELLER_RESOURCE_URL')) {
    $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

try {
    [Environment]::SetEnvironmentVariable('HOST', '127.0.0.1', 'Process')
    [Environment]::SetEnvironmentVariable('CONCORDIUM_NETWORK', $network, 'Process')
    [Environment]::SetEnvironmentVariable('FACILITATOR_SETTLEMENT_ENABLED', 'true', 'Process')
    [Environment]::SetEnvironmentVariable('SELLER_RESOURCE_ENABLED', 'true', 'Process')
    [Environment]::SetEnvironmentVariable('SELLER_CHALLENGE_ONLY', 'false', 'Process')
    [Environment]::SetEnvironmentVariable('SELLER_RESOURCE_HOST', '127.0.0.1', 'Process')
    [Environment]::SetEnvironmentVariable('SELLER_RESOURCE_PORT', '4191', 'Process')
    [Environment]::SetEnvironmentVariable('SELLER_RESOURCE_URL', 'http://127.0.0.1:4191/resource', 'Process')

    [Environment]::SetEnvironmentVariable('FACILITATOR_HOST', '127.0.0.1', 'Process')
    [Environment]::SetEnvironmentVariable('FACILITATOR_PORT', '4180', 'Process')
    [Environment]::SetEnvironmentVariable('FACILITATOR_STORE_PATH', (Join-Path $env:TEMP 'countercheck-testnet-facilitator-store'), 'Process')
    $facilitator = Start-LocalService 'facilitator'
    $facilitatorHealth = Wait-LocalJson $facilitator 'http://127.0.0.1:4180/healthz'
    if ($facilitatorHealth.ok -ne $true -or $facilitatorHealth.settlementEnabled -ne $true -or $facilitatorHealth.network -ne $network) { throw 'Facilitator health did not confirm enabled Concordium Testnet settlement.' }

    $seller = Start-LocalService 'seller'
    $sellerHealth = Wait-LocalJson $seller 'http://127.0.0.1:4191/healthz'
    if ($sellerHealth.ok -ne $true -or $sellerHealth.settlementEnabled -ne $true -or $sellerHealth.paidFulfillmentAvailable -ne $true -or $sellerHealth.network -ne $network) { throw 'Seller health did not confirm Testnet paid fulfillment.' }

    [Environment]::SetEnvironmentVariable('PORT', '4173', 'Process')
    [Environment]::SetEnvironmentVariable('PAYMENTS_ENABLED', 'true', 'Process')
    $app = Start-LocalService 'app'
    $appStatus = Wait-LocalJson $app 'http://127.0.0.1:4173/api/status'
    if ($appStatus.paymentReady -ne $true -or $appStatus.paymentEnabled -ne $true -or $appStatus.settlementEnabled -ne $true -or $appStatus.network -ne $network) { throw 'Buyer app did not confirm a complete Testnet payment setup.' }
    $quote = Post-LocalJson 'http://127.0.0.1:4173/api/quote' @{}
    if ($quote.status -ne 'quoted' -or $quote.payment.amountMicroCcd -ne '1000000') { throw 'Live Registry and seller quote preflight did not accept the exact 1 CCD Testnet policy.' }
    $review = Post-LocalJson 'http://127.0.0.1:4173/api/prepare' @{ quoteId = $quote.quoteId }
    if ($review.status -ne 'review_ready' -or $review.review.amountMicroCcd -ne '1000000' -or $review.review.network -ne $network) { throw 'Live Testnet unsigned transaction review preflight failed.' }

    $state = [ordered]@{ appPid = $app.Id; sellerPid = $seller.Id; facilitatorPid = $facilitator.Id; appScript = $scripts.app; sellerScript = $scripts.seller; facilitatorScript = $scripts.facilitator }
    foreach ($key in $logs.Keys) { $state[$key] = $logs[$key] }
    $state | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
    Write-Output 'Countercheck full Testnet demo is ready on loopback.'
    Write-Output 'Preflight confirmed a live Registry/quote and a fresh unsigned Testnet transaction review. Nothing was signed or paid during startup.'
    Write-Output 'Open http://127.0.0.1:4173. The workflow shows live badge/quote failures, exact transaction review, approval, and a separate 1 CCD payment action.'
    Write-Output 'The separate payment action signs and broadcasts one 1 CCD Testnet transfer; the configured sponsor pays the network fee.'
    Write-Output 'Stop the services with .\demo\stop-testnet-demo.ps1. No secret values are displayed.'
} catch {
    foreach ($role in @('app','seller','facilitator')) { if ($started.ContainsKey($role)) { Stop-Process -Id $started[$role] -Force -ErrorAction SilentlyContinue } }
    foreach ($path in $logs.Values) { if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue } }
    Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
    throw 'Testnet demo startup failed. No environment values or secret logs were printed; review setup locally.'
} finally {
    foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
}
