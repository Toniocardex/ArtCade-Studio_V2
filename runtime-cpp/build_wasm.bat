@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ArtCade WASM build script.
rem - Loads MSVC build tools for nmake.
rem - Loads Emscripten from EMSDK.
rem - Configures/builds runtime-cpp/build-wasm.
rem - Copies game.js/game.wasm/game.data to editor/public/runtime.

set "SCRIPT_DIR=%~dp0"
set "BUILD_DIR=%SCRIPT_DIR%build-wasm"
set "OUTDIR=%BUILD_DIR%\src\app"
set "EDITOR_RUNTIME=%SCRIPT_DIR%..\editor\public\runtime"

if "%EMSDK%"=="" set "EMSDK=C:\Users\Antonio\emsdk"
set "EMSCRIPTEN=%EMSDK%\upstream\emscripten"

set "VSDEV_CMD=C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\Tools\VsDevCmd.bat"
set "CMAKE_EXE=cmake"
if exist "C:\Program Files\CMake\bin\cmake.exe" set "CMAKE_EXE=C:\Program Files\CMake\bin\cmake.exe"

if /I "%~1"=="--clean" (
    echo [WASM] Removing "%BUILD_DIR%"
    if exist "%BUILD_DIR%" rmdir /s /q "%BUILD_DIR%"
)

if not exist "%VSDEV_CMD%" (
    echo [FAIL] Visual Studio DevCmd not found:
    echo        !VSDEV_CMD!
    exit /b 1
)

if not exist "%EMSCRIPTEN%\emcmake.bat" (
    echo [FAIL] Emscripten not found. Expected:
    echo        !EMSCRIPTEN!\emcmake.bat
    echo        Set EMSDK to your emsdk root and retry.
    exit /b 1
)

if not exist "%EMSDK%\emsdk_env.bat" (
    echo [FAIL] emsdk_env.bat not found:
    echo        !EMSDK!\emsdk_env.bat
    exit /b 1
)

echo [WASM 1/5] Loading MSVC build environment...
call "%VSDEV_CMD%" -arch=x64 >nul
if errorlevel 1 (
    echo [FAIL] Visual Studio environment setup failed.
    exit /b 1
)

echo [WASM 2/5] Loading Emscripten environment...
set "EMSDK_QUIET=1"
call "%EMSDK%\emsdk_env.bat" >nul
if errorlevel 1 (
    echo [FAIL] Emscripten environment setup failed.
    exit /b 1
)

pushd "%SCRIPT_DIR%" >nul

echo [WASM 3/5] Configuring CMake...
call "%EMSCRIPTEN%\emcmake.bat" "%CMAKE_EXE%" ^
    -S . ^
    -B "%BUILD_DIR%" ^
    -G "NMake Makefiles" ^
    -Wno-dev ^
    -DCMAKE_BUILD_TYPE=Release ^
    -DCMAKE_POLICY_VERSION_MINIMUM=3.5 ^
    -DPLATFORM=Web ^
    -DARTCADE_BUILD_TESTS=OFF
if errorlevel 1 (
    popd >nul
    echo [FAIL] CMake configure failed.
    exit /b 1
)

rem Emscripten does not always track --preload-file inputs as build deps.
rem Remove generated app outputs so game.data is repacked when scripts/assets change.
if exist "%OUTDIR%\game.html" del /q "%OUTDIR%\game.html"
if exist "%OUTDIR%\game.js"   del /q "%OUTDIR%\game.js"
if exist "%OUTDIR%\game.wasm" del /q "%OUTDIR%\game.wasm"
if exist "%OUTDIR%\game.data" del /q "%OUTDIR%\game.data"

echo [WASM 4/5] Building runtime...
call "%EMSCRIPTEN%\emmake.bat" "%CMAKE_EXE%" --build "%BUILD_DIR%" --config Release
if errorlevel 1 (
    popd >nul
    echo [FAIL] WASM build failed.
    exit /b 1
)

echo [WASM 5/5] Copying preview runtime assets...
if not exist "%OUTDIR%\game.js" (
    popd >nul
    echo [FAIL] Missing output: !OUTDIR!\game.js
    exit /b 1
)
if not exist "%OUTDIR%\game.wasm" (
    popd >nul
    echo [FAIL] Missing output: !OUTDIR!\game.wasm
    exit /b 1
)
if not exist "%OUTDIR%\game.data" (
    popd >nul
    echo [FAIL] Missing output: !OUTDIR!\game.data
    exit /b 1
)

if not exist "%EDITOR_RUNTIME%" mkdir "%EDITOR_RUNTIME%"
copy /y "%OUTDIR%\game.js" "%EDITOR_RUNTIME%\game.js" >nul
copy /y "%OUTDIR%\game.wasm" "%EDITOR_RUNTIME%\game.wasm" >nul
copy /y "%OUTDIR%\game.data" "%EDITOR_RUNTIME%\game.data" >nul
if errorlevel 1 (
    popd >nul
    echo [FAIL] Failed to copy runtime assets to:
    echo        !EDITOR_RUNTIME!
    exit /b 1
)

echo.
echo [OK] WASM runtime updated:
for %%F in ("%EDITOR_RUNTIME%\game.js" "%EDITOR_RUNTIME%\game.wasm" "%EDITOR_RUNTIME%\game.data") do (
    echo        %%~nxF  %%~zF bytes
)

popd >nul
exit /b 0
