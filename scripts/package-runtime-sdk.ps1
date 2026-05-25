# Packages runtime-cpp + pack script into Tauri resources for on-demand SDK install.
# Run before `tauri build` (via npm run package:sdk).

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$runtimeSrc = Join-Path $repoRoot "runtime-cpp"
$resourcesDir = Join-Path $repoRoot "editor\src-tauri\resources"
$toolsDir = Join-Path $resourcesDir "tools"
$scriptsDir = Join-Path $resourcesDir "scripts"
$zipPath = Join-Path $resourcesDir "runtime-cpp-sdk.zip"

New-Item -ItemType Directory -Force -Path $toolsDir, $scriptsDir | Out-Null

Write-Host "[package-sdk] Staging runtime-cpp sources…"

$stage = Join-Path $env:TEMP "artcade-runtime-sdk-stage"
if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

$runtimeStage = Join-Path $stage "runtime-cpp"
New-Item -ItemType Directory -Force -Path $runtimeStage | Out-Null

$copyItems = @(
    "CMakeLists.txt",
    "build_native.bat",
    "build_wasm.bat",
    "src",
    "tools",
    "test-project"
)
foreach ($item in $copyItems) {
    $src = Join-Path $runtimeSrc $item
    if (Test-Path $src) {
        Copy-Item -LiteralPath $src -Destination (Join-Path $runtimeStage $item) -Recurse -Force
    }
}

if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path (Join-Path $stage "runtime-cpp") -DestinationPath $zipPath -Force

Copy-Item -LiteralPath (Join-Path $runtimeSrc "tools\pack-artcade.py") `
    -Destination (Join-Path $toolsDir "pack-artcade.py") -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "scripts\bootstrap-artcade-sdk.ps1") `
    -Destination (Join-Path $scriptsDir "bootstrap-artcade-sdk.ps1") -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "scripts\bootstrap-runtime-libs.ps1") `
    -Destination (Join-Path $scriptsDir "bootstrap-runtime-libs.ps1") -Force

$sizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "[package-sdk] OK $zipPath ($sizeMb MB)"
Write-Host "[package-sdk] Resources ready in $resourcesDir"
