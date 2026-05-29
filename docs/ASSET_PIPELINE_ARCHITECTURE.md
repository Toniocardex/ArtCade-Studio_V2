# ArtCade Studio V2 — Asset Pipeline Architecture

**Document type:** Architecture proposal + codebase audit  
**Audience:** Engine / editor collaborators  
**Status:** Phases A–D implemented in editor preview and native draw path (2026-05-29); explorer/normalize/virtual-folders v0 documented in `ASSETS_ROADMAP.md` § Explorer  
**Last updated:** 2026-05-29 (§4.2 resolved gaps, §12.1 explorer, §13 conclusion; C++ `AssetManifestIndex` on `main`)  
**Repository:** ArtCade-Studio_V2  

**Related docs:** `ASSETS_ROADMAP.md` (phased delivery), `ARCHITETTURA_TECNICA_ENGINE_2D.md` §10 (WASM assets), `REACT_WASM_PATTERN.md` (editor↔WASM boundaries)

---

## 1. Executive summary

ArtCade uses a **dual runtime**: the same C++ engine compiles to **native** (Raylib) and **WASM** (Tauri preview). Assets (sprites, tilesets, audio, shaders) must be owned by the **runtime renderer**, not by the React editor layer.

**Core principle (agreed):**

> The WASM/native runtime is the renderer — it must own asset memory after load.  
> TypeScript orchestrates *when* and *what* to load; it must not become a long-lived binary buffer for game assets.

This document merges:

1. The **collaborator’s proposed schema** (Tauri FS → TS orchestration → handoff to WASM → C++ registry).
2. An **audit of the current repository** (what exists, what is missing, what to build next).
3. A **phased roadmap** aligned with `docs/ASSETS_ROADMAP.md`.

---

## 2. Proposed architecture (target state)

### 2.1 Data flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Tauri FS / bundle / exported .artcade ZIP                       │
└────────────────────────────┬────────────────────────────────────┘
                             │ file path (string) only
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  TypeScript — orchestration ONLY                                 │
│  • Decides what to load, when, in which order                    │
│  • Reads raw bytes via Tauri fs API                              │
│  • Does NOT decode images/audio (no PNG→pixels in JS)            │
│  • Does NOT hold GPU textures or long-lived atlases              │
└────────────────────────────┬────────────────────────────────────┘
                             │ ArrayBuffer / Uint8Array
                             │ (handoff to WASM; see §3.3)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  AssetBridge (single TS ↔ WASM contact surface)                  │
│  • editor_register_image / editor_register_audio (planned)     │
│  • Queue, dedup, priority, cancellation                          │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  WASM / native runtime — OWNS asset memory                       │
│                                                                  │
│  AssetRegistry (conceptual unification of today’s caches)       │
│    ├── TextureCache / TextureManager  (sprites, tilesets)        │
│    ├── AudioPool                      (sfx, music)               │
│    ├── TilemapCache                   (from ProjectDoc JSON)     │
│    └── ShaderProgram cache            (screen/entity shaders)    │
│                                                                  │
│  Decode: stb/Raylib (images), miniaudio (audio) — all in C++       │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Layer responsibilities

| Layer | Responsibility | Must NOT do |
|--------|----------------|-------------|
| **Tauri / disk** | Store project files under `assets/` | — |
| **TypeScript** | Read bytes; schedule loads; react to scene changes | Decode media; keep GPU resources |
| **AssetBridge** | Marshal bytes + metadata into runtime IPC | Gameplay logic |
| **C++ runtime** | Decode, cache, refcount, draw, unload | Read Tauri filesystem (WASM preview) |

### 2.3 Build-time manifest

```
AssetManifest.json   ← generated at build/export (or derived from ProjectDoc in v1)
        │
        ▼
AssetLoader (TS)     ← reads manifest / project index, manages load queue
        │
        ▼
AssetBridge          ← WASM IPC (editor-api)
        │
        ▼
AssetRegistry (C++)  ← lookup by stable asset ID, lifecycle, invalidation
```

**Key rule:** The runtime requests assets by **stable ID**, not by machine-specific absolute paths. Paths are an editor/packaging concern; IDs survive renames when the manifest is updated.

---

## 3. Three key decisions

### 3.1 Who reads from disk?

**Decision:** TypeScript via **Tauri `plugin-fs`**, not WASM.

**Rationale:** The WASM preview has no direct access to the host filesystem. Native `game.exe` can read from disk or from an extracted `.artcade` archive via C++ `AssetLoader` — same *logical* asset IDs, different physical I/O path.

**Target pattern:**

```typescript
// TS: read and forward — do not interpret image bytes
const buffer = await readFile(joinPath(projectRoot, relPath));
assetBridge.loadAsset({ id, type: 'image', ext, bytes: buffer });
// After successful handoff, drop the TS reference (GC)
```

**Current implementation:** `readProjectImageBytes()` in `editor/src/utils/asset-file-api.ts`.

**C++ contract today** (`asset-loader.h`):

> Asset caching (GPU textures, audio handles) is the responsibility of the Renderer and Audio modules; AssetLoader only handles disk I/O.

