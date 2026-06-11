param(
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

  & git @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Push-CurrentBranch {
  $remote = if ($env:SKYFALL_AUTO_PUSH_REMOTE) { $env:SKYFALL_AUTO_PUSH_REMOTE } else { "origin" }
  $branch = (& git branch --show-current).Trim()
  if (-not $branch) {
    throw "Cannot push from detached HEAD."
  }

  & git remote get-url $remote *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Remote '$remote' does not exist."
  }

  $upstream = (& git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null)
  if ($LASTEXITCODE -eq 0 -and $upstream) {
    Invoke-Git push
  } else {
    Invoke-Git push -u $remote $branch
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not $Message) {
  $Message = "chore: finish work $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}

Invoke-Git add -A
$pendingChanges = (& git status --porcelain)

if ($pendingChanges) {
  $previousSkip = $env:SKYFALL_SKIP_AUTO_PUSH
  $env:SKYFALL_SKIP_AUTO_PUSH = "1"
  try {
    Invoke-Git commit -m $Message
  } finally {
    if ($null -eq $previousSkip) {
      Remove-Item Env:\SKYFALL_SKIP_AUTO_PUSH -ErrorAction SilentlyContinue
    } else {
      $env:SKYFALL_SKIP_AUTO_PUSH = $previousSkip
    }
  }
} else {
  Write-Host "No changes to commit. Pushing current branch."
}

Push-CurrentBranch
