# ArtCade Simplification Refactor Plan

> Status: delivery plan, July 2026.
> Goal: remove unnecessary complexity while preserving the product, the current ProjectDocument contract, and the runtime/editor boundaries.
> Canonical guardrails: `AGENTS.md`, `.cursor/rules/cursorrules-artcade.mdc`, `NORTH_STAR_ARCHITECTURE.md`, `AUTHORING_COMMAND_ARCHITECTURE.md`.

---

## 1. Objective

ArtCade must become easier to reason about:

- One durable source of truth: `ProjectDocument` / `ProjectDoc`.
- One entry point for persistent authoring changes.
- One handler per domain/action family.
- UI components only render, collect input, and dispatch typed commands.
- Runtime/play state never writes into authoring data without an explicit command.
- Domains only do what they were designed to do.
- Old compatibility paths are removed after the new path covers the behavior.

This is a simplification refactor, not a rewrite. Each tranche must delete or privatize an old path before it is considered done.

---

## 2. Current Hotspots

| Area | Current issue | Files to audit first |
|------|---------------|----------------------|
| Store action surface | One large `Action` union mixes authoring, workspace, runtime, modal, volatile, and persistence concerns. | `editor/src/store/editor-store-state.ts`, `editor/src/store/editor-store.tsx` |
| Reducer pipeline | Every action passes through many domain reducers, so ownership is implicit and easy to blur. | `editor/src/store/reducers/*` |
| UI dispatching raw mutations | Panels dispatch low-level authoring actions directly. | `ProjectExplorerPanel.tsx`, `InspectorPanel.tsx`, `Dialog*`, `LogicBoard*`, preview toolbar |
| Asset deletion | Asset removal scrubs refs instead of using a dependency policy; some refs can drift after normalization. | `scene-reducer.ts`, `strip-project-asset-refs.ts`, `normalize-asset-refs.ts` |
| Dialogs | Dialog edits dirty data but are excluded from project history. | `dialog-reducer.ts`, `project-history.ts`, `panels/dialog/*` |
| Object model | `entities` still acts as an edit-time source in some flows; target is object types + scene instances, with entities as derived runtime view. | `entity-reducer.ts`, `object-type-reducer.ts`, `project-object-types.ts`, `project-queries.ts` |
| Layers | Display names are internal keys. | `layer-reducer.ts`, `scene-reducer.ts`, `types/index.ts`, layer UI |
| Validation | Load/save/import/manual edits do not all enter through one validation path. | `project-validator.ts`, `project-codec.ts`, `project-migrations.ts`, `project-persist.ts`, `project-file-api.ts` |
| Runtime sync | Preview sync must remain a projection, never a hidden authoring writer. | `runtime-sync-service.ts`, `runtime-sync-diff.ts`, `panels/preview/*`, `wasm-bridge.ts` |

---

## 3. Target Shape

```txt
editor/src/authoring/
  command-dispatcher.ts
  command-result.ts
  document-transaction.ts
  project-document-store.ts
  commands/
    assets.ts
    dialogs.ts
    logic-board.ts
    objects.ts
    scenes.ts
    settings.ts
    layers.ts
  validation/
    validate-command.ts
    validate-document.ts
  queries/
    project-snapshot.ts
```

State and action families:

```txt
AuthoringCommand -> ProjectDocument -> history/dirty/revision -> snapshot
WorkspaceAction  -> EditorWorkspaceState only
RuntimeAction    -> PlaySession / WASM bridge only
VolatileAction   -> logs, cursor, high-frequency UI signals only
```

Reducer/store target:

```txt
UI
  -> useAuthoringCommands()       for saved project changes
  -> useWorkspaceActions()        for selection, zoom, panels, grid
  -> useRuntimeActions()          for play/preview bridge

Authoring dispatcher
  -> exactly one domain handler
  -> centralized validation
  -> history/dirty/revision
  -> read-only snapshot for UI/runtime projection
```

---

## 4. Refactor Phases

