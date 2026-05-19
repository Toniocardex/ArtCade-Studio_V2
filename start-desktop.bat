@echo off
rem ===========================================================================
rem ArtCade V2 — launch the DESKTOP app in dev mode (Tauri + Vite).
rem Double-click this file instead of typing "npm run tauri:dev".
rem Opens the native window with hot-reload (no .exe build needed).
rem ===========================================================================
setlocal
cd /d "%~dp0editor"

if not exist "node_modules" (
    echo [ArtCade] Installing dependencies (first run)...
    call npm install || goto :fail
)

echo [ArtCade] Starting the desktop editor (Tauri dev). First run compiles
echo [ArtCade] Rust and may take a few minutes. Close the window to stop.
call npm run tauri:dev
goto :eof

:fail
echo.
echo [ArtCade] Setup failed. Ensure Node.js/npm and the Rust toolchain are installed.
pause
