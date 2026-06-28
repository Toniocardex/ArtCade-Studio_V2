# Native Editor Migration Matrix

Questo documento traccia la migrazione dal vecchio editor React al nuovo editor
nativo RmlUi. La migrazione procede per feature/caso d'uso, non per pannello.

Regola: se il vecchio percorso React confligge con
`RMLUI_MIGRATION_CONTRACT.md`, vince il contratto.

## Paletti architetturali (perche' esiste questa migrazione)

L'editor React e' diventato troppo complesso non per quantita' di feature, ma
per *forma*: piu' fonti di verita' per lo stesso dato, piu' entry point per la
stessa operazione, orchestratori e sync che tenevano allineate copie che non
sarebbero dovute esistere.

Il nuovo editor esiste per eliminare quella forma, non per riprodurla in C++.
Ogni operazione — creare un'entita', rinominarla, spostarla, creare o eliminare
una scena, cambiare un asset, gestire un componente — deve rispettare questi
paletti, sempre, non solo nello spike:

1. **Una sola fonte di verita'.** `ProjectDocument` e' l'unica autorita'
   persistente per scene, entita', componenti, asset, Logic Board e variabili.
   Nessun `UiProjectModel`, `InspectorModel` o `RuntimeCopy` autorevole in
   parallelo. I pannelli leggono via query e modificano solo via comando.
2. **Un solo entry point per operazione.** Ogni operazione passa per esattamente
   un percorso: `execute(EditorCommand)` se entra in salvataggio/undo,
   `apply(EditorIntent)` se tocca solo il workspace. Mai una seconda strada
   "diretta" per la stessa modifica.
3. **Un solo coordinatore.** `EditorCoordinator` e' l'unico punto di
   coordinamento. Niente catene pannello -> pannello, callback circolari,
   event bus string-based, service locator.
4. **Nessuna sincronizzazione.** Niente sync service, polling dello stato
   authoring, fingerprint, readiness flag tra oggetti dello stesso processo,
   retry per modifiche locali, refresh globale per frame, serializzazione
   interna tra moduli. L'invalidazione e' esplicita, tipizzata e consumata una
   volta per frame.
5. **Il flusso deve restare spiegabile in una riga.** Il test di riferimento di
   ogni feature e': `evento UI -> command/intent -> ProjectDocument/EditorState
   -> invalidazione mirata -> frame successivo`. Se serve un diagramma con piu'
   di un ramo per spiegare una singola modifica, la feature va semplificata,
   non portata com'e'.

Regola pratica, prima di aggiungere qualunque classe: *"elimina complessita'
reale o nasconde un nuovo percorso di sincronizzazione?"*. In caso di dubbio:
la soluzione piu' diretta, tipizzata e locale.

Dettaglio normativo completo in `RMLUI_MIGRATION_CONTRACT.md` (§Autorita',
§Direzione delle dipendenze, §Divieti) e nel prompt di refactor
`ARTCADE_RMLUI_CLAUDE_REFACTOR_PROMPT.md` (§2, §3, §25). Questi paletti non sono
criteri del solo spike: valgono per ogni feature di ogni fase qui sotto, finche'
il vecchio editor non e' rimosso.

## Cadenza di lavoro

I paletti sopra sono rigidi. La cadenza di lavoro non lo e': si interviene solo
quando si protegge un rischio reale, non per purezza fine a se stessa.

Bloccare sempre, senza compromessi, quando un incremento introduce:

- doppie fonti di verita';
- mutazioni fuori da Command/Intent (o, in Play, fuori dal confine runtime
  esplicito del coordinator);
- polling o sincronizzazione nascosta;
- runtime che legge l'authoring durante Play;
- renderer che legge direttamente il dominio;
- dipendenze invertite;
- perdita dati;
- invalidazioni o persistenza incoerenti.

Non fermare il lavoro per:

- accessor migliorabili ma gia' corretti;
- nomi non perfetti;
- wrapper aggiuntivi;
- astrazioni preventive;
- edge case teorici senza impatto reale;
- refactor che non sbloccano una capability concreta.

Criterio operativo per ogni incremento:

```text
capability visibile
-> implementazione end-to-end
-> test/build/smoke
-> chiusura
-> step successivo
```

Non:

```text
feature -> audit -> micro-refactor -> secondo audit -> wrapper
       -> terzo audit -> feature mai conclusa
