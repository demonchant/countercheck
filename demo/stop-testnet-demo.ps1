#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$statePath = Join-Path $env:TEMP 'countercheck-testnet-demo-state.json'
if (!(Test-Path -LiteralPath $statePath)) { Write-Output 'No Countercheck Testnet demo process record exists.'; exit 0 }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json -ErrorAction Stop
$targets = @()
foreach ($role in @('app','seller','facilitator')) {
    $pidName = "${role}Pid"
    $scriptName = "${role}Script"
    if ($state.PSObject.Properties[$pidName] -and $state.PSObject.Properties[$scriptName]) {
        $targets += [pscustomobject]@{ Id = [int]$state.$pidName; Script = [string]$state.$scriptName }
    }
}
foreach ($target in $targets) {
    $expectedScript = [System.IO.Path]::GetFullPath($target.Script)
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($target.Id)" -ErrorAction SilentlyContinue
    if ($process -and $process.Name -match '^node(\.exe)?$' -and $process.CommandLine.IndexOf($expectedScript, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        Stop-Process -Id $target.Id -Force -ErrorAction SilentlyContinue
        Write-Output "Stopped Countercheck Testnet demo process $($target.Id)."
    }
}
foreach ($name in @('appLog','appErrorLog','sellerLog','sellerErrorLog','facilitatorLog','facilitatorErrorLog')) {
    $path = if ($state.PSObject.Properties[$name]) { [string]$state.$name } else { '' }
    if ($path -and (Test-Path -LiteralPath $path)) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue }
}
Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
Write-Output 'Temporary service logs and process record were removed.'
