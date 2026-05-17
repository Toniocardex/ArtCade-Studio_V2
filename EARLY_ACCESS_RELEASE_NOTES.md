# ArtCade V2 — Early Access Release Notes

**Release Date**: May 21, 2026  
**Version**: 2.0.0  
**Status**: Public Beta (8-week Early Access)

---

## 🎮 What's Included

### Core Features (Phases 1–20)

✅ **Dual-Runtime Engine**
- C++ codebase compiles to Windows/macOS/Linux native (.exe)
- Same codebase compiles to WebAssembly for browsers + Tauri preview
- Raylib 2D renderer, Lua 5.4 + Sol2 bindings, Box2D 2.4 physics

✅ **React TypeScript Editor (Tauri)**
- Scene hierarchy + entity inspector
- Lua script editor with syntax highlighting (Monaco)
- Asset browser (sprites, audio, fonts)
- Live WASM preview with real-time sync
- Console panel with game logs + editor output
- Tileset editor (paint mode)

✅ **Lua Game API** (30+ functions)
- Entity pool (get, set position/velocity, destroy)
- Physics (raycast, overlap, gravity)
- Input (keyboard, mouse, gamepad)
- Audio (sound, music, volume control)
- Game state (key-value store, persistence)
- Events (emit, listen, deferred handling)
- Debug drawing (lines, rects)

✅ **ECS Architecture**
- EnTT entity component system (10.000+ entities in WASM)
- 19 modular systems (renderer, physics, input, audio, Lua, etc.)
- Fixed 60 FPS timestep (tunable)
- Deterministic Lua bytecode execution

✅ **Asset Pipeline**
- `.artcade` format (ZIP-based, single-file distribution)
- Automatic asset compression + checksum validation
- Sprite animation support
- Audio mixing (OGG Vorbis)
- Bitmap font rendering

✅ **License System**
- FREE tier: Splash screen watermark ("MADE WITH ARTCADE")
- PRO tier: No watermark (future commercial support)

---

## ⚠️ Known Limitations (Early Access)

| Limitation | Status | Fix Timeline |
|-----------|--------|--------------|
| Emscripten SDK local setup | ⚠️ Manual setup required | Week 2 (docker image) |
| Sprite skinning / bone animation | ❌ Not yet | Week 4 |
| Advanced physics (ragdoll, joints) | ❌ Basic Box2D only | Week 6 |
| Steam integration | ❌ Stub present | Future (Week 8+) |
| Real-time collaboration | ❌ Not planned | N/A (v3.0) |
| Visual Logic Board | ⚠️ Code-only for now | Week 3 (if funded) |
| Mobile platform support | ❌ Desktop only | V2.1 (iOS/Android) |

---

## 🚀 Getting Started

### Install (Windows)

1. Download `ArtCade-Editor-2.0.0.exe` from releases
2. Run installer → installs to `Program Files/ArtCade`
3. Open editor, create new project, click **PLAY** to launch preview

### Build from Source (All Platforms)

```bash
# Prerequisites: CMake, MSVC/Clang, Emscripten SDK (optional for WASM)
git clone https://github.com/anthropics/artcade.git
cd artcade

# Build native game engine
cd runtime-cpp/build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release
# Output: game.exe

# Build React editor
cd ../../editor
npm install
npm run tauri:build
# Output: ArtCade-Editor.exe (Windows), ArtCade.dmg (macOS), .AppImage (Linux)

# Build WASM (requires Emscripten)
cd ../runtime-cpp/build
emcmake cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build .
# Output: game.js, game.wasm
```

---

## 📋 Test Scenario: Coin Collector Demo

A full working example is included in `runtime-cpp/test-project/`:

```
Controls:
  WASD / Arrow Keys — move player
  Approach coins    — automatic collection
  Collision        — enemy hit = player death

Expected:
  - Console shows "Coin collected! score=XXX" per pickup
  - Physics: green ball falls under gravity, rests on orange floor
  - No visual glitches (coin pickup should be silent, no canvas flash)

Test Assets:
  - Entities: Player, 2× Enemy (patrol), 2× Coins, Physics ball + floor
  - Lua script: WASD controller, collision detection, scoring
```

Run:
```bash
./build/Release/game.exe ../test-project/
```

---

## 💬 Feedback Channels

### During Early Access (May 21 — July 16)

