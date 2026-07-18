# ArtCade Studio Development Guidelines

The delivery pipeline, mandatory diff audit, test expectations, and review format are
defined in [`.cursor/rules/cursorrules-artcade.mdc`](.cursor/rules/cursorrules-artcade.mdc).
The architecture contract is defined in
[`.cursor/rules/artcade-architecture-authority.mdc`](.cursor/rules/artcade-architecture-authority.mdc).
Those two rule files are authoritative for implementation and review work.

## Product

ArtCade is an authoring-first 2D game engine. Authoring workspaces are **Scene**,
**Logic**, and **Script**. Logic Board provides visual rules; Script Editor
provides authored Lua. Editor Play and exported games must use the same runtime
semantics.

**This repository** owns the shared C++ runtime (`runtime-cpp`) and optional
headless `artcade_editor_core`. The **product editor UI** is the sibling repo
**ArtCade_Editor_RmlUi** (native RmlUi). Obsolete authoring UI stacks must not
be reintroduced.

## Authoritative state

- `ProjectDocument` / `ProjectDoc` owns persisted authoring data.
- Workspace / UI chrome state lives in the RmlUi editor (`EditorState`, …).
- `PlaySession` materializes runtime state and never writes back to the document
  without an explicit authoring command.
- Dirty state is derived from `revision != savedRevision`; it is never a second
  mutable flag.
- Persistent mutations must use the command/intent path and support undo/redo.

## Core architectural rules

- Stable IDs are identities. Names are display labels and paths are locations.
- `SceneDef.layers` is the only render-order authority.
- Object Types own defaults; instances own sparse overrides.
- Logic Board is type-owned and compiled by C++ into `LogicRuntime`; generated
  Logic never overwrites authored scripts.
- Raylib is a backend, not the application architecture.

## Saved project contract

The current `project.json` contract is `formatVersion: 8`. Older and malformed
formats are rejected with a clear error. Do not add migration, alias parsing,
normalization, or compatibility adapters. Every saved-format change needs an
explicit version bump, validation coverage, and a current-format round trip.

## Repository layout

```text
runtime-cpp/            Runtime, Raylib boundary, Lua host, native/WASM targets
src/application/        artcade_editor_core: ProjectDoc, commands, validation
tests/                  Editor-core and runtime regressions
docs/                   Product and technical documentation
```

## Development workflow

```powershell
cmake --build build-native --target artcade_editor_core_roundtrip_test
ctest --test-dir build-native --output-on-failure
```

Before every commit: inspect the full diff, run the targeted tests, run
`git diff --check`, and resolve blockers. Do not commit generated build output,
secrets, dead code, or revival of obsolete authoring UI stacks.
