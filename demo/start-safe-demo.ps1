#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$statePath = Join-Path $env:TEMP 'countercheck-safe-demo-state.json'
$runId = [guid]::NewGuid().ToString('N')
$appScript = Join-Path $projectRoot 'src\server.mjs'
$facilitatorScript = Join-Path $projectRoot 'src\facilitator.mjs'
$nodePath = (Get-Command node -ErrorAction Stop).Source
$network = 'ccd:4221332d34e1694168c2a0c0b3fd0f27'
$appLog = Join-Path $env:TEMP "countercheck-safe-demo-$runId-app.log"
$appErrorLog = Join-Path $env:TEMP "countercheck-safe-demo-$runId-app-error.log"
$facilitatorLog = Join-Path $env:TEMP "countercheck-safe-demo-$runId-facilitator.log"
$facilitatorErrorLog = Join-Path $env:TEMP "countercheck-safe-demo-$runId-facilitator-error.log"
$started = @()
$overrides = [ordered]@{
    HOST = '127.0.0.1'
    PORT = '4173'
    PAYMENTS_ENABLED = 'false'
    CONCORDIUM_NETWORK = $network
    AUDIT_LOG_PATH = (Join-Path $env:TEMP "countercheck-safe-demo-$runId-receipts.jsonl")
    FACILITATOR_HOST = '127.0.0.1'
    FACILITATOR_PORT = '4180'
    FACILITATOR_SETTLEMENT_ENABLED = 'false'
    FACILITATOR_MAX_AMOUNT_MICROCCD = '1000000'
    FACILITATOR_STORE_PATH = (Join-Path $env:TEMP "countercheck-safe-demo-$runId-store")
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
    if ($oldState -and ((Get-Process -Id $oldState.appPid -ErrorAction SilentlyContinue) -or (Get-Process -Id $oldState.facilitatorPid -ErrorAction SilentlyContinue))) {
        throw 'Countercheck demo processes are already recorded. Run .\demo\stop-safe-demo.ps1 first.'
    }
    Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
}

foreach ($port in @(4173, 4180)) {
    if (Test-PortOccupied $port) { throw "Local port $port is already in use. Stop the existing service before starting this demo." }
}

if (!(Test-Path -LiteralPath $appScript) -or !(Test-Path -LiteralPath $facilitatorScript)) { throw 'Countercheck server files were not found.' }

try {
    foreach ($entry in $overrides.GetEnumerator()) {
        $saved[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, 'Process')
        [Environment]::SetEnvironmentVariable($entry.Key, [string]$entry.Value, 'Process')
    }

    $appProcess = Start-Process -FilePath $nodePath -ArgumentList ('"' + $appScript + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $appLog -RedirectStandardError $appErrorLog
    $started += [pscustomobject]@{ Id = $appProcess.Id; Script = $appScript }
    $appStatus = Wait-ForJson $appProcess 'http://127.0.0.1:4173/api/status'
    if ($appStatus.paymentEnabled -ne $false -or $appStatus.network -ne $network) { throw 'The app did not report safe Testnet/payment-off status.' }

    $facilitatorProcess = Start-Process -FilePath $nodePath -ArgumentList ('"' + $facilitatorScript + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $facilitatorLog -RedirectStandardError $facilitatorErrorLog
    $started += [pscustomobject]@{ Id = $facilitatorProcess.Id; Script = $facilitatorScript }
    $health = Wait-ForJson $facilitatorProcess 'http://127.0.0.1:4180/healthz'
    $supported = Get-LocalJson 'http://127.0.0.1:4180/supported'
    $kind = @($supported.kinds | Where-Object { $_.x402Version -eq 2 -and $_.scheme -eq 'exact' -and $_.network -eq $network }) | Select-Object -First 1
    if ($health.ok -ne $true -or $health.settlementEnabled -ne $false -or $health.network -ne $network) { throw 'Facilitator health did not confirm Testnet with settlement disabled.' }
    if (!$kind) { throw 'Facilitator does not report x402 v2 exact support for Concordium Testnet.' }

    [pscustomobject]@{ appPid = $appProcess.Id; facilitatorPid = $facilitatorProcess.Id; appScript = $appScript; facilitatorScript = $facilitatorScript; appLog = $appLog; appErrorLog = $appErrorLog; facilitatorLog = $facilitatorLog; facilitatorErrorLog = $facilitatorErrorLog } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
    Write-Output 'Countercheck safe demo is ready.'
    Write-Output "App: http://127.0.0.1:4173 | network=$network | paymentEnabled=false"
    Write-Output "Facilitator: http://127.0.0.1:4180 | health=ok | settlementEnabled=false"
    Write-Output "Supported scheme: x402 v$($kind.x402Version) $($kind.scheme) on Concordium Testnet"
    Write-Output 'Only GET status/health/supported calls were made. No payment payload was verified or settled.'
    Write-Output 'Stop with .\demo\stop-safe-demo.ps1. Startup logs remain under TEMP and are not printed.'
} catch {
    foreach ($process in $started) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
    Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
    throw 'Safe demo startup failed. No environment values or secret logs were printed; review local setup privately.'
} finally {
    foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
}
