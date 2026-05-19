@echo off
rem ArtCade V2 - launch the web editor (Vite dev) in the browser.
if not "%~1"=="_run" (
  start "ArtCade Web" cmd /k ""%~f0" _run"
  exit /b
)
setlocal EnableExtensions
cd /d "%~dp0editor"
if errorlevel 1 ( echo [ArtCade] editor folder not found next to this script. & goto :done )
set "NPMC="
where npm >nul 2>&1 && set "NPMC=npm"
if not defined NPMC if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPMC=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPMC ( echo [ArtCade] Node.js/npm not found. Install Node LTS from https://nodejs.org & goto :done )
if not exist "node_modules" ( echo [ArtCade] Installing dependencies, first run... & call "%NPMC%" install )
echo [ArtCade] Starting Vite dev server, the browser will open...
call "%NPMC%" run dev -- --open
:done
echo.
echo [ArtCade] Stopped. This window stays open - read any message above.