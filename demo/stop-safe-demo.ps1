#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$statePath = Join-Path $env:TEMP 'countercheck-safe-demo-state.json'
if (!(Test-Path -LiteralPath $statePath)) { Write-Output 'No Countercheck safe-demo process record exists.'; exit 0 }

$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json -ErrorAction Stop
$targets = @(
    [pscustomobject]@{ Id = [int]$state.appPid; Script = [string]$state.appScript },
    [pscustomobject]@{ Id = [int]$state.facilitatorPid; Script = [string]$state.facilitatorScript }
)
$rootPrefix = [System.IO.Path]::GetFullPath($projectRoot)
foreach ($target in $targets) {
    $expectedScript = [System.IO.Path]::GetFullPath($target.Script)
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($target.Id)" -ErrorAction SilentlyContinue
    if ($process -and $process.Name -match '^node(\.exe)?$' -and $expectedScript.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and $process.CommandLine.IndexOf($expectedScript, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        Stop-Process -Id $target.Id -Force -ErrorAction SilentlyContinue
        Write-Output "Stopped Countercheck demo process $($target.Id)."
    }
}

foreach ($logPath in @($state.appLog, $state.appErrorLog, $state.facilitatorLog, $state.facilitatorErrorLog)) {
    if ($logPath -and (Test-Path -LiteralPath $logPath)) { Remove-Item -LiteralPath $logPath -Force -ErrorAction SilentlyContinue }
}
Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
Write-Output 'Temporary demo logs and process record were removed.'
