# Migrazione modello oggetti + Logic Board — Piano master pre-release

> **Status:** Fasi A + B + C **completate** (2026-06-10) — Logic Board solo `object_type`, Hierarchy unificata "Objects in scene", Inspector scrive su `objectTypes` (entities = cache derivata). Resta la Fase D (pulizia doc / opzionali).  
> **Data:** 2026-06-09 (agg. 2026-06-10)  
> **Audience:** Collaboratori editor (React/TS), reviewer, tech lead  
> **Policy:** **Nessuna compatibilità legacy** in pre-release — un solo schema autore, niente doppi percorsi  
> **Prerequisiti:** [`OBJECT_TYPES_ARCHITECTURE.md`](OBJECT_TYPES_ARCHITECTURE.md), [`NORTH_STAR_ARCHITECTURE.md`](NORTH_STAR_ARCHITECTURE.md) §3, [`GLOBAL_LOGIC_UI_ARCHITECTURE.md`](GLOBAL_LOGIC_UI_ARCHITECTURE.md) §0, [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md)

---

## 1. Obiettivo

Due refactor correlati, un **solo modello mentale** per il designer:

### 1.1 Oggetti in scena = istanze di tipi

| Per il designer | Per il salvataggio (`project.json` v2) |
|-----------------|----------------------------------------|
| **Oggetti in scena** (lista nella Hierarchy) | `scene.instances[]` — placement |
| Modifica sprite/componenti sul tipo condiviso | `project.objectTypes[id]` — definizione |
| Più copie dello stesso oggetto (es. 10 Coin) | Stesso `objectTypeId`, N istanze |

**Non** due sezioni Hierarchy (“Entities” + “Entity Types”), **non** due pulsanti che creano cose diverse, **non** un tipo automatico per ogni oggetto (`Entity_1`, `Entity_2`).

Riferimento prodotto: **Construct 3 Object Types** / **Unity Prefab + instance in scene**.

### 1.2 Comportamento = un tipo, una Logic Board

| Per il designer | Per il codice |
|-----------------|---------------|
| **Coin** ha un solo comportamento | Una board con `target: { type: 'object_type', objectTypeId: 'Coin' }` |
| Tutte le istanze Coin in scena condividono quella logica | Lua: `pool.getAll("Coin")` |
| Serve una variante (es. moneta d’oro) | Nuovo tipo **CoinGold** (sprite + componenti + board propria) |

**Non** logica per istanza numerica (`entity_id`), **non** alias `entity_class`, **non** migrazione silenziosa al load.

### 1.3 Decisioni prodotto (bloccanti)

1. **Variante di gameplay** → nuovo `objectTypeId` (`Coin2`, `CoinGold`), non override su un’istanza.
2. **Differenza solo di posizione/nome/visibilità** → stessa istanza dello stesso tipo.
3. **Stato runtime** (già raccolto, timer, HP) → `state` / Lua, non nuova board per istanza.
4. **Pre-release:** progetti con `entity_id` / `entity_class` nelle board → **errore di validazione** al load, non conversione automatica.

---

## 2. Stato attuale del codice (cosa fa oggi)

### 2.1 Tre layer percepiti, due sorgenti reali (oggetti)

