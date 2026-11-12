Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$sourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoUrl = 'https://github.com/demonchant/countercheck.git'
$repoName = 'demonchant/countercheck'
$workTree = Join-Path $env:TEMP ('countercheck-project-push-' + [guid]::NewGuid().ToString('N'))
$excludedDirectories = @(
    '.git', 'node_modules', 'docs', 'data', 'dist', 'coverage', 'artifacts',
    'test-results', 'playwright-report', '.playwright', 'wallets', 'video_work'
)
$excludedRootFiles = @(
    'AGENTS.md', 'HACKATHON_START.md', 'MASTER_PROMPT.md',
    'HACKATHON_BUILD_STANDARD_V2.md', 'HACKATHON_REBUILD_PLAYBOOK.md'
)

gh auth status *> $null
if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI is not authenticated in this PowerShell session. Run gh auth login first.' }
gh auth setup-git *> $null
if ($LASTEXITCODE -ne 0) { throw 'Git could not be configured to use GitHub CLI authentication.' }

$branch = (gh api "repos/$repoName" --jq '.default_branch') -join ''
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) { throw 'Could not read the repository default branch.' }
$branch = $branch.Trim()

$remoteRefs = @(git ls-remote --heads $repoUrl)
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect remote branches.' }
$branchPattern = "\srefs/heads/$([regex]::Escape($branch))$"
if (-not [bool]($remoteRefs | Where-Object { $_ -match $branchPattern })) {
    throw "Remote default branch '$branch' is missing. Refusing to create or overwrite a branch."
}

git clone --single-branch --branch $branch $repoUrl $workTree
if ($LASTEXITCODE -ne 0) { throw 'Clone failed; nothing was pushed.' }

$files = @(Get-ChildItem -LiteralPath $sourceRoot -File -Recurse -Force | Where-Object {
    $relative = $_.FullName.Substring($sourceRoot.Length).TrimStart('\', '/').Replace('\', '/')
    $parts = $relative.Split('/')
    if ($parts | Where-Object { $excludedDirectories -contains $_ }) { return $false }
    if ($parts.Count -eq 1 -and $excludedRootFiles -contains $parts[0]) { return $false }
    if ($relative -match '(^|/)\.env($|\.)' -and $relative -ne '.env.example') { return $false }
    if ($relative -match '(^|/)(\.npm-cache|\.cache)(/|$)' -or $relative -match '\.(pem|key|log)$') { return $false }
    if ($_.Extension.ToLowerInvariant() -in @('.mp4', '.mov', '.webm', '.mkv', '.avi', '.mp3', '.wav', '.m4a')) { return $false }
    return $true
} | Sort-Object FullName)

if ($files.Count -eq 0) { throw 'No project files remained after excluding secrets, dependencies, generated documents and build artifacts.' }

$toAdd = @()
foreach ($file in $files) {
    $relative = $file.FullName.Substring($sourceRoot.Length).TrimStart('\', '/')
    $target = Join-Path $workTree $relative
    if (Test-Path -LiteralPath $target) {
        $extension = [System.IO.Path]::GetExtension($relative).ToLowerInvariant()
        $textExtensions = @('.json', '.md', '.txt', '.js', '.mjs', '.html', '.css', '.ps1', '.yaml', '.yml')
        if ($textExtensions -contains $extension -or @('.gitignore', 'LICENSE', 'Dockerfile') -contains [System.IO.Path]::GetFileName($relative)) {
            $localContent = [System.IO.File]::ReadAllText($file.FullName).Replace("`r`n", "`n").Replace("`r", "`n")
            $remoteContent = [System.IO.File]::ReadAllText($target).Replace("`r`n", "`n").Replace("`r", "`n")
            $same = $localContent -ceq $remoteContent
        } else {
            $localHash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
            $remoteHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
            $same = $localHash -eq $remoteHash
        }
        if (-not $same) {
            throw "Remote file differs from the local project; refusing to overwrite: $relative"
        }
    } else {
        $directory = Split-Path -Parent $target
        if (!(Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
        Copy-Item -LiteralPath $file.FullName -Destination $target
        $toAdd += $relative
    }
}

if ($toAdd.Count -gt 0) {
    git -C $workTree add -- $toAdd
    if ($LASTEXITCODE -ne 0) { throw 'Could not stage project files.' }
    git -C $workTree diff --cached --check
    if ($LASTEXITCODE -ne 0) { throw 'Staged diff check failed.' }
} else {
    Write-Output 'Every included local project file already matches GitHub; no commit is needed.'
}

Write-Output "`nFiles to publish on '$branch' (generated docs, secrets, dependencies and build artifacts excluded):"
if ($toAdd.Count -gt 0) { git -C $workTree diff --cached --name-only }
Write-Output "`nStaged summary:"
git -C $workTree diff --cached --stat
if ($LASTEXITCODE -ne 0) { throw 'Could not summarize staged changes.' }

$confirmation = Read-Host "Type PUSH to publish these project files to $repoUrl on branch '$branch'"
if ($confirmation -cne 'PUSH') { Write-Output 'Stopped. Nothing was pushed.'; exit 0 }

if ($toAdd.Count -gt 0) {
    $githubIdentity = (gh api user --jq '[.id, .login] | @tsv') -join ''
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($githubIdentity)) { throw 'Could not read the authenticated GitHub username for commit attribution.' }
    $profileParts = $githubIdentity.Trim() -split "`t"
    $commitName = $profileParts[1]
    $commitEmail = "$($profileParts[0])+$commitName@users.noreply.github.com"
    git -C $workTree -c "user.name=$commitName" -c "user.email=$commitEmail" commit -m 'Publish Countercheck project and browser checks'
    if ($LASTEXITCODE -ne 0) { throw 'Commit failed; nothing was pushed.' }
}

git -C $workTree push origin $branch
if ($LASTEXITCODE -ne 0) { throw 'Push failed. No force push was attempted.' }

$head = (git -C $workTree rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Push completed but the local revision could not be read.' }
$remoteHeadLine = git -C $workTree ls-remote origin "refs/heads/$branch"
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($remoteHeadLine -join ''))) { throw 'Push command completed, but GitHub branch read-back failed.' }
$remoteHead = (($remoteHeadLine -join '').Trim() -split '\s+')[0]
if ($remoteHead -ne $head) { throw "GitHub branch read-back differs from the pushed revision. Local=$head Remote=$remoteHead" }
Write-Output "Verified published revision $head at https://github.com/$repoName/tree/$branch"
