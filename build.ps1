# ArtCade native build wrapper — delegates to runtime-cpp/build_native.bat (Ninja + VsDevCmd).
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
