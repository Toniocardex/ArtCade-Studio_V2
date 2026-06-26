# 📖 ArtCade V2 — Documentazione Completa

> **Versione**: 2.2  
> **Data**: 2026-05-23  
> **Status**: ✅ MVP integrato, documenti in riallineamento continuo  
> **Audience**: Team development

---

## 🚀 Leggi Questi Documenti in Ordine

### 0️⃣ **LOGIC_BOARD_SPEC.md** — Glossario + Sheet + Logic Board (20–35 min) ⭐

**Parte I:** glossario (Logic Board / Event / Component, ECS, …). **Parte II:** formato tabellare when/then. **Parte III:** specifica tecnica Logic Board (JSON event-centric, compilatore TS→Lua, UI, MVP). **Parte IV:** puntatori a documenti satellite. Contratti nel SPEC; principio prodotto **`ARTIST_FRIENDLY_COMPONENTS.md`** (~5 min); **`LOGIC_BOARD_UX_CHARTER.md`** (~5 min, When/If/Then artist-first); **`LOGIC_BOARD_DESIGN_GUIDELINES.md`** (~5 min); condizionali OR/ELSE e branch flow: **`LOGIC_BOARD_CONDITIONAL_DESIGN.md`** (~10 min).

### 0.5️⃣ **NORTH_STAR_ARCHITECTURE.md** — Principi e confini V2 (15 min)

Riferimento unico allineato al report struttura ArtCade, con sezione **Come differisce V2** (React, ECS, compile-to-Lua, `.artcade`). Usalo prima di proporre refactor massicci.

**Presentation / viewport refactor (ADR):** [`PRESENTATION_ARCHITECTURE.md`](PRESENTATION_ARCHITECTURE.md) — Shared Presentation Core, snapshot atomica, pipeline a pass, 9 fasi di migrazione. **Report audit fasi 1–8 (per collaboratori):** [`PRESENTATION_MIGRATION_AUDIT_REPORT.md`](PRESENTATION_MIGRATION_AUDIT_REPORT.md).

Prosa estesa del report greenfield (italiano, riferimento storico): **`Report-Struttura-Artcade.md`**.

### 1️⃣ **ARCHITECTURAL_RATIONALE.md** — Il PERCHÉ (20–30 min) ⭐ INIZIO QUI

Inizia QUI se vuoi capire il **razionale** dietro ogni decisione.

**Contenuto**:
- ECS vs OOP: Dati reali (10.000 entity vs 500 in WASM)
- Canvas Black Box: Perché il flash accade e come evitarlo
- WASM Memory: Perché 128MB + growth
- Hot-Reload: 5ms vs 20sec rebuild
- Audio Sandboxing: Browser policy
- Piano d'azione: 3 step concreti

**Perché**: Comprenderai il contesto decisionale, non solo il "come"

---

### 2️⃣ Poi, Per Specializzazione:

#### Se sei **React Developer**
```
ADAPTIVE_LAYOUT.md          (Layout adattivo editor — fasi 1–5, decisioni D1–D11) ⭐
    ↓
EDITOR_UI_DESIGN_SYSTEM.md  (Palette + token CSS — refactor UI visivo)
LOGIC_BOARD_UX_CHARTER.md   (Logic Board artist-first: When / Also require… / Then)
    ↓
TECHNICAL_OVERVIEW.md     § 5.5 (React-WASM Decoupling Pattern)
    ↓
REACT_WASM_PATTERN.md     (Buffering model, checklist, anti-pattern)
    ↓
ARCHITECTURE_INTEGRATION.md (Scenario: "User clicks PLAY", flussi dati)
```

#### Se sei **C++ Developer**
```
PRESENTATION_ARCHITECTURE.md   (ADR: viewport, snapshot, coordinate spaces, migration)
    ↓
LOGIC_BOARD_SPEC.md          (Parte I glossario Logic Board / Event / Component)
    ↓
FIXED_STEP_CONTRACT.md            (ordine tickFixedStep, Transform vs physics body)
    ↓
ARCHITETTURA_TECNICA_ENGINE_2D.md  (Stack, §8–10, §11 stato repo + roadmap)
    ↓
TECHNICAL_OVERVIEW.md     § 3.5 (ECS Architecture)
    ↓
ECS_IMPLEMENTATION_GUIDE.md (Guida pratica EnTT, 9 sezioni)
    ↓
ARCHITECTURAL_RATIONALE.md § 1 (Dati ECS vs OOP)
```

