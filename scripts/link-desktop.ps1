# Creates or updates ArtCade Editor shortcuts on the user Desktop.
# Run from repo root: npm run desktop:link

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$Desktop = [Environment]::GetFolderPath('Desktop')
$Exe = Join-Path $Root 'editor\src-tauri\target\release\artcade-editor.exe'
$DevPs1 = Join-Path $Root 'start-desktop.ps1'
$Wsh = New-Object -ComObject WScript.Shell

function Set-Shortcut(
    [string]$Path,
    [string]$Target,
    [string]$WorkingDir,
    [string]$Description,
    [string]$Arguments = ''
) {
    $sc = $Wsh.CreateShortcut($Path)
    $sc.TargetPath = $Target
    if ($Arguments) { $sc.Arguments = $Arguments }
    $sc.WorkingDirectory = $WorkingDir
    $sc.Description = $Description
    $sc.Save()
}

$devLnk = Join-Path $Desktop 'ArtCade Editor (Dev).lnk'
Set-Shortcut `
    -Path $devLnk `
    -Target 'powershell.exe' `
    -Arguments "-ExecutionPolicy Bypass -NoProfile -File `"$DevPs1`"" `
    -WorkingDir $Root `
    -Description 'ArtCade Studio — desktop editor (Tauri dev, hot reload)'

Write-Host "[OK] $devLnk"

$appLnk = Join-Path $Desktop 'ArtCade Editor.lnk'
if (Test-Path $Exe) {
    Set-Shortcut `
        -Path $appLnk `
        -Target $Exe `
        -WorkingDir (Split-Path $Exe) `
        -Description 'ArtCade Studio — release desktop build (no installer)'
    Write-Host "[OK] $appLnk"
    Write-Host "     -> $Exe"
} else {
    if (Test-Path $appLnk) {
        Remove-Item $appLnk -Force
        Write-Host "[WARN] Removed stale shortcut (exe missing): $appLnk"
    }
    Write-Host "[SKIP] Release exe not found. Build first: npm run desktop:build"
    Write-Host "       Expected: $Exe"
}
