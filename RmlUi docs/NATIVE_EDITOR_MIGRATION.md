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
| Undo / Redo | React/editor history path | `CommandStack` (undo+redo) + toolbar buttons & Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z (single `undo`/`redo` coordinator entries); enabled derived from `can(Un\|Re)do() && !isPlaying()`; per-entry revision restore keeps dirty correct across the walk | Done | No |
| Project replace/load boundary | React/Tauri file path | `EditorCoordinator::replaceProject(ProjectDocument)` | In progress | No |
| Play Project | WASM bridge / preview path | `EditorCoordinator::playProject` (guarded by `canPlayProject`) | Done | No |
| Play Current Scene | WASM bridge / preview path | `EditorCoordinator::playCurrentScene` (guarded by `canPlayCurrentScene`) | Done | No |
| Project file I/O | React/Tauri file path | `readProjectTextFile` + `loadProjectFromText` + atomic save, wired to GUI Open/Save/Save As (native pickers; app clears texture cache on replace) | Done | No |
| Runtime viewport | WASM/runtime preview | `SceneFrameSnapshot` + derived texture cache | In progress | No |
| Viewport pick + drag | React canvas pointer handlers | `pickEntityAt` + `SelectEntityIntent`; drag preview local, one `SetEntityPositionCommand` on release | Done | No |
| Authored runtime motion | Logic Board / Lua runtime | `EntityDef.linearMover` -> `RuntimeEntity.velocity` -> `PlaySession::advance` via `advanceRuntime`; edited via `linear_mover_commands` + Inspector, persisted in the object-type subset | Done | No |
| TopDownController (input) | Logic Board / Lua runtime | `EntityDef.topDownController` -> `RuntimeTopDownController` -> `PlaySession::update` via `updateRuntime` with `RuntimeInputSnapshot`; edited via `top_down_controller_commands` + Inspector, persisted | Done | No |
| Unsaved-changes guard | React beforeunload / dialogs | `resolveUnsavedGuard` (pure) + native confirm; guards Open and Exit (Save/Discard/Cancel, Save-fail aborts); Open blocked during Play | Done (New pending) | No |
| Play materialization | WASM bridge / preview path | `PlaySession` from `ProjectDocument` once at Start Play | In progress | No |
| Sprite Renderer component | React Inspector | `sprite_commands` + `inspector_actions` (instance-scoped) | Done | No |
| BoxCollider2D component | React Inspector / physics form | `box_collider_commands` on `EntityDef.boxCollider2D` | Done | No |
| Object type persistence | React project store | `ProjectSerializer` minimal subset + referential validation | Done | No |
| Components inspector | React Inspector | Feature commands + read-only queries | In progress | No |
| Asset references | React asset stores | `AssetId` -> `ProjectDoc.imageAssets.sourcePath`, validated | In progress | No |
| Asset import (image/audio/font) | React asset import/store | One `importAsset(AssetKind,...)` pipeline: picker -> copy into `<projectRoot>/assets/{images,audio,fonts}` -> typed `Add{Image,Audio,Font}AssetCommand` (relative path); Assets panel lists/imports/removes per kind; images also assignable | Done (import); audio/font consumers pending | No |
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

Runtime mutations flow through narrow coordinator entry points, never a mutable
session handle:

```text
EditorCoordinator::advanceRuntime(dt)          // autonomous motion (LinearMover)
-> PlaySession::advance
EditorCoordinator::updateRuntime(input, dt)    // input-driven (TopDownController)
-> PlaySession::update(RuntimeInputSnapshot, dt)
-> RuntimeEntity.transform.position
-> Play SceneFrameSnapshot
```

Neither is an `EditorCommand`; neither touches `ProjectDocument`, undo, revision,
dirty state or JSON. The coordinator exposes the session read-only
(`const PlaySession*`) and keeps the mutable surface private, so panels, toolbar
and shortcuts cannot open parallel mutation paths. `Stop` destroys the session,
so the next Play starts again from the authoring document.

The first *authored* runtime behaviour is linear motion, driven by data rather
than a hardcoded loop rule (the earlier WASD smoke harness is removed):

