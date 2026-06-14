# LuaJIT Evaluation — Decision: Do Not Adopt

**Status:** evaluated 2026-06 · **Decision:** keep Lua 5.4; do **not** adopt LuaJIT.

LuaJIT promises a large native-execution speedup (often cited ~5×). We evaluated
adopting it for the native (`.exe`) target and concluded it is the wrong move for
ArtCade's architecture. This document records why, so the question doesn't get
re-litigated without new information.

## Why not

1. **No JIT under WebAssembly.** LuaJIT's speed comes from runtime machine-code
   generation, which the Emscripten/WASM sandbox does not permit. In the browser
   build only its interpreter could run, forfeiting the gain. Our dual-runtime
   (native + WASM) ships the *same* game logic to both targets — LuaJIT would only
   ever accelerate one of them.

2. **Dialect and bytecode split.** LuaJIT is Lua 5.1 semantics with its own,
   incompatible bytecode format. The runtime is built on **Lua 5.4** — generational
   GC (`LUA_GCGEN`), 5.4 language features, Sol2 bindings, and shipped `.luac`
   bytecode are all 5.4-specific. Adopting LuaJIT native-only would mean native and
   web run *different languages*, breaking the deterministic, portable dual-runtime
   pillar (CLAUDE.md §4). A game that behaves one way in the editor/web preview
   could behave differently in the native build — exactly the "no surprises"
   property the architecture exists to guarantee.

3. **Coupling cost.** CMake targets `lua54`; GC tuning, Sol2 integration, and the
   bytecode pipeline assume 5.4. Swapping the VM is not a flag change — it is a
   cross-cutting rewrite with a permanent maintenance burden (two VMs, two
   bytecode formats, two test matrices).

## If performance becomes a real, measured problem

Profile first — the runtime already reports `luaMs` via `onRuntimeProfile`
(see the preview profile buffer). Only act on measured Lua hot spots, then:

1. **Offload hot paths to C++** through `game-api` (the bindings layer that
   already does the heavy lifting: physics, collision, entity queries). Moving a
   hot loop from Lua into a C++ binding keeps native + WASM identical and
   deterministic, and is usually the bigger win.
2. **Tune Lua 5.4** — generational GC parameters, fewer per-frame allocations,
   table reuse.
3. **Consider Luau (Roblox) later** *only* if a genuinely faster VM is required.
   Note Luau is also a Lua 5.1-ish dialect, so the same native/web parity caveat
   applies; it would need the same scrutiny as LuaJIT before adoption.

## Bottom line

The dual-runtime determinism guarantee is worth more than a native-only speedup
that can't reach the web build. Keep Lua 5.4 everywhere; reach for C++ offload
when the profiler — not intuition — says Lua is the bottleneck.
