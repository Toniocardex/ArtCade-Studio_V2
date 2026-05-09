@echo off
setlocal

:: Setup MSVC environment
call "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1

:: Working directory
cd /d "C:\Users\Antonio\Desktop\ArtCade V2\runtime-cpp"

echo [1/3] CMake configure...
if exist build-phase4 rmdir /s /q build-phase4
mkdir build-phase4
cmake -S . -B build-phase4 -G "NMake Makefiles" -DCMAKE_BUILD_TYPE=Release -DARTCADE_BUILD_TESTS=ON -DCMAKE_POLICY_VERSION_MINIMUM=3.5
if %ERRORLEVEL% neq 0 (
    echo [FAIL] CMake configure failed: %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

echo [2/3] Build...
cmake --build build-phase4 --parallel
if %ERRORLEVEL% neq 0 (
    echo [FAIL] Build failed: %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

echo [3/3] Test...
cd build-phase4
ctest --output-on-failure -C Release
set CTEST_EXIT=%ERRORLEVEL%
cd ..

echo BUILD_COMPLETE=%CTEST_EXIT%
exit /b %CTEST_EXIT%
