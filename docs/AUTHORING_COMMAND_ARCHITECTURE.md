# ArtCade Authoring Command Architecture

> Status: refactor target, July 2026.
> Purpose: remove accidental complexity from the editor by making every durable authoring change enter through one explicit command boundary.

---

## 1. Rule

The UI is only UI.

React components may render snapshots, collect user input, show validation messages, and dispatch typed intents. They must not mutate, normalize, repair, validate, persist, synchronize, or partially rebuild `ProjectDocument` data.

Every persistent authoring change must enter through a single command entry point:

```ts
dispatchAuthoringCommand(command)
```

That entry point is responsible for routing to one domain handler, running validation, producing undo/redo history, updating dirty/revision state, and emitting the next read-only snapshot.

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
  project-document-store.ts
  commands/
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
  -> dispatchAuthoringCommand(command)
  -> domain handler
  -> schema/validator
  -> ProjectDocument update
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

1. Asset deletion must go through one authoring command with dependency checks.
2. Dialog edits must become normal authoring commands with undo/redo and dirty behavior.
3. Layers must stop using display names as internal keys; use stable IDs.
4. Object/scene creation must reject or explicitly resolve duplicate names in the same scope.
5. Legacy entity/object dual paths must collapse toward one object model.
6. Project validation, import, paste, AI generation, drag/drop, and manual edits must share the same validation path.
7. UI components that call project repair, normalization, or persistence helpers directly should be reduced to command dispatchers.

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
