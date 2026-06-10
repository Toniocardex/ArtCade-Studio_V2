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
├── AGENTS.md            # Architecture & repo conventions (for humans + agents)
├── CLAUDE.md            # Same guidelines as AGENTS.md (Claude)
├── .cursor/rules/       # Canonical Cursor agent rules (delivery + code review)
├── .gitignore
└── CMakeLists.txt       # Root build config
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Editor UI** | React 19 + TailwindCSS + TypeScript | Logic Board, inspector, timeline |
| **Editor Tests** | Vitest 4.1.7 | Unit tests; keeps npm audit clean for Vite/esbuild dev tooling |
| **Editor Bridge** | Tauri (Rust) | File I/O, system integration, preview |
| **Game Engine** | C++ (C++17) | Core game loop, deterministic |
| **Graphics** | Raylib (C) | 2D rendering (native + WASM) |
| **Physics** | Custom 2D (C++ + Raymath) | Collisions, overlap, raycast, dynamic bodies |
| **Scripting** | Lua 5.4 + Sol2 | Game logic (bytecode compiled) |
| **Audio** | Raylib Audio (OpenAL) | Sound, music |
| **Build (Native)** | CMake + MSVC/GCC/Clang | Windows/Linux/macOS .exe |
| **Build (Web)** | Emscripten | C++ → .wasm/.js |
| **Distribution** | .artcade (ZIP) | Project package (scripts + assets) |

## Documentation

- **Cursor / AI agent rules (delivery + code review):** [`.cursor/rules/cursorrules-artcade.mdc`](.cursor/rules/cursorrules-artcade.mdc) — architecture context in [AGENTS.md](AGENTS.md)
- **Index (all docs):** [docs/README.md](docs/README.md)
- **Artist-friendly component principle:** [docs/ARTIST_FRIENDLY_COMPONENTS.md](docs/ARTIST_FRIENDLY_COMPONENTS.md)
- **Engine integration roadmap:** [docs/ENGINE_INTEGRATION_ROADMAP.md](docs/ENGINE_INTEGRATION_ROADMAP.md)
- **Splash screen & Free/Pro licenses (editor + export + runtime):** [docs/GUIDA_INTEGRAZIONE_SPLASH_LICENZE.md](docs/GUIDA_INTEGRAZIONE_SPLASH_LICENZE.md)
- **End-to-end integration:** [docs/ARCHITECTURE_INTEGRATION.md](docs/ARCHITECTURE_INTEGRATION.md)
- **Global logic & UI (sensors, platformer feel, world UI, text juice):** [docs/GLOBAL_LOGIC_UI_ARCHITECTURE.md](docs/GLOBAL_LOGIC_UI_ARCHITECTURE.md)

## Requirements: end users vs developers

ArtCade ships in two very different ways. **Do not** ask end users to install Node, Rust, or Emscripten unless they are building the engine from source.

### End users — MSI / NSIS installer

The release installer (`ArtCade Editor_2.0.0_x64-setup.exe` or `.msi`) bundles:

- Tauri desktop shell (`artcade-editor.exe`)
- React editor UI (`editor/dist/`)
- WASM preview runtime (`dist/runtime/game.js` + `game.wasm`)

**Required on the PC**

| Requirement | Notes |
|-------------|-------|
| **Windows 10/11, 64-bit** | Current builds are **x64 only**. Windows 7/8 and 32-bit Windows are not supported. |
| **Microsoft Edge WebView2 Runtime** | Tauri embeds the UI in WebView2. Usually pre-installed on Windows 11; on Windows 10 it may be installed by the setup or must be installed manually. |
| **4 GB RAM** (8 GB recommended) | Preview + large projects need headroom. |
| **~500 MB disk** (2 GB recommended) | Installer + project assets; more if users keep build artifacts nearby. |

**Optional — needed only for some menu actions**

| Tool | When |
|------|------|
| **Python 3** on `PATH` | **Export `.artcade`** and **Pack project** (`pack_project` Tauri command). Without it: `python not found`. |

**What works out of the box (installer)**

| Action | Supported |
|--------|-----------|
| Open / save projects | Yes |
| Logic Board → Lua (in-editor compiler) | Yes |
| WASM live preview | Yes (bundled `game.wasm`) |
| Import assets, scene editing | Yes |

**What does *not* work without extra setup**

| Action | Why |
|--------|-----|
| **Build native `.exe` from the editor menu** | Requires **ArtCade SDK** (on-demand install) + **Visual Studio Build Tools** (MSVC). The base installer does not include MSVC (~GB). |
| **Rebuild WASM after C++ engine changes** | Requires SDK install with **Emscripten** option (~1 GB download). Preview WASM bundled in the installer still works without this. |

**On-demand SDK (recommended — not in the base MSI size)**

End users can install the **ArtCade SDK** from the editor when they first **Pack**, **Build .exe**, or open **File → Check dependencies**:

| Component | Base installer | SDK on-demand install |
|-----------|----------------|------------------------|
| Editor + WASM preview | ✅ Bundled | — |
| WebView2 | ✅ Tauri installer (`embedBootstrapper`) | — |
| Python (export) | — | ✅ Embeddable Python → `%LOCALAPPDATA%\ArtCade\sdk\python` |
| runtime-cpp sources | — | ✅ From `runtime-cpp-sdk.zip` (packaged at `tauri build`) |
| CMake + Ninja | — | ✅ Portable tools in SDK folder |
| C++ libs (Raylib, Lua…) | — | ✅ Cloned on first SDK install |
| Emscripten | — | ⚠️ Optional checkbox (~1 GB) |
| MSVC (link.exe) | — | ❌ User installs VS Build Tools once |

SDK location: `%LOCALAPPDATA%\ArtCade\sdk\`

Release builds run `npm run package:sdk` before bundling so the installer ships the SDK **bootstrapper + zip**, not the full toolchain. MSVC is the only hard external requirement for native `.exe` builds.

**Common failure cases (end users)**

- **WebView2 missing or blocked** — app window blank or fails to start; common on locked-down corporate PCs or offline installs if WebView2 bootstrap download is blocked.
- **Antivirus / SmartScreen** — may quarantine `artcade-editor.exe` or block `game.wasm`.
- **Saving projects under protected folders** — e.g. `C:\Program Files\` → write permission denied.
- **Very low RAM or disk** — slow preview, failed save, installer abort.
- **GPU / driver too old** — WASM preview (WebGL) may be black or degraded.

Installers are produced with `npm run desktop:release` (see [Build pipeline](#build-pipeline)).

---

### Developers — build from source

Use this path if you clone the repository or modify the C++ runtime.

**Full toolchain (Windows)**

| Tool | Purpose | Notes |
|------|---------|-------|
| **Git** | Clone/pull/push repository | `git` on PATH |
| **Node.js LTS** | Editor, Vite, npm scripts | `node`, `npm` on PATH |
| **Python 3.14+** | Icon tooling, `.artcade` packer, Tauri build commands | `python` on PATH |
| **Rust (rustup)** | Tauri shell | `%USERPROFILE%\.cargo\bin` on PATH |
| **VS Build Tools 2026** | MSVC linker (`link.exe`) for Rust + C++ native | Workload: *Desktop development with C++* |
| **CMake** | C++ configure/build | e.g. `C:\Program Files\CMake\bin` |
| **Ninja** | CMake generator | Used by both native and WASM scripts |
| **Emscripten SDK** | C++ → WASM | Set `EMSDK` (default in scripts: `%USERPROFILE%\emsdk`) |

**Generated / downloaded artifacts (not in git)**

| Path | How to restore |
|------|----------------|
| `node_modules/` | `npm install` |
| `runtime-cpp/libs/` | `npm run setup:runtime-libs` |
| `editor/public/runtime/game.wasm` | `npm run build:wasm` |
| `runtime-cpp/build-native/`, `build-wasm/` | `npm run build:cpp`, `npm run build:wasm` |

**Common failure cases (developers)**

| Symptom | Typical cause |
|---------|----------------|
| `"tauri" non è riconosciuto` / `tauri` not found | `node_modules` missing → run `npm install` |
| `link.exe` not found | MSVC not on PATH → use `npm run desktop:dev` (loads `VsDevCmd`) or set `ARTCADE_VSDEVCMD` |
| Preview empty / WASM load error | `game.wasm` not built → `npm run build:wasm` |
| C++ configure fails | `runtime-cpp/libs` missing → `npm run setup:runtime-libs` |
| WASM build fails | `EMSDK` unset or wrong path |
| `python not found` on export | Python not installed or not on `PATH` |
| Port 5173 in use | Another Vite dev server running |

**Web-only dev (`npm run dev`, no Tauri)** — UI loads in the browser but **no** native file dialogs, project save to disk, export, or build commands. WASM needs a browser that supports the COOP/COEP + SharedArrayBuffer setup used by Vite dev.

---

### Feature matrix

| Feature | End user (installer) | Developer (full checkout) |
|---------|----------------------|---------------------------|
| Launch editor | Yes | Yes (`npm run desktop:dev`) |
| Open / save project | Yes | Yes |
| WASM preview | Yes (bundled) | Yes (after `build:wasm`) |
| Logic Board → Lua | Yes | Yes |
| Export `.artcade` | Yes (SDK installs Python if needed) | Yes |
| Build native `game.exe` | Yes, after SDK + MSVC | Yes |
| Rebuild engine WASM | After SDK + Emscripten | Yes (`npm run build:wasm`) |
| Modify C++ runtime | No | Yes |

\*The editor **Build** menu uses the dev checkout when present, otherwise the on-demand SDK under `%LOCALAPPDATA%\ArtCade\sdk`.

---

## Getting Started

> **Developers only.** End users should install the MSI/NSIS bundle; see [Requirements: end users vs developers](#requirements-end-users-vs-developers).

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
| **Emscripten SDK** | C++ → WASM | Set `EMSDK` (default in scripts: `%USERPROFILE%\emsdk`) |

PowerShell may block `npm.ps1` until you run once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

First-time dependency install (npm workspace — deps hoist to repo root):

```powershell
cd "$env:USERPROFILE\Desktop\ArtCade-Studio_V2"
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

