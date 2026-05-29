# Assets & Sprites Roadmap

Document of record for the work on asset loading and usage. Each phase MUST
be closed, validated, and tested before starting the next. If a phase grows
during execution, split it into the listed sub-phases (or add new ones) and
apply the same DoD per sub-phase.

**Owner:** Antonio + Codex · **Started:** 2026-05-25 · **Last updated:** 2026-05-29  
**Status:** Core phases 1–5 and asset-pipeline A–D are implemented in code; per-phase closure checklists below still need manual smoke and (where noted) stronger automated tests before calling each phase fully closed.

---

## Definition of done — applies to every phase / sub-phase

A phase is closed only when ALL the following are true:

1. **Schema & types** — added or updated; tsc `--noEmit` is clean.
2. **Editor UI** — the user can reach the feature from the existing panels;
   no dead entry points.
3. **Runtime wiring** — the C++ runtime consumes the new data through the
   existing `editor-api` / `project-doc-parser` path (or via a documented
   new path).
4. **Persistence** — round-trips through `project.json` save/load and through
   `.artcade` export+import (once Phase 3 lands; before then, save/load only).
5. **Unit tests** — schema serialization, compiler emission, and any new
   utility helpers covered. `npx vitest run` passes.
6. **Manual smoke** — verified live in the editor preview (Tauri) with a
   minimal scene; screenshot or short note in the phase's "Closure" section
   at the bottom of this doc.
7. **Docs** — this file's status updated; any new public concept added to
   `docs/README.md` index.
8. **Internal review pass** — explicit code review of the phase's diff
   before marking closed: hunt for bugs, regressions, conflicts with
   surrounding code, edge cases, hidden coupling. Findings either fixed in
   the same phase or filed as follow-up notes in the closure log. Only
   *after* the review may the phase be checked off and the next one started.

---

## Phase 1 — Animation clips (sprite sheet + clip definitions)

**Goal:** let the user slice a sprite sheet into frames and group them into
named clips with fps + loop, then play them with the existing
`playAnimation` / `onAnimationEnd` Logic Board nodes.

**Why first:** the runtime already has `SpriteAnimator::defineClip`; the only
missing piece is editor authoring + the `defineClip` call at load time. High
value-for-effort and unblocks two Logic Board nodes that today reference
clips that don't exist.

### 1a — Schema for clips on `ImageAsset` ✅

- ✅ Added `AnimationClipDef`, `AnimationFrameRect` + `clips?` on `ImageAsset`
  in [editor/src/types/index.ts](../editor/src/types/index.ts).
- ✅ `parseProjectDoc` / `serializeProjectDoc` round-trip `clips` (and, while
  there, `imagePoints` — pre-existing gap silently dropped on save before).
- ✅ Defensive parser drops malformed clips (empty name, empty frames, NaN
  rect, invalid fps → default 12).
- ✅ Tests in [editor/src/store/editor-store.assets.test.ts](../editor/src/store/editor-store.assets.test.ts):
  clips round-trip, imagePoints round-trip, malformed-clip defensive case.
