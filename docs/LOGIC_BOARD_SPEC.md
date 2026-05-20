# ArtCade V2 — Logic Board, Logic Sheet & glossario authoring

> **Versione documento:** 1.2  
> **Stato:** Parte I normativa · Parte II formato tabellare (v0.1) · Parte III Logic Board event-centric (v1.0 proposta)  
> **Data:** 2026-05-11  
> **Audience:** Team, UI copy, codegen, runtime  

Questo file **unifica** tre livelli: (1) **glossario** Logic Board / Logic Event / Logic Component e termini runtime; (2) **formato Logic Sheet tabellare** (righe when/then — authoring alternativo); (3) **specifica tecnica Logic Board** orientata agli eventi (trigger / condizioni / azioni, compilatore TS → Lua, UI, MVP). Un solo punto di riferimento per vocabolario e implementazione.

**Best practice di design** (blackboard, segnali, nodi data-driven, UX debug, bridge numerico): [`LOGIC_BOARD_DESIGN_GUIDELINES.md`](LOGIC_BOARD_DESIGN_GUIDELINES.md). **Condizionali avanzati** (OR/ gruppi booleani, IF/ELSE, branch flow vs compatto, codegen, didattica): [`LOGIC_BOARD_CONDITIONAL_DESIGN.md`](LOGIC_BOARD_CONDITIONAL_DESIGN.md). Entrambi in **Parte IV** in fondo.

---

## Parte I — Glossario ufficiale

Le definizioni seguenti sono **normative**: in nuovi doc, pannelli e tooltip usare queste forme (mai abbreviare in modo ambiguo, es. solo «Component» per un mattone logico).

### ArtCade V2

Prodotto complessivo: **runtime** C++ (nativo + WASM), **editor** (React + shell Tauri), formato progetto **`.artcade`**, toolchain e documentazione associata.

### Logic Board

L’ambiente di authoring della **logica di gioco** pensato come **scheda / tavolo di lavoro**: un luogo distinto dall’**editor** generico e dal **canvas** di preview, dove si assembla la logica.

- Evoca **fisicità** (board = banco di lavoro), suona **professionale** ma accessibile, ed è **traducibile** («Scheda logica») senza perdere il senso.
- Contiene **Logic Event** organizzati in modo che l’utente capisca in pochi minuti la gerarchia.

**Gerarchia (ordine di apprendimento):**

```text
Logic Board              (il luogo di lavoro)
  └─ Logic Event         (il blocco condizionale / trigger)
       └─ Logic Component (il mattone: trigger, condizione o azione)
```

**Implementazione editor (oggi):** tab **Visual** = solo editor eventi (tutta la larghezza); tab **Script** = anteprima Lua read-only + **Apri in Editor Script**. Nessuna anteprima Lua affiancata in Visual. Il main (`mainScriptPath`) si aggiorna in store (`UPSERT_SCRIPT`); edit con tab bar nel modulo **Editor Script** (`CODEMIRROR_EDITOR.md`). **Apply & hot-reload** invia il Lua al runtime WASM.

### Logic Event

Blocco **condizionale** dentro la Logic Board: qualcosa che **accade** (collisione, input, tick, timer, …).

- Composto da: **trigger** (quando scatta), **condizioni** opzionali (filtri), **azioni** (cosa eseguire).
- Il nome richiama **evento** = trigger; anche chi non programma lo associa a «circostanze e conseguenze».

### Logic Component

**Unità atomica** di comportamento nella Logic Board: il «mattone» riutilizzabile che si incastra dentro un Logic Event.

Tre famiglie tipiche (catalogo prodotto in evoluzione):

| Famiglia | Ruolo |
|----------|--------|
| **Trigger** | *Quando* valutare l’evento (`onStart`, `onUpdate`, `onCollision`, …) |
| **Condizione** | *Se* procedere (`compareVariable`, `isKeyDown`, …) |
| **Azione** | *Cosa* fare (`playSound`, `applyImpulse`, `setGlobalState`, …) |

> **Omonimia:** nel runtime **ECS** esistono i **Component** (dati: `Transform`, `Sprite`, …). Qui si usa sempre **Logic Component** (comportamento). In UI e doc **non** usare il solo «Component» per i mattoni logici.

**UI:** tooltip e menu in forma completa — es. *«Aggiungi un Logic Component…»* — così **ECS Component** = dato, **Logic Component** = comportamento.

### Logic Sheet

