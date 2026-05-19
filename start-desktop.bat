@echo off
rem ===========================================================================
rem ArtCade V2 — launch the DESKTOP app in dev mode (Tauri + Vite).
rem Double-click this file instead of typing "npm run tauri:dev".
rem Opens the native window with hot-reload (no .exe build needed).
rem ===========================================================================
setlocal EnableExtensions
cd /d "%~dp0editor" || (echo [ArtCade] editor\ folder not found next to this script. & pause & exit /b 1)

set "NPM_CMD=npm"
where npm >nul 2>&1 || set "NPM_CMD="
if not defined NPM_CMD if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPM_CMD (
    echo [ArtCade] Node.js / npm not found in PATH.
    echo [ArtCade] Install Node.js LTS from https://nodejs.org and retry.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [ArtCade] Installing dependencies (first run)...
    call "%NPM_CMD%" install
    if errorlevel 1 (echo [ArtCade] npm install failed. & pause & exit /b 1)
)

echo [ArtCade] Starting the desktop editor (Tauri dev). First run compiles
echo [ArtCade] Rust and may take a few minutes. Close the window to stop.
echo.
call "%NPM_CMD%" run tauri:dev

echo.
echo [ArtCade] The desktop dev session has stopped.
pause