### Phase 0 - Stabilize The Worktree

Do this before code refactors:

1. Resolve or isolate the current editor conflicts.
2. Capture a baseline test/build result.
3. Keep document-only changes separate from behavior changes.
4. Pick one branch for the simplification work.

Exit gate:

- `git status` has no unmerged paths.
- Baseline failures are documented before refactor work starts.

### Phase 1 - Classify Existing Actions

Split the current action list conceptually before moving code.

Deliverables:

1. Add `AuthoringCommand`, `WorkspaceAction`, `RuntimeAction`, and `VolatileAction` type groups.
2. Keep the existing reducer behavior initially; this phase is classification plus tests.
3. Add a mapping file that marks every current action as one of the four families.
4. Add tests for dirty/history expectations by family.

High-value examples:

- `PROJECT_RENAME`, `ENTITY_SET_SPRITE`, `OBJECT_TYPE_RENAME`, `ASSET_ADD`, `DIALOG_UPSERT` -> `AuthoringCommand`.
- `SELECT_ENTITY`, `EDITOR_SET_ZOOM`, `SET_SNAP_TO_GRID`, `DIALOG_OPEN_MODAL` -> `WorkspaceAction`.
- `SET_PLAYING`, runtime preview load/reload, bridge calls -> `RuntimeAction`.
- `LOG`, `SET_CURSOR` -> `VolatileAction`.

Exit gate:

- No behavior change.
- Dirty/history behavior is tested against the family classification.

### Phase 2 - Introduce The Authoring Boundary

Add the new entry point while keeping the old store alive behind an adapter.

Deliverables:

1. Create `editor/src/authoring/command-dispatcher.ts`.
2. Create `dispatchAuthoringCommand(command, context)`.
3. Create `CommandResult` with success, no-op, blocked, and validation-error variants.
4. Add `document-transaction.ts` for:
   - previous document snapshot;
   - next document;
   - validation;
   - dirty/revision;
   - undo/redo snapshot.
5. Add `useAuthoringCommands()` hook so UI stops importing raw project mutation action names.

Exit gate:

- At least one low-risk command goes through the new boundary.
- Existing reducers can still be called internally, but UI must call the new hook for migrated commands.

### Phase 3 - Assets First

Assets are the first domain because they already show correctness risk and cross-domain leakage.

Deliverables:

1. Implement `commands/assets.ts`.
2. Replace raw delete actions with:
   - `importAsset`;
   - `renameAsset`;
   - `moveAsset`;
   - `deleteAsset`.
3. Add a single dependency collector for images, audio, fonts, and tilesets.
4. Delete should default to `blocked` when references exist.
5. If removal-with-detach is supported, make it an explicit command option, not a silent side effect.
6. Fix normalized image refs so stable IDs are compared as IDs, not paths.

Files to migrate:

- `ProjectExplorerPanel.tsx`
- `InspectorPanel.tsx`
- `scene-reducer.ts`
- `strip-project-asset-refs.ts`
- `collect-scene-asset-refs.ts`
- `build-project-asset-manifest.ts`

Exit gate:

- No UI component dispatches `ASSET_REMOVE`, `AUDIO_ASSET_REMOVE`, `FONT_ASSET_REMOVE`, or `TILESET_ASSET_REMOVE`.
- Referenced asset deletion is blocked or explicitly resolved.
- Tests cover normalized refs, dependency blocking, and explicit detach behavior.

### Phase 4 - Dialogs Into Normal Authoring

Dialogs are persisted authoring data and must participate in undo/redo.

Deliverables:

1. Implement `commands/dialogs.ts`.
2. Move create, upsert, rename, delete into `AuthoringCommand`.
3. Keep open/close/select modal state as `WorkspaceAction`.
4. Remove blanket `DIALOG_*` history exclusion.
5. Validate dialog IDs and duplicate names centrally.

Files to migrate:

- `dialog-reducer.ts`
- `project-history.ts`
- `panels/dialog/dialog-modal-api.ts`
- `DialogLibrarySidebar.tsx`
- `DialogScriptEditor.tsx`