Nome del **documento dati** (JSON) che contiene la logica generata dalla Logic Board: in **Parte III** il modello canonico è **`events: LogicEvent[]`** (trigger + condizioni + azioni). La **Parte II** documenta inoltre una vista **tabellare** (`rows` when/then) mappabile sullo stesso comportamento o usata come authoring alternativo. Il runtime esegue sempre **Lua bytecode**; non interpreta JSON a runtime.

---

### ECS (Entity Component System)

Paradigma: **Entity** (identificatore), **Component** (dati), **System** (logica che itera su pattern di componenti).

La guida `ECS_IMPLEMENTATION_GUIDE.md` e l’architettura tecnica descrivono anche **EnTT** come obiettivo/evoluzione; **nel codice runtime attuale** le entità sono gestite tramite **`EntityManager`** e **`EntityDef`** (vedi `ARCHITETTURA_TECNICA_ENGINE_2D.md` §11).

### ECS Component

**Dato** associato a un’entità (trasformazione, sprite, corpo fisico). **Non** è un Logic Component.

### EnTT

Libreria C++ header-only per registry ECS; riferimenti e migrazione in `ECS_IMPLEMENTATION_GUIDE.md` e §11 di `ARCHITETTURA_TECNICA_ENGINE_2D.md`.

### World

Orchestratore di **stato di gioco** (Layer 3): scena attiva, sync fisica → entità, stato globale. In `world.h` usa `EntityManager`, `SceneManager`, `Physics` — **non** è sinonimo di «registry EnTT» finché la migrazione ECS non sarà completata.

### EngineContext

Contenitore **DI** con puntatori non-owning (`runtime-cpp/src/core/engine-context.h`); lifecycle di **`Application`**.

### LuaHost

Lua 5.4 via **Sol2**, bytecode `.luac`, tick nel passo fisso.

### Fixed timestep

Aggiornamento logica/fisica a delta fisso; vedi `Application::loopIteration()` e `ARCHITETTURA_TECNICA_ENGINE_2D.md` §3 e §9.

### Draw queue

Coda comandi disegno differiti nel renderer; azzeramento a inizio tick fisso multiplo (cfr. `TECHNICAL_OVERVIEW.md`).

### Runtime nativo / Runtime WASM

Eseguibile nativo (Raylib OpenGL) vs stesso codice compilato con **Emscripten** (WebGL / browser / Tauri).

### Editor React

UI React 19 + Vite: pannelli, inspector, vista Logic Board, preview.

### PreviewPanel / canvas

Area **Black Box** per WASM; React non ridisegna il canvas in gameplay (`REACT_WASM_PATTERN.md`).

### Buffering pattern

C++ → `window._*`, React legge in modo asincrono.

### Hot-reload

Ricarica script/asset senza riavvio completo; vedi `ARCHITECTURAL_RATIONALE.md` e architettura tecnica §4 / §10.

### `.artcade` / ProjectDoc / Lua bytecode (`.luac`)

Formato pacchetto ZIP; JSON progetto; output compilazione Lua. Logic Board e Logic Sheet convergono su **Lua + bytecode** come lo script manuale.

---

### Tabella di disambiguazione rapida

| Termine | Significato | Non confondere con |
|---------|---------------|---------------------|
| **Logic Board** | Ambiente authoring logica (scheda di lavoro) | Canvas preview, «editor» generico |
| **Logic Event** | Blocco evento nella Logic Board | `EventBus` C++, singolo frame |
| **Logic Component** | Mattone trigger/condizione/azione nella Logic Board | **ECS Component** (dato) |
| **ECS Component** | Dato su entità (`Transform`, …) | **Logic Component** |
| **Logic Sheet** | Formato tabellare (Parte II **qui**) | Logic Board (nome del luogo di lavoro) |
| **Entity** | Oggetto di gioco (id) | Logic Event |
| **World** | Orchestratore stato gioco | Logic Board |

---

### Riferimenti esterni (oltre a questo file)

- `ARCHITETTURA_TECNICA_ENGINE_2D.md` — stack, pipeline §9, §11 stato repo  
- `TECHNICAL_OVERVIEW.md` — dettaglio implementativo  
- `ECS_IMPLEMENTATION_GUIDE.md` — ECS / EnTT  

---

## Parte II — Specifica del formato Logic Sheet (v0.1)

Vista **tabellare** opzionale: righe `when` / `then` serializzate in JSON. Per il modello **event-centric** (trigger, `conditions[]`, `actions[]`) e il flusso compilatore → Lua vedi **Parte III**. Le due viste possono convivere in editor (export verso la stessa pipeline Lua).

