# ArtCade Authoring Command Architecture

> Status: active incremental refactor, July 2026.
> Purpose: remove accidental complexity from the editor by making every durable authoring change enter through one explicit command boundary.

---

## 1. Rule

The UI is only UI.

React components may render snapshots, collect user input, show validation messages, and dispatch typed intents. They must not mutate, normalize, repair, validate, persist, synchronize, or partially rebuild `ProjectDocument` data.

Every persistent authoring change must enter through a single command entry point:

```ts
dispatchAuthoringCommand(command)
```

The current implementation is an adapter around a pure materialization step:

```txt
useAuthoringCommands()
  -> dispatchAuthoringCommand(command, { project, dispatch })
  -> materializeAuthoringCommand(command, { project })
  -> legacy reducer action(s), temporarily
```

`materializeAuthoringCommand()` is the authoring-core entry point added during the July 2026 refactor. It must stay free of React, UI state, dialogs, prompts, DOM access, and direct dispatch. Until reducers are replaced by document transactions, it may materialize legacy reducer actions as an adapter layer.

The final command path is responsible for routing to one domain handler, running validation, producing undo/redo history, updating dirty/revision state, and emitting the next read-only snapshot.

---

## 2. State Boundaries

| State | Owns | Can dirty project? | Examples |
|-------|------|--------------------|----------|
| `ProjectDocument` / `ProjectDoc` | Saved authoring data | Yes, through authoring commands only | scenes, object types, assets, dialogs, rulesheets, settings |
| `EditorWorkspaceState` | Temporary editor experience | No | selection, zoom, grid visibility, open panels, focus mode |
| `PlaySession` | Runtime test state | No, unless an explicit authoring command is requested by the user | live transforms, physics bodies, Lua variables, runtime logs |

No layer may keep a second writable copy of equivalent project state. If two representations exist, one must be derived deterministically from the other.

---

## 3. Command Boundary

Target shape:

```txt
editor/src/authoring/
  command-dispatcher.ts
  command-result.ts
  materialize-authoring-command.ts
  project-document-store.ts
  commands/
    index.ts
    assets.ts
    dialogs.ts
    logic-board.ts
    objects.ts
    scenes.ts
    settings.ts
    layers.ts
```

Each domain gets one handler file. A user action should have one obvious path:

```txt
UI event
  -> useAuthoringCommands()
  -> dispatchAuthoringCommand(command)
  -> materializeAuthoringCommand(command)
  -> domain handler / materializer
  -> schema/validator
  -> ProjectDocument update or temporary legacy reducer action
  -> history/dirty/revision
  -> read-only snapshot
  -> UI render
```

There should not be a chain of UI helper -> panel helper -> store helper -> reducer helper -> repair helper that all know part of the same business rule.

---

## 4. Action Types

Use three separate action families:

| Family | Mutates | Undo/redo | Dirty |
|--------|---------|-----------|-------|
| `AuthoringCommand` | `ProjectDocument` | Yes | Yes |
| `WorkspaceAction` | `EditorWorkspaceState` | No | No |
| `RuntimeAction` | `PlaySession` / WASM bridge | No | No |

Examples:

| User action | Family |
|-------------|--------|
| Rename object type | `AuthoringCommand` |
| Import image asset | `AuthoringCommand` |
| Delete referenced asset | `AuthoringCommand`, blocked or resolved by dependency policy |
| Toggle editor grid | `WorkspaceAction` |
| Select an object | `WorkspaceAction` |
| Press Play | `RuntimeAction` |
| Runtime moves an entity during play | `RuntimeAction` |
| Save runtime transform back to project | explicit `AuthoringCommand` |

---

## 5. Domain Ownership

Each asset/domain should do only the job it was designed for.

| Domain | Owns | Must not own |
|--------|------|--------------|
| Assets | asset registry, asset refs, import/move/rename/delete dependency policy | scene mutation rules, UI selection, runtime texture lifetime |
| Objects | object type and instance identity, components, prefab-like authoring data | asset file paths, panel state, WASM runtime bodies |
| Scenes | scene membership, layers, world placement | object type schema, raw asset lifecycle |
| Logic Board | rulesheet data, validation, compile-to-Lua inputs | Inspector UI state, runtime execution state |
| Dialogs | dialog graph authoring data | global undo exceptions, asset delete policy |
| Runtime bridge | preview/play communication | ProjectDocument repair, authoring validation |

If a handler needs another domain, it should call a small domain service with a clear contract, not reach through UI/store internals.

---

## 6. Simplification Targets

Prioritize refactors that remove paths, not ones that add abstractions.

### Done In The July 2026 Refactor

- Project rename uses `useAuthoringCommands()`.
- Scene/object explorer create, rename, start-scene, duplicate, instance visibility, instance rename, object type rename, and object deletion now route through authoring commands.
- Asset delete, rename, image patch, image clip update, image/audio/font/tileset upsert, virtual folder create/rename/move/unassign/delete, and image usage changes now route through authoring commands.
- `object-delete-request.ts` only handles confirmation and messaging; it no longer imports or dispatches reducer action names.
- `useAssetFolderActions()` no longer dispatches raw persistent mutations.
- `moveImportedAssetToFolderAction()` was removed; folder moves now use `asset.folder.moveAsset`.
- `materializeAuthoringCommand()` has direct unit coverage and is the pure boundary for migrated commands.
- Project utility lint debt was removed and `project-save-recovery-prompt.ts` listener notification was fixed.

### Still Open

1. Dialog edits must become normal authoring commands with undo/redo and dirty behavior.
2. Logic Board edits must route through authoring commands; preview-applied/runtime markers stay runtime/workspace actions.
3. Inspector property edits still contain raw persistent dispatches and should move behind command helpers.
4. Layers must stop using display names as internal keys; use stable IDs.
5. Object/scene creation must reject or explicitly resolve duplicate names in the same scope in the command layer.
6. Legacy entity/object dual paths must collapse toward one object model.
7. Project validation, import, paste, AI generation, drag/drop, and manual edits must share the same validation path.
8. UI components that call project repair, normalization, or persistence helpers directly should be reduced to command dispatchers.

---

## 7. Anti-Patterns To Remove

- UI component directly edits `ProjectDocument`.
- UI component calls `normalize*`, `repair*`, `validate*`, or save/export helpers as part of a user edit.
- Two stores keep equivalent project data synchronized by effects.
- Runtime echo or play state writes into authoring data without an explicit command.
- One user action travels through several generic helper layers before the real domain rule runs.
- A domain silently fixes another domain's data instead of returning a typed validation error.
- Display names are used as durable keys.
- Compatibility fallback becomes the main authoring path.

---

## 8. Definition Of Done

A simplified action is done when:

1. There is one public entry point for the action.
2. The UI only dispatches the typed command or workspace/runtime action.
3. The domain handler owns the business rule.
4. Validation is centralized and shared with import/paste/AI paths where applicable.
5. Undo/redo, dirty flag, and revision behavior match the action family.
6. Tests cover the command/handler, serialization if persisted, and any migration or dependency policy.
7. The old parallel path is deleted or made private to the new handler.

---

## 9. Implementation Plan

The delivery roadmap lives in [`SIMPLIFICATION_REFACTOR_PLAN.md`](SIMPLIFICATION_REFACTOR_PLAN.md).
