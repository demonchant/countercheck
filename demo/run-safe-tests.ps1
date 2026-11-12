#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Push-Location -LiteralPath $projectRoot
$oldPayments = [Environment]::GetEnvironmentVariable('PAYMENTS_ENABLED', 'Process')
$oldSettlement = [Environment]::GetEnvironmentVariable('FACILITATOR_SETTLEMENT_ENABLED', 'Process')
try {
    [Environment]::SetEnvironmentVariable('PAYMENTS_ENABLED', 'false', 'Process')
    [Environment]::SetEnvironmentVariable('FACILITATOR_SETTLEMENT_ENABLED', 'false', 'Process')
    npm run test:all
    if ($LASTEXITCODE -ne 0) { throw "The safe test run failed with exit code $LASTEXITCODE." }
} finally {
    [Environment]::SetEnvironmentVariable('PAYMENTS_ENABLED', $oldPayments, 'Process')
    [Environment]::SetEnvironmentVariable('FACILITATOR_SETTLEMENT_ENABLED', $oldSettlement, 'Process')
    Pop-Location
}
