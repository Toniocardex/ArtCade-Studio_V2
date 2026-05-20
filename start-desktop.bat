@echo off
rem ArtCade V2 - launch the DESKTOP app in dev mode (Tauri + Vite).
if not "%~1"=="_run" (
  start "ArtCade Desktop" cmd /k ""%~f0" _run"
  exit /b
)
setlocal EnableExtensions
set "ROOT=%~dp0"
cd /d "%ROOT%"
if errorlevel 1 ( echo [ArtCade] project root not found. & goto :done )
set "NPMC="
where npm >nul 2>&1 && set "NPMC=npm"
if not defined NPMC if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPMC=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPMC ( echo [ArtCade] Node.js/npm not found. Install Node LTS from https://nodejs.org & goto :done )
rem npm workspace: deps hoist to the ROOT node_modules, not editor\node_modules.
if not exist "%ROOT%node_modules\vite" ( echo [ArtCade] Installing dependencies, first run... & call "%NPMC%" install )
cd /d "%ROOT%editor"
echo [ArtCade] Starting Tauri dev, first run compiles Rust, can take minutes...
call "%NPMC%" run tauri:dev
:done
echo.
echo [ArtCade] Stopped. This window stays open - read any message above.
