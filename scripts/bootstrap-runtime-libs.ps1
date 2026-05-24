$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$libsDir = Join-Path $repoRoot "runtime-cpp\libs"

New-Item -ItemType Directory -Force -Path $libsDir | Out-Null

function Require-Command($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "$name not found. Install it or add it to PATH, then retry."
    }
}

function Clone-Or-Update($name, $url, $tag) {
    $target = Join-Path $libsDir $name
    if (Test-Path (Join-Path $target ".git")) {
        Write-Host "[libs] $name already exists"
        return
    }

    if (Test-Path $target) {
        Write-Host "[libs] Removing incomplete $name checkout"
        Remove-Item -LiteralPath $target -Recurse -Force
    }

    Write-Host "[libs] Cloning $name $tag"
    git clone --depth 1 --branch $tag $url $target
}

Require-Command git

Clone-Or-Update "raylib" "https://github.com/raysan5/raylib.git" "5.0"
Clone-Or-Update "lua" "https://github.com/lua/lua.git" "v5.4.7"
Clone-Or-Update "sol2" "https://github.com/ThePhD/sol2.git" "v3.5.0"

$jsonHeader = Join-Path $libsDir "nlohmann-json\include\nlohmann\json.hpp"
if (-not (Test-Path $jsonHeader)) {
    Write-Host "[libs] Downloading nlohmann/json 3.11.3 header"
    New-Item -ItemType Directory -Force -Path (Split-Path $jsonHeader) | Out-Null
    Invoke-WebRequest `
        -Uri "https://raw.githubusercontent.com/nlohmann/json/v3.11.3/single_include/nlohmann/json.hpp" `
        -OutFile $jsonHeader `
        -UseBasicParsing
}

$luaCmake = Join-Path $libsDir "lua\CMakeLists.txt"
if (-not (Test-Path $luaCmake)) {
    Write-Host "[libs] Writing Lua CMake target"
    @'
add_library(lua54 STATIC
    lapi.c
    lauxlib.c
    lbaselib.c
    lcode.c
    lcorolib.c
    lctype.c
    ldblib.c
    ldebug.c
    ldo.c
    ldump.c
    lfunc.c
    lgc.c
    linit.c
    liolib.c
    llex.c
    lmathlib.c
    lmem.c
    loadlib.c
    lobject.c
    lopcodes.c
    loslib.c
    lparser.c
    lstate.c
    lstring.c
    lstrlib.c
    ltable.c
    ltablib.c
    ltm.c
    lundump.c
    lutf8lib.c
    lvm.c
    lzio.c
)

target_include_directories(lua54 PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
'@ | Set-Content -Path $luaCmake -Encoding ASCII
}

Write-Host "[libs] Runtime libraries ready in $libsDir"