```
┌─────────────────────────────────────────────────────────────────┐
│  UI Hierarchy (confusa)                                         │
│  • ENTITIES + "Add entity"                                      │
│  • ENTITY TYPES + "New type" (+ "Place in scene" da menu)       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  In memoria (ProjectDoc)                                        │
│  • project.entities[id]     ← Inspector scrive qui (cache piana)  │
│  • project.objectTypes     ← Catalogo tipi (v2)                │
│  • scene.instances[]       ← Placement v2                       │
│  • scene.entityIds[]       ← Indice legacy, tenuto in sync       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ save (serializeProjectDoc)
┌─────────────────────────────────────────────────────────────────┐
│  Su disco (formatVersion: 2)                                    │
│  • objectTypes + scenes.instances  (canonico)                   │
│  • entities map NON serializzata come sorgente autore           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ runtime / WASM
┌─────────────────────────────────────────────────────────────────┐
│  EntityDef materializzato = merge(tipo + istanza)             │
│  pool Lua: className === objectTypeId                           │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Percorsi di creazione oggetti (ridondanti)

| Azione UI | Action Redux | Cosa succede oggi |
|-----------|--------------|-------------------|
| **Add entity** | `ENTITY_ADD` | Crea `EntityDef` in `entities`, aggiunge a `entityIds`, poi `syncObjectModelFromEntities()` ricostruisce `objectTypes` + `instances` — spesso **un tipo nuovo per oggetto** (`Entity_1`, `Entity_2`…) |
| **New type** | `OBJECT_TYPE_ADD` | Solo catalogo; **non** piazza in scena |
| **Place in scene** (menu su tipo) | `INSTANCE_ADD_FROM_TYPE` | Percorso v2 **corretto**: tipo esistente → istanza + `materializeEntity` |
| **Insert** (tastiera) | → `addEntity()` → `ENTITY_ADD` | Come “Add entity” |

Il percorso v2 pulito esiste ma **non** è il default in UI.

### 2.3 Ponte legacy oggetti: `syncObjectModelFromEntities`

```ts
// editor/src/utils/project-object-types.ts
syncObjectModelFromEntities(project)
  → buildObjectModelFromEntities(project)  // inferisce tipi DA entities piane
  → aggiorna objectTypes + scenes.instances
```

Chiamata da `entity-reducer` su `ENTITY_ADD`, `ENTITY_DUPLICATE`, `ENTITY_DELETE`.

**Problema:** l’Inspector modifica `entities`; il modello v2 viene **ricostruito all’indietro** invece di essere la sorgente autore.

### 2.4 Ruolo di `entities` in memoria oggi

| Ruolo | Dettaglio |
|-------|-----------|
| **Inspector / Canvas** | Legge e scrive `project.entities[selectedId]` |
| **Runtime preview** | `entitiesForRuntimeSync()` materializza da tipi+istanze, con overlay su `entities` |
| **Save** | `projectForSave` rigenera tipi/istanze da `entities` via `buildObjectModelFromEntities` |

`EntityDef` resta necessario come **vista materializzata** verso WASM/C++; va **depromosso** come sorgente autore.

---

### 2.5 Logic Board — ibrido attuale (cosa fa oggi)

Le regole vivono in `project.logicBoards[]`, separate da `objectTypes`. Ogni board ha un `target` con **tre modi** per legare il comportamento agli oggetti:

| `target.type` | Significato oggi | Stato |
|---------------|------------------|-------|
| **`object_type`** | Comportamento condiviso su tutte le istanze del tipo | ✅ Target corretto |
| **`entity_class`** | Alias legacy di `className`; parser converte spesso in `object_type` | ⚠️ Da eliminare |
| **`entity_id`** | Board legata a **un solo** id numerico in scena | ⚠️ Da eliminare |
| **`global`** / **`scene`** | Logica senza `self` (input, timer scena) | ✅ Mantieni |

#### Risoluzione board da istanza selezionata

`findLogicBoardForInstance(project, instanceId)` in `project-queries.ts`:

```
1. Risolve objectTypeId dall’istanza (instances[] o entities[].className)
2. findLogicBoardForObjectType(project, typeId)   ← preferito
3. Se assente → findLogicBoardForEntity(project, instanceId)   ← fallback legacy
```

#### Creazione board da UI

`LogicBoardPanel.createBoardForEntity(entityId)`:

```
typeId = findObjectTypeForInstance(project, entityId)
board = typeId
  ? createLogicBoardForObjectType(typeId)    ← se risolve il tipo
  : createLogicBoardForEntity(entityId)      ← fallback entity_id