---

### 3.2 When are assets loaded?

**Decision:** **Lazy per active scene**, with **predictive prefetch** in idle time — not full project load at boot.

| Phase | Load policy |
|--------|-------------|
| **Boot / project open** | Minimum: active scene dependencies only |
| **Scene active** | Sprites, tilesets, backgrounds referenced by that scene |
| **Idle / background** | Prefetch adjacent scenes (from `ProjectDoc.scenes`, `loadScene` graph) |
| **Memory pressure** | Unload scenes far from active if GPU/RAM > threshold |

**Dependency graph sources (v1):**

- `ProjectDoc.scenes[]` — entities, tilemaps, tileset refs
- `project.assets` — image definitions
- *(v2)* Logic Board static analysis — audio paths, `loadScene` actions

**Current implementation:** **Scene-scoped** — `useRuntimeAssetUpload` → `performRuntimeSceneAssetSync` → `AssetOrchestrator.loadScene` for the active scene; other scenes prefetch on idle. LRU eviction when registered count exceeds `ASSET_CACHE_MAX_ENTRIES` (96).

---

### 3.3 Who decodes formats?

**Decision:** **C++ runtime decodes** raw buffers. TypeScript delivers opaque bytes.

| Asset type | TS delivers | C++ decodes |
|------------|-------------|-------------|
| PNG / JPEG / WebP | Raw file bytes | `TextureCache::registerFromMemory` / Raylib |
| OGG / WAV / MP3 | Raw file bytes | miniaudio (planned — ASSETS_ROADMAP Phase 2) |
| Tilemap | Structured JSON via `editor_load_project` | `ProjectDocParser` |
| Lua scripts | Source or bytecode | `LuaHost` |

**Exception:** Tilemaps and scene structure are already JSON in `project.json` — no per-tile binary blobs from TS.

#### Note on “zero-copy”

The collaborator diagram mentions **zero-copy** transfer (e.g. `postMessage` with transfer list).

**Today:** The Emscripten bridge uses `malloc` + `HEAPU8.set` + `ccall` in `editorRegisterImage` — a **copy** into WASM linear memory. That is normal for `editor_register_image`.

**Recommendation for v1:** Accept the copy; optimize later only if profiling requires it. The larger win is **loading fewer assets** (scene scope), not avoiding one memcpy per texture.

---

### 3.4 Resolved: stable ID migration (dual-read)

**Decision (not open):** **Dual-read with path fallback** — no big-bang migration on project open.

| Approach | Verdict |
|----------|---------|
| Big-bang rewrite `spriteAssetId` → `asset.id` on open | **Rejected** — requires a migration function tested on every legacy `formatVersion`; user-visible breakage risk |
| Dual-read at resolve time | **Adopted** — existing projects open unchanged; migration is transparent |

**Today:** `entity.sprite.spriteAssetId` and `TilesetAsset.spriteImagePath` usually store the **project-relative path**; `ImageAsset.id` exists in `project.assets` but is not the render key yet.

**Resolve rule (TS orchestrator — implement in `resolveImageLoadKey` or equivalent):**

1. If `ref` matches an `ImageAsset.id` in `project.assets` → use that asset’s **`path`** for disk read and WASM register.
2. Else if `ref` matches a known `ImageAsset.path` → use `ref` as-is.
3. Else if `ref` is a non-empty string (legacy orphan path) → use as path; **warn once** in console.

**WASM cache key:** still the **resolved path string** passed to `editor_register_image` (after manifest/id resolution in TS and in `Renderer::resolvedTextureKey` for draw).

**Persistence:** Saving a project does **not** require rewriting references. Optional future action: “Normalize asset references to IDs” (explicit, user-triggered).

**Phase C alignment:** Manifest and C++ may add `assetId` lookup; dual-read remains for loaded projects that still store paths in entity JSON.

---

## 4. Current codebase audit (2026-05-29)

### 4.1 What already matches the proposal

| Capability | Location | Notes |
|------------|----------|--------|
| TS reads binary from disk | `editor/src/utils/asset-file-api.ts` | Tauri `readFile` |
| TS does not decode PNG for engine | — | `dataUrl` only for UI thumbnails |
| Single image IPC | `editorRegisterImage` → `editor_register_image` | `editor/src/utils/wasm-bridge.ts` |
| C++ decode + GPU upload | `Renderer::registerImageFromMemory` | `runtime-cpp/src/modules/renderer/` |
| Project JSON → runtime | `editor_load_project` | Scenes, entities, tilesets |
| Native disk / ZIP load | `AssetLoader::loadDirectory` / `loadArtcade` | No TS in native play |
| Texture cache (native) | `TextureManager::load(path)` | Refcount, unload |
| Architecture policy | `docs/ARCHITETTURA_TECNICA_ENGINE_2D.md` §10 | Batched load, avoid random fetch |

### 4.2 Gaps vs target

**Resolved in repo (2026-05-29):**

