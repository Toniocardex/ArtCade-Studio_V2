@echo off
REM Runtime Core unit tests (scene gateway, physics sensor, blackboard save/load)
setlocal
set VCVARS="C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
set BUILD_DIR=build-msvc
cd /d "%~dp0"

call %VCVARS%
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

if not exist "%BUILD_DIR%\CMakeCache.txt" (
    cmake -S . -B %BUILD_DIR% -G "NMake Makefiles" -DCMAKE_BUILD_TYPE=Release ^
        -DARTCADE_BUILD_TESTS=ON -DCMAKE_POLICY_VERSION_MINIMUM=3.5
    if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%
)

cmake --build %BUILD_DIR% --target scene_gateway_test physics_test variable_manager_test save_load_test
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

cd %BUILD_DIR%
ctest -C Release -R "scene_gateway_test|physics_test|variable_manager_test|save_load_test" --output-on-failure
set EXIT=%ERRORLEVEL%
cd ..
exit /b %EXIT%
