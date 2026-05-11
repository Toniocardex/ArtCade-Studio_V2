# ArtCade V2: Quick Start Guide

## Prerequisites

- **CMake** 3.20+ (https://cmake.org/)
- **C++ Compiler**:
  - Windows: MSVC 2019+ or MinGW
  - macOS: Clang (Xcode)
  - Linux: GCC or Clang
- **Git** (https://git-scm.com/)
- **Emscripten SDK** (for WASM builds) (https://emscripten.org/)

## Step 1: Clone & Initialize

```bash
cd C:\Users\Antonio\Desktop\ArtCade\ V2
git init
git config user.name "Antonio"
git config user.email "Antonino.cardelli@outlook.it"
```

## Step 2: Setup Third-Party Libraries

```bash
cd runtime-cpp/libs

# Download Raylib (if not already present)
git clone https://github.com/raysan5/raylib.git raylib

# Download Lua 5.4
git clone https://github.com/lua/lua.git lua

# Download Sol2 (header-only, just clone)
git clone https://github.com/ThePhD/sol2.git sol2

# Box2D 2.4: scaricato automaticamente da CMake (FetchContent) nel modulo physics;
# non serve clonarlo in libs/.
```

## Step 3: Build for Native (Windows)

```bash
cd C:\Users\Antonio\Desktop\ArtCade\ V2\runtime-cpp
mkdir build && cd build

# MSVC (Visual Studio 2022)
cmake .. -G "Visual Studio 17 2022" -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release

# Output: Release/game.exe
./Release/game.exe
```

## Step 4: Build for WASM (Emscripten)

```bash
cd C:\Users\Antonio\Desktop\ArtCade\ V2\runtime-cpp\build

# Setup Emscripten
# On Windows: emcmdprompt.bat (comes with emsdk)
# Or: source emsdk/emsdk_env.sh (Linux/macOS)

emcmake cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build .

# Output: game.js, game.wasm
```

## Step 5: Test Your Build

### Native Test
```bash
# Create a minimal game.artcade (or use dev folder)
# Run game.exe
cd Release
./game.exe
```

### WASM Test
```bash
# Serve WASM output locally
cd build
python -m http.server 8000
# Open http://localhost:8000 in browser
```

## File Organization for Development

### During Development (loose assets)

```
project-root/
├── assets-dev/
│   ├── game.json
│   ├── project.json
│   ├── sprites/
│   │   └── player.png
│   ├── audio/
│   │   └── jump.ogg
│   └── scripts/
│       └── main.luac
```

### For Distribution (packed .artcade)

```bash
./scripts/pack-artcade.sh assets-dev/ MyGame.artcade
```

## Common Commands

### Rebuild Everything

```bash
cd runtime-cpp/build
cmake --build . --config Release --clean-first
```

### Clean Build Artifacts

```bash
cd runtime-cpp
rm -rf build
mkdir build && cd build
cmake ..
```

### Run with Debug Symbols

```bash
cmake .. -DCMAKE_BUILD_TYPE=Debug
cmake --build . --config Debug
```

## Troubleshooting

### CMake Not Found
- Install CMake from https://cmake.org/download/
- Add to PATH

### MSVC Not Found
- Install Visual Studio Community (MSVC toolset required)
- Run cmake from "Developer Command Prompt for VS"

### Emscripten Not Installed
```bash
# Download emsdk
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest

# On Windows, use: emsdk.bat instead of ./emsdk
```

### Raylib Link Errors
- Ensure `raylib` folder exists in `libs/`
- CMakeLists.txt should auto-find it via `add_subdirectory(libs/raylib)`

## Next: Implementation

Refer to `ARCHITECTURE_DUAL_RUNTIME.md` for detailed specs on each system.

Start with:
1. **renderer.cpp** — Raylib window creation
2. **input.cpp** — Keyboard polling
3. **physics.cpp** — Box2D setup
4. **lua-host.cpp** — Lua VM initialization

Good luck! 🚀