Il **Logic Sheet** in questa parte è un formato di authoring **strutturato** (non AST legacy), integrabile con l’editor React e con la **Logic Board** (**Parte I**). Qui si privilegiano **righe** when/then; la **Parte III** privilegia **Logic Event** annidati.

### Convenzione nomi file e simboli (unificata)

Per evitare ambiguità con il termine **Logic Board** (scheda di lavoro) e i vecchi nomi `logic_sheet_*`, **file, chiavi JSON e simboli Lua generati** usano il prefisso **`logic_board`**:

| Prima (deprecato) | Dopo (ufficiale) |
|-------------------|------------------|
| `logic_sheet.json`, `logic_sheets.json` | **`logic_board.json`** (file opzionale / manifest; oppure campo in `project.json`) |
| `logicSheets` (chiave array) | **`logicBoards`** |
| `sheetId` | **`boardId`** |
| `logic_sheet_<id>_tick`, … | **`logic_board_<id>_tick`**, … (stesso schema per altri hook generati) |
| `types/logic-sheet.ts` | **`types/logic-board.ts`** |

Il nome **Logic Sheet** resta nel glossario (**Parte I**) per indicare il **formato tabellare** (righe when/then); i **persisted identifiers** seguono la tabella sopra.

### Obiettivi

| Obiettivo | Descrizione |
|-----------|-------------|
| **Accessibilità** | Ridurre la curva per logiche ripetitive (stati, condizioni, azioni) senza sostituire Lua per casi avanzati. |
| **Tracciabilità** | Righe identificabili, ordinate, diff-friendly nel JSON progetto. |
| **Codegen** | Ogni sheet compila in uno o più chunk Lua (funzioni / `tick` hook) con contratto stabile verso il runtime. |
| **Allineamento runtime** | Rispettare la pipeline di frame (`ARCHITETTURA_TECNICA_ENGINE_2D.md` §9, §11): niente teletrasporto posizione post-fisica salvo azioni esplicitamente marcate. |

### Non-obiettivi (v0.1)

- Non sostituisce la **Logic Board** (né l’editor Lua in tab Script) per script liberi non legati al compilatore.
- Non è un **node graph** completo (React Flow può arrivare in fasi successive).
- Non definisce ancora l’**UI pixel-perfect** del pannello Sheet; solo modello dati, flussi e contratti.

### Concetti core

#### Documento tabellare (`LogicBoardDoc`)

- **Identificatore:** `boardId` (stringa stabile, es. `player_controller`).
- **Ambito:** associato a un’**entità** (`entityId` o `className` pool) oppure a una **scena** — da decidere per riga o per foglio in v0.2.
- **Righe (`SheetRow`):** ordine **sequenziale** di valutazione nello stesso step.

#### Riga (`SheetRow`)

| Campo | Tipo | Note |
|-------|------|------|
| `id` | string | UUID o id monotonic per undo/redo editor. |
| `enabled` | bool | Se false, riga ignorata. |
| `when` | espressione | Dialect ristretto (vedi sotto) o predicato registrato. |
| `then` | lista azioni | Azioni atomiche dal catalogo. |

#### Eventi di valutazione (quando gira il foglio)

- **`on_tick`** — passo logico allineato a `luaHost->tick` / §11.  
- **`on_enter` / `on_exit`** (opzionale) — fasi successive.

### Dialect condizioni (`when`)

- **Sandbox:** nessuna `os`/`io` arbitraria; solo API whitelist.  
- **Tipi:** booleani, confronti numerici, enum sheet (`state == "Idle"`).  
- **Riferimenti:** `state.get`, proprietà entità read-only in pre-fisica salvo azioni taggate.  
- Opt-in **`lua_predicate`** (snippet firmato) se il dialect non basta.

### Azioni (`then`) — catalogo v0.1 (estendibile)

| `action` | Parametri | Note |
|----------|-----------|------|
| `set_state` | `key`, `value` | `state.set(...)` |
| `apply_impulse` | `entityRef`, `ix`, `iy` | Preferito a set position in pre-fisica |
| `set_velocity` | `entityRef`, `vx`, `vy` | Se supportato dall’API |
| `play_sound` | `assetId` | Path virtuale / alias (arch. tecnica §10) |
| `emit_event` | `name`, `payload?` | TBD verso EventBus / Lua |
| `call_lua` | `chunkId` | Escape hatch |

Ogni azione: **`phase`** `pre_physics` | `post_physics` | `render_safe` (default `pre_physics` per mutazioni fisiche).

### Modello dati (persistenza progetto)

Estensione **`project.json`** (o file **`logic_board.json`** referenziato dal manifest — TBD):

