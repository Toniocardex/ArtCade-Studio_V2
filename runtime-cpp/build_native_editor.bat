@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ArtCade native RmlUi editor build script (spike).
rem - Mirrors build_native.bat (Ninja + MSVC via VsDevCmd, static /MT).
rem - Enables -DARTCADE_BUILD_NATIVE_EDITOR=ON which fetches RmlUi 6.1 + FreeType
rem   via CMake FetchContent on the first configure (needs network once).
rem - Builds only the artcade-editor-native target; the web editor is untouched.
rem
rem Usage:  build_native_editor.bat [--clean]

set "SCRIPT_DIR=%~dp0"
set "BUILD_DIR=%SCRIPT_DIR%build-native"
set "OUTDIR=%BUILD_DIR%\src\editor-native"
set "DO_CLEAN=0"
if /I "%~1"=="--clean" set "DO_CLEAN=1"

set "NINJA_DIR=%USERPROFILE%\DevTools\ninja"
if exist "%NINJA_DIR%\ninja.exe" set "PATH=%NINJA_DIR%;%PATH%"
set "NINJA_DIR=%LOCALAPPDATA%\ninja"
if exist "%NINJA_DIR%\ninja.exe" set "PATH=%NINJA_DIR%;%PATH%"

set "CMAKE_EXE=cmake"
if exist "%USERPROFILE%\DevTools\cmake\bin\cmake.exe" set "CMAKE_EXE=%USERPROFILE%\DevTools\cmake\bin\cmake.exe"
if exist "C:\Program Files\CMake\bin\cmake.exe" set "CMAKE_EXE=C:\Program Files\CMake\bin\cmake.exe"

if defined ARTCADE_VSDEVCMD (
    set "VSDEVCMD=!ARTCADE_VSDEVCMD!"
) else (
    set "VSDEVCMD=C:\Program Files\Microsoft Visual Studio\18\BuildTools\Common7\Tools\VsDevCmd.bat"
)
if not exist "!VSDEVCMD!" set "VSDEVCMD=C:\Program\Common7\Tools\VsDevCmd.bat"
if not exist "!VSDEVCMD!" set "VSDEVCMD=C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat"
if not exist "!VSDEVCMD!" set "VSDEVCMD=C:\Program Files\Microsoft Visual Studio\2022\Professional\Common7\Tools\VsDevCmd.bat"
if not exist "!VSDEVCMD!" set "VSDEVCMD=C:\Program Files\Microsoft Visual Studio\2022\Enterprise\Common7\Tools\VsDevCmd.bat"
if not exist "!VSDEVCMD!" (
    set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
    if exist "!VSWHERE!" for /f "usebackq tokens=*" %%I in (`"!VSWHERE!" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VSDEVCMD=%%I\Common7\Tools\VsDevCmd.bat"
)
if not exist "!VSDEVCMD!" (
    echo [FAIL] Visual Studio DevCmd not found. Set ARTCADE_VSDEVCMD and retry.
    exit /b 1
)

where ninja >nul 2>&1 || ( echo [FAIL] ninja not found on PATH. & exit /b 1 )

if "!DO_CLEAN!"=="1" if exist "!BUILD_DIR!" (
    echo [editor] removing "!BUILD_DIR!"
    rmdir /s /q "!BUILD_DIR!"
)

echo [editor 1/3] Loading MSVC environment...
call "!VSDEVCMD!" -arch=x64 >nul || ( echo [FAIL] VsDevCmd failed & exit /b 1 )
if defined VCToolsInstallDir if exist "!VCToolsInstallDir!lib\onecore\x64\oldnames.lib" set "LIB=!VCToolsInstallDir!lib\onecore\x64;!LIB!"

pushd "%SCRIPT_DIR%" >nul
echo [editor 2/3] Configuring (Ninja, Release, native editor ON)...
"%CMAKE_EXE%" -S . -B "!BUILD_DIR!" -G Ninja -Wno-dev ^
    -DCMAKE_BUILD_TYPE=Release ^
    -DCMAKE_POLICY_VERSION_MINIMUM=3.5 ^
    -DARTCADE_BUILD_NATIVE_EDITOR=ON
if errorlevel 1 ( popd >nul & echo [FAIL] configure failed. & exit /b 1 )

echo [editor 3/3] Building artcade-editor-native...
"%CMAKE_EXE%" --build "!BUILD_DIR!" --target artcade-editor-native
if errorlevel 1 ( popd >nul & echo [FAIL] build failed. & exit /b 1 )
popd >nul

echo.
if exist "!OUTDIR!\artcade-editor-native.exe" (
    echo [OK] Native editor built: !OUTDIR!\artcade-editor-native.exe
) else (
    echo [WARN] Build reported success but exe not found in !OUTDIR!
)
exit /b 0
