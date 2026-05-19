@echo off
rem ===========================================================================
rem ArtCade V2 — launch the editor web app (Vite dev server) in the browser.
rem Double-click this file instead of typing "npm run dev".
rem ===========================================================================
setlocal
cd /d "%~dp0editor"

if not exist "node_modules" (
    echo [ArtCade] Installing dependencies (first run)...
    call npm install || goto :fail
)

echo [ArtCade] Starting the web editor — the browser will open automatically.
echo [ArtCade] Close this window (or press Ctrl+C) to stop the server.
call npm run dev -- --open
goto :eof

:fail
echo.
echo [ArtCade] Setup failed. Make sure Node.js / npm are installed.
pause
