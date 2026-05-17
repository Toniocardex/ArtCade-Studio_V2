@echo off
REM Native Windows build (MSVC / NMake) -> build-msvc\src\app\game.exe
set VCVARS="C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
set BUILD_DIR=build-msvc

cd /d "%~dp0"

call %VCVARS%
if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] vcvars64 not found
    exit /b %ERRORLEVEL%
)

if not exist "%BUILD_DIR%\CMakeCache.txt" (
    cmake -S . -B %BUILD_DIR% -G "NMake Makefiles" -DCMAKE_BUILD_TYPE=Release
    if %ERRORLEVEL% NEQ 0 (
        echo [FAIL] cmake configure failed
        exit /b %ERRORLEVEL%
    )
)

cmake --build %BUILD_DIR%
if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] build failed
    exit /b %ERRORLEVEL%
)

echo [OK] Native build done.
dir "%BUILD_DIR%\src\app\game.exe"
