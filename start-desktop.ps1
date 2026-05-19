# ===========================================================================
# ArtCade V2 — launch the DESKTOP app in dev mode (Tauri + Vite).
# Run:  powershell -ExecutionPolicy Bypass -File start-desktop.ps1
# (or right-click → Run with PowerShell). Native window with hot-reload.
# ===========================================================================
Set-Location -Path (Join-Path $PSScriptRoot 'editor')

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host '[ArtCade] Node.js / npm not found. Install Node.js LTS from https://nodejs.org'
    Read-Host 'Press Enter to close'; exit 1
}

if (-not (Test-Path 'node_modules')) {
    Write-Host '[ArtCade] Installing dependencies (first run)...'
    npm install
    if ($LASTEXITCODE -ne 0) { Read-Host '[ArtCade] npm install failed. Press Enter'; exit 1 }
}

Write-Host '[ArtCade] Starting the desktop editor (Tauri dev). First run'
Write-Host '[ArtCade] compiles Rust and may take a few minutes.'
npm run tauri:dev

Read-Host '[ArtCade] Desktop dev session stopped. Press Enter to close'