```json
{
  "logicBoards": [
    {
      "boardId": "player_controller",
      "target": { "type": "entity_class", "className": "Player" },
      "hooks": ["on_tick"],
      "rows": [
        {
          "id": "r1",
          "enabled": true,
          "when": { "op": "key_down", "key": "Space" },
          "then": [
            { "action": "apply_impulse", "entityRef": "self", "ix": 0, "iy": -400, "phase": "pre_physics" }
          ]
        }
      ]
    }
  ]
}
```

Schema JSON formale (`$schema`) — **da aggiungere** con il tooling.

### Codegen → Lua

- Output: es. `function logic_board_player_controller_tick(dt) … end`.  
- Registrazione: loader / `LuaHost`, bytecode `.luac`.  
- Errori: `sol::protected_function`; errori codegen → messaggio editor, non crash WASM.

### Integrazione editor (React)

- Pannello tabella When / Then; convivenza sheet + script (ordine merge **v0.2**).  
- Undo/redo per riga (CommandHistory editor).

### Test e qualità

- Golden: JSON → snapshot Lua.  
- Runtime: progetto minimo + assert dopo N step fisici.

### Roadmap integrazione (indicativa)

1. Schema JSON v0.1 + catalogo azioni minimo.  
2. Codegen (TS o Rust Tauri) + validatore.  
3. UI tabella + binding `project.json`.  
4. Hook `LuaHost` per `entity_class` / `entityId`.  
5. Dialect, azioni, merge con Logic Board a blocchi.

### Riferimenti tecnici aggiuntivi (Parte II)

- `ARCHITETTURA_TECNICA_ENGINE_2D.md` — §6 authoring, §9 pipeline, §11 stato repo.  
- `TECHNICAL_OVERVIEW.md` — editor, IPC, WASM.  
- `ECS_IMPLEMENTATION_GUIDE.md` — quando le righe referenzieranno componenti EnTT.  

---

## Parte III — Logic Board: specifica tecnica

> **Versione Parte III:** 1.0  
> **Stato:** Proposta tecnica per implementazione  
> **Dipendenze:** Fase 19 (React–WASM decoupling, hot-reload) completata; editor React operativo  

Coerente con **Parte I** (glossario) e con `ARCHITETTURA_TECNICA_ENGINE_2D.md` (pipeline di frame, §9–§11).

### 1. Visione

La **Logic Board** è l’ambiente di scripting **visuale** di ArtCade V2. Permette di definire la logica di gioco senza scrivere Lua a mano, con un modello **Event–Condition–Action** familiare a strumenti tipo Construct / GameMaker.

Ogni documento serializzato (**`logic_board.json`** / campo **`logicBoards`** in `project.json`, modello dati §3) viene **compilato** in **bytecode Lua** standard ed eseguito dal runtime C++ **senza modifiche al motore**: la Logic Board è un **compilatore visuale** che produce lo stesso output di uno script scritto a mano.

### 2. Principio di funzionamento

```text
┌──────────────────────────────────────────────────┐
│  LOGIC BOARD (React)                             │
│                                                  │
│  Logic Board JSON (logic_board.json)             │
│  ├─ Logic Event 1 (trigger + conditions)         │
│  │   ├─ Logic Component: condizione              │
│  │   └─ Logic Component: azione                   │
│  ├─ Logic Event 2                                │
│  └─ ...                                          │
│                                                  │
│  ↓ compilazione (TypeScript)                    │
│                                                  │
│  Stringa Lua                                     │
│  function onCollision(self, other) ... end       │
│  function tick(dt) ... end                       │
│                                                  │
│  ↓ salvataggio / hot-reload                      │
└──────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────┐
│  RUNTIME C++ (invariato)                         │
│                                                  │
│  LuaHost carica bytecode Lua                     │
│  Esegue tick(dt), onCollision(...), ecc.        │
│  Nessuna consapevolezza della Logic Board       │
└──────────────────────────────────────────────────┘
```

### 3. Modello dati: Logic Board JSON

Il documento (stesso schema per vista tabellare **Logic Sheet** e vista eventi) è un array di **Logic Event**. Ogni evento ha un **trigger**, **condizioni** opzionali e una lista di **azioni**. Persistenza: vedi **Parte II**, convenzione **`logic_board.json`** / **`logicBoards`**.

> I nomi delle API Lua negli esempi di output sono **indicativi**; allineare al contratto reale (`LUA_GAME_API`, `GameAPI`) durante l’implementazione.