```

La baseline e' considerata solida. Ogni incremento deve produrre valore
funzionale reale; la pulizia architetturale e' ammessa solo quando protegge un
paletto o sblocca la capability in corso.

## Fasi

1. Fondazioni: `ProjectDocument`, `EditorState`, `SelectionState`,
   `EditorCoordinator`, command, intent, `DomainChange`, invalidation.
2. Vertical slice: open project, scene selection, entity selection, transform
   editing, viewport, undo, save, reload.
3. Struttura editor: scene create/delete, entity create/delete, components,
   asset references, validation.
4. Asset pipeline: stable asset IDs, import, metadata, reimport, missing asset
   handling.
5. Logic Board: board document, commands, compiler, diagnostics, generated Lua.
6. Play Session: start, pause, stop, debug query, runtime isolation.
7. UI polish: drag-and-drop, context menu, shortcuts, dialogs, empty states,
   accessibility, DPI.
8. Rimozione vecchio editor: solo quando non esistono piu' doppi percorsi.

## Matrix

| Feature | Vecchia autorita' | Nuova autorita' | Stato | Vecchio percorso rimosso |
| --- | --- | --- | --- | --- |
| Native RmlUi shell | React DOM / CSS | RmlUi document + `RmlHost` | Done | No |
| Font rendering | Custom `rlgl` Rml renderer | RmlUi `RenderInterface_GL3` | Done | Yes for native target |
| Scene selection | React/editor active state | `EditorState.activeSceneId` | In progress | No |
| Entity selection | React/editor selection state | `SelectionState` via `SelectEntityIntent` | In progress | No |
| Transform edit | TS project/store path | `SetEntityPositionCommand` -> `ProjectDocument` | In progress | No |
| Entity rename | TS project/store path | `RenameEntityCommand` -> `ProjectDocument` | In progress | No |
| Scene background edit | TS project/store path | `SetSceneBackgroundCommand` -> `ProjectDocument` | In progress | No |
| Scene create | TS project/store path | `CreateSceneCommand` -> `ProjectDocument` | Done | No |
| Scene delete | TS project/store path | `DeleteSceneCommand` -> `ProjectDocument` (exact undo) | Done | No |
| Entity create | TS project/store path | `CreateEntityCommand` -> `ProjectDocument` | Done | No |
| Entity delete | TS project/store path | `DeleteEntityCommand` -> `ProjectDocument` (index-faithful undo) | Done | No |
| Hierarchy add/delete wiring | React Hierarchy buttons | `hierarchy_actions` (UI-free) -> `EditorCoordinator` | Done | No |
| Start scene | TS project/store path | `SetStartSceneCommand`; first scene auto-keeps invariant | Done | No |
| Workspace reconciliation | React effects/listeners | `EditorCoordinator::reconcileWorkspace` (same op) | Done | No |
| Undo | React/editor history path | `CommandStack` | Partial | No |
| Project replace/load boundary | React/Tauri file path | `EditorCoordinator::replaceProject(ProjectDocument)` | In progress | No |
| Play Project | WASM bridge / preview path | `EditorCoordinator::playProject` (guarded by `canPlayProject`) | Done | No |
| Play Current Scene | WASM bridge / preview path | `EditorCoordinator::playCurrentScene` (guarded by `canPlayCurrentScene`) | Done | No |
| Project file I/O | React/Tauri file path | `readProjectTextFile` + `loadProjectFromText` + atomic save | In progress | No |
| Runtime viewport | WASM/runtime preview | `SceneFrameSnapshot` + derived texture cache | In progress | No |
| Play materialization | WASM bridge / preview path | `PlaySession` from `ProjectDocument` once at Start Play | In progress | No |
| Sprite Renderer component | React Inspector | `sprite_commands` + `inspector_actions` (instance-scoped) | Done | No |
| BoxCollider2D component | React Inspector / physics form | `box_collider_commands` on `EntityDef.boxCollider2D` | Done | No |
| Object type persistence | React project store | `ProjectSerializer` minimal subset + referential validation | Done | No |
| Components inspector | React Inspector | Feature commands + read-only queries | In progress | No |
| Asset references | React asset stores | `AssetId` -> `ProjectDoc.imageAssets.sourcePath`, validated | In progress | No |
| Logic Board | React Logic Board state | Logic Board document + commands | Planned | No |

## Component resolution (sprite renderer)

A sprite renderer can exist on two levels: the object type (`EntityDef.sprite`)
and a per-instance override (`SceneInstanceDef.spriteRenderer`). A single query,
`resolveSpriteRenderer(document, sceneId, entityId)`, is the only resolver used
by both the viewport and the Inspector. Precedence:

```text
instance override present        -> use the override        (InstanceOverride)
else object type sprite w/ image -> use the inherited sprite (EntityDefinition)
else                             -> no sprite renderer       (None)
```

Consequence to keep in mind: because the override is a `std::optional`, **Remove
Override means "drop the override and fall back to the inherited component"**, not
"disable the inherited component for this instance". If a true per-instance
disable is ever needed, `optional` is not enough — it would take an explicit
`Inherit | Override | Disabled` mode — but that is deliberately not introduced
without a concrete use case.

Object types now persist (minimal subset: `id`, `name`, `visible`, `sprite`
asset + fill — not the full `EntityDef` bag). So an inherited sprite survives
save/reload, an override still prevails after reload, and removing the override
falls back to the base after reload. The validator rejects a duplicate object
type id (on deserialize) and, when a catalog exists, an instance whose
`objectTypeId` is dangling. The serializer never copies the inherited component
into each instance. The format addition is backward-compatible (a file without
`objectTypes` loads with an empty catalog), so no schema bump is required yet.

Mutation detection is revision-based, not flag-based: `executeOwned` compares
`ProjectDocument::revision()` before and after `apply()`. A command changed the
project iff the revision moved; debug asserts pin the contract (a failed command
must not mutate; a no-op must declare no change and no invalidation; a mutating
command must declare both).

## Component ownership matrix

The native editor now covers three ownership shapes, intentionally:

```text
Transform       -> instance only
Sprite Renderer -> object type inheritance + optional instance override
BoxCollider2D   -> object type only, shared by every instance of that type
```

`BoxCollider2D` lives on `EntityDef.boxCollider2D` and is edited through
commands that target the object type id directly. The selected instance is used
only by the Inspector to discover the authoritative object type. There is no
per-instance override, no `resolve*` layer, and the serializer never writes the
collider into `SceneInstanceDef`. The viewport consumes projected
`SceneFrameCollider` values (`entityId`, world bounds, enabled/trigger/selected
flags) from `collectBoxColliderBounds(...)`; draw code does not re-read
`EntityDef` to interpret collider ownership.

## Edit viewport texture baseline

The Edit viewport renders from an immutable projection:

```text
ProjectDocument + EditorState
-> SceneFrameSnapshot
-> SceneView
```

`SceneFrameSnapshot` contains entity placeholders, `SceneFrameSprite` draw
items, and `SceneFrameCollider` overlays. It carries `AssetId`, destination
bounds, visibility, and selection state, but no `Texture2D` and no GPU handle.

Texture resources are derived and non-authoritative. Persisted `sourcePath`
values should be portable paths relative to the project/resource root, not
machine-specific absolute paths:

```text
SceneFrameSprite.assetId
-> ImageAssetDef.sourcePath
-> application resolves project/resource root + sourcePath
-> TextureCache
-> DrawTexturePro
```

`TextureCache` belongs to the native rendering layer. It receives resolved paths,
loads synchronously, records failed loads to avoid retrying every frame, unloads
while the Raylib context is still valid, and is not serialized. Missing source
paths or missing files produce a diagnostic placeholder; they do not mutate the
document.

The application path that consumes `DomainChange::ProjectReplaced` must call
`TextureCache::clear()` directly, so two projects can reuse the same `AssetId`
without stale GPU state. This must not be discovered by polling
`ProjectDocument::replaceCount()` in the frame loop. `TextureCache::invalidate(id)`
exists for future catalog changes where `sourcePath` changes but the `AssetId`
does not.

The renderer must not query `ProjectDocument`, `EditorCoordinator`, RmlUi
controls, or panels during draw. Asset catalog lookup happens before drawing;
`SceneView` receives only `SceneFrameSnapshot` and `TextureCache`.

## Play materialization baseline

Play now has a concrete runtime boundary:

```text
Play Project
-> ProjectDocument.startSceneId
-> materialize PlaySession

