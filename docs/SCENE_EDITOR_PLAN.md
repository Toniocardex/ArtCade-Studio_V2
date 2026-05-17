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

### Fase D — Runtime C++ · suddivisa in D1 / D2 / D3
**Tocca il motore — rebuild WASM. Ogni sotto-fase è indipendente, testata e
validata end-to-end nel preview PRIMA di passare alla successiva.**

Vincolo di coerenza: il parser C++ deve usare **gli stessi nomi di campo**
serializzati dall'editor TS (Fasi A/C), non sinonimi:
`sensor{shape,radius,width,height,targetTag}`, `health{maxHp,currentHp,iFrames}`,
`platformerController{maxSpeed,jumpForce,customGravity,coyoteTime,jumpBuffer}`,
`autoDestroy{lifespan}` (0 = manuale); `tilemap{tileSize,cols,rows,data}`,
`tilePalette[{id,name,color,solid}]`.

#### D1 — Componenti ECS nel runtime + AutoDestroy system · rischio BASSO-MEDIO
- `core/types.h`: `SensorComponent`, `PlatformerControllerComponent`,
  `HealthComponent`, `AutoDestroyComponent` (+ `_timeAlive`); su `EntityDef`
  come `std::optional<...>` (C++17, "opzionale" pulito).
- `editor-api.cpp parseEntityDef`: leggere i 4 campi con i nomi esatti TS.
- `app.cpp loopIteration`: **AutoDestroy system** dopo
  `world->syncPhysicsToEntities()` — `lifespan>0`: `_timeAlive+=dt`; se
  `>=lifespan` → `physics->destroyBody` (se handle) + `entityManager->destroyEntity`.
- **Validazione**: project con `autoDestroy.lifespan=1.0` → entità sparisce
  dopo ~1 s nel canvas WASM (entity count cala); sensor/health/platformer
  parsati senza crash (console log conteggio). Nessuna regressione: progetti
  senza i campi invariati.
- **Commit D1**, poi STOP/validate prima di D2.

#### D2 — Tilemap rendering + collisioni · rischio MEDIO
- `core/types.h`: `SceneDef.tilemap` (`TilemapData{tileSize,cols,rows,
  std::vector<int> data}`); `ProjectDoc` palette `id→Vec4 color` + `solid`.
- `editor-api.cpp`: parse `scene.tilemap` + `project.tilePalette`.
- `app.cpp renderActiveScene`: dopo gli sprite, loop celle → `drawRect`
  col colore della palette (id 0 = skip).
- `world.cpp init`: per ogni tile `solid` → `physics->createBody` static box.
- **Validazione**: project con tilemap (celle solide) → tile colorati visibili
  nel canvas (screenshot); una `PhysicsBall` che cade si **appoggia** su un
  tile solido (fisica). Progetti senza tilemap invariati.
- **Commit D2**, poi STOP/validate prima di D3.

#### D3 — Feedback viewport: gizmo selezione + sensori · rischio BASSO-MEDIO
- `app.cpp renderActiveScene`: se `EditorAPI::s_selectedEntityId != 0` e
  `s_mode==0` (editor) → `drawRect` bordo attorno all'entità selezionata;
  se ha `sensor` → `drawCircle`/`drawRect` dell'area (shape-aware).
- Riusa primitive Renderer esistenti (`drawRect/drawCircle`) — niente API nuove.
- **Validazione**: selezione entità da Hierarchy (`editor_select_entity`) →
  gizmo visibile nel canvas (screenshot pre/post); entità con Sensor → area
  disegnata; in play-mode (mode 1) i gizmo spariscono.
- **Commit D3** → Fase D completa.

### Fase E — Theming: Dark / Light (default Dark) · ~1 gg · solo-TS
**Obiettivo**: sostituire il tema "Neon" hard-coded con un sistema a temi
selezionabile **Dark / Light**, con **Dark come default**.

- Estrarre i colori hard-coded (`#0B1121`, `#00FFFF`, `#FF00FF`, `#F97316`,
  `#1A253A`, `#9CA3AF`, `#D1D5DB`…) in **CSS custom properties** / token
  Tailwind (`tailwind.config.js` `theme.extend.colors` + `:root` /
  `[data-theme]`); i componenti usano i token, non i literal.
- Due palette: `dark` (default — derivata dall'attuale Neon, contrasto alto)
  e `light` (sfondi chiari, accenti adattati).
- Theme switcher in UI (MenuBar o impostazioni) + persistenza scelta
  (`localStorage`/settings); attributo `data-theme` su `<html>`.
- `prefers-color-scheme` come fallback iniziale, override manuale.
- Nessun rebuild WASM (puramente editor TS/CSS). Lo `PreviewPanel` resta
  black-box: il tema riguarda solo la chrome dell'editor.
- Test: util di risoluzione tema + persistenza.

> Nota: tocca molti file (sostituzione literal → token). Da fare in modo
> meccanico e verificabile (nessun cambiamento funzionale, solo styling).

---

## Decisioni (stato)

1. **EntityDef.components**: ✅ DECISO — tipi forti + registry (Fase A fatta).
2. **Tile rendering**: storage subito (Fase C), rendering nel runtime (Fase D).
   **Raccomando ancora questo.**
3. **Ordine**: ✅ CONFERMATO — A→B→C solo-TS, poi D runtime.
4. **Logic Board node-graph**: fuori da questo piano (iterazione dedicata).
5. **Theming (Fase E)**: ✅ RICHIESTO — Dark/Light, default Dark; collocato
   dopo D ma indipendente (solo-TS, può slittare prima se prioritario).

---

## Stato avanzamento

| Fase | Stato |
|------|-------|
| A — Inspector a componenti | ✅ `efdc6af` |
| B — World settings + Hierarchy | ✅ `97c8ba1` |
| C — Tile painter (editor-side) | ✅ `4585b23` |
| D1 — Componenti ECS + AutoDestroy | ⏳ in corso |
| D2 — Tilemap render + collisioni | ⏳ |
| D3 — Gizmo/sensori viewport | ⏳ |
| E — Theming Dark/Light | ⏳ pianificato |

## Stima totale

| Fasi solo-TS (A+B+C) | ~4 gg | A fatta; basso rischio, nessun rebuild |
| Fase D (runtime) | ~2-3 gg | tocca C++/WASM, validazione end-to-end |
| Fase E (theming) | ~1 gg | solo-TS, meccanico |
| **Totale** | **~7-8 gg** | |

Lo scene editor resta usabile ad ogni fase; il valore è incrementale.