```typescript
interface LogicBoardDoc {
  events: LogicEvent[];
}

interface LogicEvent {
  id: string;
  trigger: LogicTrigger;
  conditions?: LogicCondition[];
  actions: LogicAction[];
}

type LogicTrigger =
  | { type: "onStart" }
  | { type: "onUpdate" }
  | { type: "onCollision" }
  | { type: "onInput"; keyCode: string; eventType: "pressed" | "down" | "released" }
  | { type: "onTimer"; seconds: number; repeat: boolean };

type LogicCondition =
  | { type: "compareClass"; className: string }
  | { type: "compareVariable"; key: string; operator: ComparisonOp; value: number }
  | { type: "compareState"; key: string; operator: ComparisonOp; value: number }
  | { type: "isKeyDown"; keyCode: string }
  | { type: "chance"; percent: number };

type LogicAction =
  | { type: "setVariable"; key: string; value: number }
  | { type: "addVariable"; key: string; value: number; clampMin?: number; clampMax?: number }
  | { type: "setPosition"; target: TargetSelector; x: number; y: number }
  | { type: "setVelocity"; target: TargetSelector; vx: number; vy: number }
  | { type: "playSound"; path: string; volume?: number; pitch?: number }
  | { type: "playMusic"; path: string; loop?: boolean }
  | { type: "stopAllAudio" }
  | { type: "destroyEntity"; target: TargetSelector }
  | { type: "spawnEntity"; className: string; x: number; y: number }
  | { type: "setGlobalState"; key: string; value: number | boolean | string }
  | { type: "emitEvent"; name: string; payload?: unknown }
  | { type: "callFunction"; functionName: string; args?: unknown[] }
  | { type: "debugLog"; message: string }
  | { type: "wait"; seconds: number; then?: LogicAction[] }
  | { type: "setAnimation"; target: TargetSelector; clipName: string }
  | { type: "cameraShake"; intensity: number; duration: number };

type TargetSelector =
  | "self"
  | "other"
  | { entityId: number }
  | { className: string; first: boolean };

type ComparisonOp = "==" | "!=" | "<" | "<=" | ">" | ">=";
```

### 4. Logic Component — descrizione

#### 4.1 Trigger (quando l’evento si attiva)

| Nome | Parametri | Descrizione |
|------|-----------|-------------|
| `onStart` | — | Una volta all’avvio dell’entità |
| `onUpdate` | — | Ogni frame (riceve `dt`) |
| `onCollision` | — | Collisione; `self` entità corrente, `other` l’altra |
| `onInput` | `keyCode`, `eventType` | Tasto premuto / tenuto / rilasciato |
| `onTimer` | `seconds`, `repeat` | Dopo `seconds` s; se `repeat`, si ripete |

#### 4.2 Condizioni (filtri opzionali)

| Nome | Parametri | Note |
|------|-----------|------|
| `compareClass` | `className` | Es. classe di `other` in `onCollision` |
| `compareVariable` | `key`, `operator`, `value` | Variabile / stato globale |
| `compareState` | `key`, `operator`, `value` | Stato sull’entità `self` |
| `isKeyDown` | `keyCode` | Utile in `onUpdate` |
| `chance` | `percent` (0–100) | Probabilità che l’evento proceda |

Più condizioni nello stesso evento = **AND** logico (tutte vere).

#### 4.3 Azioni (sequenza)

Esecuzione **in ordine**. **Target** delle azioni:

| Valore | Significato |
|--------|-------------|
| `"self"` | Entità che possiede il documento Logic Board / Logic Sheet |
| `"other"` | Altra entità (solo dove ha senso, es. `onCollision`) |
| `{ entityId: number }` | ID esplicito |
| `{ className, first }` | Prima entità della classe |

### 5. Algoritmo di compilazione (TypeScript → Lua)

Il compilatore è un modulo **TypeScript** puro (senza dipendenza dal runtime C++) che trasforma un `LogicBoardDoc` in una **stringa Lua** valida.

#### 5.1 Struttura dell’output

```lua
-- Generato automaticamente dalla Logic Board di ArtCade V2
-- Non modificare a mano: le modifiche verranno sovrascritte

local initialized = false

function init()
  -- Corpi degli eventi onStart
end

function tick(dt)
  if not initialized then
    init()
    initialized = true
  end
  -- Corpi degli eventi onUpdate e onTimer
end

function onCollision(self, other)
  -- Corpi degli eventi onCollision
end

function onInput(keyCode, eventType)
  -- Corpi degli eventi onInput
end
```

