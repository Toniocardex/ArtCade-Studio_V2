# ArtCade on-demand SDK installer — extracts bundled runtime-cpp, portable CMake/Ninja,
# embeddable Python, and optionally Emscripten into %LOCALAPPDATA%\ArtCade\sdk.
param(
    [Parameter(Mandatory = $true)][string]$SdkRoot,
    [Parameter(Mandatory = $true)][string]$ResourceDir,
    [string]$IncludeEmscripten = "false",
    [string]$DevRepoRoot = ""
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "[SDK] $msg" }

function Ensure-Dir($path) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
}

function Download-File($url, $dest) {
    Write-Step "Downloading $(Split-Path $dest -Leaf)…"
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
}

function Expand-Zip($zip, $dest) {
    Ensure-Dir $dest
    Expand-Archive -LiteralPath $zip -DestinationPath $dest -Force
}

Ensure-Dir $SdkRoot
$toolsRoot = Join-Path $SdkRoot "tools"
Ensure-Dir $toolsRoot

# ── 1. Runtime C++ sources (from installer resources or dev zip) ─────────────
$zipCandidates = @(
    (Join-Path $ResourceDir "runtime-cpp-sdk.zip"),
    (Join-Path $ResourceDir "resources\runtime-cpp-sdk.zip")
)
$runtimeZip = $zipCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$runtimeDir = Join-Path $SdkRoot "runtime-cpp"

if (-not (Test-Path (Join-Path $runtimeDir "build_native.bat"))) {
    if (-not $runtimeZip -and $DevRepoRoot -ne "" -and (Test-Path (Join-Path $DevRepoRoot "runtime-cpp\build_native.bat"))) {
        Write-Step "Copying runtime-cpp from dev checkout…"
        if (Test-Path $runtimeDir) { Remove-Item -LiteralPath $runtimeDir -Recurse -Force }
        Copy-Item -LiteralPath (Join-Path $DevRepoRoot "runtime-cpp") -Destination $runtimeDir -Recurse -Force
    } elseif (-not $runtimeZip) {
        throw "runtime-cpp-sdk.zip not found in $ResourceDir"
    } else {
    Write-Step "Extracting runtime-cpp SDK…"
    $extractTemp = Join-Path $env:TEMP "artcade-runtime-cpp-extract"
    if (Test-Path $extractTemp) { Remove-Item -LiteralPath $extractTemp -Recurse -Force }
    Expand-Zip $runtimeZip $extractTemp
    $extracted = Get-ChildItem -LiteralPath $extractTemp -Directory | Select-Object -First 1
    if (-not $extracted) { throw "Invalid runtime-cpp-sdk.zip layout" }
    if (Test-Path $runtimeDir) { Remove-Item -LiteralPath $runtimeDir -Recurse -Force }
    Move-Item -LiteralPath $extracted.FullName -Destination $runtimeDir
    Write-Step "Runtime sources → $runtimeDir"
    }
} else {
    Write-Step "Runtime SDK already present"
}

# ── 2. C++ third-party libs (Raylib, Lua, Sol2, json) ───────────────────────
$libsDir = Join-Path $runtimeDir "libs"
$bootstrapLibs = Join-Path $PSScriptRoot "bootstrap-runtime-libs.ps1"
if (-not (Test-Path $bootstrapLibs)) {
    $bootstrapLibs = Join-Path (Split-Path $PSScriptRoot -Parent) "..\scripts\bootstrap-runtime-libs.ps1"
    $bootstrapLibs = (Resolve-Path $bootstrapLibs -ErrorAction SilentlyContinue).Path
}
if (-not (Test-Path (Join-Path $libsDir "raylib\.git"))) {
    Write-Step "Fetching C++ runtime libraries (first install may take a few minutes)…"
    if (-not (Test-Path $bootstrapLibs)) {
        throw "bootstrap-runtime-libs.ps1 not found near $PSScriptRoot"
    }
    & powershell -NoProfile -ExecutionPolicy Bypass -File $bootstrapLibs -LibsDir $libsDir
    if ($LASTEXITCODE -ne 0) { throw "bootstrap-runtime-libs failed" }
}

