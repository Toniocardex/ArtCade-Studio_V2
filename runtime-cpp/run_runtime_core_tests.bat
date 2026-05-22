@echo off
REM Runtime Core unit tests (scene gateway, physics sensor, blackboard save/load)
setlocal EnableExtensions
cd /d "%~dp0"

call build_native.bat --config Release --no-test
if errorlevel 1 exit /b %errorlevel%

ctest --test-dir build-native -C Release -R "scene_gateway_test|physics_test|variable_manager_test|save_load_test" --output-on-failure
exit /b %errorlevel%
