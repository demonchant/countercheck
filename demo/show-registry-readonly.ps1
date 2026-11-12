#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Use the same Node fetch path as Countercheck. Windows PowerShell's .NET
# HttpWebRequest returned ReceiveFailure in this environment while Node fetch
# successfully reached the official hosted Registry through the configured proxy.
& node (Join-Path $PSScriptRoot 'show-registry-readonly.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Read-only Node Registry inspection failed.' }
