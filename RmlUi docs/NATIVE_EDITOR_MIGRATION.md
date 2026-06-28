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
| Undo | React/editor history path | `CommandStack` | Partial | No |
| Project replace/load boundary | React/Tauri file path | `EditorCoordinator::replaceProject(ProjectDocument)` | In progress | No |
| Play Project | WASM bridge / preview path | `PlaySession::startProject` from `ProjectDocument.startSceneId` | Partial | No |
| Play Current Scene | WASM bridge / preview path | `PlaySession::startActiveScene` from `EditorState.activeSceneId` | Partial | No |
| Project file I/O | React/Tauri file path | `readProjectTextFile` + `loadProjectFromText` + atomic save | In progress | No |
| Runtime viewport | WASM/runtime preview | `SceneFrameSnapshot` or minimal projection | Planned | No |
| Components inspector | React Inspector | Feature commands + read-only queries | Planned | No |
| Asset references | React asset stores | Stable IDs in `ProjectDocument` | Planned | No |
| Logic Board | React Logic Board state | Logic Board document + commands | Planned | No |

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
