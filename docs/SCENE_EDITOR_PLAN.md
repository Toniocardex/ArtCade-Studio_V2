# Scene Editor — Piano di Sviluppo (da rivedere insieme)

**Stato**: PROPOSTA — non ancora implementato
**Riferimento di design**: `C:\Users\Antonio\Desktop\ArtCade Workspace GUI.html` (mockup React) + `Logic_Board_GUI_mockup.png`
**Data**: 2026-05-17

---

## Context

Lo Scene Editor attuale di ArtCade V2 è **funzionale ma basilare**: layout corretto
(Hierarchy | Preview | Inspector + BottomPanel), sync entity/transform con il
runtime C++, console da Lua. Manca però tutto ciò che serve per *costruire
davvero un livello*: tile painting, inspector a componenti ECS, world settings,
feedback visuale (gizmo/sensori) nel viewport.

Il mockup di riferimento mostra la versione "production": inspector a componenti
con campi condizionali, tile painter interattivo, world settings, visualizzazione
sensori Box2D. Questo documento mappa i gap e propone un percorso incrementale.

---

## Gap: stato attuale → target (dal mockup)

| Area | Oggi | Target mockup | Tocca |
|------|------|---------------|-------|
| Layout base | ✅ Hierarchy/Preview/Inspector + bottom | uguale | — |
| Hierarchy | lista piatta, eye/trash UI-only | add/delete/visibility funzionali | solo TS |
| Inspector | Transform + Sprite hard-coded | **componenti ECS** (PhysicsBody, Sensor, PlatformerController, Health…) con **campi condizionali** | TS + **C++** |
| World settings | assenti | gravità Box2D, scala metrica, time-scale | TS + **C++** |
| Tile painter | palette UI, paint/erase non funzionanti | **griglia interattiva** paint/erase, storage in ProjectDoc, render nel runtime | TS + **C++** |
| Viewport feedback | canvas black-box | gizmo selezione, **cerchi sensori**, grid | **C++** (Raylib) |
| Metriche header | MenuBar semplice | FPS C++, memory heap | TS (legge buffer) + C++ (espone) |
| Logic Board | lista eventi (iter.1-3) | node-graph (mockup) | TS — *iterazione dedicata futura, fuori scope qui* |

**Componenti ECS nel runtime**: oggi esistono solo `Transform`, `Sprite`,
`Physics{bodyType,collider}`, `Animation`. Mancano come tipi/strutture:
`Sensor` (oggi è solo flag `collider.isSensor`), `PlatformerController`,
`Health`, `AutoDestroy`, e qualsiasi sistema di **tilemap**.

---

## Principi del piano

1. **Editor-only prima, runtime dopo**: massimizzare il valore con modifiche
   solo-TS (basso rischio, niente rebuild WASM) prima di toccare il C++.
2. **Niente regressioni**: lo scene editor attuale resta funzionante ad ogni fase.
3. **Schema-driven**: l'inspector a componenti deve essere data-driven (un
   registry di componenti), non `if (component) {...}` hard-coded — così aggiungere
   un componente è dato, non codice.
4. **Persistenza**: ogni nuovo dato (componenti, tilemap, world settings) entra in
   `ProjectDoc` con parse/serialize difensivi (come fatto per `logicBoards`).

---

## Fasi proposte

### Fase A — Inspector a componenti (solo editor TS) · ~1.5 gg
**Obiettivo**: trasformare l'Inspector da hard-coded a registry data-driven.

- `types/index.ts`: estendere `EntityDef` con `components?: Record<string, unknown>`
  o tipi forti `SensorComponent`, `PlatformerControllerComponent`,
  `HealthComponent`, `AutoDestroyComponent`.
- `panels/inspector/component-registry.ts`: descrittori per ogni componente
  (campi, tipo, range, **condizioni di visibilità** es. "massa/bounce solo se
  `bodyType==='Dynamic'`").
- `InspectorPanel.tsx`: render generico dal registry + "Add/Remove Component".
- `utils/project.ts`: parse/serialize `components` (difensivo).
- Store: azione `UPDATE_ENTITY_COMPONENT`.
- Test vitest: registry + reducer + roundtrip.
- ⚠️ Nessun rebuild WASM. Il runtime ignora i componenti che non conosce
  (nessuna regressione) finché non arriva la Fase D.

### Fase B — World Settings + Hierarchy funzionale (solo TS) · ~1 gg
- World settings (gravità, scala metrica, time-scale) in `SceneDef` o nuovo
  `ProjectDoc.world`; pannello nella sidebar (come da mockup).
- Hierarchy: add entity, delete entity, visibility toggle realmente collegati
  allo store; selezione bidirezionale con viewport già esistente.
- Test + roundtrip.

### Fase C — Tile painter (editor TS + storage) · ~1.5 gg
- `types`: `TilemapLayer { tileSize, cols, rows, data:number[] }` in `SceneDef`.
- `TilesetEditorPanel.tsx`: griglia interattiva paint/erase/pick (oggi è solo
  palette). Stato in store, persistito in ProjectDoc.
- Render del tilemap: **decisione aperta** (vedi sotto) — overlay TS sul canvas
  vs render nel runtime C++.

### Fase D — Runtime C++: componenti + tilemap + feedback viewport · ~2-3 gg
**Tocca il motore — richiede rebuild WASM e validazione end-to-end.**
- ECS: aggiungere `Sensor`, `PlatformerController`, `Health`, `AutoDestroy`
  come componenti reali in `core/types.h` + sistemi relativi.
- Tilemap: storage + rendering Raylib + collisioni Box2D per tile "solid".
- Viewport feedback: gizmo selezione + cerchi sensori + grid disegnati in C++,
  esposti via editor-api (coerente col pattern `editor_*` già usato).
- Estendere `editor_load_project` per i nuovi campi.
- Smoke test nel preview WASM.

---

## Decisioni aperte (da rivedere insieme)

1. **EntityDef.components**: tipi forti per ogni componente *oppure* mappa
   generica `Record<string,unknown>` + registry? (forte = type-safety; generico
   = estensibile senza toccare i tipi). **Raccomando: tipi forti + registry.**
2. **Tile rendering**: overlay editor-side (rapido, ma diverge dal runtime) vs
   render nel runtime C++ (fedele "what you see is what you get", ma Fase D).
   **Raccomando: storage subito (Fase C), rendering nel runtime (Fase D).**
3. **Ordine**: Fasi A→B→C solo-TS dimostrabili senza rebuild; Fase D in blocco
   finale. Confermi questo ordine o vuoi prioritizzare il tile painter?
4. **Scope Logic Board node-graph**: confermato fuori da questo piano (iterazione
   dedicata separata, come concordato).

---

## Stima totale

| Fasi solo-TS (A+B+C) | ~4 gg | basso rischio, nessun rebuild |
| Fase D (runtime) | ~2-3 gg | tocca C++/WASM, validazione end-to-end |
| **Totale** | **~6-7 gg** | |

Lo scene editor resta usabile ad ogni fase; il valore è incrementale.