Play Current Scene
-> EditorState.activeSceneId
-> materialize PlaySession
```

Materialization reads `ProjectDocument` once at Start Play, resolves each
instance's Sprite Renderer through the same authoring resolver used by Edit,
and creates only the runtime subset needed by this slice:

```text
RuntimeScene
-> RuntimeEntity
-> optional RuntimeSpriteComponent

PlayAssetCatalogSnapshot
-> only image assets referenced by the materialized scene
```

After Start Play:

```text
PlaySession
-> SceneFrameSnapshot
-> SceneView
```

The Play draw path does not query `ProjectDocument`, object types, Inspector
state, RmlUi controls, or JSON. The application resolves the frozen
`PlayAssetCatalogSnapshot` source paths into `TextureRequest`s and feeds the
same derived `TextureCache`. `Stop` destroys the session and returns to the Edit
projection; it never writes runtime state back into the authoring document.

Current policy: `replaceProject()` while Play is active is rejected explicitly.
This avoids a hidden auto-stop or frame-loop observer.

Authoring edits are also blocked while Play is active:

```text
isPlaying()
-> EditorCommand rejected
-> undo rejected
-> ProjectDocument revision/dirty/history unchanged
```

Workspace intents may still run when they do not mutate the document. This is a
coordinator-level rule, so it applies equally to RmlUi buttons, menu actions,
shortcuts and tests.

During Play, scene-selection intents affect only the workspace:

```text
SelectSceneIntent(B)
-> EditorState.activeSceneId = B
-> current PlaySession remains on its materialized source scene
-> Stop returns the viewport to the Edit projection for B
```

Blocked commands may append a console warning and invalidate Console. They must
not change `ProjectDocument`, revision, dirty state or undo history.

The toolbar should label the runtime target, for example `PLAYING - Scene A`.
That label is derived from `PlaySession::scene()` and exists only to avoid UX
ambiguity when the workspace active scene changes during Play.

The first runtime mutation is intentionally minimal and flows through one narrow
coordinator entry point, not a mutable session handle:

```text
Raylib input
-> application computes Vec2 delta
-> EditorCoordinator::translateRuntimeEntity(entityId, delta)
-> PlaySession::translateEntity(entityId, delta)
-> RuntimeEntity.transform.position
-> Play SceneFrameSnapshot
```

It is not an `EditorCommand` and it does not touch `ProjectDocument`, undo,
revision, dirty state or JSON. The coordinator exposes the session read-only
(`const PlaySession*`) and keeps the mutable surface private, so panels, toolbar
and shortcuts cannot open parallel mutation paths. `Stop` destroys the session,
so the next Play starts again from the authoring document.

The WASD/arrow mapping that drives the first runtime entity (`routePlaySmokeInput`
in `editor_app`) is a temporary smoke harness to verify the slice visually, not
engine behaviour. Real runtime motion will come from authoring (a Logic
Board/Lua action on the transform); the harness is to be replaced or removed
once verified, so no project silently gains an undefined movement rule.

## RmlUi input commit baseline

Inspector text and number fields use RmlUi as a local edit buffer. Typing does
not create commands and does not mutate `ProjectDocument`.

```text
input/change
-> local control buffer only

