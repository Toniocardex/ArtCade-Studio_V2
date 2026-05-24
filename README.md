# ArtCade V2

**Dual-Runtime 2D Game Engine**: TypeScript Editor + C++ Native Runtime + WebAssembly

## Vision

ArtCade V2 is a complete redesign focused on **solid software architecture** with two execution targets:

1. **Native Runtime** (C++ + Raylib) → Windows/macOS/Linux executables
2. **Web Runtime** (C++ compiled to WASM via Emscripten) → Browser + Tauri preview

Same codebase, compiled twice, deterministic Lua scripting logic.

## Architecture

```
Editor (React + Tauri)
    ↓ (.artcade project file)
    ├─→ C++ Runtime (Windows .exe)
    ├─→ WASM Runtime (Browser via Emscripten)
    └─→ Tauri Preview (WASM in WebView)
```

## Project Structure

```
ArtCade V2/
├── editor/              # React TypeScript editor + Tauri
│   ├── src/             # panels, store, wasm-bridge, CodeMirror iframe
│   ├── public/runtime/  # game.js + game.wasm (preview; .wasm gitignored)
│   └── package.json
│
├── runtime-cpp/         # C++ game engine (dual-compile)
│   ├── src/modules/     # renderer, physics, lua-runtime, editor-api, …
│   ├── test-project/    # Demo project (project.json, scripts)
│   ├── build_wasm.bat   # WASM → editor/public/runtime/
│   ├── CMakeLists.txt
│   └── build-*/         # CMake output (gitignored)
│
├── docs/                # Architecture & design (see docs/README.md)
├── scripts/             # Windows helpers (clean, tauri-dev)
├── UI/                  # Design mockups (reference PNGs)
├── start-desktop.ps1    # Launch Tauri dev (alternative entry)
├── start-webapp.ps1     # Launch Vite dev in browser
├── CLAUDE.md            # Development guidelines
├── .gitignore
└── CMakeLists.txt       # Root build config
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Editor UI** | React 19 + TailwindCSS + TypeScript | Logic Board, inspector, timeline |
| **Editor Bridge** | Tauri (Rust) | File I/O, system integration, preview |
| **Game Engine** | C++ (C++17) | Core game loop, deterministic |
| **Graphics** | Raylib (C) | 2D rendering (native + WASM) |
| **Physics** | Box2D 2.4 (C++) | 2D collisions, rigid bodies |
| **Scripting** | Lua 5.4 + Sol2 | Game logic (bytecode compiled) |
| **Audio** | Raylib Audio (OpenAL) | Sound, music |
| **Build (Native)** | CMake + MSVC/GCC/Clang | Windows/Linux/macOS .exe |
| **Build (Web)** | Emscripten | C++ → .wasm/.js |
| **Distribution** | .artcade (ZIP) | Project package (scripts + assets) |

## Documentation

- **Index (all docs):** [docs/README.md](docs/README.md)
- **Artist-friendly component principle:** [docs/ARTIST_FRIENDLY_COMPONENTS.md](docs/ARTIST_FRIENDLY_COMPONENTS.md)
- **Engine integration roadmap:** [docs/ENGINE_INTEGRATION_ROADMAP.md](docs/ENGINE_INTEGRATION_ROADMAP.md)
- **Splash screen & Free/Pro licenses (editor + export + runtime):** [docs/GUIDA_INTEGRAZIONE_SPLASH_LICENZE.md](docs/GUIDA_INTEGRAZIONE_SPLASH_LICENZE.md)
- **End-to-end integration:** [docs/ARCHITECTURE_INTEGRATION.md](docs/ARCHITECTURE_INTEGRATION.md)
- **Global logic & UI (sensors, platformer feel, world UI, text juice):** [docs/GLOBAL_LOGIC_UI_ARCHITECTURE.md](docs/GLOBAL_LOGIC_UI_ARCHITECTURE.md)

## Getting Started

### Prerequisites (Windows)

| Tool | Purpose | Notes |
|------|---------|-------|
| **Git** | Clone/pull/push repository | `git` on PATH |
| **Node.js LTS** | Editor, Vite, npm scripts | `node`, `npm` on PATH |
| **Python 3.14+** | Icon tooling, `.artcade` packer, Tauri build commands | `python` on PATH |
| **Rust (rustup)** | Tauri shell | `%USERPROFILE%\.cargo\bin` on PATH |
| **VS Build Tools 2026** | MSVC linker (`link.exe`) for Rust + C++ native | Workload: *Desktop development with C++* |
| **CMake** | C++ configure/build | e.g. `C:\Program Files\CMake\bin` |
| **Ninja** | CMake generator | Used by both native and WASM scripts |
| **Emscripten SDK** | C++ → WASM | Set `EMSDK` (default in scripts: `C:\Users\Antonio\emsdk`) |

PowerShell may block `npm.ps1` until you run once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

First-time dependency install (npm workspace — deps hoist to repo root):

```powershell
cd "C:\Users\Antonio\Desktop\ArtCade V2"
npm install
```

### Clean Windows reinstall checklist

Use this section after a PC format or a fresh Windows install.

1. Install core tools and make sure they are on `PATH`:
   - Git
   - Node.js LTS
   - Python 3.14+
   - Rust via `rustup`
   - Visual Studio Build Tools 2026 (or VS 2022 fallback) with **Desktop development with C++**
   - CMake
   - Ninja
   - Emscripten SDK

2. Clone the repository:

```powershell
cd "$env:USERPROFILE\Desktop"
git clone https://github.com/Toniocardex/ArtCade-Studio_V2.git "ArtCade V2"
cd "ArtCade V2"
```

3. Configure Emscripten. The scripts default to `C:\Users\Antonio\emsdk`;
   if you install it elsewhere, set `EMSDK`:

```powershell
[Environment]::SetEnvironmentVariable("EMSDK", "C:\Users\Antonio\emsdk", "User")
```

Typical fresh emsdk install:

```powershell
cd "$env:USERPROFILE"
git clone https://github.com/emscripten-core/emsdk.git emsdk
cd emsdk
.\emsdk install latest
.\emsdk activate latest
[Environment]::SetEnvironmentVariable("EMSDK", "$env:USERPROFILE\emsdk", "User")
```

4. If Visual Studio Build Tools is not installed in the default location, set
   `ARTCADE_VSDEVCMD` to your `VsDevCmd.bat`:

```powershell
[Environment]::SetEnvironmentVariable(
  "ARTCADE_VSDEVCMD",
  "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\Tools\VsDevCmd.bat",
  "User"
)
```

5. Open a **new** PowerShell and verify the toolchain:

```powershell
git --version
node --version
npm --version
python --version
rustc --version
cargo --version
cmake --version
ninja --version
```

6. Install project dependencies and verify the editor:

```powershell
cd "C:\Users\Antonio\Desktop\ArtCade V2"
npm install
npm run build
```

7. Verify native and WASM runtime builds:

```powershell
npm run build:cpp
npm run build:wasm
```

8. Start working:

```powershell
npm run tauri:dev   # desktop editor
# or
npm run dev         # web-only editor
```

Git-tracked source and docs are enough to resume work. Generated outputs such
as `node_modules`, `editor/dist`, `runtime-cpp/build-*`,
`editor/src-tauri/target`, and `editor/public/runtime/game.wasm` are intentionally
not required from backup; rebuild them with the commands above.

---

## Build pipeline

All npm scripts below are run from the **repo root**. On Windows they invoke `.bat` helpers via `cmd /c call …` so they work from PowerShell.

### npm scripts (root `package.json`)

| Script | Invokes | Output / effect |
|--------|---------|-----------------|
| `npm run dev` | Vite dev server in `editor/` | http://localhost:5173 |
| `npm run build` | Logic schemas + `tsc` + Vite production build | `editor/dist/` |
| `npm run tauri:dev` | `scripts\tauri-dev.bat` → MSVC env + `tauri dev` | Desktop editor window (hot reload) |
| `npm run tauri:build` | `editor` → `tauri build` | `editor\src-tauri\target\release\` + MSI/NSIS under `target\release\bundle\` |
| `npm run build:cpp` | `runtime-cpp\build_native.bat --config Release` | Native runtime + tests |
| `npm run build:wasm` | `runtime-cpp\build_wasm.bat` | WASM preview bundle |
| `npm run clean` | `scripts\clean-builds.bat` | Removes build output dirs (see below) |

### Helper scripts (`scripts/`)

| File | Role |
|------|------|
| `scripts/tauri-dev.bat` | Loads `VsDevCmd.bat` (x64), applies MSVC `onecore\x64` CRT workaround, runs `npm run tauri:dev` in `editor/` |
| `scripts/clean-builds.bat` | Deletes CMake/Vite build folders listed in [Build output paths](#build-output-paths) |

### C++ scripts (`runtime-cpp/`)

| File | Role |
|------|------|
| `runtime-cpp/build_native.bat` | Ninja + MSVC via `VsDevCmd`, configures `build-native/`, builds, runs CTest |
| `runtime-cpp/build_wasm.bat` | Ninja + Emscripten via `emsdk_env.bat`, configures `build-wasm/`, copies artifacts to editor preview |

Optional flags:

```powershell
runtime-cpp\build_native.bat --clean --config Release   # full reconfigure
runtime-cpp\build_native.bat --no-test                  # skip CTest
runtime-cpp\build_wasm.bat --clean                      # wipe WASM build dir
```

Override paths when needed:

- `ARTCADE_VSDEVCMD` — custom `VsDevCmd.bat` (native build)
- `EMSDK` — Emscripten root (WASM build)

### Build output paths

| Artifact | Path |
|----------|------|
| **Native game.exe** | `runtime-cpp\build-native\src\app\game.exe` |
| **Native CMake tree** | `runtime-cpp\build-native\` |
| **WASM game.js** | `editor\public\runtime\game.js` (copied from build) |
| **WASM game.wasm** | `editor\public\runtime\game.wasm` (gitignored; produced by build) |
| **WASM build tree** | `runtime-cpp\build-wasm\` |
| **Editor frontend (prod)** | `editor\dist\` |
| **Tauri binary (release)** | `editor\src-tauri\target\release\artcade-editor.exe` |
| **Tauri installer** | `editor\src-tauri\target\release\bundle\` (`.msi`, etc.) |
| **Rust build cache** | `editor\src-tauri\target\` |

`npm run clean` removes: `runtime-cpp\build-native`, `build-wasm`, `build-msvc`, `build-nmake`, `build`, root `build*`, and `editor\dist`.

### Typical workflows

**Editor dev (recommended — loads MSVC for Rust link):**

```powershell
cd "C:\Users\Antonio\Desktop\ArtCade V2"
npm run tauri:dev
```

Uses Vite on port **5173** and compiles the Tauri shell on first run. If the port is busy: `netstat -ano | findstr ":5173"` then `Stop-Process -Id <PID> -Force`.

**Web-only editor (no Tauri/Rust):**

```powershell
powershell -ExecutionPolicy Bypass -File start-webapp.ps1
# or: npm run dev
```

**Refresh runtime after C++ changes:**

```powershell
npm run build:cpp    # native .exe + unit tests
npm run build:wasm   # preview game.js + game.wasm → editor/public/runtime/
```

**Full release-style build:**

```powershell
npm run build:cpp
npm run build:wasm
npm run build
npm run tauri:build
```

### MSVC / Rust notes

- Rust on Windows requires `link.exe` from VS Build Tools. `scripts/tauri-dev.bat` and `runtime-cpp/build_native.bat` call `VsDevCmd.bat` automatically.
- `editor/src-tauri/.cargo/config.toml` adds the `onecore\x64` library path for minimal Build Tools installs (missing desktop CRT import libs). Update the MSVC version folder there if you upgrade Build Tools.

Verified on **VS BuildTools 2026 (18.x)** + **Node 24 LTS** + **Rust 1.95** + **CMake/Ninja/Emscripten** (May 2026).

## Current Status

- Runtime C++ MVP: complete native/WASM loop, Lua 5.4, Raylib, Box2D, asset loader, `.artcade` package loading.
- Editor MVP: React/Tauri app, project open/save, script save, Logic Board, Scene Editor, asset import, console copy, dark/light theme.
- Preview: WASM canvas is treated as a black box; React communicates through imperative bridge functions and buffered callbacks.
- Logic Board: entity-first authoring, schema-driven forms, Ajv build-time validators for Tauri CSP, Lua compiler, runtime APIs for spawn/sensor/lifecycle/shaders, and artist-friendly controls that show design numbers while hiding engine-only complexity.
- Export: deterministic packer with `manifest.json`, `project.json`, scripts/assets, `licenseTier`, and native runnable bundle.

## Roadmap

Historical roadmap is tracked in [ROADMAP_INTEGRATIVA.md](ROADMAP_INTEGRATIVA.md). The next useful work is:

- Asset pipeline hardening for arbitrary imported images in packaged/WASM runtime.
- Build WASM action exposed directly from the editor UI.
- Lua diagnostics/markers inside the CodeMirror iframe.
- Structured undo/redo for transform, tile painting, scene/objects panel and Logic Board edits.
- Steamworks/no-op integration in a later release phase.

## License

GPL-3.0-or-later

---

**Status**: MVP integration / release polish  
**Started**: 2026-05-09  
**Last updated**: 2026-05-23