# ── 3. Portable Ninja ────────────────────────────────────────────────────────
$ninjaExe = Join-Path $toolsRoot "ninja\ninja.exe"
if (-not (Test-Path $ninjaExe)) {
    $ninjaZip = Join-Path $env:TEMP "ninja-win.zip"
    Download-File "https://github.com/ninja-build/ninja/releases/download/v1.13.2/ninja-win.zip" $ninjaZip
    Expand-Zip $ninjaZip (Join-Path $toolsRoot "ninja")
    Write-Step "Ninja → $ninjaExe"
} else {
    Write-Step "Ninja already installed"
}

# ── 4. Portable CMake ────────────────────────────────────────────────────────
$cmakeExe = Join-Path $toolsRoot "cmake\bin\cmake.exe"
if (-not (Test-Path $cmakeExe)) {
    $cmakeZip = Join-Path $env:TEMP "cmake-portable.zip"
    $cmakeUrl = "https://github.com/Kitware/CMake/releases/download/v3.31.6/cmake-3.31.6-windows-x86_64.zip"
    Download-File $cmakeUrl $cmakeZip
    $cmakeExtract = Join-Path $env:TEMP "cmake-portable-extract"
    if (Test-Path $cmakeExtract) { Remove-Item -LiteralPath $cmakeExtract -Recurse -Force }
    Expand-Zip $cmakeZip $cmakeExtract
    $cmakeFolder = Get-ChildItem -LiteralPath $cmakeExtract -Directory | Where-Object { $_.Name -like "cmake-*" } | Select-Object -First 1
    if (-not $cmakeFolder) { throw "CMake portable extract failed" }
    if (Test-Path (Join-Path $toolsRoot "cmake")) { Remove-Item -LiteralPath (Join-Path $toolsRoot "cmake") -Recurse -Force }
    Move-Item -LiteralPath $cmakeFolder.FullName -Destination (Join-Path $toolsRoot "cmake")
    Write-Step "CMake → $cmakeExe"
} else {
    Write-Step "CMake already installed"
}

# ── 5. Embeddable Python (export .artcade) ───────────────────────────────────
$pythonExe = Join-Path $SdkRoot "python\python.exe"
if (-not (Test-Path $pythonExe)) {
    $pyZip = Join-Path $env:TEMP "python-embed.zip"
    $pyUrl = "https://www.python.org/ftp/python/3.14.0/python-3.14.0-embed-amd64.zip"
    Download-File $pyUrl $pyZip
    Expand-Zip $pyZip (Join-Path $SdkRoot "python")
    Write-Step "Python embeddable → $pythonExe"
} else {
    Write-Step "Python already installed"
}

# ── 6. Optional Emscripten SDK (~1 GB download) ─────────────────────────────
if ($IncludeEmscripten -eq "true") {
    $emsdkRoot = Join-Path $SdkRoot "emsdk"
    if (-not (Test-Path (Join-Path $emsdkRoot "emsdk_env.bat"))) {
        Write-Step "Installing Emscripten SDK (large download, please wait)…"
        if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
            throw "Git is required to install Emscripten. Install Git and retry with Emscripten option."
        }
        if (Test-Path $emsdkRoot) { Remove-Item -LiteralPath $emsdkRoot -Recurse -Force }
        git clone https://github.com/emscripten-core/emsdk.git $emsdkRoot
        Push-Location $emsdkRoot
        try {
            & .\emsdk install latest
            & .\emsdk activate latest
        } finally {
            Pop-Location
        }
        Write-Step "Emscripten → $emsdkRoot"
    } else {
        Write-Step "Emscripten already installed"
    }
}

Write-Step "SDK ready at $SdkRoot"
Write-Step "Note: native builds still require Visual Studio Build Tools (Desktop C++)."
Write-Step "      Install from https://visualstudio.microsoft.com/visual-cpp-build-tools/"