**Implementazione runtime attuale (2026-05):** il compilatore in [`editor/src/utils/logic-board/compiler.ts`](../editor/src/utils/logic-board/compiler.ts) emette **solo** `init()` + `tick(dt)` con **polling** (`collision.touchingClass`, `input.isKeyDown`, …). Gli esempi con `function onCollision` sopra sono **target illustrativo**, non l'output generato oggi.

**`scene.load` / `restartScene`:** `scene.load(name)` imposta la scena attiva in `RuntimeEntityGateway`, attiva solo le entità listate in `SceneDef.entityIds` (alpha + physics), **senza** cancellare `state.*` (blackboard = `VariableManager`). Vedi [`GLOBAL_LOGIC_UI_ARCHITECTURE.md`](GLOBAL_LOGIC_UI_ARCHITECTURE.md).

#### 5.2 Algoritmo

1. Raggruppare gli eventi per **trigger**.  
2. Per ogni gruppo, generare funzione Lua o blocco nella funzione appropriata (`tick`, `onCollision`, …).  
3. Per ogni evento: generare valutazione **condizioni** (AND), poi blocco `if` con **azioni** in sequenza.  
4. Tradurre `TargetSelector` in chiamate API reali (`entity`, `pool`, …).  
5. Azioni `wait`: generare equivalente con timer/closure (o API time del runtime) per le azioni successive.

#### 5.3 Esempio di compilazione

**Input (Logic Event)**

```json
{
  "id": "evt_1",
  "trigger": { "type": "onCollision" },
  "conditions": [
    { "type": "compareClass", "className": "Enemy" }
  ],
  "actions": [
    { "type": "addVariable", "key": "playerHP", "value": -10, "clampMin": 0 },
    { "type": "playSound", "path": "assets/hit.ogg" }
  ]
}
```

**Output Lua (esemplificativo)**

```lua
function onCollision(self, other)
  local cond1 = pool.getClass(other) == "Enemy"
  if cond1 then
    state.add("playerHP", -10, 0, nil)
    audio.playSound("assets/hit.ogg", 1.0, 1.0)
  end
end
```

#### 5.4 Traduzione dei target

| `TargetSelector` | Esempio Lua generato |
|-------------------|----------------------|
| `"self"` | `self` |
| `"other"` | `other` |
| `{ entityId: 5 }` | `5` (o wrapper entity id) |
| `{ className: "Player", first: true }` | `pool.getFirst("Player")` (nome API da allineare) |

### 6. Coesistenza con script Lua testuali

Un’entità può avere **documento Logic Board / Logic Sheet (opzionale)** e **script Lua testuali (opzionali)**.

**Strategia di fusione (proposta):** in caricamento, concatenare nell’ordine:

1. Sorgente **generato** dalla Logic Board (`init`, `tick`, `onCollision`, `onInput`, …).  
2. **Script testuali** aggiuntivi.

Lo script testuale può: chiamare funzioni del blocco generato; **ridefinire** funzioni dopo il blocco generato (in Lua vince l’ultima definizione); usare `callFunction` come ponte verso funzioni custom.

**Esempio:** il foglio genera `tick` base; lo script successivo ridefinisce `tick` per effetti avanzati (o salva un upvalue alla versione precedente se serve composizione).

### 7. UI/UX del pannello Logic Board

#### 7.1 Layout (wireframe)

```text
┌─────────────────────────────────────────────────┐
│  Logic Board: Player                        [×] │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─ Event 1 ──────────────────────────────────┐ │
│  │ ⚡ onCollision                             │ │
│  │   🔍 compareClass = "Enemy"               │ │
│  │   ▶ addVariable("playerHP", -10)          │ │
│  │   ▶ playSound("assets/hit.ogg")           │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌─ Event 2 ──────────────────────────────────┐ │
│  │ ⚡ onUpdate                                │ │
│  │   🔍 compareVariable("playerHP", <=, 0)   │ │
│  │   ▶ setGlobalState("gameOver", true)      │ │
│  │   ▶ destroyEntity("self")                  │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  [+ Aggiungi Evento]                            │
│                                                  │
└─────────────────────────────────────────────────┘
```

#### 7.2 Interazioni

- **Aggiungi evento:** pulsante `+` (toolbar o fondo lista).  
- **Modifica trigger:** clic su ⚡ → menu.  
- **Aggiungi condizione / azione:** `+` dentro l’evento.  
- **Riordina:** drag & drop (opzionale).  
- **Elimina:** icona cestino.  
- **Visualizza Lua:** toggle **Script** nel pannello Logic Board (anteprima read-only del sorgente generato); **Apri in Editor Script** per edit con tab bar nel modulo Script.