| Former gap | Resolution |
|------------|------------|
| Path-only runtime key | **Dual-read** (§3.4): `AssetManifestIndex` + `Renderer::setTextureKeyResolver`; optional File → Normalize asset references |
| Eager load of all images | **Scene-scoped orchestrator** + prefetch + LRU (`asset-orchestrator.ts`, §5) |
| No manifest / queue | **`build-project-asset-manifest.ts`** + `AssetLoadQueue` (§5.2) |
| No scene-scoped policy | **`collect-scene-asset-refs`** with `scene-static` default (§5.1) |
| No file-watch pipeline | Tauri watch → re-register (§7.2; ASSETS_ROADMAP Phase 4) |
| Clips not at load | `registerAnimationClipsFromAssets` on `editor_load_project` |

**Still open:**

| Gap | Impact | Priority |
|-----|--------|----------|
| **`editor_register_audio` parity** | Logic Board audio weaker in preview until bytes registered | Medium — Phase 2 manual smoke |
| **Normalize scope** | Only entities + tilesets; Logic Board / dialog refs still path-based | Medium |
| **Virtual folders v0** | Create/list Images only; no move/delete UI | Low–Medium |
| **Export round-trip test** | Manifest builder tested; full ZIP ↔ import not automated | Medium — Phase 3 |
| **Fragmented C++ caches** | TextureCache vs TextureManager vs Audio | Low (registry facade later) |
| **`game.wasm` not in git** | Clone/CI must run `build_wasm.bat` | Ops (documented in root `README.md`) |

### 4.3 Asset identity today

From `editor/src/types/index.ts` (`ImageAsset`):

- `id`, `name`, `path` on each asset.
- **Saved projects may use either** stable `ImageAsset.id` or legacy **path** in `spriteAssetId` / `spriteImagePath`.
- `dataUrl` is **transient** (preview / unsaved assets) — correctly **not** serialized to `project.json`.

**Runtime (2026-05-29):** C++ and WASM resolve refs through **`AssetManifestIndex::resolveImageKey`** (id → path, known path passthrough, else legacy ref). Editor **Normalize asset references…** rewrites entity/tileset fields to ids where a library match exists.

### 4.4 Dual paths: editor WASM vs shipped native

| Mode | Who reads bytes | Who owns GPU |
|------|-----------------|--------------|
| **Tauri preview** | TypeScript (Tauri fs) | WASM via `editor_register_image` |
| **Native `game.exe`** | C++ `AssetLoader` from folder / `.artcade` | C++ `TextureManager::load(path)` |
| **Web export shell** | JS `fetch` in bundled `index.html` (`editor/src-tauri/src/main.rs`) | Same WASM IPC |

Unifying **logical asset IDs** across all three is a design goal; physical I/O stays mode-specific.

### 4.5 End-to-end flow today (images, Tauri preview)

```
ProjectDoc.assets
    → useRuntimeAssetUpload (runtime-hooks.ts)
        → readProjectImageBytes OR decode dataUrl in TS (base64 only for unsaved)
        → editorRegisterImage(path, bytes, ext)
            → editor_register_image (editor-api.cpp)
                → Renderer::registerImageFromMemory
                    → TextureCache (keyed by path string)
```

---

## 5. Concrete module map (target vs today)

| Proposed module | Today | Action |
|-----------------|-------|--------|
| `AssetManifest.json` | Packaging manifest in `.artcade` only (version/checksums) | Generate from `ProjectDoc` + referenced files |
| `AssetLoader` (TS) | `useRuntimeAssetUpload` | Replace with queued orchestrator |
| `AssetBridge` | `wasm-bridge.ts` (images only) | Extend: audio, invalidate, errors |
| `AssetRegistry` (C++) | Split caches | Facade over Texture + Audio |
| `SpriteAtlas[]` | Per-path texture entries | Optional batching later |
| Prefetch scheduler | — | `requestIdleCallback` + scene graph |

### 5.1 `collectSceneAssetRefs` — normative specification

**Status:** Spec only (not implemented). Implement in Phase A/B **before** wiring scene-scoped load.

This function is the **static closure** over `ProjectDoc` that answers: *which image files must be registered in the WASM texture cache when scene `sceneId` is active?* It does **not** read disk, decode PNGs, or call WASM — only deterministic JSON walking.

**Code anchors today:**

- Entity materialization: `materializeEntity` / `entitiesForRuntimeSync` in `editor/src/utils/project-object-types.ts`
- Runtime texture key: `SpriteComponent.spriteAssetId` and `TilesetAsset.spriteImagePath` (both are project-relative **paths** until Phase C stable IDs)
- Eager load to replace: `useRuntimeAssetUpload` in `editor/src/panels/preview/runtime-hooks.ts` (loads **all** `project.assets`)

#### Contract

```typescript
/** v1: project-relative path used as TextureCache key (same as spriteAssetId today). */
type SceneAssetLoadKey = string

interface CollectSceneAssetRefsOptions {
  /**
   * scene-static (default): placed instances + tilemap in this scene only.
   * scene+spawn-prototypes: above + sprites for types referenced by static
   *   spawnEntity / spawnEntityAtPointer in Logic Boards tied to this scene.
   */
  scope?: 'scene-static' | 'scene+spawn-prototypes'

  /** Default true — see §5.1.3. */
  includeHiddenInstances?: boolean
}

function collectSceneAssetRefs(
  project: ProjectDoc,
  sceneId: string,
  options?: CollectSceneAssetRefsOptions,
): SceneAssetLoadKey[]
```

