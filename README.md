# ArtCade V2 (runtime)

Shared **C++ game runtime** (native Raylib + WebAssembly) and headless
`artcade_editor_core`.

**Product UI:** [ArtCade_Editor_RmlUi](../ArtCade_Editor_RmlUi) — native RmlUi
editor. Obsolete authoring UI stacks are not part of this repository.

## Layout

```
ArtCade-Studio_V2/
├── runtime-cpp/         # Game engine (Raylib, Lua, Logic, Scripts, …)
├── src/application/     # Headless artcade_editor_core (tests / tools)
├── tests/               # Headless editor-core + runtime tests
├── docs/                # Runtime / product notes
└── CMakeLists.txt
```

## Build

```powershell
cmake -S . -B build-native -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build-native
```

Runtime unit tests:

```powershell
cmake -S . -B build-runtime-tests -G Ninja -DARTCADE_BUILD_TESTS=ON
cmake --build build-runtime-tests
ctest --test-dir build-runtime-tests --output-on-failure
```

## Related

| Repo | Role |
|------|------|
| **This** | Runtime + headless authoring core |
| **ArtCade_Editor_RmlUi** | Native RmlUi editor (active authoring UI) |
