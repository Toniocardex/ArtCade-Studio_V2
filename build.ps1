# ArtCade native C++ runtime — wrapper for runtime-cpp/build_native.bat (Ninja + VsDevCmd).
# Prefer from repo root: npm run build:cpp
# Desktop editor: npm run desktop:dev | desktop:build | desktop:release
param (
    [switch]$Clean,
    [switch]$NoTest,
    [string]$Config = "Debug"
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Bat = Join-Path $Root "runtime-cpp\build_native.bat"

if (-not (Test-Path $Bat)) {
    Write-Host "build_native.bat not found: $Bat" -ForegroundColor Red
    exit 1
}

$batArgs = @()
if ($Clean)   { $batArgs += "--clean" }
if ($NoTest)  { $batArgs += "--no-test" }
$batArgs += "--config", $Config

Write-Host "--- ArtCade native build (Ninja + MSVC) ---" -ForegroundColor Cyan
Write-Host "    Config: $Config" -ForegroundColor DarkGray

& cmd /c "`"$Bat`" $($batArgs -join ' ')"
exit $LASTEXITCODE