#### 7.3 Parametri per tipo (form / modali)

| Componente | Parametri UI tipici |
|-------------|---------------------|
| `onInput` | Tasto (dropdown key codes), tipo evento |
| `onTimer` | Secondi, checkbox ripeti |
| `compareClass` | Dropdown classi progetto |
| `compareVariable` | Chiave, operatore, valore |
| `setPosition` | Target, X, Y |
| `playSound` | Path (picker), volume, pitch |
| … | Estendere con la libreria MVP |

### 8. Flusso di salvataggio e hot-reload

1. L’utente modifica la logica nell’editor (vista tabellare **Logic Sheet** o pannello **Logic Board**).  
2. Su salvataggio (Ctrl+S o auto-save): il compilatore TS produce la **stringa Lua**.  
3. Invio al runtime tramite `editorLoadProject()` / `editorReloadScript()` (o equivalente documentato in `TECHNICAL_OVERVIEW` / `REACT_WASM_PATTERN`).  
4. Il runtime **compila bytecode** e aggiorna i riferimenti in `LuaHost`.  
5. Il **JSON** (`logicBoards` / `logic_board.json`) resta nel `ProjectDoc` per riapertura editor.

Il runtime **non** interpreta JSON a runtime: riceve Lua (e bytecode), mantenendo il motore **snello** e indipendente dal formato visuale.

### 9. Libreria MVP (20 Logic Component)

| # | Tipo | Nome | Categoria |
|---|------|-------|-----------|
| 1 | Trigger | `onStart` | Ciclo di vita |
| 2 | Trigger | `onUpdate` | Ciclo di vita |
| 3 | Trigger | `onCollision` | Fisica |
| 4 | Trigger | `onInput` | Input |
| 5 | Trigger | `onTimer` | Tempo |
| 6 | Condizione | `compareClass` | Collisione |
| 7 | Condizione | `compareVariable` | Stato |
| 8 | Condizione | `isKeyDown` | Input |
| 9 | Condizione | `chance` | Random |
| 10 | Azione | `setVariable` | Stato |
| 11 | Azione | `addVariable` | Stato |
| 12 | Azione | `setPosition` | Movimento |
| 13 | Azione | `setVelocity` | Movimento |
| 14 | Azione | `playSound` | Audio |
| 15 | Azione | `playMusic` | Audio |
| 16 | Azione | `destroyEntity` | Entità |
| 17 | Azione | `spawnEntity` | Entità |
| 18 | Azione | `setGlobalState` | Stato |
| 19 | Azione | `emitEvent` | Eventi |
| 20 | Azione | `debugLog` | Debug |

Coprono la maggior parte dei casi 2D semplici; estensioni successive come moduli TS.

### 10. Vantaggi dell’approccio

| Aspetto | Vantaggio |
|---------|-----------|
| Runtime invariato | Nessuna modifica obbligatoria al C++; esecuzione Lua come oggi |
| Hot-reload | Stesso percorso degli script testuali |
| Portabilità | JSON versionabile, indipendente dalla piattaforma |
| Gradualità | Board → Lua quando l’utente è pronto |
| Manutenibilità | Logic Component come moduli TS testabili |

### 10.1 JSON Schema registry (editor, 2026-05)

Ogni Logic Component MVP ha uno schema **draft-07** in [`editor/src/schemas/logic-board/`](../editor/src/schemas/logic-board/):

| File | Contenuto |
|------|-----------|
| `index.json` | Elenco tipi trigger / action / condition |
| `triggers.json`, `actions.json`, `conditions.json` | Schema per tipo + metadati UI `x-artcade` |
| `condition-node.schema.json` | Albero `LogicConditionNode` (leaf / group AND\|OR) |
| `board.schema.json` | `LogicBoard` + shell `LogicEvent` |
| `target-selector.schema.json` | `TargetSelector` per azioni/condizioni |

**Runtime editor:** [`schema-registry.ts`](../editor/src/utils/logic-board/schema-registry.ts) espone `validateLogicBoard`, `validateConditionNode`, `getComponentMeta`, `list*Types`. I validatori Ajv sono **pre-compilati a build** (`npm run compile-schemas` → [`validators.generated.ts`](../editor/src/utils/logic-board/validators.generated.ts)) così il bundle Tauri non usa `eval` e la CSP release resta senza `'unsafe-eval'`.

**UI:** [`SchemaParamForm.tsx`](../editor/src/components/logic-board/SchemaParamForm.tsx) — parametri di trigger, azioni e condizioni; [`ConditionTreeEditor.tsx`](../editor/src/components/logic-board/ConditionTreeEditor.tsx) — modalità Flat (AND) vs Tree (OR/AND su `conditionRoot`).