```

#### Compilazione Lua

- **`object_type` / `entity_class`:** `pool.getAll("Coin")` — tutte le istanze del tipo.
- **`entity_id`:** `poolExpr` emette `{ 7 }` — solo quell’id.

File: `editor/src/utils/logic-board/lua-helpers.ts`, `trigger-execution.ts`, `compiler.ts`.

#### Migrazione al load (da rimuovere)

`migrateLogicBoards()` in `project-object-types.ts` converte silenziosamente:

- `entity_id` → `object_type` se trova mapping istanza→tipo
- `entity_class` → `object_type` con `objectTypeId = className`

#### Lifecycle legato a `entity_id` (da rimuovere)

| Evento | Comportamento oggi |
|--------|-------------------|
| `ENTITY_DELETE` | Rimuove board con `target.entityId === id` |
| `SCENE_DELETE` | Rimuove board `entity_id` le cui istanze escono dalla scena |
| `SCENE_DUPLICATE` | Clona board `entity_id` con nuovo `entityId` mappato |

#### UI incoerenze oggi

| File | Problema |
|------|----------|
| `RulesheetControls.tsx` | Usa `findLogicBoardForEntity` invece di `findLogicBoardForInstance` |
| `EventEditor.tsx` | `clickToDestroy` abilitato solo per `entity_id` \| `entity_class`, non per `object_type` (bug rispetto a `click-to-destroy.ts`) |
| `GLOBAL_LOGIC_UI_ARCHITECTURE.md` | Menziona ancora “entity-first default” — doc obsoleto |

#### Schema JSON oggi

`editor/src/schemas/logic-board/board.schema.json` ammette ancora:

```json
"type": { "enum": ["object_type", "entity_class", "entity_id", "global", "scene"] }
```

---

## 3. Modello target (cosa dovrà fare il codice)

### 3.1 Oggetti — regole

1. Ogni riga in Hierarchy = **istanza** con `objectTypeId`.
2. Definizione condivisa (sprite, physics, componenti) su **`objectTypes[objectTypeId]`**.
3. **Solo su istanza:** `transform`, `instanceName`, `visible`.
4. **`project.entities`** = cache derivata (`materializeEntity`); aggiornata dopo ogni mutazione; **mai** `buildObjectModelFromEntities` nel loop di edit.
5. **UI:** una lista “Objects in scene”, un pulsante “+ Insert object”.

### 3.2 Oggetti — flusso autore target

```
[+ Insert object]
    → prompt nome (es. "Coin")
    → slugTypeId → objectTypeId
    → se tipo non esiste: OBJECT_TYPE_ADD (prototipo default)
    → INSTANCE_ADD_FROM_TYPE (piazza in scena attiva, seleziona)
```

Duplicare in scena = **nuova istanza dello stesso tipo** (offset transform), non clone `EntityDef` con nuovo tipo inferito.

### 3.3 Oggetti — diagramma dati target

```
objectTypes["Coin"]          scene.instances[]
├─ sprite, physics, …      ├─ { id: 3, objectTypeId: "Coin", transform }
├─ tags, components          ├─ { id: 7, objectTypeId: "Coin", transform }
└─ (no logic inline)         └─ …

logicBoards[]
└─ { target: { type: 'object_type', objectTypeId: 'Coin' }, events: [...] }