| Property | Rule |
|----------|------|
| **Input** | `project`, existing `sceneId`, optional flags |
| **Output** | Sorted, deduplicated `SceneAssetLoadKey[]` (lexicographic sort) |
| **Missing scene** | Return `[]` (do not throw in production; dev builds may assert) |
| **Determinism** | Same project + scene + options → identical array (vitest golden) |

**Callers (Phase B):**

- `AssetOrchestrator.loadScene(activeSceneId)` → collector with default `scene-static` (or project flag for `scene+spawn-prototypes`).
- `prefetchScene(otherSceneId)` → same collector; enqueue at `prefetch` priority.
- Dedup across scenes happens in **`AssetLoadQueue`**, not inside the collector (two scenes sharing a tileset each return the same path).

#### 5.1.1 Inclusion rules (v1 — mandatory)

**A. Entities in the target scene**

Resolve entities **only** for `project.scenes[sceneId]`:

| Project model | Resolution |
|---------------|------------|
| **v2** (`scene.instances[]`) | `materializeEntity(objectTypes[inst.objectTypeId], inst)`, then overlay `project.entities[inst.id]` when present (mirror `entitiesForRuntimeSync`, scene-scoped) |
| **v1** (`scene.entityIds[]`) | `project.entities[id]` for each listed id |

For each resolved entity:

- If `sprite.spriteAssetId` is a non-empty string after `.trim()` → add that path.
- If empty → **no** asset (placeholder / `fillColor` only).

**B. Tilemap**

If `scene.tilemap?.tilesetAssetId` is set:

1. Look up `project.tilesets[tilesetAssetId]`.
2. If found and `spriteImagePath.trim()` is non-empty → add **one** path.

Notes:

- `tilemap.data` does not reference additional files (cells index into the tileset image).
- Legacy palette-only tilemaps (`TileDef` colours, no `tilesetAssetId`) → **no** texture.

**C. Animation clips**

Clips live on `ImageAsset.clips` for the image already referenced by `spriteAssetId`. **No extra paths** in v1.

#### 5.1.2 Explicit exclusions (v1)

| Case | v1 decision | Mitigation |
|------|-------------|------------|
| Assets only in **non-active** scenes | Out of scope for one call | Caller runs collector per scene (active + prefetch list) |
| **“Disabled scene”** flag on `SceneDef` | N/A — no such field exists | Lazy load = per `sceneId`, not a global disable |
| **Lua / hand-written scripts** with dynamic paths | Out of scope | Not soundly analyzable; optional future `collectLogicBoardStaticAssetRefs` |
| **`audio.playSound` in generated Lua** | Out of scope until `editor_register_audio` | Phase B images-only unless audio bridge lands |
| **All** `project.assets` entries | Excluded | Replaces today's eager `useRuntimeAssetUpload` |
| Thumbnails, `logicBoards` JSON blobs, dialog files | Excluded | Not gameplay textures in preview |
| Fonts / shaders (future) | Excluded until schema + register API exist | — |

#### 5.1.3 Edge cases — decisions

| Edge case | Decision |
|-----------|----------|
| **Instance `visible: false`** | **Include** when `includeHiddenInstances !== false` (default **true**). Editor preview still draws hidden instances; play may toggle visibility without a second asset pass. |
| **Shared tileset across scenes** | Each `collectSceneAssetRefs(sceneId)` returns the same `spriteImagePath`; queue dedupes loads. |
| **Empty / whitespace `spriteAssetId`** | Skip. |
| **Unknown `tilesetAssetId`** | Skip tilemap texture (log once in orchestrator). |
| **Runtime `object.spawn(className)`** | **Not** in `scene-static`. With `scene+spawn-prototypes`, add `objectTypes[className].sprite.spriteAssetId` when Logic Board analysis finds a literal `className` (see below). Unknown class → C++ `minimalSpawnDef` (no texture) — no preload. |
| **Entities materialized in other scenes but present in WASM project sync** | Asset load follows **collector output for active (+ prefetched) scenes only**, not the full `entitiesForRuntimeSync()` map — otherwise lazy loading is defeated. |

#### 5.1.4 Optional scope: `scene+spawn-prototypes`

When `scope === 'scene+spawn-prototypes'`, also collect sprite paths for **spawnable types** referenced statically from Logic Boards:

1. Consider boards whose target is reachable from this scene:
   - `entity_class` where at least one live instance of that class exists in `sceneId`, **or**
   - `entity_id` pointing to an instance in `sceneId`.
2. Walk all `LogicEvent.actions` in those boards.
3. For `spawnEntity` / `spawnEntityAtPointer` with a string literal `className`:
   - v2: `project.objectTypes[className]?.sprite.spriteAssetId`
   - v1 fallback: first `project.entities[*]` with matching `className` (same rule as C++ `rebuildClassPrototypes`)

