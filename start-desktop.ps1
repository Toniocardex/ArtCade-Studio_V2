# ===========================================================================
# ArtCade V2 — launch the DESKTOP app in dev mode (Tauri + Vite).
# Run:  powershell -ExecutionPolicy Bypass -File start-desktop.ps1
# (or right-click → Run with PowerShell). Native window with hot-reload.
# ===========================================================================
$ErrorActionPreference = 'Stop'
Set-Location -Path (Join-Path $PSScriptRoot 'editor')

if (-not (Test-Path 'node_modules')) {
    Write-Host '[ArtCade] Installing dependencies (first run)...'
    npm install
    if ($LASTEXITCODE -ne 0) { Write-Host '[ArtCade] npm install failed.'; Read-Host 'Press Enter'; exit 1 }
}

Write-Host '[ArtCade] Starting the desktop editor (Tauri dev). First run'
Write-Host '[ArtCade] compiles Rust and may take a few minutes.'
npm run tauri:dev
