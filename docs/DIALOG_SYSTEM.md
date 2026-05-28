# Dialog System (ArtCade V2)

> Runtime consumes **JSON only** (`dialogs/{dialogId}.json`). Authoring: CSV import or Dialog Editor (React Flow).

## Data flow

```
dialogs/innkeeper.json
    → DialogParser → DialogManager (registry)
    → tick + DialogRenderer (screen space)
    → VariableManager / EventBus (same as Logic Board state.*)
```

## Project layout

```
my-game/
  project.json
  dialogs/
    innkeeper.json
```

`DialogComponent` on an Object Type references `dialogId: "innkeeper"`.

## Node types (MVP)

| type | Runtime behavior |
|------|------------------|
| `say` | Typewriter text; Confirm completes line then advances `next` |
| `choice` | List options; Up/Down + Confirm |
| `condition` | Read `VariableManager`; jump `ifTrue` / `ifFalse` |
| `setVariable` | Write `VariableManager`; advance `next` |
| `emitEvent` | `EventBus::emitDeferred` (flushed end of fixed step) |
| `end` | Close dialog, resume gameplay pause |

## JSON schema

See golden file [`examples/dialogs/innkeeper.json`](examples/dialogs/innkeeper.json).

## Tick order

Documented in [`FIXED_STEP_CONTRACT.md`](FIXED_STEP_CONTRACT.md): after `luaHost.tick`, `DialogManager::tick`; gameplay/platformer skipped while `isBlocking()`.

## Logic Board

- Start: `startDialog` action or `dialog.start(entityId, "innkeeper")` from Lua.
- React: `onMessage` for events emitted by `emitEvent` nodes (e.g. `QuestAccepted`).

## Input (PLAY)

| Action | Keys |
|--------|------|
| Confirm | `Enter`, `Space` |
| Up / Down | Arrow keys (choice navigation) |
| Skip typewriter | Confirm while text still revealing |

## Pause

`TimeManager::pause("dialog")` on start; resumed on `end` node.

## Related docs

- [`DIALOG_CSV_FORMAT.md`](DIALOG_CSV_FORMAT.md)
- [`ENGINE_DESIGN_RECAP.md`](ENGINE_DESIGN_RECAP.md) §10
- [`GLOBAL_LOGIC_UI_ARCHITECTURE.md`](GLOBAL_LOGIC_UI_ARCHITECTURE.md) §4–5