**Conservative default for Phase B:** ship **`scene-static` only**; enable `scene+spawn-prototypes` behind a project/editor flag after tests exist.

**Logic Board gaps (document, do not guess in v1):**

- Boards with global / cross-scene targets not tied to instances in `sceneId`.
- `loadScene` actions: target scene assets are loaded when that scene becomes active (prefetch hook), not merged into the current scene's collector output.

#### 5.1.5 Reference algorithm

```
function collectSceneAssetRefs(project, sceneId, opts):
  scene = project.scenes[sceneId]
  if !scene: return []

  keys = new Set()
  scope = opts.scope ?? 'scene-static'
  includeHidden = opts.includeHiddenInstances !== false

  for E in entitiesInScene(project, scene):   // shared helper, unit-tested
    if !includeHidden && E.visible === false: continue
    p = E.sprite?.spriteAssetId?.trim()
    if p: keys.add(p)

  tsId = scene.tilemap?.tilesetAssetId
  if tsId:
    path = project.tilesets?.[tsId]?.spriteImagePath?.trim()
    if path: keys.add(path)

  if scope === 'scene+spawn-prototypes':
    for className in spawnClassNamesFromLogicBoards(project, sceneId):
      addSpritePathFromPrototype(project, className, keys)

  return [...keys].sort()
```

Implement `entitiesInScene` once in `editor/src/utils/` (e.g. `collect-scene-asset-refs.ts`) and reuse in tests — do not duplicate materialization logic in the orchestrator.

#### 5.1.6 Required vitest cases

1. Two instances, same `spriteAssetId` → one path in output.
2. `visible: false` with defaults → path still present.
3. Two scenes, same `tilesetAssetId` → identical path string from both collectors.
4. `spriteAssetId: ''` → no path.
5. v2: `project.entities[id]` override changes path vs object-type-only materialization.
6. Unknown `sceneId` → `[]`.
7. (`scene+spawn-prototypes`) board with `spawnEntity { className: 'Coin' }` on scene entity → Coin type sprite path included.

#### 5.1.7 Mapping paths → load requests (Phase A)

Collector returns **paths**; orchestrator resolves against `project.assets`:

```typescript
function pathsToDescriptors(project: ProjectDoc, paths: SceneAssetLoadKey[]): AssetDescriptor[] {
  const byPath = new Map(Object.values(project.assets ?? {}).map(a => [a.path, a]))
  return paths
    .map(p => byPath.get(p))
    .filter((a): a is ImageAsset => a != null)
    .map(a => ({ id: a.id, type: 'image' as const, path: a.path, ext: extname(a.path) }))
}
```

Paths referenced by entities but **missing** from `project.assets` should surface a **console warning** (inspector already shows orphan paths) — do not silently skip in dev.

Apply **`resolveImageLoadKey`** (§3.4) to each collected path/id before enqueueing loads.

### 5.2 `AssetLoadQueue` — errors, cancellation, and UX

**Status:** Implemented in `editor/src/utils/asset-orchestrator.ts` (generation token, `AssetLoadResult`, deduped failures).

The queue must define preview behaviour on failure and scene supersession — these cases drive every error UX in Tauri preview.

#### 5.2.1 Load result contract

```typescript
interface AssetLoadFailure {
  path: string
  reason: string   // e.g. 'read_failed', 'empty_bytes', 'register_rejected', 'not_in_library'
}

interface AssetLoadResult {
  ok: boolean           // true if zero failures OR partial success policy accepted
  loaded: string[]      // paths successfully registered in WASM
  failed: AssetLoadFailure[]
  cancelled?: boolean   // true if aborted due to scene/generation supersession
}
```

`loadScene(sceneId)` **must not throw** on per-asset failure; it returns `AssetLoadResult`.

#### 5.2.2 `readFile` / register failure

| Situation | Behaviour |
|-----------|-----------|
| Tauri `readFile` fails (moved, permissions, missing file) | Record in `failed`; **do not block** scene activation or project sync |
| Empty bytes / decode rejected in WASM | Same as above |
| Path in collector but missing from `project.assets` | Warn once (§5.1.7); attempt read by path if file exists on disk |
| Runtime draw while asset missing | **Placeholder** — `Renderer::drawSprite` already draws `fillColor` / 32×32 when `getByPath` misses (`renderer.cpp`) |
| Editor feedback | Console: `[Asset] Failed to load: <path> (<reason>)` — **dedupe** by path per editor session |
| Retry | Re-enqueue on project save, `fs.watch` (Phase D), or explicit `loadScene` retry |

**Policy:** Scene load is **non-blocking** — gameplay/preview continues with placeholders for failed textures.

#### 5.2.3 Scene change while queue is in flight

Use a monotonic **`loadGeneration`** (or equivalent) per orchestrator instance:

```typescript
let loadGeneration = 0

async function loadScene(sceneId: string): Promise<AssetLoadResult> {
  const gen = ++loadGeneration
  const paths = collectSceneAssetRefs(project, sceneId)
  const loaded: string[] = []
  const failed: AssetLoadFailure[] = []
  for (const path of paths) {
    if (gen !== loadGeneration) {
      return { ok: loaded.length > 0, loaded, failed, cancelled: true }
    }
    // read + editorRegisterImage; on error push to failed, continue
  }
  return { ok: failed.length === 0, loaded, failed }
}
```

| Job type | On scene switch (generation stale) |
|----------|-----------------------------------|
| **`critical`** (active scene) | **Do not** call `editor_register_*` if `gen !== loadGeneration` after async read returns. In-flight disk reads may finish but registration is skipped. |
| **`prefetch`** | **Cancel** via `cancelPrefetch(sceneId)` — bump generation or invalidate prefetch token; discard registrations for abandoned prefetch. |
| **Already registered** | Textures remain in `TextureCache` (harmless; helps if user switches back). Phase D LRU may evict later. |

**Do not** drain the entire previous scene’s queue after the user has switched away — wastes I/O and can flash wrong-scene assets if registration is not guarded.

#### 5.2.4 Dedup and priority

- **Dedup:** Same resolved path enqueued once per generation; concurrent `loadScene` + `prefetchScene` share the in-flight promise map.
- **Priority:** `critical` runs before `prefetch`; prefetch only when `requestIdleCallback` / idle scheduler fires (Phase B).

#### 5.2.5 Required vitest cases

1. `readFile` mock rejects → `failed` populated, `ok: false`, scene promise still resolves.
2. Switch scene mid-loop → `cancelled: true`, no register for paths only belonging to the old scene after stale gen.
3. Duplicate paths in collector → single read/register.
4. Console dedupe — two failures same path → one log line (mock logger).

---

## 6. Recommended implementation phases

Aligned with `docs/ASSETS_ROADMAP.md` — incremental delivery, no big-bang.

### Phase A — Bridge contract (foundation)

**Goal:** One orchestration API in TS; thin C++ register functions per asset type.

- [x] `AssetDescriptor { id, type, path, ext }` from `ProjectDoc.assets`
- [x] `AssetLoadQueue` per **§5.2** (generation token, `AssetLoadResult`, non-blocking failures)
- [x] `resolveImageLoadKey` per **§3.4**
- [x] Implement `collectSceneAssetRefs` per **§5.1** (`editor/src/utils/collect-scene-asset-refs.ts`)
- [x] Refactor `useRuntimeAssetUpload` → `performRuntimeSceneAssetSync` via `pathsToDescriptors`
- [x] Document handoff in `REACT_WASM_PATTERN.md`
- [x] Backward compat: `spriteAssetId` may still equal `path` until manifest draw path uses ids

**Tests:** vitest **§5.1.6** + **§5.2.5** queue cases  
**DoD:** Opening a project loads assets for the **active scene** only, not the full library.

---

### Phase B — Scene-scoped load + prefetch

**Goal:** Load on scene enter; prefetch neighbors when idle.

- [x] Wire `AssetOrchestrator.loadScene` → `collectSceneAssetRefs(activeSceneId)` (§5.1)
- [x] Hook scene change via `useRuntimeAssetUpload` / `PreviewPanel` asset sync
- [x] Prefetch: other `ProjectDoc.scenes` keys on `requestIdleCallback`
- [x] LRU eviction via `evictLru` when cache exceeds cap (non-active paths first)
- [x] Optional flag: `scope: 'scene+spawn-prototypes'` (§5.1.4) on collector

**Tests:** §5.1.6 + integration test orchestrator calls collector on scene switch  
**DoD:** Scene switch in preview loads new textures; manual smoke in Tauri.

---

### Phase C — Stable IDs + export manifest

**Goal:** Same index for editor, `.artcade`, and native.

- [x] Align with **ASSETS_ROADMAP Phase 3** (`exportArtcadePackage`)
- [x] Manifest entry: `{ id, type, relativePath, sha256? }` via `build-project-asset-manifest.ts`
- [x] Manifest resolve layered on **§3.4** dual-read (no mandatory rewrite on open)
- [x] C++: optional `assetId` in draw path when manifest present (`AssetManifestIndex` + `Renderer::setTextureKeyResolver`)

**Breaking change:** None for open — dual-read preserves saved projects. Document new export format only.

---

### Phase D — Lifecycle (hot-reload + memory cap)

**Goal:** File changes on disk refresh preview; evict distant scenes under pressure.

- [x] **ASSETS_ROADMAP Phase 4:** Tauri `fs.watch` on `assets/**` → **re-register** same key (§7.2)
- [x] `editor_invalidate_asset` for eviction / LRU only (§7.2)
- [x] LRU when registered count > `ASSET_CACHE_MAX_ENTRIES` (96)

---

### Parallel tracks (existing ASSETS_ROADMAP)

| Track | Phase | Notes |
|-------|-------|--------|
| Animation clips UI + `defineClip` at load | 1b–1d | Metadata in JSON; C++ parser |
| Audio import + `editor_register_audio` | 2 | Mirror image pipeline |
| Export `.artcade` | 3 | Prerequisite for shipping |
| Hot-reload assets | 4 | `fs.watch` + re-register (§7.2); invalidate for LRU |