```text
EntityDef.linearMover (canonical component, object type)
-> materialize: RuntimeEntity.velocity = normalize(direction) * max(0, speed)
-> advanceRuntime(dt): position += velocity * dt   (each Play frame)
-> Play SceneFrameSnapshot
```

The runtime integrates whatever the authoring document declares; `editor_app`
holds no per-entity movement rule. The mover is authored end-to-end: edited from
the Inspector via `linear_mover_commands` (object-type scope, same pattern as
BoxCollider2D, undoable) and persisted in the object-type subset by
`ProjectSerializer`. `_paused` stays a runtime flag and is deliberately not
serialized. Mover edits invalidate only the Inspector — motion has no edit-mode
viewport visual; it is observed in Play, which renders every frame.

The first *input-driven* behaviour is the canonical `TopDownController`. It closes
the full gameplay loop: authored in the Inspector (this slice edits the speed =
`maxSpeed`; acceleration/friction/fourDirections persist untouched), materialized
into `RuntimeTopDownController`, and moved each Play frame by a
`RuntimeInputSnapshot` the application builds from the platform:

```text
Raylib keys -> RuntimeInputSnapshot -> EditorCoordinator::updateRuntime(input, dt)
-> PlaySession::update: direction = normalizeOrZero(right-left, down-up)
-> position += direction * speed * dt   (each controller entity)
```

`PlaySession` never sees Raylib. Opposite inputs cancel, the diagonal is
normalized (never faster — a fixed behaviour, not a property), non-finite or
non-positive `dt` is a no-op, and input is neutral while an RmlUi text field has
focus. Edits use `top_down_controller_commands` (object-type scope, undo/redo,
Inspector-only invalidation) and persist in the object-type subset.

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

## Viewport pick and drag baseline

The viewport's world<->screen mapping has a single source, `SceneViewCamera`
(`makeSceneViewCamera` + `screenToWorld`), shared by the renderer and picking so
a click maps to exactly what is drawn. The renderer builds its Raylib `Camera2D`
from it; picking inverts the same transform. `pickEntityAt` is a pure query on
`SceneFrameSnapshot` (sprite occludes placeholder, later draw order wins).

World-space drawing (grid, sprites, placeholders, colliders, selection) is
scissored to the **scene surface** — the world rectangle projected to screen,
intersected with the viewport — so an entity whose runtime position drifts
outside the scene (e.g. a LinearMover with no walls) is clipped at the scene
edge instead of painting over the panel backdrop. Out-of-bounds positions stay
legal in the domain (off-screen spawns, side-entering enemies); only rendering is
clipped. The scene-name chip is a viewport-space overlay drawn after, outside the
scene scissor.

Selection and move follow the existing command/intent split — no new authority,
no command per mouse move:

```text
left press in viewport
-> screenToWorld -> pickEntityAt
-> SelectEntityIntent (INVALID clears selection)
-> capture start mouse-world + entity authoring position   (local drag state)

drag
-> local preview only: the draw path offsets the dragged entity in its snapshot
-> no command, no revision, no invalidation

left release
-> one SetEntityPositionCommand(start position + world delta)  (zero delta: none)
```

The drag state is transient presentation owned by the application; it never
enters `ProjectDocument`. Pick + drag is Edit-mode only; Play keeps its own input
path. `pickEntityAt` and `screenToWorld` are unit-tested in `editor-core`.

## Undo / Redo baseline

`CommandStack` owns an undo and a redo stack of `CommandEntry{command,
revisionBefore, revisionAfter}`. A new command records onto undo and discards the
redo branch. Undo runs `command->undo`, redo re-runs the same `command->apply`
(no inverse is built, no UI re-read) — the existing commands are reusable because
each captures its previous value once and keeps its next value.

```text
toolbar Undo / Ctrl+Z          -> EditorCoordinator::undo  -> restoreRevision(before)
toolbar Redo / Ctrl+Y/Shift+Z  -> EditorCoordinator::redo  -> restoreRevision(after)
```