entities[3] = materializeEntity(objectTypes["Coin"], instance[3])  // cache
entities[7] = materializeEntity(objectTypes["Coin"], instance[7])
```

Variante gameplay:

```
objectTypes["CoinGold"]  +  logicBoards[] con objectTypeId: "CoinGold"
(scene: istanze CoinGold piazzate come qualsiasi altro tipo)
```

### 3.4 Logic Board — contratto target (unico schema)

#### Target ammessi

| `target.type` | Campi | Uso |
|---------------|-------|-----|
| **`object_type`** | `objectTypeId: string` (obbligatorio) | Comportamento di tutte le istanze del tipo |
| **`global`** | — | Input, messaggi, timer senza `self` |
| **`scene`** | — | Opzionale: alias di `global` o rimozione in favore di solo `global` |

**Rimossi:** `entity_id`, `entity_class`, campi `entityId`, `className` sul target.

#### TypeScript target

```ts
target: {
  type: 'object_type' | 'global' | 'scene'
  objectTypeId?: string  // required when type === 'object_type'
}
```

#### Comportamenti che il codice dovrà implementare

| Operazione | Comportamento target |
|------------|---------------------|
| Apri Logic da istanza selezionata | Risolve `objectTypeId` → apre/crea board **del tipo** |
| Crea nuova board | **Sempre** `createLogicBoardForObjectType(objectTypeId)`; errore se tipo non risolvibile |
| `findLogicBoardForInstance` | **Solo** `findLogicBoardForObjectType`; niente fallback `entity_id` |
| Delete istanza | **Non** cancella board (la board è sul tipo, non sull’istanza) |
| Delete ultima istanza di un tipo | Board resta (tipo ancora in `objectTypes`); validator può **warn** “tipo senza istanze in scena” |
| Duplicate scena | **Non** clona board per istanza; board `object_type` già copre le nuove istanze dello stesso tipo |
| Parse `logicBoards` da JSON | `entity_id` / `entity_class` → **board rifiutata** o errore progetto |
| `migrateLogicBoards` | **Eliminata** |
| Compilatore | Solo `pool.getAll(objectTypeId)` per board oggetto; niente `{ entityId }` |
| `clickToDestroy` | Disponibile su board `object_type` (allineare `EventEditor` a `isEntityBoardTarget`) |

#### Regola designer (documentata in UI)

> Modifichi il comportamento di **tutti** i Coin insieme. Per una moneta diversa, crea un nuovo tipo (es. CoinGold) e assegna una board a quel tipo.

---

## 4. Inventario file — UI oggetti

### 4.1 Modificare (Fase B — Hierarchy)

| File | Ruolo oggi | Cosa dovrà fare |
|------|------------|-----------------|
| [`ProjectExplorerPanel.tsx`](../editor/src/components/project-explorer/ProjectExplorerPanel.tsx) | Due sezioni “Entities” + “Entity Types” | Una sezione “Objects in scene”; CTA `+ Insert object`; rimuovere Entity Types |
| [`useSceneExplorerActions.ts`](../editor/src/hooks/useSceneExplorerActions.ts) | `addEntity`, `addEntityType`, `placeEntityType`, Insert → `ENTITY_ADD` | `insertObject()` unificato; Insert → `OBJECT_TYPE_ADD` + `INSTANCE_ADD_FROM_TYPE` |
| [`project-explorer-tree.ts`](../editor/src/utils/project-explorer-tree.ts) | `entities` + `entityTypes` | Solo istanze in scena; `hasLogic` via `findLogicBoardForInstance` → poi solo tipo |
| [`useExplorerExpanded.ts`](../editor/src/hooks/useExplorerExpanded.ts) | Chiave `entityTypes` | Rimuovere |
| [`project-explorer-tree.test.ts`](../editor/src/utils/project-explorer-tree.test.ts) | Test `entityTypes` | Aggiornare |

### 4.2 Modificare (Fase C — Inspector)

| File | Oggi | Target |
|------|------|--------|
| `SpriteSection.tsx` | `ENTITY_SET_SPRITE` su entity | Scrittura su `objectTypes[typeId]` + rematerialize |
| `PhysicsSection.tsx` | `ENTITY_SET_PHYSICS` | Idem |
| `ComponentsSection.tsx` | `ENTITY_SET_COMPONENT` | Idem |
| `EntityHeaderBar.tsx` | `ENTITY_SET_NAME` | `instanceName` vs `displayName` tipo |
| `EntityTagsSection.tsx` | Tag su entity | Tag sul **tipo** |
| `LogicBoardCta.tsx` / `logic-board-navigation.ts` | Apre Logic per `entityId` | Ok: navigazione da istanza, board risolta sul **tipo** |

---

## 5. Inventario file — Store / reducer / utils oggetti

### 5.1 Tenere (canonico v2)

| Simbolo | File |
|---------|------|
| `OBJECT_TYPE_*`, `INSTANCE_ADD_FROM_TYPE` | `object-type-reducer.ts` |
| `materializeEntity`, `entitiesForRuntimeSync`, `normalizeProjectDoc`, `projectForSave` | `project-object-types.ts` |
| `serializeProjectDoc` | `project-codec.ts` |
| `ObjectTypeDef`, `SceneInstanceDef`, `EntityDef` | `types/index.ts` |

### 5.2 Eliminare (Fase B)

| Simbolo | Motivo |
|---------|--------|
| `ENTITY_ADD` | Sostituito da insert unificato |
| `addEntity`, `addEntityType`, `placeEntityType` | UI non espone più percorsi legacy |
| Sezione Entity Types in Hierarchy | Ridondante |

### 5.3 Refactor (Fase C)

| Simbolo | Target |
|---------|--------|
| `ENTITY_SET_*` (sprite, physics, component, tag) | Scrittura su `objectTypes` + `rematerializeInstance` |
| `ENTITY_DUPLICATE` | `INSTANCE_DUPLICATE` (stesso `objectTypeId`) |
| `syncObjectModelFromEntities` | **Fuori dal hot path**; solo import v1 se ancora necessario |
| `buildObjectModelFromEntities` | Solo `migrateLegacyProject` / test, non ogni edit |

### 5.4 Nuove action

| Action | Scopo |
|--------|--------|
| `OBJECT_INSERT` (opzionale) | Atomico: tipo + istanza + selezione |
| `INSTANCE_DUPLICATE` | Stesso tipo, nuovo id, offset transform |
| `OBJECT_TYPE_PATCH` | Patch su `ObjectTypeDef` + rematerialize tutte le istanze |
| `INSTANCE_PATCH` | `instanceName`, `visible`, `transform` |

Helper:

```ts
rematerializeInstance(project, instanceId): ProjectDoc
rematerializeAllInstancesOfType(project, objectTypeId): ProjectDoc
```

---

## 6. Inventario file — Logic Board (rimozione ibrido)

### 6.1 Contratto e tipi (Fase A — prima o in parallelo a UI)

| File | Oggi | Target |
|------|------|--------|
| [`types/logic-board.ts`](../editor/src/types/logic-board.ts) | Union con `entity_id`, `entity_class` | Solo `object_type` \| `global` \| `scene` |
| [`schemas/logic-board/board.schema.json`](../editor/src/schemas/logic-board/board.schema.json) | Enum 5 valori | Enum 3 valori; `objectTypeId` required se `object_type` |
| — | — | `npm run compile-schemas` → aggiorna `validators.generated.ts` |
| [`project-validator.ts`](../editor/src/utils/project-validator.ts) | Valida anche `entity_class` / `entity_id` | **Errore** su target legacy; verifica `objectTypeId` ∈ `objectTypes` |

### 6.2 Factory e parse (Fase A)

| File | Oggi | Target |
|------|------|--------|
| [`logic-board/factory.ts`](../editor/src/utils/logic-board/factory.ts) | `createLogicBoardForEntity`; `parseBoard` fallback `entity_class` | Elimina `createLogicBoardForEntity`; parse rifiuta legacy |
| [`project-object-types.ts`](../editor/src/utils/project-object-types.ts) | `migrateLogicBoards()` in `migrateLegacyProject` | Elimina `migrateLogicBoards` |

### 6.3 Query e label (Fase A)

| File | Oggi | Target |
|------|------|--------|
| [`project-queries.ts`](../editor/src/utils/project-queries.ts) | `findLogicBoardForEntity`, fallback in `findLogicBoardForInstance`, `logicBoardTargetTypeKey` con `entity_class` | Elimina `findLogicBoardForEntity`; `findLogicBoardForInstance` → solo tipo; semplifica label “Applies to” |
| [`project.labels.test.ts`](../editor/src/utils/project.labels.test.ts) | Test `findLogicBoardForEntity` | Rimuovere / riscrivere |

### 6.4 Compiler e Lua (Fase A)

| File | Oggi | Target |
|------|------|--------|
| [`logic-board/lua-helpers.ts`](../editor/src/utils/logic-board/lua-helpers.ts) | Ramo `entity_id` in `poolExpr`, `sensorSourceExpr` | Solo `object_type` + `global` |
| [`logic-board/trigger-compatibility.ts`](../editor/src/utils/logic-board/trigger-compatibility.ts) | `ENTITY_TARGETS` include legacy | `ENTITY_TARGETS = ['object_type']` |
| [`logic-board/trigger-execution.ts`](../editor/src/utils/logic-board/trigger-execution.ts) | Branch per `entity_class` | Solo `object_type` |
| [`logic-board/click-to-destroy.ts`](../editor/src/utils/logic-board/click-to-destroy.ts) | `isEntityBoardTarget` include legacy | Solo `object_type` |

### 6.5 Store lifecycle (Fase A)

| File | Oggi | Target |
|------|------|--------|
| [`entity-reducer.ts`](../editor/src/store/reducers/entity-reducer.ts) | `ENTITY_DELETE` filtra board `entity_id` | Rimuovi filtro board (board non legata a istanza) |
| [`scene-reducer.ts`](../editor/src/store/reducers/scene-reducer.ts) | `SCENE_DUPLICATE` clona board `entity_id`; `SCENE_DELETE` le prune | Rimuovi entrambi i rami |

### 6.6 UI Logic Board (Fase A + B)

| File | Oggi | Target |
|------|------|--------|
| [`LogicBoardPanel.tsx`](../editor/src/panels/LogicBoardPanel.tsx) | `createLogicBoardForEntity` fallback | Solo `createLogicBoardForObjectType`; errore se no `typeId` |
| [`RulesheetControls.tsx`](../editor/src/panels/logic-board/RulesheetControls.tsx) | `findLogicBoardForEntity` | `findLogicBoardForInstance` o `findLogicBoardForObjectType` |
| [`EventEditor.tsx`](../editor/src/panels/logic-board/EventEditor.tsx) | `clickToDestroy` solo legacy target | `object_type` (o `isEntityBoardTarget`) |

### 6.7 Test da convertire (Fase A)

Tutti i fixture con `target: { type: 'entity_id', ... }` → `object_type` + `objectTypes` + `instances` nel progetto di test.

| File (priorità alta) | Occorrenze `entity_id` circa |
|----------------------|------------------------------|
| `compiler.test.ts` | ~10 |
| `trigger-execution.test.ts` | ~14 |
| `compiler.runtime.test.ts` | ~11 |
| `component-capabilities.test.ts` | ~5 |
| `editor-store.logic.test.ts` | ~3 |
| `editor-store.scene-duplicate.test.ts` | clone board legacy |
| Altri `*.test.ts` in `logic-board/` e `utils/` | ~15 file totali |

Comando: `cd editor; npm test -- --run`

---

## 7. Runtime / C++ / WASM

| Layer | Oggi | Dopo refactor |
|-------|------|---------------|
| `entitiesForRuntimeSync` | Materializza v2 | Invariato |
| Lua `pool.getAll(className)` | `className === objectTypeId` | Invariato |
| C++ gateway | `EntityDef` + prototipi | Invariato |

**Nessun cambio** al contratto WASM/C++ se il compilatore emette sempre `pool.getAll("Coin")` per board oggetto.

Il formato `.artcade` / `project.json` v2 resta valido; cambia solo il **sottoinsieme ammesso** di `logicBoards[].target`.

---

## 8. Piano di esecuzione (ordine consigliato)

### Fase A — Logic Board: schema unico ✅ (2026-06-10)

**Obiettivo:** un solo target per comportamento oggetto; zero `entity_id` / `entity_class` nel codice.

- [x] Aggiornare `types/logic-board.ts` + `board.schema.json` + `compile-schemas`
- [x] `project-validator`: errore su target legacy
- [x] Rimuovere `createLogicBoardForEntity`, `findLogicBoardForEntity`, `migrateLogicBoards`
- [x] Semplificare `findLogicBoardForInstance`, `lua-helpers`, `trigger-compatibility`, `trigger-execution`
- [x] Pulire `entity-reducer` / `scene-reducer` (lifecycle board)
- [x] Aggiornare `LogicBoardPanel`, `RulesheetControls`, `EventEditor`
- [x] Convertire tutti i test Logic Board (140 file suite verdi)
- [x] Aggiornare doc: `OBJECT_TYPES_ARCHITECTURE.md` § Logic Board, `GLOBAL_LOGIC_UI_ARCHITECTURE.md`
- [x] `npm test -- --run` (140/140); `npm run build` ok

**Breaking:** progetti salvati con board `entity_id` non passano validazione finché non convertiti a mano a `object_type`.

### Fase B — UI oggetti + creazione ✅ (2026-06-10)

**Obiettivo:** un solo ingresso per aggiungere oggetti in scena.

- [x] Hierarchy: “Objects in scene” + `+ Insert object`
- [x] `insertObject` → `OBJECT_TYPE_ADD` + `INSTANCE_ADD_FROM_TYPE`
- [x] Insert tastiera → stesso flusso
- [x] Rimuovere Entity Types section + `ENTITY_ADD` + test associati
- [x] `npm test -- --run`; `npm run build`

**Non in Fase B:** refactor Inspector (Fase C).

### Fase C — Edit path oggetti ✅ (2026-06-10)

**Obiettivo:** `objectTypes` + `instances` = sorgente autore; `entities` = cache.

- [x] `rematerializeInstance` / `rematerializeAllInstancesOfType` (+ `findSceneInstance`)
- [x] Refactor `ENTITY_SET_*` → tipo (sprite/physics/component/tag/className) o istanza (name/visible)
- [x] `ENTITY_DUPLICATE` → `INSTANCE_DUPLICATE` (stesso tipo, offset transform)
- [x] Rimuovere `syncObjectModelFromEntities` da `entity-reducer`
- [x] `projectForSave` senza rebuild da `entities` (rebuild solo per progetti pre-v2)
- [x] Test: duplicate 2× stesso tipo, edit sprite condiviso propagato, rename solo istanza

### Fase D — Pulizia doc e prodotto

- [ ] `ENGINE_STATE_RECAP_COLLABORATORS.md` — flusso unificato
- [ ] Rimuovere riferimenti “entity-first” / “Advanced entity_id” dai doc
- [ ] (Opzionale) selettore board per **Object Type** in pannello Logic, oltre alla navigazione da istanza
- [ ] (Opzionale) unificare `scene` → `global` nei target board

---

## 9. Test — riepilogo

### Oggetti

| File | Azione |
|------|--------|
| `editor-store.scene-objects.test.ts` | `OBJECT_INSERT` / `INSTANCE_ADD_FROM_TYPE` |
| `project-explorer-tree.test.ts` | Rimuovere `entityTypes` |
| `project-object-types.test.ts` | Test rematerialize; tenere migrazione v1 separata |
| `editor-store.assets.test.ts` | Setup senza `ENTITY_ADD` |

### Logic Board

| File | Azione |
|------|--------|
| `compiler.test.ts`, `compiler.runtime.test.ts` | Fixture `object_type` + progetto v2 |
| `trigger-execution.test.ts` | Idem |
| `editor-store.scene-duplicate.test.ts` | Rimuovere expect clone board `entity_id` |
| `project.labels.test.ts` | Rimuovere suite `findLogicBoardForEntity` |

---

## 10. Cosa eliminare vs cosa tenere

### Eliminare (pre-release, nessuna compat)

| Elemento | Motivo |
|----------|--------|
| `target.type: entity_id` | Logica per istanza — anti-pattern |
| `target.type: entity_class` | Alias ridondante di `object_type` |
| `createLogicBoardForEntity` | Sostituito da `createLogicBoardForObjectType` |
| `findLogicBoardForEntity` | Sostituito da risoluzione via tipo |
| `migrateLogicBoards` | Nessuna conversione silenziosa |
| `ENTITY_ADD` (UI + reducer) | Crea tipi spuri `Entity_N` |
| `syncObjectModelFromEntities` nel hot path | Inverte sorgente autore |

### Tenere

| Elemento | Motivo |
|----------|--------|
| `migrateLegacyProject` / `normalizeProjectDoc` | Apertura progetti **v1** senza `objectTypes` (solo oggetti, non board legacy) |
| `EntityDef` + `materializeEntity` | Contratto runtime/WASM |
| `entityIds[]` su scena | Indice canvas finché non migrato del tutto |
| `target.type: global` | Logica scena senza `self` |
| `INSTANCE_ADD_FROM_TYPE` | Piazzamento v2 canonico |

---

## 11. Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Progetti dev con board `entity_id` | Pre-release: convertire manualmente a `object_type` o rigenerare board |
| Inspector scrive su `entities` (Fase B) | Accettabile brevemente; Fase C allinea al tipo |
| Modifica sprite su istanza A non su B (Fase B) | Fase C: edit sul tipo |
| Test ~35 file Logic Board | Fase A dedicata; fixture helper condiviso `makeProjectWithTypeBoard()` |
| Doc obsoleti (`GLOBAL_LOGIC_UI`, backlog entity-first) | Fase A/D aggiornamento esplicito |
| Coin “speciale” senza nuovo tipo | **Non supportato** — usare `CoinGold` o stato Lua |

---

## 12. Glossario

| Termine UI | Termine codice | Note |
|------------|----------------|------|
| Oggetto in scena | `SceneInstanceDef` | Una riga Hierarchy |
| Tipo / Prefab | `objectTypeId` / `ObjectTypeDef` | Pool Lua, target Logic Board |
| Comportamento | `logicBoards[]` con `object_type` | **Una board per tipo**, non per istanza |
| Variante | Nuovo `objectTypeId` | Es. `CoinGold`, non override istanza |
| Entity (codice) | `EntityDef` materializzato | Cache verso Inspector/runtime; non mostrare “Entity” in UI Base |

---

## 13. Riferimenti incrociati

| Documento | Aggiornare dopo refactor |
|-----------|--------------------------|
| [`OBJECT_TYPES_ARCHITECTURE.md`](OBJECT_TYPES_ARCHITECTURE.md) | § Logic Board — solo `object_type` |
| [`GLOBAL_LOGIC_UI_ARCHITECTURE.md`](GLOBAL_LOGIC_UI_ARCHITECTURE.md) | Rimuovere entity-first default |
| [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md) | Target union nel SPEC |
| [`LOGIC_BOARD_EDITOR_BACKLOG.md`](LOGIC_BOARD_EDITOR_BACKLOG.md) | Chiudere voce “entity-first authoring” |
| [`ENGINE_DESIGN_RECAP.md`](ENGINE_DESIGN_RECAP.md) | Recipe pickup su tipo Player |

---

## 14. Checklist reviewer (pre-merge per fase)

### Fase A (Logic Board)

- [ ] `board.schema.json` non ammette `entity_id` / `entity_class`
- [ ] Nessun `createLogicBoardForEntity` / `findLogicBoardForEntity` nel codice sorgente
- [ ] Nessun ramo `entity_id` in `poolExpr` / compiler
- [ ] `migrateLogicBoards` rimossa
- [ ] Test verdi; nessun fixture con `entity_id` target
- [ ] Doc OBJECT_TYPES / GLOBAL_LOGIC aggiornati

### Fase B (Hierarchy)

- [ ] Una sola sezione oggetti in scena
- [ ] Nessun `ENTITY_ADD` in UI
- [ ] Insert tastiera = Insert object

### Fase C (Edit path)

- [ ] `ENTITY_SET_SPRITE` (e simili) scrivono su `objectTypes`
- [ ] `syncObjectModelFromEntities` assente da `entity-reducer`
- [ ] Save/load round-trip senza `buildObjectModelFromEntities` nel loop edit

---

*Ultimo aggiornamento: 2026-06-09 — piano master: modello oggetti unificato + Logic Board senza ibrido (pre-release, no compat).*
