# Object Types + scene instances

> **Status:** Implemented (format v2) — Fasi A+B del refactor completate (Logic Board solo `object_type`, Hierarchy unificata); Fase C (Inspector → tipo) in corso  
> **Audience:** Editor, runtime, Logic Board  
> **Implementazione refactor (pre-release):** seguire [`OBJECT_MODEL_MIGRATION.md`](OBJECT_MODEL_MIGRATION.md) (Fasi A–D: Logic Board, Hierarchy, Inspector).

## Model (hybrid Construct / Unity)

| Layer | Storage | Editable per instance |
|-------|---------|------------------------|
| **Object Type** | `project.objectTypes[id]` | Definition: sprite, components, default Logic Board |
| **Scene instance** | `scene.instances[]` | `transform`, `instanceName`, `visible` |

Runtime pool key: `className` === `objectTypeId` (same string, e.g. `"Coin"`, `"Player"`).

## Merge rule

```
EntityDef = ObjectTypeDef (no scene placement)
          + instance.id, instance.transform
          + name = instanceName ?? type.displayName
          + className = objectTypeId
```

Used by: editor `project.entities` cache, WASM `runtime-fingerprint`, C++ `replaceProject`.

## project.json v2

- `formatVersion: 2`
- `objectTypes: { "Player": { ... }, "Coin": { ... } }`
- `scenes[].instances: [{ id, objectTypeId, transform, ... }]`
- Legacy `entities` map: read-only on import; not written on save

## Migration (legacy → v2)

On load when `objectTypes` is absent:

1. Group entities by `className`; if all `"Entity"`, group by normalized entity **name** → type id.
2. First entity in group → `ObjectTypeDef` prototype.
3. Each entity → `SceneInstanceDef` + scene membership from `entityIds`.

`logicBoards` are **not** migrated: legacy `entity_id` / `entity_class` targets are rejected at parse time (pre-release no-compat policy) — re-target by hand to `object_type`.

## Logic Board

- **Target ammessi (unico schema, 2026-06-10):** `object_type` | `global` | `scene` — `entity_id` / `entity_class` **rimossi**; progetti con board legacy vengono rifiutati al load (`parseBoard`).
- **Target canonico:** `{ type: 'object_type', objectTypeId: 'Player' }`
- Compiler: `pool.getAll("Player")` (unchanged Lua API)
- Lifecycle: delete istanza / duplicate scena **non** toccano le board (vivono sul tipo)

## Designer recipe (pickup)

1. Object types: `Player`, `Coin`, `Solid` (distinct ids).
2. Logic Board on **Player** type: While touching `Coin` → Destroy objects of class `Coin`.
3. Do not use Destroy **This object** on the player for pickup rules.

See also: [OBJECT_MODEL_MIGRATION.md](OBJECT_MODEL_MIGRATION.md) (roadmap refactor), [GLOBAL_LOGIC_UI_ARCHITECTURE.md](GLOBAL_LOGIC_UI_ARCHITECTURE.md), [FIXED_STEP_CONTRACT.md](FIXED_STEP_CONTRACT.md).