- ✅ 288/288 vitest green, tsc clean.
- ✅ Retroactive review (rule #8 introduced after this sub-phase landed):
  - **OK** new fields are additive + optional → backward compat preserved;
  - **OK** parser is defensive on every numeric/string field;
  - **OK** serializer omits empty arrays so existing-project JSON byte-equal
    on save/load when no clips/points present;
  - **Note** runtime C++ parser does NOT yet read `clips` — sub-phase 1c
    will close this; until then `playAnimation` still references undefined
    clips (no regression: same state as before this sub-phase).

### 1b — Editor authoring UI ✅

- ✅ `AnimationClipsEditor` on image asset detail in `ProjectExplorerPanel` → `AssetDetailStrip` (grid slicer + preview).
- New "Animations" tab inside the existing image asset detail (or a modal),
  reusing the Tileset grid-slicer pattern (cell size + selection rectangle).
- Allow: add clip, name it, pick frames by clicking cells, set fps + loop.
- Live preview of the clip (looped playback in a small canvas).
- **Test:** reducer test for add/remove/rename clip + frame selection.

### 1c — Runtime wiring ✅ (preview path)

- ✅ `project-doc-parser` + `parseImageAssets` supply clip metadata.
- ✅ On `editor_load_project`, `registerAnimationClipsFromAssets` →
  `SpriteAnimator::defineClip` (`editor-api.cpp`).
- **Test:** C++ `sprite_animator_test`; end-to-end `playAnimation` smoke still
  manual (see closure checklist).

### 1d — Wire `onAnimationEnd` out of stub

- Remove the "needs engine hook (stub)" annotation from
  [logic-board.ts:38](../editor/src/types/logic-board.ts:38).
- Verify the registration emitted by `emit-event-registration.ts` actually
  fires via `animation.onFinished` end-to-end (it's already plumbed but
  marked stub).
- **Test:** Logic Board compiler test + manual smoke firing a non-loop clip.

### Closure checklist
- [x] tsc clean
- [x] vitest green (incl. new tests)
- [ ] manual smoke: define a 4-frame "walk" clip on a sprite, scene plays it
- [ ] manual smoke: non-loop clip fires `onAnimationEnd`
- [x] docs/ASSETS_ROADMAP.md status updated

---

## Phase 2 — Audio assets

**Goal:** asset library + import for sound effects and music; `playSound` /
`playMusic` Logic Board actions accept an `audioAssetId` (path stays as
fallback for retro-compat with existing projects).

### 2a — Schema & storage

- `AudioAsset { id; name; path; category?: 'sfx' | 'music'; volume?: number }`.
- `ProjectDoc.audioAssets?: Record<string, AudioAsset>`.
- Round-trip in project codec.
- **Test:** codec round-trip.

### 2b — Import pipeline

- Tauri dialog filter for `.ogg .wav .mp3`.
- `importAudioIntoProject` (mirror of `importImageIntoProject`) copies into
  `assets/audio/`.
- **Test:** unit test on the path-rewriting helper.

### 2c — Asset browser tab

- Add audio preview in the Project Explorer asset tree (folder Audio), with play/stop preview using
  the browser's `HTMLAudioElement`.
- **Test:** reducer / panel rendering smoke.

### 2d — Logic Board action update

- Extend `playSound` / `playMusic` action schemas with
  `audioAssetId?: string` alongside the existing `path`.
- Compiler: when `audioAssetId` is set, resolve to the asset's `path` at
  emit time; fall back to `path` otherwise.
- **Test:** compiler emission test for both shapes.

### Closure checklist
- [x] tsc clean (editor `npm run build`)
- [x] vitest green (`cd editor; npm test -- --run`)
- [ ] manual smoke: import an OGG, drop it into a `playSound` action, hear it
- [ ] existing projects with raw-path `playSound` still work

---

## Phase 3 — Export `.artcade`

**Goal:** single-file distribution. File menu "Export .artcade" produces a
ZIP with `project.json`, `assets/`, compiled Lua, and a manifest with
checksums + version. Mirror of the existing `importArtcadePackage`.

**Why before Phase 4:** prerequisite for any kind of shipping to early-access
users. Hot-reload is dev-side quality of life and can wait.

### 3a — ZIP writer

- New helper `exportArtcadePackage(project, destPath)` in
  [editor/src/utils/artcade-package.ts](../editor/src/utils/artcade-package.ts).
- Custom deflate writer mirroring the existing reader, or pull a small ZIP
  lib (preferably zero-deps to keep bundle slim).
- Manifest: `{ version, exportedAt, checksums: { 'path': sha256 } }`.
- **Test:** round-trip — export then `importArtcadePackage` yields equal
  `ProjectDoc`.

### 3b — Asset collection

- Walk `assets/` (images, tilesets, future audio/fonts), include only files
  referenced by `ProjectDoc` (drop orphans).
- Include compiled Lua bytecode (`scripts/*.luac`) — verify the compile path
  produces bytecode at the right location.
- **Test:** orphan exclusion + reference inclusion.

### 3c — UI hook

- File menu entry "Export .artcade" → Tauri save dialog → call writer.
- Progress + success toast; error surfaced in console panel.

### 3d — Runtime validation

- Confirm `AssetLoader::loadArtcade` parses the produced manifest (it
  already supports ZIP but verify manifest schema matches).
- Smoke: build native `.exe` runtime, double-click an exported `.artcade`,
  game runs.

### Closure checklist
- [x] `exportArtcadePackage` + File menu hook (`useFileMenuActions.tsx`)
- [x] manifest builder unit test (`export-artcade-package.test.ts`)
- [ ] export → import round-trip is byte-for-byte equivalent on full `project.json`
- [ ] export → native runtime can load and play
- [ ] orphan files (unreferenced assets) NOT included (verify with fixture project)
- [x] vitest green, tsc clean

---

## Phase 4 — Hot-reload assets

**Goal:** when the user replaces an image/audio on disk (e.g. saves in
Aseprite), the preview updates without restart.

### 4a — Filesystem watcher

- Tauri-side `fs.watch` (or polling fallback) on `assets/**`.
- Debounce 200ms; on change → emit `asset-changed` event with the relative
  path.
- **Test:** unit test on the debouncer + path-normaliser.

### 4b — Sync service extension

- `runtime-sync-service` already exists for Logic Boards. Add an
  `asset-changed` handler that:
  1. Re-reads bytes,
  2. Computes new hash; skip if unchanged,
  3. Sends `invalidateTexture(assetId)` or `invalidateAudio(assetId)` over
     the editor-api bridge.
- **Test:** mock-driven test of the change pipeline.

### 4c — Runtime invalidation API

- Add `editor-api` endpoints: `invalidateTexture`, `invalidateAudio`.
- C++ side drops the cached entry from `TextureCache` / audio cache; the
  next draw / play reloads from disk.
- **Test:** C++ smoke or scripted scenario.

### 4d — UX

- Tiny toast or status-bar line: "Reloaded: assets/images/player.png".
- Don't spam — coalesce burst events.

### Closure checklist
- [x] Tauri `fs.watch` + debounce → re-register (`asset-orchestrator.ts`; see
  `ASSET_PIPELINE_ARCHITECTURE.md` §7.2)
- [x] `editor_invalidate_asset` + LRU cap in preview orchestrator
- [ ] edit a PNG in an external tool, see it update in preview within 1s (manual)
- [ ] no leaks (texture cache size doesn't grow on repeated reloads)
- [ ] disabling watcher via a setting (escape hatch)

---

## Phase 5 — Font assets

**Goal:** mirror of audio for `.ttf` / `.otf` fonts.

### 5a — Schema & import
- `FontAsset { id; name; path; defaultSize?: number }` + import dialog.

### 5b — Runtime API
- Lua: `text.draw(fontAssetId, str, x, y, size?, color?)`.
- C++: register loaded fonts in a font cache; draw with Raylib's `DrawTextEx`.

### 5c — Logic Board action (optional)
- New `drawText` action — or keep this strictly script-side. Decide during
  the phase.

### Closure checklist
- [x] 5a schema + import (`FontAsset`, `assets/fonts/`, Asset Browser tab)
- [x] 5b Lua `text.draw(path, …)` + `FontCache` + `editor_register_font`
- [ ] manual smoke: import TTF, `text.draw` in preview
- [x] fallback to default font when path is missing/invalid (DrawText)
- [ ] Logic Board `drawText` action (deferred — script-only for now)

---

## Cross-cutting concerns

### CC1 — Project doc backward compatibility
Every new optional field must be safe to parse from a project saved by an
older editor (= field missing). Codec tests should include a "load doc
without field X" case for each new field.

### CC2 — Asset id stability
Once an asset has an id, never reassign it on rename; the id is what other
project entities reference. Renames touch only the display `name`.

### CC3 — Storage layout discipline
- `assets/images/` — image files
- `assets/audio/` — audio files
- `assets/fonts/` — font files (Phase 5)
- `scripts/` — Lua source and compiled bytecode
- `project.json` — root manifest

Any new asset kind extends this convention.

---

## Explorer & stable IDs (post-pipeline, 2026-05-29)

Work landed after pipeline phases A–D (commits `ab471f0`, `e68928b`, `952aa43` on `main`).

| Item | Status | Notes |
|------|--------|--------|
| C++ `AssetManifestIndex` + dual-read draw | ✅ | `Renderer::setTextureKeyResolver`; native `AssetLoader`; WASM manifest rebuild on `editor_load_project` |
| File → **Normalize asset references…** | ✅ | `normalize-asset-refs.ts`; entities, tilesets, Logic Board `playSound` / `playMusic` |
| Scene duplicate + Logic Board clone | ✅ | `SCENE_DUPLICATE` remaps `entity_id` boards |
| Entity type rename / delete | ✅ | Explorer + `object-type-reducer` |
| Virtual folders (`assetVirtualFolders`) | ✅ | Images, audio, fonts, tilesets — New Folder, move/remove via context menu |
| Audio/font detail strip | ✅ | `AssetMediaDetailStrip` (preview from disk when project saved) |
| Export manifest + ZIP round-trip | ✅ | `buildArtcadeZipBytes` + `parseArtcadePackageBytes` vitest |
| Preview spawn-prototype preload | ✅ | Canvas toolbar toggle → `scene+spawn-prototypes` scope |
| **Spritesheet Studio** (modal + engine preview) | ✅ | `editor/src/panels/spritesheet-studio/`; `editor_reregister_animation_clips`; `editor_preview_spritesheet_tick`; `Renderer::captureSpriteRegionFrame`; does not hide main preview canvas |
| CI (vitest, native, wasm) | ✅ | `.github/workflows/ci.yml` |
| Console REPL / LSP Lua | ❌ | Deferred — spike in `TECHNICAL_OVERVIEW.md` §11.1 |

**Manual smoke checklist (recommended before marking explorer track closed):**

1. Preview sprite referenced by **path** and by **library id** after Normalize.
2. Duplicate scene that has an **entity_id** Logic Board — board still runs on clone.
3. Create image virtual folder → save → reload — folder and membership persist.
4. Replace PNG on disk — preview updates without restart (Phase 4).
5. Open **Spritesheet Studio** on an image → engine preview canvas animates; scene preview still visible; `animation.play` uses clip name after save.

---

## Closure log (append on each phase close)

| Phase | Closed on | Validated by | Notes |
|------:|-----------|--------------|-------|
| 1 | 2026-05-29 (partial) | vitest; `registerAnimationClipsFromAssets` | 1a–1b ✅; 1c preview ✅; 1d + manual walk/`onAnimationEnd` smoke open |
| 2 | 2026-05-29 (partial) | vitest; `editor_register_audio` | Schema/import/UI/compiler in tree; manual hear-in-preview open |
| 3 | 2026-05-29 (partial) | `export-artcade-package.test.ts`; File menu | Export ships; full import round-trip + native `.artcade` smoke open |
| 4 | 2026-05-29 (partial) | orchestrator + `editor_invalidate_asset` | Watch + re-register ✅; leak test + disable setting open |
| 5 | 2026-05-29 (partial) | `editor_register_font`; FontCache | 5a–5b ✅; manual TTF smoke + Logic Board `drawText` deferred |
| Explorer | 2026-05-29 | vitest + CI | Virtual folders all categories; normalize audio; export round-trip |
| Spritesheet Studio | 2026-05-29 | vitest + WASM build | Modal UI (fase 1); clip hot-sync + engine canvas preview (fase 2); manual smoke item 5 above |
