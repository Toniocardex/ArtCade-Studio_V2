# ArtCade V2: Global Logic & UI Architecture

> **Versione:** 1.0
> **Data:** 2026-05-11
> **Stato:** Specifica di alto livello (logica, fisica arcade, UI)
> **Audience:** Runtime C++, editor UI, game design

Questo documento riassume le specifiche finalizzate per i sistemi di **logica**, **fisica arcade** e **interfaccia utente**.

---

## 1. Physics & proximity (sensor system)

Invece di calcoli matematici espliciti ovunque, ArtCade sfrutta il **broad-phase** di **Box2D** per vicinanza e contatti.

### Sensor component

- Fixture **"ghost"** (sensor) che rilevano entita tramite **`OnEnter`** e **`OnExit`** (o equivalente nel binding verso Box2D / event bus del motore).

### Body types

| Tipo | Uso |
|------|-----|
| **Static** | Terreno, piattaforme fisse. |
| **Kinematic (arcade)** | Player tipico: movimento controllato da script; **non** usa la gravita "fisica" classica come un dynamic puro (policy da definire nel controller). |
| **Dynamic** | Oggetti con massa, rimbalzo, forze esterne. |

---

## 2. Platformer controller (game feel)

Componente / modulo specializzato per corpi **kinematic** che implementa:

| Meccanica | Descrizione |
|-----------|-------------|
| **Coyote time** | Il salto resta possibile per **X ms** dopo aver lasciato una piattaforma (tolleranza percepita). |
| **Jump buffer** | Memorizzazione dell'input di salto **prima** di toccare terra, applicata al prossimo atterraggio valido. |
| **Variable gravity** | Gravita **maggiore in discesa** rispetto alla salita per caduta piu "pesante" e controllo piu preciso. |

---

## 3. Core system actions (universal nodes)

Azioni che **non** sono legate a una singola entita ma governano il **World**:

| Area | Comportamento atteso |
|------|----------------------|
| **Spawn / destroy** | Gestione sicura della memoria: **kill queue** (o differita) **post physics step** per evitare use-after-free durante lo step. |
| **Global state** | Variabili persistenti tra scene (punteggio, inventario, flag di missione). |
| **Scene manager** | Caricamento scene, restart, **time scale** (pausa, slow-mo) a livello mondo. |

Allineamento concettuale con [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md) e API Lua / `World` dove applicabile.

---

## 4. UI system (screen space)

Sistema di rendering **separato** dal mondo di gioco (camera / world space).

| Elemento | Specifica |
|----------|------------|
| **RectTransform** | Ancoraggio a **9 punti** (es. top-left, center, stretch orizzontale/verticale, ecc.). |
| **Image** | Supporto **9-slice** (sliced) per pannelli scalabili. |
| **Button** | Stati hover / pressed con eventi verso **Logic Board** (o script Lua) come contratto input. |
| **Text** | Rendering preferibilmente con **font SDF** (Signed Distance Fields) per nitidezza a scale diverse. |

---

## 5. Text effects ("juice" library)

Effetti nativi per aumentare la **qualita percepita** del gioco.

| Effetto | Caso d'uso | Logica (C++ / pipeline) |
|---------|------------|-------------------------|
| **Floating text** | Danni, XP, pop-up | Spawn temporaneo con **scatter** (direzione pseudo-random). |
| **Typewriter** | Dialoghi RPG | Rivelazione **progressiva** dei caratteri via timer. |
| **Wavy / jitter** | Testo "vivo" | Offset **sinusoidale** o randomico **per glifo**. |
| **Pop-in** | Game over, menu | **Easing elastico** (es. BackOut) sulla scala del `RectTransform`. |

---

## Riferimenti incrociati

- [`ARCHITETTURA_TECNICA_ENGINE_2D.md`](ARCHITETTURA_TECNICA_ENGINE_2D.md) - pipeline di frame, fisica, sync.
- [`TECHNICAL_OVERVIEW.md`](TECHNICAL_OVERVIEW.md) - panoramica motore e moduli.
- [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md) - Logic Board / Event / Component.
- [`ECS_IMPLEMENTATION_GUIDE.md`](ECS_IMPLEMENTATION_GUIDE.md) - ECS / EnTT (dove i componenti sensor/controller vivono).

---

*Documento generato per lo sviluppo di ArtCade V2 - 2026.*