**Validazione:**

- **Load:** `parseLogicBoards` scarta eventi non validi (`console.warn`).
- **Save:** `saveProjectFile` blocca il write se `logicBoards` non passa Ajv.

**Anti-drift:** `schema-registry.test.ts` verifica che ogni `defaultTrigger` / `defaultAction` / `defaultCondition` in [`options.ts`](../editor/src/panels/logic-board/options.ts) validi.

Modifica di un componente → aggiornare **TS** (`logic-board.ts`), **schema JSON**, **compiler** nello stesso change set.

### 11. Stato implementazione (runtime + editor)

| Area | Editor / compiler | Runtime C++ | Note |
|------|-------------------|-------------|------|
| Blackboard globale `state.*` | `setGlobalState`, `compareVariable` | `VariableManager` via `state-api.cpp` | Persiste su `scene.load` |
| `loadScene` / `restartScene` | azioni Logic | `World` + `RuntimeEntityGateway::syncSceneActivation` | Pool filtrati per scena attiva |
| Spawn / destroy | `spawnEntity`, `destroyEntity` | destroy in coda post-physics | |
| Sensor trigger | `onTriggerEnter/Exit` (compiler edge) | fixture sensor + log overlap | Event bus Lua in evoluzione |
| Platformer feel | script Lua opzionale | `PlatformerControllerComponent` in `World` | C++ se componente su entità |
| `wait` | azione Logic + `time.delay` in compiler | `time.*` in runtime | Azioni dopo `wait` in coda async |
| JSON Schema registry | Ajv build-time + `SchemaParamForm` + `ConditionTreeEditor` | — | `editor/src/schemas/logic-board/`, `validators.generated.ts` |
| Shaders / image points / bussola | — | — | Vedi [`ArtCade_V2_Riepilogo_Suggerimenti.md`](ArtCade_V2_Riepilogo_Suggerimenti.md) |

### 12. Dipendenze per l’implementazione

- Fase 19 (decoupling React–WASM, hot-reload) **completata**.  
- Pannello React dedicato (`LogicBoardPanel.tsx`).  
- Compilatore TypeScript (`logic-board/compiler.ts`).  
- Tipi condivisi (`types/logic-board.ts`).  
- Runtime C++: scene activation, blackboard unificato, sensor/platformer MVP, kill queue (2026-05).

---

## Parte IV — Linee guida di design (documento satellite)

Questa parte **non** duplica il contenuto: indica dove trovare le raccomandazioni **non normative** (supporto a Fase 19–20) che completano la specifica tecnica.

| Documento | Contenuto |
|-----------|-----------|
| [`LOGIC_BOARD_DESIGN_GUIDELINES.md`](LOGIC_BOARD_DESIGN_GUIDELINES.md) | Blackboard locale/globale, Logic Messaging / segnali, nodi data-driven (JSON Schema), visual flow e organizzazione grafo, precisione numerica Lua ↔ C++ |
| [`LOGIC_BOARD_CONDITIONAL_DESIGN.md`](LOGIC_BOARD_CONDITIONAL_DESIGN.md) | `LogicConditionGroup` (AND/OR ad albero), anti-pattern eventi duplicati, branching IF/ELSE, branch fisico vs blocco compatto, modello grafo, compilazione Lua, React Flow, uso didattico |
| [`ArtCade_V2_Riepilogo_Suggerimenti.md`](ArtCade_V2_Riepilogo_Suggerimenti.md) | Visione UX «Zero Matematica», 8 gruppi componenti, shader, layout IDE |
| [`LOGIC_BOARD_EDITOR_BACKLOG.md`](LOGIC_BOARD_EDITOR_BACKLOG.md) | Backlog editor post runtime-core (schema, wait, UX modale tasti) |

Mantenere questi documenti in file dedicati evita di gonfiare il presente SPEC e permette aggiornamenti rapidi senza toccare glossario o contratti dati delle Parti I–III. Quando i tipi JSON/TS del condizionale saranno stabili, rispecchiarli in **Parte III**.

---

*Parte I: revisione terminologica. Parte II: formato tabellare + integrazione tooling. Parte III: allineare nomi API Lua e IPC a `TECHNICAL_OVERVIEW` / implementazione reale al momento dello sviluppo. Parte IV: riferimento a `LOGIC_BOARD_DESIGN_GUIDELINES.md` e `LOGIC_BOARD_CONDITIONAL_DESIGN.md`.*