3. Configure Emscripten. The scripts default to `%USERPROFILE%\emsdk`;
   if you install it elsewhere, set `EMSDK`:

```powershell
[Environment]::SetEnvironmentVariable("EMSDK", "$env:USERPROFILE\emsdk", "User")
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
   `ARTCADE_VSDEVCMD` to your `VsDevCmd.bat` (examples):

```powershell
# Standard VS Build Tools 2026 install
[Environment]::SetEnvironmentVariable(
  "ARTCADE_VSDEVCMD",
  "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\Tools\VsDevCmd.bat",
  "User"
)
# Alternate layout (e.g. custom VS install under C:\Program)
# [Environment]::SetEnvironmentVariable("ARTCADE_VSDEVCMD", "C:\Program\Common7\Tools\VsDevCmd.bat", "User")
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

6. Install project dependencies and runtime libraries:

```powershell
cd "$env:USERPROFILE\Desktop\ArtCade-Studio_V2"
npm install
npm run setup:runtime-libs
cd editor
npm run package:sdk
```

`npm run package:sdk` (in `editor/`) stages `runtime-cpp-sdk.zip` into `src-tauri/resources/` so Tauri dev/build can bundle the on-demand SDK installer.

`setup:runtime-libs` restores the gitignored C++ dependencies under
`runtime-cpp/libs`: Raylib 5.0, Lua 5.4.7, Sol2 3.5.0, and
nlohmann/json 3.11.3.

7. Verify editor, native, and WASM builds:

```powershell
npm run verify
npm audit
```

`npm audit` should report `0 vulnerabilities`. The editor uses Vitest 4.1.7
to avoid the older Vite/esbuild advisory chain pulled in by Vitest 2.x.

8. Start working:

```powershell
npm run desktop:dev   # desktop editor
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
| `npm run setup:runtime-libs` | `scripts\bootstrap-runtime-libs.ps1` | Restores gitignored C++ libs under `runtime-cpp\libs\` |
| `npm run verify` | Editor build + native runtime/tests + WASM runtime | Full clean-machine verification path |
| `npm run build` | Logic schemas + `tsc` + Vite production build | `editor/dist/` |
| `npm -w editor test` | Logic schemas + Vitest 4.1.7 | Editor unit tests |
| `npm run desktop:dev` | `scripts\tauri-dev.bat` → MSVC env + `tauri dev` | Desktop editor window (hot reload) |
| `npm run desktop:build` | `editor` → `tauri build --no-bundle` | `editor\src-tauri\target\release\artcade-editor.exe` only |
| `npm run desktop:release` | `editor` → `tauri build` | Same exe + MSI/NSIS under `target\release\bundle\` |
| `npm run desktop:link` | `scripts\link-desktop.ps1` | Desktop shortcuts (Dev + release exe) |
| `npm run build:cpp` | `runtime-cpp\build_native.bat --config Release` | Native runtime + tests |
| `npm run build:wasm` | `runtime-cpp\build_wasm.bat` | WASM preview bundle |
| `npm run clean` | `scripts\clean-builds.bat` | Removes build output dirs (see below) |

### Helper scripts (`scripts/`)

| File | Role |
|------|------|
| `scripts/tauri-dev.bat` | Loads `VsDevCmd.bat` (x64), applies MSVC `onecore\x64` CRT workaround, runs `npm run desktop:dev` in `editor/` |
| `scripts/link-desktop.ps1` | Desktop shortcuts: **ArtCade Editor (Dev)** + **ArtCade Editor** (release exe) |
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
cd "$env:USERPROFILE\Desktop\ArtCade-Studio_V2"
npm run desktop:dev
# or double-click: start-desktop.bat / Desktop shortcut "ArtCade Editor (Dev)"
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

**Desktop app binary (daily use — no installers):**

```powershell
npm run desktop:build
npm run desktop:link   # refresh Desktop shortcut to artcade-editor.exe
```

**Release / shipping (MSI + NSIS — only when packaging a release):**

```powershell
npm run desktop:release
```

### MSVC / Rust notes

- Rust on Windows requires `link.exe` from VS Build Tools. `scripts/tauri-dev.bat` and `runtime-cpp/build_native.bat` call `VsDevCmd.bat` automatically.
- `editor/src-tauri/.cargo/config.toml` adds the `onecore\x64` library path for minimal Build Tools installs (missing desktop CRT import libs). Update the MSVC version folder there if you upgrade Build Tools.

Verified on **VS BuildTools 2026 (18.x)** + **Node 24 LTS** + **Rust 1.95** + **CMake/Ninja/Emscripten** (May 2026).

## Current Status

- Runtime C++ MVP: complete native/WASM loop, Lua 5.4, Raylib, custom 2D physics, asset loader, `.artcade` package loading.
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
**Last updated**: 2026-05-25