**Bugs & Crashes**
- GitHub Issues: [anthropics/artcade/issues](https://github.com/anthropics/artcade/issues)
- Slack (invite-only): #artcade-ea-support

**Feature Requests & Suggestions**
- Discord: [ArtCade Community](https://discord.gg/artcade) (invite in email)
- Feedback form: [artcade.io/feedback](https://artcade.io/feedback)

**Performance & Build Issues**
- Email: support@artcade.io
- Provide: OS, Emscripten version, reproduction steps

### Community Events

| Week | Event | Link |
|------|-------|------|
| 1–2 | Onboarding webinar (Wed 3pm UTC) | [Zoom](https://zoom.us/...) |
| 3–4 | Game jam (48h) | [Itch.io](https://itch.io/) |
| 5–6 | Creator showcase | [Discord](https://discord.gg/) |
| 7–8 | Retrospective survey | [Form](https://forms.gle/...) |

---

## 📈 Roadmap: Next 8 Weeks

### Week 1–2: Stabilization
- [ ] Local Emscripten SDK Docker image (no manual setup)
- [ ] Hot-reload in editor preview (click-to-build, instant test)
- [ ] Editor preferences (theme, font size, key bindings)
- [ ] Bug fixes from day-1 feedback

### Week 3–4: Content Authoring
- [ ] Visual Logic Board (node-based event scripting, not code)
- [ ] Particle system (emit, lifespan, blend modes)
- [ ] Advanced sprite animation (frame tags, events)
- [ ] Tile map editor improvements

### Week 5–6: Distribution
- [ ] One-click web export (auto-upload to itch.io or custom host)
- [ ] Native installer bundling (DLL handling, shortcuts)
- [ ] Game template library (platformer, shooter, puzzle starter kits)

### Week 7–8: Community & Polish
- [ ] Showcase gallery on artcade.io (featured creator games)
- [ ] Final stability pass + performance optimization
- [ ] RTL/CJK language support in text rendering
- [ ] Public release (Version 2.0 Final)

---

## 📊 System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **OS** | Windows 10, macOS 11, Ubuntu 20.04 | Windows 11, macOS 13, Ubuntu 22.04 |
| **CPU** | i5-6th Gen / Ryzen 5 2600 | i7 / Ryzen 7 |
| **RAM** | 4 GB | 8 GB |
| **Disk** | 500 MB (editor + runtime) | 2 GB (build artifacts, project assets) |
| **GPU** | Integrated (Intel UHD, AMD Radeon) | Discrete (NVIDIA GTX 1050, AMD RX 580+) |
| **Browser** (WASM) | Chrome/Edge 90+, Firefox 88+ | Latest (performance) |

---

## 🔐 License & Attribution

**ArtCade V2 Editor & Engine**: Proprietary  
**FREE Tier**: Non-commercial use, watermark required  
**PRO Tier**: Commercial use, no watermark (licensing info TBA)

**Open Source Dependencies**:
- Raylib (zlib license)
- Lua 5.4 (MIT license)
- Sol2 (MIT license)
- Box2D 2.4 (MIT license)
- React 19 (MIT license)

**Attribution**: Games made with ArtCade FREE must display "Made with ArtCade" watermark in splash screen (automatic, non-removable).

---

## 🎯 Success Criteria for Early Access

We'll consider Early Access successful if:

- ✅ 100+ games submitted to showcase (target: 500)
- ✅ 90%+ satisfaction on [feedback form](https://forms.gle/...)
- ✅ Zero critical crashes (99.9% uptime)
- ✅ Community votes 8+ features into Week 5–6 roadmap
- ✅ Educational partnerships with 5+ universities

---

## 📞 Support

**Get Help**:
- [Docs](https://artcade.io/docs) — API reference, tutorials, guides
- [FAQ](https://artcade.io/faq) — Common questions
- [Community Wiki](https://wiki.artcade.io) — User-contributed tips
- **Email**: support@artcade.io (48h response time)

**Report Issues**:
- GitHub Issues with:
  - OS + version
  - Emscripten version (if building)
  - Error message + stack trace
  - Minimal reproduction project (`.artcade` file)

---

**Thank you for using ArtCade V2!** 🚀

We're excited to see what you create. Your feedback shapes the engine.

**— The ArtCade Team**

---

*Last updated: 2026-05-17 / Phase 20*
