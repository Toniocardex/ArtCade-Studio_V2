@echo off
setlocal EnableExtensions
set "ROOT=%~dp0.."

call :rmdir_if_exist "%ROOT%\runtime-cpp\build-native"
call :rmdir_if_exist "%ROOT%\runtime-cpp\build-wasm"
call :rmdir_if_exist "%ROOT%\runtime-cpp\build-msvc"
call :rmdir_if_exist "%ROOT%\runtime-cpp\build-nmake"
call :rmdir_if_exist "%ROOT%\runtime-cpp\build"
call :rmdir_if_exist "%ROOT%\build"
call :rmdir_if_exist "%ROOT%\build-nmake"
call :rmdir_if_exist "%ROOT%\editor\dist"

echo [OK] Build output directories removed.
exit /b 0

:rmdir_if_exist
if exist "%~1" rmdir /s /q "%~1"
exit /b 0