Dirty stays correct across the walk because revisions are stable ids, not a
counter bumped per mutation: `markDirty` allocates from a monotonic high-water
mark, and undo/redo *restore* the entry's recorded id. So a redo back to the
saved revision reports clean, and a command executed after an undo gets a fresh
id that cannot collide with the discarded branch. `replaceProject` clears both
stacks; Save updates `savedRevision` only. Both ops are coordinator-guarded
during Play (rejected, console warning, no authoring mutation); the disabled
buttons are affordance only. Single entry points, no transaction manager, no
history dropdown, no command grouping.

## Image import + Assets panel baseline

The native editor imports its own images, so it no longer depends on assets
staged by hand. There is **one canonical import entry point**; every UI source
converges on it, with no per-UI import path:

```text
Assets panel ─┐
File > Import ─┤ (future)
Drag & Drop ──┼─> importAsset(coordinator, projectRoot, {kind, sourcePath})
Inspector ────┘ (future)
```

`importAsset` (in `asset_import`) owns the common pipeline — reject during Play,
require a saved project, validate the source, choose a portable unique
destination, copy, run the per-kind command, roll the copy back on failure — then
switches on `AssetKind` to a typed command. The single entry point is about the
*operation*; the per-kind domain stays typed:

```text
importAsset(Image) -> assets/images/<unique>.<ext> -> AddImageAssetCommand
importAsset(Audio) -> assets/audio/<unique>.<ext>  -> AddAudioAssetCommand (load mode)
importAsset(Font)  -> assets/fonts/<unique>.<ext>  -> AddFontAssetCommand  (pixel size, glyph preset)
   (the copied file is rolled back if the command fails)
```

Supported now: image `png/jpg/jpeg/webp`, audio `wav/ogg/mp3`, font `ttf/otf`.
Audio load mode defaults by extension (wav -> StaticSound, else Stream) and can be
overridden in the request. The UI trigger (Assets panel "Import Image/Audio/Font")
only picks the file and calls `importAsset` with the kind. `ProjectDocument` only
gets `AssetId` + relative `sourcePath` (never absolute); one suffix keeps the file
name and `AssetId` unique together.

Import, use and remove are distinct operations: image assignment reuses
`set-sprite-asset` (`SetSpriteRendererAssetCommand`), removal is the typed
`Remove{Image,Audio,Font}AssetCommand` and **does not delete the file on disk**
(orphan cleanup is separate). Undo/redo and save/reload cover all three catalogs.
Audio/font are catalog-only for now — their consumers (audio playback, font
rasterisation/preview) are deferred to dedicated slices; the typed model carries
the fields those consumers will read (`loadMode`, `defaultPixelSize`,
`glyphPreset`).

Textures resolve against the **project root** (`currentProjectPath.parent_path()`)
for a loaded project, falling back to the executable resources for the in-code
demo. The renderer still consumes only `SceneFrameSnapshot` + `TextureCache`;
`TextureCache::invalidate(assetId)` is available for a future catalog change that
keeps the same id.

## Unsaved-changes guard baseline

Now that the editor makes real, persistable edits, a destructive action must not
silently lose work. The guard wraps Open Project and Exit (and New Project when
it is wired):

```text
destructive action requested
-> document.isDirty()?
   no  -> run immediately
   yes -> native confirm: Save / Discard / Cancel
          Save    -> atomic save; run only if it succeeds
          Discard -> run, dropping changes
          Cancel  -> change nothing
```

The decision is a pure, unit-tested function, `resolveUnsavedGuard(dirty, choice,
saveSucceeded)`; the confirm itself is a blocking native dialog, so no pending
state machine, modal manager, event bus, or dirty polling is introduced. The
"which action was requested" is implicit in the synchronous call site, not stored
in `ProjectDocument` or `EditorUiState`.

A failed Save keeps the project loaded and dirty and aborts the action. On Exit,
Cancel clears the platform close flag and keeps the app running. Open/New are
rejected outright during Play ("Stop Play before opening another project") with
no hidden auto-stop; Exit may still run the guard and then terminate.

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
