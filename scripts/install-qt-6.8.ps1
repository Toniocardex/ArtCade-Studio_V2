# Installs Qt 6.8 LTS (Community) for ArtCade via aqtinstall.
# Target: C:\Qt\<version>\msvc2022_64  (dynamic LGPL DLLs — see docs/qt-migration/qt-lgpl-compliance.md)
# Does NOT install GPL-only modules (e.g. qtquick3d).

param(
    [string]$OutputDir = "C:\Qt",
    [string]$VersionSpec = "6.8",
    [string]$Arch = "win64_msvc2022_64"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "Installing aqtinstall..."
py -3 -m pip install -U aqtinstall
if ($LASTEXITCODE -ne 0) {
    python -m pip install -U aqtinstall
    if ($LASTEXITCODE -ne 0) { throw "pip install aqtinstall failed" }
}

function Invoke-Aqt {
    param([string[]]$AqtArgs)
    Write-Host "aqt $($AqtArgs -join ' ')"
    py -3 -m aqt @AqtArgs
    if ($LASTEXITCODE -ne 0) {
        python -m aqt @AqtArgs
        if ($LASTEXITCODE -ne 0) { throw "aqt failed: $($AqtArgs -join ' ')" }
    }
}

Write-Host "Resolving latest Qt $VersionSpec for windows desktop..."
$listOut = & py -3 -m aqt list-qt windows desktop 2>&1
if ($LASTEXITCODE -ne 0) {
    $listOut = & python -m aqt list-qt windows desktop 2>&1
}
Write-Host $listOut

# Prefer explicit newest 6.8.x if list contains versions; else SimpleSpec "6.8"
$versions = @()
foreach ($line in ($listOut | Out-String) -split "[\s`r`n]+") {
    if ($line -match '^6\.8\.\d+$') { $versions += $line }
}
$version = $null
if ($versions.Count -gt 0) {
    $version = ($versions | Sort-Object { [version]$_ } -Descending | Select-Object -First 1)
} else {
    $version = $VersionSpec
}

Write-Host "Selected Qt version: $version / $Arch"
Write-Host "Output: $OutputDir"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Invoke-Aqt @(
    "install-qt", "windows", "desktop", $version, $Arch,
    "-O", $OutputDir,
    "--timeout", "600"
)

# aqt layout: OutputDir/<version>/msvc2022_64
$kitName = if ($Arch -eq "win64_msvc2022_64") { "msvc2022_64" } else { $Arch }
$prefix = Join-Path (Join-Path $OutputDir $version) $kitName
$cfg = Join-Path $prefix "lib\cmake\Qt6\Qt6Config.cmake"
if (-not (Test-Path -LiteralPath $cfg)) {
    throw "Install finished but Qt6Config.cmake missing at $cfg"
}

Set-Content -LiteralPath (Join-Path $repoRoot ".qt-prefix.path") -Value $prefix -NoNewline -Encoding utf8
Write-Host "Wrote .qt-prefix.path -> $prefix"
Write-Host "CMAKE_PREFIX_PATH=$prefix"
Write-Host "Done."
