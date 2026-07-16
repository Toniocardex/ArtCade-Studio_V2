# ArtCade V2 Development Guidelines

**Cursor / AI agents:** delivery pipeline and code-review format live in [`.cursor/rules/cursorrules-artcade.mdc`](.cursor/rules/cursorrules-artcade.mdc). **Authoritative architecture paletti** live in [`.cursor/rules/artcade-architecture-authority.mdc`](.cursor/rules/artcade-architecture-authority.mdc). Narrative layout: [`AGENTS.md`](AGENTS.md).

> **Legacy policy:** the former React/Tauri editor and the RmlUi native editor are **removed**. Any remaining reference to them (code, functions, docs, comments) is technical debt — delete it on sight, do not preserve compatibility. The only editor stack is **Qt/QML + C++**.

## Project Vision

**Authoring-first 2D game engine/editor** (Scene | Logic | Script) with dual runtime:
- Windows/macOS/Linux native executables (Raylib)
- WebAssembly (Emscripten) for browsers

Lua 5.4 as the game logic layer. Raylib is a **backend**, not the architecture core. QML is presentation only (Intent → `EditorSession` → Command → ProjectDoc). Editor Play and export must share gameplay semantics.

---

## Key Architectural Decisions

### 1. Qt-first editor (QML presentation, C++ authority)
**Why**: One native desktop editor. QML shows state and emits intents; C++
`EditorSession` (Qt bridge) is the single voice for tools/selection/Play; the
Qt-free `artcade_editor_core` owns ProjectDoc, commands, undo, validation.

### 2. Raylib + Emscripten runtime (Not Rust/WASM)
**Why**: Raylib is C, born for Emscripten. Write once (C++), compile twice (native .exe + .wasm). Zero rendering logic rewrite.

### 3. Hybrid authoring (Logic Board + Lua + dialogs)
**Why**: Gameplay ships as compiled Lua; the editor adds a visual Logic Board (descriptor registry → Lua), script editing, and dialog JSON. C++ runtime is Lua + Raylib + Sol2.

### 4. Lua for Game Logic
**Why**: Portable, deterministic, easy Lua<->C++ binding via Sol2. Native builds use bytecode; editor Play validates and compiles the same boards (`compileProjectLogic`).

### 5. ProjectRuntimeSettings (editor ↔ runtime contract)
**Why**: C++ `ProjectRuntimeSettings` keeps targetFPS, physicsMode, and viewport policy aligned between editor Play and exported runtimes.

### 6. .artcade Format (ZIP-based)
**Why**: Single-file distribution, fast web loading, asset encryption, version manifest.

---

## Code Organization

### Editor (Qt/QML)

```
qml/ArtCade/            # QML presentation only (no document writes)
├── Main.qml
├── Theme/              # Theme, Metrics, Typography, Icons singletons
├── Controls/           # Ac* reusable controls (AcButton, AcLogicRuleCard, …)
└── Shell/              # Workspace views (LogicBoardView, InspectorPane, …)

src/qt/                 # Qt adapter layer
├── app/                # Entry point, window bootstrap
└── bridge/             # EditorSession (QML singleton), derived models
                        # (HierarchyModel, LayersModel, AssetsModel, ConsoleModel)

src/application/        # artcade_editor_core — Qt-free authoring authority
├── include/artcade/editor_core/editor_core.h
└── src/                # ProjectDoc IO, CommandStack, EditorCoordinator,
                        # logic board / section / property commands
```

Mutation path (the only one): `QML → EditorSession intent → EditorCoordinator
→ Command → ProjectDoc → refreshSelectionCache → QML re-reads`.

### Runtime (`runtime-cpp/`)

C++17, CMake. Modules under `runtime-cpp/src/modules/` (logic-core, physics,
renderer, audio, scene-system, …), shared types in `runtime-cpp/src/core/types.h`.
Compile targets: native `game.exe` and Emscripten `.wasm` (`build_wasm.bat` → `dist/wasm/`).

### Docs

Full index: **`docs/README.md`**. Do not delete files under `docs/`; when a doc
still describes React/Tauri, rewrite or remove the stale content per the legacy policy.

---

## Lua Game API Contract

**Deterministic, no randomness without seeding.** Full spec in `docs/LUA_GAME_API.md`.
Logic Board blocks compile to Lua against the same host API (`context.self`,
input/audio/state helpers). Sandbox: no `io`/`os`/filesystem/network/Raylib/ProjectDoc.

---

## .artcade File Format

ZIP archive: `manifest.json`, `game.json`, `project.json` (ProjectDoc,
`formatVersion` C++-owned), `scripts/*.luac`, `assets/`, `thumbnails/`.

---

## Development Workflow

### Build & test (Qt editor)

```powershell
# Editor core tests (build + run)
cmake --build build-qt --config Release --target artcade_editor_core_roundtrip_test
build-qt\src\application\Release\artcade_editor_core_roundtrip_test.exe

# Qt editor
cmake --build build-qt --config Release --target artcade-editor-qt
powershell -File scripts\run-artcade-editor-qt.ps1     # deploy Qt DLLs + launch
```

### Runtime builds

```powershell
cd runtime-cpp; .\build_wasm.bat      # WASM → dist/wasm/
npm run build:cpp                     # native game.exe (desktop)
```

PowerShell: use `;` instead of `&&` for chained commands.
Commit/push directly on the working branch (`master`) — no feature branches, no PRs.

---

**Status**: Logic Board redesign in progress (compact cards, inline property editing, sections)
**Last Updated**: 2026-07-16
**Author**: Antonio + Claude
