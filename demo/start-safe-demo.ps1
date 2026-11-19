#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$statePath = Join-Path $env:TEMP 'countercheck-safe-demo-state.json'
$runId = [guid]::NewGuid().ToString('N')
$appScript = Join-Path $projectRoot 'src\server.mjs'
$sellerScript = Join-Path $projectRoot 'src\seller-resource.mjs'
$nodePath = (Get-Command node -ErrorAction Stop).Source
$network = 'ccd:4221332d34e1694168c2a0c0b3fd0f27'
$appLog = Join-Path $env:TEMP "countercheck-safe-demo-$runId-app.log"
$appErrorLog = Join-Path $env:TEMP "countercheck-safe-demo-$runId-app-error.log"
$sellerLog = Join-Path $env:TEMP "countercheck-safe-demo-$runId-seller.log"
$sellerErrorLog = Join-Path $env:TEMP "countercheck-safe-demo-$runId-seller-error.log"
$started = @()
$overrides = [ordered]@{
    HOST = '127.0.0.1'
    PORT = '4173'
    PAYMENTS_ENABLED = 'false'
    CONCORDIUM_NETWORK = $network
    SELLER_RESOURCE_URL = 'http://127.0.0.1:4191/resource'
    CCD_PRIVATE_KEY = ''
    CCD_FACILITATOR_PRIVATE_KEY = ''
    FACILITATOR_API_TOKEN = ''
    BUYER_API_TOKEN = ''
    AUDIT_LOG_PATH = (Join-Path $env:TEMP "countercheck-safe-demo-$runId-receipts.jsonl")
    SELLER_RESOURCE_ENABLED = 'true'
    SELLER_RESOURCE_HOST = '127.0.0.1'
    SELLER_RESOURCE_PORT = '4191'
    SELLER_CHALLENGE_ONLY = 'true'
    FACILITATOR_SETTLEMENT_ENABLED = 'false'
}
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
    $request.Timeout = 1500
    $request.ReadWriteTimeout = 1500
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

function Wait-ForJson([System.Diagnostics.Process]$Process, [string]$Url) {
    for ($attempt = 0; $attempt -lt 24; $attempt++) {
        $Process.Refresh()
        if ($Process.HasExited) { throw 'A local demo service exited during startup.' }
        try { return (Get-LocalJson $Url) } catch { Start-Sleep -Milliseconds 500 }
    }
    throw 'A local demo service did not become ready in time.'
}

if (Test-Path -LiteralPath $statePath) {
    $oldState = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
    $oldAppPid = if ($oldState.PSObject.Properties['appPid']) { $oldState.appPid } else { 0 }
    $oldSellerPid = if ($oldState.PSObject.Properties['sellerPid']) { $oldState.sellerPid } else { 0 }
    $oldFacilitatorPid = if ($oldState.PSObject.Properties['facilitatorPid']) { $oldState.facilitatorPid } else { 0 }
    if ($oldState -and ((Get-Process -Id $oldAppPid -ErrorAction SilentlyContinue) -or (Get-Process -Id $oldSellerPid -ErrorAction SilentlyContinue) -or (Get-Process -Id $oldFacilitatorPid -ErrorAction SilentlyContinue))) {
        throw 'Countercheck demo processes are already recorded. Run .\demo\stop-safe-demo.ps1 first.'
    }
    Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
}

foreach ($port in @(4173, 4191)) {
    if (Test-PortOccupied $port) { throw "Local port $port is already in use. Stop the existing service before starting this demo." }
}

if (!(Test-Path -LiteralPath $appScript) -or !(Test-Path -LiteralPath $sellerScript)) { throw 'Countercheck server files were not found.' }

try {
    foreach ($entry in $overrides.GetEnumerator()) {
        $saved[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, 'Process')
        [Environment]::SetEnvironmentVariable($entry.Key, [string]$entry.Value, 'Process')
    }

    $appProcess = Start-Process -FilePath $nodePath -ArgumentList ('"' + $appScript + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $appLog -RedirectStandardError $appErrorLog
    $started += [pscustomobject]@{ Id = $appProcess.Id; Script = $appScript }
    $appStatus = Wait-ForJson $appProcess 'http://127.0.0.1:4173/api/status'
    if ($appStatus.paymentEnabled -ne $false -or $appStatus.network -ne $network) { throw 'The app did not report safe Testnet/payment-off status.' }

    $sellerProcess = Start-Process -FilePath $nodePath -ArgumentList ('"' + $sellerScript + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $sellerLog -RedirectStandardError $sellerErrorLog
    $started += [pscustomobject]@{ Id = $sellerProcess.Id; Script = $sellerScript }
    $sellerHealth = Wait-ForJson $sellerProcess 'http://127.0.0.1:4191/healthz'
    if ($sellerHealth.ok -ne $true -or $sellerHealth.settlementEnabled -ne $false -or $sellerHealth.paidFulfillmentAvailable -ne $false -or $sellerHealth.network -ne $network) {
        throw 'Seller health did not confirm Testnet challenge-only mode.'
    }
    $challengeRequest = [System.Net.HttpWebRequest]::Create('http://127.0.0.1:4191/resource')
    $challengeRequest.Method = 'GET'
    $challengeRequest.Accept = 'application/json'
    $challengeRequest.Timeout = 3000
    try { $challengeResponse = $challengeRequest.GetResponse() }
    catch [System.Net.WebException] { $challengeResponse = $_.Exception.Response }
    if (!$challengeResponse) { throw 'The local seller did not return an HTTP response.' }
    try {
        $challengeHeader = $challengeResponse.Headers['PAYMENT-REQUIRED']
        if (!$challengeHeader) { $challengeHeader = $challengeResponse.Headers['X-PAYMENT-REQUIRED'] }
        if ([int]$challengeResponse.StatusCode -ne 402 -or !$challengeHeader) { throw 'The local seller did not return an x402 HTTP 402 challenge.' }
    } finally { $challengeResponse.Dispose() }

    [pscustomobject]@{ appPid = $appProcess.Id; sellerPid = $sellerProcess.Id; appScript = $appScript; sellerScript = $sellerScript; appLog = $appLog; appErrorLog = $appErrorLog; sellerLog = $sellerLog; sellerErrorLog = $sellerErrorLog } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
    Write-Output 'Countercheck safe demo is ready.'
    Write-Output "App: http://127.0.0.1:4173 | network=$network | paymentEnabled=false"
    Write-Output 'Seller: http://127.0.0.1:4191/resource | x402 HTTP 402 challenge confirmed | challenge-only=true'
    Write-Output 'Only local GET requests were made. No payment payload was verified or settled.'
    Write-Output 'Stop with .\demo\stop-safe-demo.ps1. Logs remain under TEMP and are not printed.'
    Write-Output 'Buyer/sponsor signing keys and API bearer tokens were blanked in both demo processes.'
} catch {
    foreach ($process in $started) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
    Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
    throw 'Safe demo startup failed. No environment values or secret logs were printed; review local setup privately.'
} finally {
    foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
}