#### Se sei **Tech Lead / Architect**
```
ARCHITECTURAL_RATIONALE.md (Tutta la sezione)
    ↓
LOGIC_BOARD_SPEC.md (Parte I glossario) · ARCHITETTURA_TECNICA_ENGINE_2D.md (§8–11)
    ↓
ARCHITECTURE_INTEGRATION.md (End-to-end architecture)
    ↓
MVP_RELEASE_GATE.md (Soglia prodotto per alpha pubblica: vertical slice, P0/P1/P2, scenario tester)
    ↓
PRE_RELEASE_ROADMAP.md (Roadmap operativa pre-alpha: fasi 0–5, gate, task per layer)
    ↓
CHECKLIST_SICUREZZA_QUALITA_AFFIDABILITA.md (Sicurezza, qualità, affidabilità — P0/P1/P2, gate rilascio)
    ↓
TECHNICAL_OVERVIEW.md       (Referenza, § 2, 4, 6, 12)
```

#### Se sei **Nuovo Collaboratore**
```
ENGINE_DESIGN_RECAP.md               (Progettazione engine — 25 min) ⭐
    ↓
ENGINE_STATE_RECAP_COLLABORATORS.md  (Onboarding rapido — 10 min)
    ↓
OBJECT_MODEL_MIGRATION.md            (Piano master pre-release: oggetti tipo+istanza + Logic Board solo object_type — 20 min) ⭐ Hierarchy/Inspector/Logic
    ↓
LOGIC_BOARD_SPEC.md         (Parte I: glossario Logic Board / Event / Component)
    ↓
ARCHITECTURAL_RATIONALE.md  (Capire il contesto)
    ↓
TECHNICAL_OVERVIEW.md       (Dettagli della tua specializzazione)
    ↓
Guida specializzata         (REACT_WASM_PATTERN.md o ECS_IMPLEMENTATION_GUIDE.md)
```

---

## 📚 Mappa Completa Documenti

