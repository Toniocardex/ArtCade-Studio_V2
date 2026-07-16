# Deploy Qt DLLs next to artcade-editor-qt.exe and launch it (LGPL dynamic linking).
# Usage:
#   powershell -File scripts\run-artcade-editor-qt.ps1
#   powershell -File scripts\run-artcade-editor-qt.ps1 -DeployOnly

param(
    [switch]$DeployOnly,
    [string]$Config = "Release",
    [string]$QtPrefix = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

if (-not $QtPrefix) {
    $marker = Join-Path $repoRoot ".qt-prefix.path"
    if (Test-Path $marker) {
        $QtPrefix = (Get-Content -LiteralPath $marker -Raw).Trim()
    } else {
        $QtPrefix = "C:\Qt\6.8.3\msvc2022_64"
    }
}

# Multi-config (VS) puts the exe under Release/; single-config (Ninja) does not.
$exeRelease = Join-Path $repoRoot "build-qt\src\qt\$Config\artcade-editor-qt.exe"
$exeNinja = Join-Path $repoRoot "build-qt\src\qt\artcade-editor-qt.exe"
$exe = if (Test-Path -LiteralPath $exeRelease) {
    $exeRelease
} elseif (Test-Path -LiteralPath $exeNinja) {
    $exeNinja
} else {
    $exeRelease
}
$windeploy = Join-Path $QtPrefix "bin\windeployqt.exe"
$qmlDir = Join-Path $repoRoot "qml"

if (-not (Test-Path -LiteralPath $exe)) {
    throw "Executable not found: $exeRelease (or $exeNinja) — build with ARTCADE_BUILD_QT_EDITOR=ON first."
}
if (-not (Test-Path -LiteralPath $windeploy)) {
    throw "windeployqt not found: $windeploy"
}

Write-Host "windeployqt -> $exe"
$modeFlag = if ($Config -eq "Debug") { "--debug" } else { "--release" }
& $windeploy --qmldir $qmlDir $modeFlag $exe
if ($LASTEXITCODE -ne 0) {
    throw "windeployqt failed with exit $LASTEXITCODE"
}

if ($DeployOnly) {
    Write-Host "Deploy only — done."
    exit 0
}

Write-Host "Launching $exe"
Start-Process -FilePath $exe -WorkingDirectory (Split-Path $exe)
