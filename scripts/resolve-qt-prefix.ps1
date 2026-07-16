# Resolves ArtCade Qt 6.8 MSVC prefix (dynamic LGPL kit).
# Preference order:
#   1) ARTCADE_QT_PREFIX env
#   2) .qt-prefix.path in repo root
#   3) Newest C:\Qt\6.8.*\msvc2022_64 that contains Qt6Config.cmake

param(
    [switch]$WriteEnvFile
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

function Test-QtPrefix([string]$prefix) {
    if (-not $prefix) { return $false }
    $cfg = Join-Path $prefix "lib\cmake\Qt6\Qt6Config.cmake"
    return (Test-Path -LiteralPath $cfg)
}

$candidates = @()
if ($env:ARTCADE_QT_PREFIX) {
    $candidates += $env:ARTCADE_QT_PREFIX.Trim()
}

$marker = Join-Path $repoRoot ".qt-prefix.path"
if (Test-Path -LiteralPath $marker) {
    $candidates += (Get-Content -LiteralPath $marker -Raw).Trim()
}

$qtRoot = "C:\Qt"
if (Test-Path -LiteralPath $qtRoot) {
    Get-ChildItem -LiteralPath $qtRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "6.8.*" } |
        Sort-Object { [version]$_.Name } -Descending |
        ForEach-Object {
            $candidates += (Join-Path $_.FullName "msvc2022_64")
        }
}

$resolved = $null
foreach ($c in $candidates) {
    if (Test-QtPrefix $c) {
        $resolved = $c
        break
    }
}

if (-not $resolved) {
    Write-Error @"
Qt 6.8 MSVC kit not found.
Install with:
  powershell -File scripts\install-qt-6.8.ps1
Or set ARTCADE_QT_PREFIX to the kit folder (…\6.8.x\msvc2022_64).
"@
}

if ($WriteEnvFile) {
    Set-Content -LiteralPath $marker -Value $resolved -NoNewline -Encoding utf8
}

Write-Output $resolved
