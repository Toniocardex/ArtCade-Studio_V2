# ArtCade V2 – Piano di Sviluppo Commerciale

> **Versione**: 1.0
> **Data**: 2026-05-11
> **Stato**: Pronto per l'esecuzione
> **Obiettivo**: Raggiungere il primo incasso con un prodotto stabile e una demo giocabile completa.

---

## 1. Obiettivo Generale

Portare ArtCade V2 da uno stato di **architettura avanzata con editor funzionante** a un **prodotto commerciale Early Access**, venduto a **39€** su piattaforme indie (Gumroad, itch.io), con un flusso di creazione gioco completo, una demo giocabile di 5 livelli e l'esportazione Web one‑click.

---

## 2. Stato Attuale (Pre‑Piano)

- Runtime C++ con Raylib, Box2D, Lua VM (Sol2) e oltre 20 moduli utility **completato**.
- Editor React con 7 pannelli, WASM Preview Panel e hot‑reload script **completato**.
- Documentazione tecnica e architetturale **completa e aggiornata** (RATIONALE, OVERVIEW, INTEGRATION, SPECS).
- Logic Board (visual scripting) **specificata e documentata**, implementazione editor in roadmap.
- **Criticità tecniche note**: flicker React‑WASM (da risolvere con buffering), IPC Tauri parziale, texture/suoni placeholder.

---

## 3. Approccio e Ritmo di Lavoro

- **Impegno previsto**: 4‑6 ore al giorno, 5 giorni a settimana (part‑time avanzato / full‑time ridotto).
- **Modalità**: sviluppo iterativo con checkpoint settimanali verificabili.
- **Priorità assoluta**: completare il flusso di creazione gioco end‑to‑end e la demo giocabile.
- **Regola d’oro**: ogni settimana deve produrre un risultato **mostrabile** (video, build, test pubblico).

---

## 4. Fasi di Sviluppo

### FASE 1 – Stabilità e Decoupling Editor (Settimane 1‑2)

**Obiettivo**: Eliminare il flicker React‑WASM, rendere l’editor stabile e completare l’IPC base Tauri.

#### Settimana 1 – Buffering e Fix Critici

| Giorno | Task |
|--------|------|
| 1 | Implementare il buffering in `wasm-bridge.ts`: C++ scrive su `window._consoleLogs` e `window._selectedEntity`. |
| 2 | Refactor `ConsolePanel` e `InspectorPanel` per usare `setInterval` a 100‑200 ms. |
| 3 | Rendere `PreviewPanel` una vera Black Box: zero re‑render durante il gameplay. |
| 4 | Test specifico “Coin pickup” e verifica zero flicker. |
| 5 | Fix di stabilità: `sol::protected_function` per script Lua, try/catch nel loop principale. |

**Checkpoint settimanale**: La demo test non mostra più artefatti grafici; la console e l’inspector si aggiornano correttamente senza bloccare il canvas.

#### Settimana 2 – Tauri IPC di Base

| Giorno | Task |
|--------|------|
| 1 | `openProjectDialog()` con file picker nativo (Tauri). |
| 2 | `saveScript()` e salvataggio automatico del progetto su file system. |
| 3 | Pulsante “▶ PLAY” che carica il WASM e avvia il runtime. |
| 4 | Log di build da `cmake --build` in tempo reale nella console dell’editor. |
| 5 | Test end‑to‑end: aprire, modificare, salvare, giocare, esportare. |

**Checkpoint**: Editor completamente funzionale su Tauri; build alpha distribuibile a tester fidati.

---

### FASE 2 – Esperienza “Real Game” (Settimane 3‑4)

**Obiettivo**: Sostituire i placeholder con asset reali e creare la prima demo giocabile completa.

#### Settimana 3 – Texture e Audio Reali

| Giorno | Task |
|--------|------|
| 1 | Caricamento PNG da `EntityDef.sprite.spriteAssetId` e resize texture cache. |
| 2 | `Renderer::drawSprite()` con `DrawTexturePro`, gestione pivot e trasparenze. |
| 3 | Fallback magenta per asset mancanti; test con sprite sheet multi‑frame. |
| 4 | Caricamento audio OGG/WAV; riproduzione suoni “salto” e “raccolta moneta”. |
| 5 | Build alpha‑2 con un mini‑livello (1 schermata, 10 monete, 1 nemico). |

#### Settimana 4 – Demo “Platformer 5 Livelli”

| Giorno | Task |
|--------|------|
| 1‑2 | Costruzione della demo nell’editor: 5 livelli, menu principale, game over. |
| 3 | Aggiunta UI rudimentale (punteggio, vite) con debug draw. |
| 4 | Test, bilanciamento e fix collisi; esportazione `.artcade`. |
| 5 | Screen‑record di 2 minuti per i social e il sito. |

**Checkpoint**: Demo giocabile su `.exe` e browser; primo video pubblico.

---

### FASE 3 – Esportazione e Landing Page (Settimane 5‑6)

**Obiettivo**: Rendi l’esportazione Web immediata e prepara l’infrastruttura di vendita.

#### Settimana 5 – One‑Click Web Export

