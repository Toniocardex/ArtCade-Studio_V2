# ArtCade Studio Development Guidelines

The delivery pipeline, mandatory diff audit, test expectations, and review format are
defined in [`.cursor/rules/cursorrules-artcade.mdc`](.cursor/rules/cursorrules-artcade.mdc).
The architecture contract is defined in
[`.cursor/rules/artcade-architecture-authority.mdc`](.cursor/rules/artcade-architecture-authority.mdc).
Those two rule files are authoritative for implementation and review work.

## Product

ArtCade is an authoring-first 2D game engine. Its authoring workspaces are
**Scene**, **Logic**, and **Script**. Logic Board provides visual rules; Script
Editor provides authored Lua. Editor Play and exported games must use the same
runtime semantics.

The editor is Qt/QML and C++. QML is presentation only. The runtime is C++ with
Raylib behind platform boundaries, Lua for gameplay, and native plus WebAssembly
targets. No other editor stack is part of the supported product.

## Authoritative state

- `ProjectDocument` / `ProjectDoc` owns persisted authoring data.
- `EditorWorkspaceState` owns temporary editor state such as selection, active
  layer, tool, zoom, filters, and panel visibility.
- `EditorUiState` owns layout preferences only.
- `PlaySession` materializes runtime state and never writes back to the document
  without an explicit authoring command.
- Dirty state is derived from `revision != savedRevision`; it is never a second
  mutable flag.
- Persistent mutations must use the command/intent path and support undo/redo.

## Core architectural rules

- Stable IDs are identities. Names are display labels and paths are locations.
- `SceneDef.layers` is the only render-order authority. Instances reference a
  `layerId`; no parallel layer manager or global render layer store is allowed.
- Object Types own defaults; instances own sparse overrides. One resolver serves
  Inspector, Scene View, validation, Play, and export.
- QML dispatches intents through `EditorSession`; it never mutates durable
  document data directly.
- Logic Board is type-owned and compiled by C++ into `LogicRuntime`; generated
  Logic never overwrites authored scripts.
- Raylib is a backend, not the application architecture. Domain code reaches it
  only at designated platform boundaries.

## Saved project contract

The current `project.json` contract is `formatVersion: 6`. Older and malformed
formats are rejected with a clear error. Do not add migration, alias parsing,
normalization, or compatibility adapters. Every saved-format change needs an
explicit version bump, validation coverage, and a current-format round trip.

Assets use registry-backed stable IDs. Import, move, rename, and deletion must
update the registry atomically and validate dependencies first.

## Repository layout

```text
runtime-cpp/            Runtime, Raylib boundary, Lua host, native/WASM targets
src/application/        artcade_editor_core: ProjectDoc, commands, validation
src/qt/                 Qt QObject bridge and editor executable
qml/ArtCade/            QML presentation
tests/                  Editor-core and Qt regressions
docs/                   Product and technical documentation
```

## Development workflow

Use the Qt build directory at the repository root:

```powershell
cmake --build build-qt --config Release --target artcade_editor_core_roundtrip_test
ctest --test-dir build-qt -C Release --output-on-failure
cmake --build build-qt --config Release --target artcade-editor-qt
```

Before every commit: inspect the full diff, run the targeted tests, run
`git diff --check`, and resolve blockers and should-fix findings. Do not commit
generated build output, secrets, dead code, compatibility paths, or untracked
technical debt.