Exit gate:

- Dialog edits undo/redo like other project edits.
- Dialog selection/modal changes do not dirty the project.

### Phase 5 - Objects And Scenes

Collapse object/entity duality toward the already documented model: object types + scene instances are authoring; entities are a derived runtime/editor view.

Deliverables:

1. Implement `commands/objects.ts` and `commands/scenes.ts`.
2. Make object creation a single command:
   - create type if needed;
   - place instance in the active scene;
   - reject or explicitly resolve duplicate display names.
3. Make duplication create another instance of the same object type unless the user explicitly duplicates the type.
4. Depromote `project.entities` to derived/materialized data.
5. Remove `buildObjectModelFromEntities` and `syncObjectModelFromEntities` from edit-time flows.
6. Keep compatibility only in load/migration code, then delete when schemaVersion allows.

Files to migrate:

- `entity-reducer.ts`
- `object-type-reducer.ts`
- `scene-reducer.ts`
- `project-object-types.ts`
- `project-queries.ts`
- `ProjectExplorerPanel.tsx`
- `InspectorPanel.tsx`

Exit gate:

- No UI path creates legacy standalone entities.
- Scene membership is `instances[]`.
- `entities` is derived for Inspector/runtime compatibility only, not the source of authoring truth.
- Duplicate names in one scope are blocked or explicitly resolved.

### Phase 6 - Layers With Stable Identity

Layers must stop using display names as internal keys.

Deliverables:

1. Add stable layer IDs.
2. Migrate `tilemapLayers: Record<string, ...>` from name-keyed to ID-keyed.
3. Keep display name as a label only.
4. Update selection, active layer, tile painting, and runtime sync to use IDs.
5. Add migration for existing projects.

Files to migrate:

- `types/index.ts`
- `constants/scene-layers.ts`
- `layer-reducer.ts`
- `scene-reducer.ts`
- `SceneLayersPanel.tsx`
- `ActiveLayerSelect.tsx`
- `LayerSettingsSection.tsx`
- `runtime-sync-diff.ts`
- `wasm-bridge.ts`

Exit gate:

- Renaming a layer does not move or lose tilemap data.
- No persisted internal map uses layer display name as the key.

### Phase 7 - Logic Board Boundary

Logic Board is a domain, not a UI-side mutation soup.

Deliverables:

1. Implement `commands/logic-board.ts`.
2. Keep rulesheet mutations behind domain commands.
3. Keep compile-to-Lua and validator in the Logic Board domain.
4. Remove legacy target fallback paths from edit-time code.
5. Ensure object-type targets remain the only object-bound authoring target.

Files to migrate:

- `logic-board-reducer.ts`
- `panels/logic-board/*`
- `components/logic-board/*`
- `utils/logic-board/*`
- `project-validator.ts`

Exit gate:

- No UI component assembles partial rulesheet patches directly into `ProjectDoc`.
- `entity_id` and `entity_class` are rejected at load/validation or handled only by explicit migration.

### Phase 8 - Save, Load, Import, Paste, AI Generation

All document creation and mutation paths must share validation and migrations.

Deliverables:

1. Create one project document pipeline:
   - parse;
   - migrate;
   - normalize only at boundary;
   - validate;
   - return `ProjectDocument`.
2. Route load, import, paste, drag/drop, AI-generated edits, and manual edits through the same validator/schema rules.
3. Remove UI-side "repair" calls.
4. Ensure every saved document has schema/version markers.

Files to migrate:

- `project-codec.ts`
- `project-document.ts`
- `project-migrations.ts`
- `project-persist.ts`
- `project-file-api.ts`
- `project-path-security.ts`
- `project-validator.ts`

Exit gate:

- There is one documented parse/migrate/validate path.
- No UI component calls project repair/normalize/validate helpers during normal edits.

### Phase 9 - Runtime And Preview As Read-Only Projection

Preview is an execution surface, not authoring storage.