| Giorno | Task |
|--------|------|
| 1 | Script di build WASM automatizzato e integrato nell’editor (pulsante “Build Web”). |
| 2 | Generazione `index.html` minimale con canvas e caricamento WASM. |
| 3 | Test cross‑browser (Chrome, Firefox, Edge) e mobile. |
| 4 | Ottimizzazione dimensione `.wasm` e asset (compressione texture). |
| 5 | Opzione “Apri nel browser” dopo il build. |

#### Settimana 6 – Landing Page e Setup Vendita

| Giorno | Task |
|--------|------|
| 1 | Registrare dominio (es. `artcade.dev`) e hosting statico. |
| 2 | Creare landing page con Hugo/Jekyll: video demo, feature list, pulsante acquisto. |
| 3 | Configurare prodotto su Gumroad/itch.io: prezzo 39€, descrizione, anteprima. |
| 4 | Scrivere documentazione pubblica “Getting Started” (PDF o pagina web). |
| 5 | Test di acquisto e delivery automatica del download. |

**Checkpoint**: Un estraneo può comprare, scaricare e creare il suo primo gioco web in pochi minuti.

---

### FASE 4 – Lucidatura e Lancio Pubblico (Settimane 7‑8)

**Obiettivo**: Raccogliere feedback, correggere bug critici e lanciare ufficialmente.

#### Settimana 7 – Beta Testing e Bug Fix

| Giorno | Task |
|--------|------|
| 1‑3 | Distribuire la build a 10‑20 beta tester (community indie, Discord). |
| 4 | Raccogliere e prioritizzare i bug report. |
| 5 | Correggere i bug critici (crash, errori di build, problemi di usabilità). |

#### Settimana 8 – Marketing e Lancio

| Giorno | Task |
|--------|------|
| 1 | Tutorial video “Crea il tuo primo platformer in 15 minuti”. |
| 2 | Scrivere 3 post per blog/social (Twitter/X, Reddit gamedev). |
| 3 | Pubblicare su IndieDB, itch.io, gruppi Facebook/Talents. |
| 4 | Comunicato stampa breve per siti di settore (indievelopment, GameFromScratch). |
| 5 | **LANCIO UFFICIALE** – annuncio su tutti i canali, monitoraggio prime vendite. |

**Checkpoint finale**: Prime vendite registrate; ricezione dei primi feedback pubblici; pianificazione degli aggiornamenti successivi.

---

## 5. Riepilogo Fasi e Scadenze

| Fase | Settimane | Obiettivo principale | Checkpoint |
|------|-----------|----------------------|------------|
| 1 | 1‑2 | Stabilità, decoupling React‑WASM, IPC Tauri | Editor stabile, build alpha distribuibile |
| 2 | 3‑4 | Texture, audio, demo giocabile | Demo 5 livelli funzionante su .exe e web |
| 3 | 5‑6 | Esportazione Web one‑click, landing page, vendita | Primo acquisto possibile |
| 4 | 7‑8 | Beta test, bug fix, lancio ufficiale | Vendite pubbliche e presenza online |

---

## 6. Rischi e Mitigazioni

| Rischio | Probabilità | Mitigazione |
|--------|-------------|-------------|
| **Burnout** | Media | Rispettare le ore giornaliere; weekend libero ogni due settimane. |
| **Bug bloccanti** (WASM, build) | Alta | Riservare un giorno a settimana per fix urgenti; avere backup delle build precedenti. |
| **Mancanza di beta tester** | Media | Costruire una community su Discord dalla Fase 1; offrire licenza gratuita in cambio di feedback. |
| **Time‑to‑market troppo lungo** | Bassa (8 settimane è rapido) | Mantenere lo scope MVP; posticipare feature non essenziali (tilemap, UI avanzata) a dopo il lancio. |
| **Problemi di pagamento/piattaforma** | Bassa | Test di acquisto anticipato con account fittizio. |

---

## 7. Criteri di Avanzamento

- Ogni checkpoint settimanale deve essere **verificabile** (build funzionante, video, test).
- Lo sviluppo della settimana successiva **non inizia** se il checkpoint precedente non è soddisfatto.
- Eccezioni: task di ricerca/design che non bloccano il codice (es. preparazione landing page).

---

## 8. Appendice: Riferimenti alla Documentazione

- [`ARCHITECTURAL_RATIONALE.md`](ARCHITECTURAL_RATIONALE.md) – Perché delle scelte architetturali.
- [`TECHNICAL_OVERVIEW.md`](TECHNICAL_OVERVIEW.md) – Panoramica completa del motore.
- [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md) – Glossario, formato Logic Sheet, specifica Logic Board.
- [`ECS_IMPLEMENTATION_GUIDE.md`](ECS_IMPLEMENTATION_GUIDE.md) – Guida pratica EnTT.
- [`REACT_WASM_PATTERN.md`](REACT_WASM_PATTERN.md) – Pattern di buffering per l’editor.
- [`ARCHITECTURE_INTEGRATION.md`](ARCHITECTURE_INTEGRATION.md) – Visione d’insieme dell’integrazione.

La documentazione è il tuo “manuale di bordo”: consultala prima di ogni task se necessario.

---

*Piano di sviluppo soggetto a revisione dopo ogni fase, in base ai feedback e alle priorità emergenti.*