| Doc | Scopo | Tempo | Audience | Priorità |
|-----|-------|-------|----------|----------|
| **ARCHITECTURAL_RATIONALE.md** | Razionale decisioni | 20–30min | Everyone | ⭐⭐⭐ |
| **TECHNICAL_OVERVIEW.md** (v2.2) | Architettura completa | 45–60min | Engineers | ⭐⭐⭐ |
| **ARCHITECTURE_INTEGRATION.md** | End-to-end flows | 15–20min | Tech leads | ⭐⭐ |
| **REACT_WASM_PATTERN.md** | Buffering implementazione | 15–20min | React dev | ⭐⭐ |
| **CODEMIRROR_EDITOR.md** | Script Editor CodeMirror 6: My Script, Logic Board e Combined Preview | ~5min | React dev | ⭐ |
| **ADAPTIVE_LAYOUT.md** | Layout adattivo workbench: scala UI, Focus, resize, tier full/compact/minimal, persistenza `WxH`, roadmap fasi 1–5 | ~20min | Editor / React | ⭐⭐⭐ |
| **EDITOR_UI_DESIGN_SYSTEM.md** | Palette monocromatica editor (#121212–#F4F4F4), regole hover/geometry, token CSS per refactor UI | ~5min | Editor / design | ⭐⭐ |
| **LOGIC_BOARD_UX_CHARTER.md** | Logic Board artist-first: Base/Advanced, When vs Also require…, percorsi utente | ~5min | Product / Editor | ⭐⭐⭐ |
| **ECS_IMPLEMENTATION_GUIDE.md** | EnTT pratica | 30–45min | C++ dev | ⭐⭐ |
| **ENGINE_INTEGRATION_ROADMAP.md** | Tracker operativo Thick Core / Thin Script / Gateway / EnTT | ~5min | C++ / Tech lead | ⭐⭐⭐ |
| **ASSETS_ROADMAP.md** | Piano fase-per-fase su asset/sprite (animation clips, audio, .artcade export, hot-reload, font) con DoD, closure log e § Explorer (2026-05-29) | ~12min | Editor / C++ / Tooling | ⭐⭐⭐ |
| **ASSET_PIPELINE_ARCHITECTURE.md** | Architettura asset (TS orchestra, WASM possiede), audit repo, manifest/ID, fasi A–D + §12.1 explorer — agg. 2026-05-29 | ~15min | Editor / C++ / Tech lead | ⭐⭐⭐ |
| **LOGIC_BOARD_COMPONENT_API_ROADMAP.md** | Component runtime → azioni/condizioni Logic Board (capability registry, tranche) | ~5min | Editor / C++ | ⭐⭐ |
| **ARTIST_FRIENDLY_COMPONENTS.md** | Principio prodotto: numeri di design visibili, complessità tecnica nascosta | ~5min | Product / Editor / C++ | ⭐⭐⭐ |
| **ARCHITETTURA_TECNICA_ENGINE_2D.md** | Stack collab, §8–10, §11 stato vs target + roadmap | 30–40min | C++ / Tech lead | ⭐⭐ |
| **LOGIC_BOARD_SPEC.md** | **I** glossario · **II** Sheet tabellare · **III** Logic Board (TS→Lua, UI, MVP) · **IV** link linee guida | 25–35min | Everyone / Editor | ⭐⭐⭐ |
| **LOGIC_BOARD_DESIGN_GUIDELINES.md** | Best practice Logic Board (blackboard, segnali, data-driven, UX, bridge numerico) | ~5min | Editor / C++ bridge | ⭐ |
| **LOGIC_BOARD_CONDITIONAL_DESIGN.md** | OR/AND ad albero, IF/ELSE, branch vs compatto, grafo, codegen Lua, didattica | ~10min | Editor / codegen | ⭐ |
| **PIANO_SVILUPPO_COMMERCIALE.md** | Early Access 8 settimane: stabilità editor, demo, export web, vendita | ~15min | Product / founder | ⭐ |
| **GUIDA_INTEGRAZIONE_SPLASH_LICENZE.md** | Splash editor vs runtime; Free/Pro; `pack-artcade.py`; watermark C++ | ~10min | Editor / tooling / runtime | ⭐ |
| **FIXED_STEP_CONTRACT.md** | Ordine `tickFixedStep`, chi scrive Transform/body, latency intent Lua, physicsMode | ~5min | C++ / gameplay | ⭐⭐ |
| **GLOBAL_LOGIC_UI_ARCHITECTURE.md** | Sensori physics, platformer feel, azioni world, UI screen-space, text juice; §0 allineato a object types — refactor editor → [`OBJECT_MODEL_MIGRATION.md`](OBJECT_MODEL_MIGRATION.md) | ~8min | C++ / gameplay / UI | ⭐ |
| **DIALOG_SYSTEM.md** | Dialog System: JSON, CSV import, runtime, Logic Board | ~10min | Editor / C++ / narrative | ⭐⭐ |
| **DIALOG_CSV_FORMAT.md** | Colonne CSV ArtCade per dialoghi | ~5min | Writers | ⭐ |
| **ENGINE_DESIGN_RECAP.md** | Documento di progettazione engine (ECS, Logic Board, Object Types, fisica, roadmap, nomenclatura) | ~25min | **Tutti / design** | ⭐⭐⭐ |
| **ENGINE_STATE_RECAP_COLLABORATORS.md** | Onboarding rapido + link a doc operativi | ~10min | **Tutti / onboarding** | ⭐⭐ |
| **OBJECT_TYPES_ARCHITECTURE.md** | Object Types + scene instances (v2 project.json), merge rules, Logic Board on type — implementazione → [`OBJECT_MODEL_MIGRATION.md`](OBJECT_MODEL_MIGRATION.md) | ~8min | Editor / runtime / design | ⭐⭐ |
| **OBJECT_MODEL_MIGRATION.md** | Piano master pre-release: modello oggetti unificato (Hierarchy, Inspector, store) + rimozione ibrido Logic Board (`entity_id`/`entity_class`); oggi vs target, inventario file, Fasi A–D | ~20min | Editor / React / reviewer | ⭐⭐⭐ |
| **PHYSICS_OPTIONAL_INTEGRATION_PLAN.md** | Piano: physics opt-in, platformer kinematic (`customGravity`), skip `physics.step` in arcade | ~15min | C++ / Editor / Product | ⭐⭐ |
| **REPORT_MIGRAZIONE_PHYSICS_SENZA_BOX2D.md** | Report team: rimozione Box2D, backend custom, impatto ruoli, test, decisioni D1–D5 | ~20min | Tutti / review migrazione | ⭐⭐ |
| **ArtCade_V2_Riepilogo_Suggerimenti.md** | Visione UX Logic Board (8 gruppi), shader, controlli artist-friendly | ~10min | Design / product | ⭐ |
| **LOGIC_BOARD_EDITOR_BACKLOG.md** | Backlog editor (JSON Schema fatto; wait, UX, shader) | ~3min | Editor | ⭐ |
| **TECHNICAL_DEBT_REVIEW.md** | Debito tecnico noto (sync WASM, EditorAPI, build Tauri) | ~10min | Engineers | ⭐⭐ |
| **PRESENTATION_ARCHITECTURE.md** | ADR: Shared Presentation Core, snapshot atomica, pipeline a pass, deprecazioni, 9 fasi migrazione | ~25min | C++ / React / Tech lead | ⭐⭐⭐ |
| **MVP_RELEASE_GATE.md** | Soglia prodotto per alpha pubblica: scenario tester, checklist P0/P1/P2, vertical slice completo | ~20min | Product / Tech lead / QA | ⭐⭐⭐ |
| **PRE_RELEASE_ROADMAP.md** | Roadmap operativa verso `0.1.0-alpha`: fasi 0–5, gate di uscita, task file-level, rischi | ~25min | Product / Tech lead / implementers | ⭐⭐⭐ |
| **CHECKLIST_SICUREZZA_QUALITA_AFFIDABILITA.md** | Checklist completa sicurezza, qualità e affidabilità (32 sezioni, P0/P1/P2, gate alpha/beta/1.0) | ~45min | Tech lead / QA / release | ⭐⭐⭐ |

Setup e build pratici: **[README.md](../README.md)** (root) — pipeline, script npm, path di output.

---

## ✅ Cosa Copre Questa Documentazione

| Argomento | Doc | Sezione | Livello |
|-----------|-----|---------|--------|
| **ECS Concetto** | TECHNICAL_OVERVIEW | §3.5 | Concettuale |
| **ECS Implementazione** | ECS_IMPLEMENTATION_GUIDE | Intera | Pratico |
| **ECS Performance** | ARCHITECTURAL_RATIONALE | §1 | Data-driven |
| **Game Loop** | TECHNICAL_OVERVIEW | §6 | Dettagliato |
| **EngineContext / Reset** | ARCHITETTURA_TECNICA_ENGINE_2D | §8 | Operativo |
| **Pipeline frame (fisica/sync)** | FIXED_STEP_CONTRACT.md | Intero | Operativo |
| **Pipeline frame (concetti)** | ARCHITETTURA_TECNICA_ENGINE_2D | §9 | Operativo |
| **Asset WASM / alias** | ARCHITETTURA_TECNICA_ENGINE_2D | §4, §10 | Operativo |
| **Stato repo vs architettura target** | ARCHITETTURA_TECNICA_ENGINE_2D | §11 | Operativo |
| **Terminologia + Sheet + Logic Board** | LOGIC_BOARD_SPEC.md | Parte I–III (vedi indice nel file) | ⭐⭐⭐ |
| **Componenti artist-friendly** | ARTIST_FRIENDLY_COMPONENTS.md | Intero | ⭐⭐⭐ |
| **Logic Board — design & UX** | LOGIC_BOARD_DESIGN_GUIDELINES.md | Intero (supporto a Parte III) | ⭐ |
| **Logic Board — condizionali & branching** | LOGIC_BOARD_CONDITIONAL_DESIGN.md | Intero (OR/ELSE, grafo, scuole) | ⭐ |
| **Go-to-market / roadmap commerciale** | PIANO_SVILUPPO_COMMERCIALE.md | Intero (fasi 1–4, rischi) | ⭐ |
| **Splash + licenze Free/Pro** | GUIDA_INTEGRAZIONE_SPLASH_LICENZE.md | Intero | ⭐ |
| **Fisica arcade, UI world, text juice** | GLOBAL_LOGIC_UI_ARCHITECTURE.md | Intero | ⭐ |
| **Physics opzionale / platformer kinematic** | PHYSICS_OPTIONAL_INTEGRATION_PLAN.md | Intero | ⭐⭐ |
| **Migrazione Box2D → physics custom** | REPORT_MIGRAZIONE_PHYSICS_SENZA_BOX2D.md | Intero | ⭐⭐ |
| **Editor adaptive layout** | ADAPTIVE_LAYOUT.md | Intero | ⭐⭐⭐ |
| **React-WASM** | TECHNICAL_OVERVIEW | §5.5 | Concettuale |
| **React-WASM Implementazione** | REACT_WASM_PATTERN | Intera | Pratico |
| **React-WASM Razionale** | ARCHITECTURAL_RATIONALE | §2 | Data-driven |
| **WASM Memory** | ARCHITECTURAL_RATIONALE | §3 | Data-driven |
| **Hot-Reload** | ARCHITECTURAL_RATIONALE | §4 | Data-driven |
| **Audio Sandboxing** | ARCHITECTURAL_RATIONALE | §5 | Data-driven |
| **Moduli C++** | TECHNICAL_OVERVIEW | §4 | Referenza |
| **Integration** | ARCHITECTURE_INTEGRATION | Intera | End-to-end |
| **Sicurezza / qualità / release** | CHECKLIST_SICUREZZA_QUALITA_AFFIDABILITA.md | Intera (32 sezioni) | Operativo |
| **Soglia prodotto MVP** | MVP_RELEASE_GATE.md | Intero (vertical slice, P0/P1/P2, release gate concreto) | Operativo |
| **Roadmap pre-alpha** | PRE_RELEASE_ROADMAP.md | Fasi 0–5, gate, task, rischi, defer P1 | Operativo |
| **Phase 0 workaround log** | PHASE0_WORKAROUND_LOG.md | Assessment vertical slice, catalogo workaround, decisione HUD | Operativo |
| **Build / setup** | README.md (root) | Build pipeline | Operativo |

---

## 🎯 Cosa Fare Subito

1. **Distribuisci** `ARCHITECTURAL_RATIONALE.md` al team
2. **Seguire la progressione di lettura** sopra
3. **Usare checklist** in ARCHITECTURE_INTEGRATION.md per lo stato MVP integrato
4. **Code review** con anti-pattern in REACT_WASM_PATTERN.md e ECS_IMPLEMENTATION_GUIDE.md

---

## 💡 Punti Chiave da Ricordare

1. **ECS**: 10.000+ entity in WASM vs 500 con OOP
2. **Canvas**: React non deve mai toccarlo durante gameplay
3. **Buffer**: C++ scrive in `window._*`, React legge asincrono
4. **Memory**: 128MB + ALLOW_MEMORY_GROWTH
5. **Hot-Reload**: 5ms via embind, non 20sec rebuild
6. **Audio**: Defer a user gesture, non startup
7. **Artist-friendly**: mostrare i numeri di design, nascondere la complessità engine-only

---

## 📞 Domande Frequenti

**D: Da dove inizio?**  
A: `ARCHITECTURAL_RATIONALE.md` — ti fornisce il contesto.

**D: Sono solo React dev, posso saltare i doc C++?**  
A: No, leggi almeno ARCHITECTURAL_RATIONALE §1 (ECS) e §2 (Canvas). Capire il backend aiuta.

**D: Quanto tempo impiegherà implementare tutto?**  
A: Fase 19 e il primo Scene/Build MVP sono già integrati. Le stime nuove vanno fatte sui follow-up: asset pipeline completa, build WASM da UI, diagnostica Lua e undo/redo.

**D: Posso implementare solo parzialmente il pattern?**  
A: No — black box canvas + buffering sono o entrambi O nessuno. Una soluzione mezza è peggio di nessuna.

**D: Qual è il documento di riferimento se ho domande?**  
A: TECHNICAL_OVERVIEW.md (v2.2) — è il documento di "verità" per implementazione.

---

## ✨ Qualità Documentazione

| Criterio | Status |
|----------|--------|
| Completezza | ✅ Tutto coperto |
| Chiarezza | ✅ Diagrammi, esempi, dati |
| Praticità | ✅ Checklist, anti-pattern, code |
| Coerenza | ✅ Cross-referenced |
| Leggibilità | ✅ Diviso per audience |
| Testabilità | ✅ Checklist verificabili |
| Up-to-date | ✅ 2026-05-23 |

---

## 📦 Distribuzione

### Manda a TUTTI
- **ENGINE_DESIGN_RECAP.md** — documento di progettazione engine (condivisione team)
- **ENGINE_STATE_RECAP_COLLABORATORS.md** — onboarding rapido + link operativi
- LOGIC_BOARD_SPEC.md (**Parte I** glossario; **Parte III** per chi implementa la Board)
- ARCHITECTURAL_RATIONALE.md
- README.md (root) — setup e build

### Poi, per specializzazione
- React dev → REACT_WASM_PATTERN.md
- C++ dev → ECS_IMPLEMENTATION_GUIDE.md
- Tech leads → ARCHITECTURE_INTEGRATION.md · CHECKLIST_SICUREZZA_QUALITA_AFFIDABILITA.md
- Referenza generale → TECHNICAL_OVERVIEW.md (v2.2)

---

**Fine della documentazione di accesso. Buona lettura! 🚀**