Enter or blur
-> parse/validate/normalize
-> compare with authoritative value
-> typed Command only when valid and different

Escape
-> restore authoritative value
-> no Command
```

Incomplete or invalid values (`"-"`, `"."`, `"1e"`, `"nan"`, `"inf"`,
`"12px"`) do not change the revision, do not enter undo history, and do not
invalidate panels. `"12."` is accepted at commit as `12.0`.

## Feature Template

Every migrated feature must fill this before implementation:

```text
Feature:
Source of truth:
Command or Intent:
Validation:
DomainChange:
EditorInvalidation:
Runtime effect:
Undo:
Persistence:
Test:
Old path removed:
```

If this cannot be filled linearly, simplify the feature before porting it.

## Persisted Schema Boundary

Current loading is intentionally narrow:

```text
filesystem bytes
-> ProjectSerializer::deserialize()
-> ProjectMigration::migrate()
-> ProjectValidator::validate()
-> EditorCoordinator::replaceProject()
```

Before the first real persisted schema change, this boundary must evolve in one
of two ways:

- parse JSON into a temporary persisted representation, migrate that shape, then
  build the current `ProjectDocument`;
- or keep version-specific parsers inside `ProjectSerializer`.

The filesystem layer must remain an adapter only. It reads/writes bytes and must
not learn about `EditorState`, `EditorUiState`, RmlUi, invalidation, undo, or
runtime projection.
