@echo off
setlocal EnableExtensions

rem Launch the native RmlUi editor from its build output (so it finds the copied
rem resources/ directory). Build it first with build_native_editor.bat.
rem
rem Usage:  run_native_editor.bat [extra args passed to the editor]

set "SCRIPT_DIR=%~dp0"
set "OUTDIR=%SCRIPT_DIR%build-native\src\editor-native"
set "EXE=%OUTDIR%\artcade-editor-native.exe"

if not exist "%EXE%" (
    echo [FAIL] %EXE% not found. Run build_native_editor.bat first.
    exit /b 1
)

pushd "%OUTDIR%" >nul
"%EXE%" %*
set "RC=%errorlevel%"
popd >nul
exit /b %RC%
