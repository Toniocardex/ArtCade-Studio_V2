# ArtCade — agent notes (runtime repo)

> **Product UI is ArtCade_Editor_RmlUi.** This tree is runtime + headless core.
> Do not reintroduce obsolete authoring UI stacks.

ArtCade is an authoring-first 2D engine. Runtime is C++ with Raylib behind
platform boundaries and Lua 5.4 for gameplay. Native and WASM share one
gameplay contract.

## Layout

```
runtime-cpp/            # Engine
src/application/        # Headless artcade_editor_core
tests/                  # Headless / runtime tests
```

## Rules of thumb

- One `ProjectDoc` authority for persisted authoring data.
- Commands for durable mutations; no silent compatibility adapters.
- Raylib is a backend, not the architecture core.
- Do not add obsolete authoring UI stacks here.
