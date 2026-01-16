# Install TradeBlocks skills for Claude Code, Codex CLI, or Gemini CLI (Windows)
# Usage: .\install.ps1 <platform>
# Platforms: claude, codex, gemini, all

param(
    [Parameter(Position=0)]
    [ValidateSet("claude", "codex", "gemini", "all")]
    [string]$Platform
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Skills = @(
    "tradeblocks-health-check",
    "tradeblocks-wfa",
    "tradeblocks-risk",
    "tradeblocks-compare",
    "tradeblocks-portfolio",
    "tradeblocks-optimize"
)

function Show-Usage {
    Write-Host "Usage: .\install.ps1 <platform>"
    Write-Host ""
    Write-Host "Platforms:"
    Write-Host "  claude    Install to ~\.claude\skills\"
    Write-Host "  codex     Install to ~\.codex\skills\"
    Write-Host "  gemini    Install to ~\.gemini\skills\"
    Write-Host "  all       Install to all platforms"
    Write-Host ""
    Write-Host "Example:"
    Write-Host "  .\install.ps1 claude"
    exit 1
}

function Install-Skills {
    param([string]$PlatformName)

    $TargetDir = Join-Path $env:USERPROFILE ".$PlatformName\skills"

    Write-Host "Installing skills to $TargetDir..."

    if (-not (Test-Path $TargetDir)) {
        New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    }

    foreach ($Skill in $Skills) {
        $Source = Join-Path $ScriptDir $Skill
        $Target = Join-Path $TargetDir $Skill

        if (Test-Path $Target) {
            Write-Host "  Updating: $Skill"
            Remove-Item -Recurse -Force $Target
        } else {
            Write-Host "  Installing: $Skill"
        }

        Copy-Item -Recurse $Source $Target
    }

    Write-Host ""
    Write-Host "Done! Verify with: Get-ChildItem $TargetDir"
}

if (-not $Platform) {
    Show-Usage
}

switch ($Platform) {
    "all" {
        Install-Skills "claude"
        Install-Skills "codex"
        Install-Skills "gemini"
    }
    default {
        Install-Skills $Platform
    }
}
