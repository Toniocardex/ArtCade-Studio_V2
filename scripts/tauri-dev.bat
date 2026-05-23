@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem Launch Tauri dev with MSVC link.exe on PATH (required for Rust on Windows).
set "ROOT=%~dp0.."
set "VSDEVCMD=C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\Tools\VsDevCmd.bat"
if not exist "!VSDEVCMD!" set "VSDEVCMD=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat"
if not exist "!VSDEVCMD!" (
    echo [FAIL] Visual Studio Build Tools not found. Install "Desktop development with C++".
    exit /b 1
)

echo [ArtCade] Loading MSVC environment...
call "!VSDEVCMD!" -arch=x64 >nul
if errorlevel 1 (
    echo [FAIL] VsDevCmd failed: !VSDEVCMD!
    exit /b 1
)

rem Same onecore\x64 CRT workaround as runtime-cpp/build_native.bat
for /D %%V in ("C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Tools\MSVC\*") do (
    if exist "%%V\lib\onecore\x64\oldnames.lib" (
        set "LIB=%%V\lib\onecore\x64;!LIB!"
    )
)
for /D %%V in ("C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\*") do (
    if exist "%%V\lib\onecore\x64\oldnames.lib" (
        set "LIB=%%V\lib\onecore\x64;!LIB!"
    )
)

pushd "%ROOT%\editor" >nul
npm run tauri:dev
set "EXIT_CODE=!ERRORLEVEL!"
popd >nul
exit /b !EXIT_CODE!
