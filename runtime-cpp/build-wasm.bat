@echo off
set EMSDK_DIR=C:\Users\Antonio\emsdk
set NINJA_DIR=C:\Users\Antonio\AppData\Local\ninja
set BUILD_DIR=build-wasm

set PATH=%NINJA_DIR%;%EMSDK_DIR%\upstream\bin;%EMSDK_DIR%\upstream\emscripten;%PATH%

cd /d "%~dp0"

call %EMSDK_DIR%\upstream\emscripten\emcmake.bat cmake . -B %BUILD_DIR% -G Ninja -DPLATFORM=Web -DCMAKE_POLICY_VERSION_MINIMUM=3.5 -DARTCADE_BUILD_TESTS=OFF -DARTCADE_BUILD_SMOKE_TESTS=ON

if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] cmake configure failed
    exit /b %ERRORLEVEL%
)

echo [OK] Configure done. Building...

cmake --build %BUILD_DIR% -- -j4

if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] build failed
    exit /b %ERRORLEVEL%
)

echo [OK] Build done!
dir %BUILD_DIR%\smoke-tests\ 2>nul