Deliverables:

1. Keep runtime payload generation as a deterministic projection from `ProjectDocument`.
2. Keep play/session state out of dirty/history.
3. Replace any runtime echo that mutates authoring with explicit "commit to project" commands.
4. Keep hot-path allocations intentional and measured in runtime code.

Files to audit:

- `runtime-sync-service.ts`
- `runtime-sync-diff.ts`
- `runtime-fingerprint.ts`
- `panels/preview/*`
- `wasm-bridge.ts`
- `runtime-cpp/src/**` only if a preview contract change requires it.

Exit gate:

- Pressing Play, Stop, runtime movement, logs, profiler polling, and preview reload do not dirty `ProjectDocument`.
- Any "apply runtime state to project" path is an explicit authoring command.

### Phase 10 - Delete Old Paths And Add Gates

The refactor is not complete while old public paths still exist.

Deliverables:

1. Delete or privatize migrated raw Redux actions.
2. Delete compatibility helpers from edit-time code.
3. Add lint or test guards for forbidden imports/usages.
4. Add `rg`-based review checklist entries for raw UI dispatch of authoring actions.
5. Update docs after each domain migration.

Suggested gates:

```txt
rg "dispatch\\(\\{ type: '(ASSET_REMOVE|AUDIO_ASSET_REMOVE|FONT_ASSET_REMOVE|TILESET_ASSET_REMOVE)'" editor/src
rg "syncObjectModelFromEntities\\(" editor/src
rg "buildObjectModelFromEntities\\(" editor/src
rg "target: \\{ type: 'entity_(id|class)'" editor/src
rg "tilemapLayers\\?\\.\\[layerName\\]|tilemapLayers\\[layerName\\]" editor/src
```

Exit gate:

- Each migrated domain has one public command surface.
- Old public mutation paths are gone.

---

## 5. Test Matrix

Minimum tests per touched domain:

| Area | Required tests |
|------|----------------|
| Command dispatcher | success, no-op, blocked, validation error, undo snapshot |
| Assets | dependency collection, blocked delete, explicit detach, normalized refs, serialization |
| Dialogs | create/upsert/rename/delete, undo/redo, modal selection does not dirty |
| Objects/scenes | create type + instance, duplicate instance, duplicate-name policy, derived entity view |
| Layers | migration, rename keeps tile data, paint target by ID, runtime payload |
| Logic Board | rulesheet command, schema validation, compile output, legacy target rejection |
| Save/load | schemaVersion, migration, validation failure, roundtrip |
| Runtime preview | play/stop no dirty, runtime projection fingerprint, no hidden writeback |

Project-level gates:

```txt
cd editor
npm test -- --run
npm run build
```

Runtime gates when C++ or WASM contract changes:

```txt
cd runtime-cpp
cmake --build build --config Release
build_wasm.bat
```

---

## 6. Review Rules

A PR in this refactor is rejected if:

1. It adds a second writable representation of project state.
2. It moves business logic into UI components.
3. It introduces another silent normalize/repair path.
4. It keeps both old and new public mutation paths after migration.
5. It uses display names as durable keys.
6. It lets runtime/play state dirty the project.
7. It adds broad abstraction without deleting real complexity.

Good PR shape:

1. Pick one domain/action family.
2. Add command handler.
3. Move UI calls to the command hook.
4. Add focused tests.
5. Delete or privatize the old path.
6. Run the domain tests and the project-level gates.

---

## 7. Suggested Delivery Order

1. Resolve conflicts and establish baseline.
2. Phase 1 classification.
3. Phase 2 command boundary.
4. Phase 3 assets.
5. Phase 4 dialogs.
6. Phase 5 objects/scenes.
7. Phase 6 layers.
8. Phase 7 Logic Board.
9. Phase 8 save/load/import/AI validation.
10. Phase 9 runtime projection audit.
11. Phase 10 deletion gates.

Assets and dialogs are intentionally early: they are small enough to prove the architecture and currently expose concrete correctness gaps.

