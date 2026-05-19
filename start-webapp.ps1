# ===========================================================================
# ArtCade V2 — launch the editor web app (Vite dev server) in the browser.
# Run:  powershell -ExecutionPolicy Bypass -File start-webapp.ps1
# (or right-click → Run with PowerShell)
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

Write-Host '[ArtCade] Starting the web editor - the browser will open automatically.'
Write-Host '[ArtCade] Press Ctrl+C to stop the server.'
npm run dev -- --open

Read-Host '[ArtCade] Dev server stopped. Press Enter to close'