---

## 7. API sketch (implementation discussion)

### 7.1 TypeScript

```typescript
interface AssetDescriptor {
  id: string
  type: 'image' | 'audio' | 'font'
  path: string          // project-relative, e.g. assets/images/hero.png
  ext?: string          // '.png', '.ogg', …
}

interface AssetLoadRequest {
  descriptor: AssetDescriptor
  priority: 'critical' | 'prefetch'
  generation: number    // must match orchestrator.loadGeneration to register
}

interface AssetOrchestrator {
  enqueue(req: AssetLoadRequest): void
  loadScene(sceneId: string): Promise<AssetLoadResult>  // §5.2.1
  prefetchScene(sceneId: string): void
  cancelPrefetch(sceneId: string): void
}
```

Queue semantics: **§5.2**. Reference resolution: **§3.4**.

### 7.2 WASM exports — register, hot reload, invalidate

#### Existing: path-keyed indirection (no entity GPU handles)

Entities store a **logical key** (`spriteAssetId` / path today). Each draw calls `TextureCache::getByPath(key)` — entities do **not** cache `Texture2D` pointers.

`editor_register_image(assetKey, data, len, ext)` → `TextureCache::registerFromMemory`:

- **New key:** allocate handle, store texture.
- **Existing key:** **in-place swap** — `UnloadTexture(old)` then assign `new` on the **same** handle (`texture-cache.cpp`, comment “re-upload / hot-swap”).

This is the handle-indirection pattern: stable slot per path, swap contents synchronously inside one WASM call.

#### Hot reload (Phase D) — preferred path

**Do not** use invalidate-then-async-register (causes multi-frame cache miss → placeholder flicker).

```
fs.watch → TS readFile → editor_register_image(sameAssetKey, newBytes, …)
```

- Runs synchronously in WASM before the next frame draw.
- Entities see the new texture on the next `drawSprite` without re-syncing entity JSON.

#### `editor_invalidate_asset` — eviction only (planned)

```cpp
void editor_register_image(const char* assetKey, const uint8_t* data, int len, const char* ext);
void editor_register_audio(const char* assetKey, const uint8_t* data, int len, const char* ext);

// Explicit cache removal — NOT the hot-reload entry point
void editor_invalidate_asset(const char* assetKey, const char* type);
```

| Parameter | v1 meaning |
|-----------|------------|
| `assetKey` | Same string as register: **resolved path** until Phase C adds id→path in TS before IPC |
| `type` | `"image"` \| `"audio"` (extensible) |

**Postconditions after invalidate:**

- Entry removed from `TextureCache` / audio pool; GPU memory freed.
- Same-frame and subsequent draws: cache miss → **placeholder** (sprites) or silent no-op (audio) until a new register.
- **No** automatic reload — TS orchestrator must register again if the asset is still needed.

**Ordering vs register:**

| Sequence | Result |
|----------|--------|
| `register` (same key, new bytes) | In-place swap, **no** visible gap if completed before draw |
| `invalidate` then later `register` | Gap frames with placeholder — **avoid** for file watch hot reload |
| `invalidate` without re-register | Intentional unload (scene far from active, LRU) |

**Threading:** WASM preview is single-threaded render loop; no cross-thread atomic swap required today. If registration becomes async later, use **double-buffer**: decode off-thread → swap pointer in cache → then `UnloadTexture(old)`.

#### Rename note

Phase D checklist previously said `editor_invalidate_texture` — normative name is **`editor_invalidate_asset`** with `type` for symmetry with audio.

### 7.3 Lua / gameplay

Gameplay continues to reference assets via entity fields and Lua APIs:

- `entity.sprite.spriteAssetId` (today: path string)
- `audio.playSound(path)` → future `audioAssetId` with compile-time resolve (ASSETS_ROADMAP 2d)

---

## 8. Non-goals (v1)

- Decoding images in JavaScript for the engine (`Canvas`, `createImageBitmap`)
- Storing GPU textures in React state or Redux
- Per-frame network asset fetch during gameplay
- Full Logic Board–driven prefetch graph (defer to v2)
- Asset encryption (future — noted in AGENTS.md)

---

## 9. Repository file index

| Area | Path |
|------|------|
| TS image read | `editor/src/utils/asset-file-api.ts` |
| WASM register | `editor/src/utils/wasm-bridge.ts` (`editorRegisterImage`) |
| Preview upload hook | `editor/src/panels/preview/runtime-hooks.ts` (`useRuntimeAssetUpload`) |
| Scene asset sync | `editor/src/panels/preview/runtime-asset-sync.ts` |
| Orchestrator | `editor/src/utils/asset-orchestrator.ts` |
| Export manifest | `editor/src/utils/build-project-asset-manifest.ts` |
| Hot-reload | `editor/src/utils/asset-watcher.ts`, `reload-project-asset.ts` |
| Runtime sync | `editor/src/utils/runtime-sync-service.ts` (`assetCacheInvalidator`) |
| C++ IPC | `runtime-cpp/src/modules/editor-api/src/editor-api.cpp` |
| Texture upload | `runtime-cpp/src/modules/renderer/src/texture-cache.cpp` |
| Native I/O | `runtime-cpp/src/modules/asset-system/` |
| Asset types | `editor/src/types/index.ts` (`ImageAsset`, `ProjectDoc.assets`) |
| Phased delivery | `docs/ASSETS_ROADMAP.md` |
| WASM asset policy | `docs/ARCHITETTURA_TECNICA_ENGINE_2D.md` §10 |
| React/WASM boundaries | `docs/REACT_WASM_PATTERN.md` |
| Packaging manifest | `runtime-cpp/tools/pack-artcade.py`, `.artcade` ZIP layout |

