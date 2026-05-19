@echo off
rem ===========================================================================
rem ArtCade V2 — launch the editor web app (Vite dev server) in the browser.
rem Double-click this file instead of typing "npm run dev".
rem ===========================================================================
setlocal EnableExtensions
cd /d "%~dp0editor" || (echo [ArtCade] editor\ folder not found next to this script. & pause & exit /b 1)

rem Resolve npm (Explorer-launched .bat sometimes lacks a full PATH).
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
    echo [ArtCade] Installing dependencies (first run, this can take a while)...
    call "%NPM_CMD%" install
    if errorlevel 1 (echo [ArtCade] npm install failed. & pause & exit /b 1)
)

echo [ArtCade] Starting the web editor - the browser will open automatically.
echo [ArtCade] Close this window (or press Ctrl+C) to stop the server.
echo.
call "%NPM_CMD%" run dev -- --open

echo.
echo [ArtCade] The dev server has stopped.
pause
