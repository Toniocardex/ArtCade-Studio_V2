@echo off
setlocal

:: ---- Environment -----------------------------------------------------------
:: 1) MSVC Build Tools (fornisce nmake come build runner)
call "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1

:: 2) emsdk (fornisce emcc come compilatore — sovrascrive CXX/CC, non nmake)
set EMSDK=C:\Users\Antonio\emsdk
set EMSCRIPTEN=%EMSDK%\upstream\emscripten
set PATH=%EMSDK%;%EMSCRIPTEN%;%EMSDK%\node\22.16.0_64bit\bin;%EMSDK%\python\3.13.3_64bit;%PATH%
set EM_CONFIG=%EMSDK%\.emscripten

:: CMake
set CMAKE_EXE=C:\Program Files\CMake\bin\cmake.exe

cd /d "C:\Users\Antonio\Desktop\ArtCade V2\runtime-cpp"

echo [WASM 1/3] Configurazione CMake...
if exist build-wasm rmdir /s /q build-wasm
mkdir build-wasm

:: emcmake imposta CMAKE_TOOLCHAIN_FILE=Emscripten.cmake + CROSSCOMPILING_EMULATOR=node
call "%EMSCRIPTEN%\emcmake.bat" "%CMAKE_EXE%" ^
    -S . -B build-wasm ^
    -G "NMake Makefiles" ^
    -DCMAKE_BUILD_TYPE=Release ^
    -DCMAKE_POLICY_VERSION_MINIMUM=3.5 ^
    -DPLATFORM=Web ^
    -DARTCADE_BUILD_TESTS=OFF

if %ERRORLEVEL% neq 0 (
    echo [FAIL] Configure fallito: %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

echo [WASM 2/3] Build...
call "%EMSCRIPTEN%\emmake.bat" "%CMAKE_EXE%" --build build-wasm

if %ERRORLEVEL% neq 0 (
    echo [FAIL] Build fallito: %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

echo [WASM 3/3] Verifica output...
set OUTDIR=build-wasm\src\app
dir "%OUTDIR%\game.html" "%OUTDIR%\game.js" "%OUTDIR%\game.wasm" 2>nul
if %ERRORLEVEL% neq 0 (
    echo Cercando in tutto build-wasm...
    dir /s build-wasm\*.wasm 2>nul | findstr ".wasm"
)

echo.
echo [OK] WASM build completato.
echo Per testare: cd %OUTDIR% ^& python -m http.server 8080
echo Poi apri: http://localhost:8080/game.html
exit /b 0
