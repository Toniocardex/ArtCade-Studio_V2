# Artcade Build & Test Automation Script
param (
    [switch]$Clean,        # Rimuove la cartella build prima di iniziare
    [switch]$NoTest,       # Salta l'esecuzione dei test
    [string]$Config = "Debug" # Configurazione (Debug o Release)
)

$BuildDir = "build"

# 1. Pulizia (opzionale)
if ($Clean -and (Test-Path $BuildDir)) {
    Write-Host "--- Cleaning build directory... ---" -ForegroundColor Yellow
    Remove-Item -Recurse -Force $BuildDir
}

if (!(Test-Path $BuildDir)) {
    New-Item -ItemType Directory -Path $BuildDir
}

cd $BuildDir

# 2. Configurazione CMake
Write-Host "--- Configuring CMake ($Config) ---" -ForegroundColor Cyan
# Qui abilitiamo i test e le future dipendenze della Fase 4
cmake .. -DCMAKE_BUILD_TYPE=$Config -DARTCADE_BUILD_TESTS=ON

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Configuration failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}

# 3. Compilazione
Write-Host "--- Building Artcade Engine ---" -ForegroundColor Cyan
cmake --build . --config $Config

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}

# 4. Esecuzione Test (se non disabilitati)
if (-not $NoTest) {
    Write-Host "--- Running Tests ---" -ForegroundColor Green
    ctest -C $Config --output-on-failure
}

cd ..
Write-Host "--- Build Process Completed Successfully! ---" -ForegroundColor Magenta