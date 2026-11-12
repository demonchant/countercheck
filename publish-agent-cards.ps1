$ErrorActionPreference = "Stop"

$sourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoUrl = "https://github.com/demonchant/countercheck.git"
$repoName = "demonchant/countercheck"
$workTree = Join-Path $env:TEMP ("countercheck-card-publish-" + [guid]::NewGuid().ToString("N"))
$paths = @(
    "agent-cards/countercheck-buyer-1147.json",
    "agent-cards/countercheck-seller-1146.json"
)

gh auth status *> $null
if ($LASTEXITCODE -ne 0) { throw "GitHub CLI is not authenticated in this PowerShell session." }
gh auth setup-git *> $null
if ($LASTEXITCODE -ne 0) { throw "Git could not be configured to use GitHub CLI authentication." }

$branch = (gh api "repos/$repoName" --jq ".default_branch") -join ""
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
    throw "Could not read the GitHub repository default branch."
}
$branch = $branch.Trim()

$remoteRefs = @(git ls-remote --heads $repoUrl)
if ($LASTEXITCODE -ne 0) { throw "Could not inspect remote branches." }
$branchPattern = "\srefs/heads/$([regex]::Escape($branch))$"
$hasDefaultBranch = [bool]($remoteRefs | Where-Object { $_ -match $branchPattern })

if ($hasDefaultBranch) {
    git clone --single-branch --branch $branch $repoUrl $workTree
    if ($LASTEXITCODE -ne 0) { throw "Clone failed; nothing was pushed." }
}
elseif ($remoteRefs.Count -eq 0) {
    New-Item -ItemType Directory -Path $workTree | Out-Null
    git -C $workTree init -b $branch
    if ($LASTEXITCODE -ne 0) { throw "Could not initialize the empty repository branch." }
    git -C $workTree remote add origin $repoUrl
    if ($LASTEXITCODE -ne 0) { throw "Could not configure the repository remote." }
}
else {
    throw "The default branch '$branch' was not found among remote branches; refusing to push to a different branch."
}

$toCommit = @()
foreach ($relativePath in $paths) {
    $sourceFile = Join-Path $sourceRoot $relativePath
    $targetFile = Join-Path $workTree $relativePath
    if (!(Test-Path -LiteralPath $sourceFile)) { throw "Local card is missing: $relativePath" }
    $null = Get-Content -LiteralPath $sourceFile -Raw | ConvertFrom-Json -ErrorAction Stop

    if (Test-Path -LiteralPath $targetFile) {
        $sourceHash = (Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash
        $targetHash = (Get-FileHash -LiteralPath $targetFile -Algorithm SHA256).Hash
        if ($sourceHash -ne $targetHash) {
            throw "Remote file has different contents; refusing to overwrite: $relativePath"
        }
    }
    else {
        $toCommit += $relativePath
    }
}

foreach ($relativePath in $toCommit) {
    $targetFile = Join-Path $workTree $relativePath
    New-Item -ItemType Directory -Path (Split-Path -Parent $targetFile) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $sourceRoot $relativePath) -Destination $targetFile
}

if ($toCommit.Count -gt 0) {
    git -C $workTree add -- $toCommit
    if ($LASTEXITCODE -ne 0) { throw "Could not stage the card files." }
    git -C $workTree diff --cached --check
    if ($LASTEXITCODE -ne 0) { throw "Staged diff check failed." }
    git -C $workTree diff --cached --name-only
    git -C $workTree commit -m "Publish Concordium Agent Cards"
    if ($LASTEXITCODE -ne 0) { throw "Commit failed; nothing was pushed." }
    git -C $workTree push --set-upstream origin $branch
    if ($LASTEXITCODE -ne 0) { throw "Push failed. No force push was attempted." }
}
else {
    Write-Output "Both remote card files already match the local files; no commit was needed."
}

foreach ($relativePath in $paths) {
    $url = "https://raw.githubusercontent.com/$repoName/$branch/$relativePath"
    $downloadFile = Join-Path $env:TEMP ("countercheck-card-check-" + [guid]::NewGuid().ToString("N") + ".json")
    $request = [System.Net.HttpWebRequest]::Create($url)
    $request.Method = "GET"
    $response = $request.GetResponse()
    try {
        $status = [int]$response.StatusCode
        $inputStream = $response.GetResponseStream()
        $outputStream = [System.IO.File]::Create($downloadFile)
        try { $inputStream.CopyTo($outputStream) }
        finally { $outputStream.Dispose(); $inputStream.Dispose() }
    }
    finally { $response.Dispose() }
    if ($status -ne 200) { throw "Download check failed for $url (HTTP $status)." }

    $null = Get-Content -LiteralPath $downloadFile -Raw | ConvertFrom-Json -ErrorAction Stop
    $localHash = (Get-FileHash -LiteralPath (Join-Path $sourceRoot $relativePath) -Algorithm SHA256).Hash.ToLowerInvariant()
    $downloadHash = (Get-FileHash -LiteralPath $downloadFile -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($localHash -ne $downloadHash) { throw "Downloaded card hash differs from local file: $relativePath" }

    [pscustomobject]@{
        URL = $url
        HTTPStatus = $status
        JSONValid = $true
        LocalSHA256 = $localHash
        DownloadSHA256 = $downloadHash
        HashesMatch = $true
    }
}