---

## 10. Resolved decisions (reference)

| Topic | Decision | Section |
|-------|----------|---------|
| Stable ID migration | **Dual-read** with path fallback; no big-bang on open | §3.4 |
| Hot reload | **Re-register** same key; invalidate is for eviction | §7.2 |
| Load failures | Non-blocking scene load; placeholder + console | §5.2.2 |
| Scene switch during load | **Generation token**; skip stale register | §5.2.3 |

---

## 11. Open questions for collaborator review

1. **Prefetch scope v1:** All scenes in project vs only scenes reachable via `loadScene`? *(Collector is per-scene — §5.1; prefetch policy is orchestrator-only.)*
2. **Zero-copy priority:** Required for MVP, or ship with `HEAPU8.set` copy first?
3. **Audio in preview:** Block Phase B on `editor_register_audio`, or ship images-only first?
4. **Manifest source:** Vite build-time only vs regenerate on every Save in editor?
5. **Tilemap assets:** Keep JSON-only via project sync, or also support binary layer exports?

---

## 12. Collaborator proposal (reference)

Original schema summary for traceability:

1. **WASM owns assets** — TS never becomes a long-term binary intermediary.
2. **TS reads from disk** via Tauri; passes buffers to WASM; does not interpret content.
3. **Lazy per scene** + idle prefetch; unload when memory exceeds threshold.
4. **WASM decodes** formats; TS exception for structured tilemap JSON.
5. **AssetManifest** at build time maps stable IDs to paths.
6. **Layers:** AssetLoader (TS) → AssetBridge → AssetRegistry (C++) with TextureAtlas, TilemapData, AudioBuffer, ShaderProgram.

This document validates that direction against the repo and sequences work through `ASSETS_ROADMAP.md`.

### 12.1 Editor UI — Project Explorer (canvas mode)

The left sidebar uses **`ProjectExplorerPanel`** (`editor/src/components/project-explorer/`) with a unified scrollable tree:

| Section | Capabilities (2026-05-29) |
|---------|-------------------------|
| **Scenes** | Add, duplicate (entities + `entity_id` logic boards), rename, delete, set start; labeled CTAs + context menus |
| **Entities** | Per active scene; rename, delete, open Logic Board |
| **Entity types** | Add, rename display name, delete (blocked if instances exist) |
| **Assets** | Fixed folders: Audio, Fonts, Images, Scripts, Tilesets; import/remove; **Expand all**; image **New Folder** (virtual) |
| **Virtual folders** | `project.json` → `assetVirtualFolders` (codec round-trip). **v0:** create under Images only; assets listed under folder; **no** move-to-folder / delete-folder UI yet (`ASSET_MOVE_TO_FOLDER` / `ASSET_FOLDER_DELETE` reducers exist) |

**Related modules:**

- Import / remove / selection: `editor/src/hooks/useAssetExplorerActions.ts`
- Scene / entity / type actions: `editor/src/hooks/useSceneExplorerActions.ts`
- Tree model + search: `editor/src/utils/project-explorer-tree.ts`
- Audio/font preview strip: `editor/src/components/asset-explorer/AssetMediaDetailStrip.tsx`
- Normalize refs: File menu → `PROJECT_NORMALIZE_ASSET_REFS` → `editor/src/utils/normalize-asset-refs.ts`

---

## 13. Conclusion

The proposed architecture matches long-term engine docs and is **implemented for Tauri preview and native draw** (phases A–D): orchestration, scene-scoped load, manifest export, dual-read ids, invalidate/watch, and LRU.

**Remaining work to “close the circle”** (see `ASSETS_ROADMAP.md` closure log + § Explorer):

1. **Manual smoke** on preview (id vs path sprites, duplicate scene + boards, virtual folder save/reload, disk hot-reload).
2. **Explorer v1:** UI for move/delete virtual folders; optional folders on audio/font/tileset.
3. **Tests:** full `.artcade` export → import round-trip; extended normalize (Logic Board asset refs).
4. **Ops:** run `runtime-cpp/build_wasm.bat` after C++ changes (`game.wasm` is gitignored).

**Recommended next engineering step:** virtual-folder UI (`ASSET_MOVE_TO_FOLDER`) or automated export round-trip test — whichever unblocks shipping confidence first.

---

*For implementation tasks and Definition of Done per sub-phase, use `docs/ASSETS_ROADMAP.md`.*
