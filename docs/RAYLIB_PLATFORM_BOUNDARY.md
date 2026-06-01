# Raylib platform boundary

ArtCade treats **Raylib as a backend**, not as the game engine. Gameplay code (`world/`, `game-api/`, Lua bindings) must not include `<raylib.h>`.

## Allowed to include `<raylib.h>`

| Area | Files |
|------|--------|
| Renderer | `runtime-cpp/src/modules/renderer/src/*.cpp`, internal headers |
| Input | `runtime-cpp/src/modules/input/src/input.cpp`, `keymap.cpp` |
| Audio | `runtime-cpp/src/modules/audio/src/audio.cpp` |
| Textures | `runtime-cpp/src/modules/texture-manager/src/texture-manager.cpp` |
| Splash overlay | `runtime-cpp/src/modules/game-state/src/splash-state.cpp` |
| Editor tint widget | `runtime-cpp/src/app/render/ray-tint-widget.cpp` |

## Must not include Raylib

- `runtime-cpp/src/world/`
- `runtime-cpp/src/modules/game-api/`
- `runtime-cpp/src/modules/physics/`
- `runtime-cpp/src/modules/lua-runtime/`
- `runtime-cpp/src/modules/scene-system/` (except via renderer APIs)

## Application entry

[`app.cpp`](../runtime-cpp/src/app/src/app.cpp) uses `Renderer::windowWidth()` / `windowHeight()` for splash sizing — not `GetScreenWidth()` directly.

## Public renderer contract

[`renderer.h`](../runtime-cpp/src/modules/renderer/include/renderer.h) exposes draw APIs and window metrics without leaking `Texture2D` / `Color` to includers (Pimpl in `renderer.cpp`).
