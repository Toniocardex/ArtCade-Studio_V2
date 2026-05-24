# ArtCade V2 — Riepilogo di Sviluppo & Suggerimenti UX
**Stato del Progetto:** MVP Specifiche Logic Board Consolidate  
**Data:** Maggio 2026  
**Focus:** Componenti artist-friendly: numeri di design visibili, complessità tecnica nascosta

---

## 1. Visione del Progetto & Filosofia UX
ArtCade V2 si propone come un game engine e un editor visuale (React + Tauri v2) accoppiato a un runtime ultra-performante (C++ + Raylib + Box2D + Lua). 
La **Logic Board** adotta una filosofia più precisa di "zero-code": **non nasconde i numeri importanti, nasconde la complessità inutile**. Valori come `speed`, `damage`, `cooldown`, `radius`, `duration` e `health` sono numeri di design e devono rimanere visibili e bilanciabili. La complessità da nascondere è quella engine-only: vettori, delta time, handle fisici, fixture, sync ECS, callback e gestione memoria. Vedi [`ARTIST_FRIENDLY_COMPONENTS.md`](ARTIST_FRIENDLY_COMPONENTS.md).

---

## 2. Riepilogo Tassonomia dei Logic Component (8 Gruppi MVP)

I componenti logici sono stati riorganizzati e potenziati per coprire non solo i classici platform, ma anche giochi arcade a schermo fisso e puzzle a griglia (es. *Tetris*, *Space Invaders*, *Sokoban*), senza gravare sul runtime.

### ⚙️ 1. Sistema & Flusso (System & Flow)
* **Trigger:** `onStart`, `onUpdate`, `onTimer`, `onDestroy`.
* **Azioni:** * `loadScene`: Cambia livello accettando parametri visivi nativi (es. `transition: "fade" | "none"`, `duration`).
    * `wait`: Sospende temporaneamente la sequenza logica del blocco per *X* secondi senza bloccare il gioco. Nell'MVP compila verso la Time API (`time.after` / `time.delay`); le coroutine Lua restano un'evoluzione possibile per flussi narrativi più lineari.

### ⌨️ 2. Input (Tastiera & Mouse)
* **Trigger:** * `onInput`: Intercetta la tastiera con stati `pressed`, `held`, `released`.
    * `onMouseInput`: Gestisce `click` ed eventi di hover (`enter`, `exit`) sulla bounding box dell'entità.
* **Condizioni:** `isKeyDown`, `isMouseOver`.

### 🏃‍♂️ 3. Fisica & Spazio (Physics & Transform)
* **Trigger:** `onCollision` (urti solidi Box2D), `onTriggerEnter` / `onTriggerExit` (sensori, checkpoint, passaggi di livello).
* **Condizioni:** * `compareDistance`: Verifica la vicinanza spaziale da un target.
    * `isSpaceFree`: Condizione predittiva fondamentale per i giochi a griglia (es. *Tetris*); controlla se una cella adiacente è libera prima di spostarsi.
* **Azioni:** * `setPosition`, `setRotation`.
    * `setVelocity`: Per movimenti continui e piattaforme mobili.
    * `applyImpulse`: Forza secca istantanea (es. salto, rinculo).
    * `moveByOffset`: Spostamento discreto al pixel (scavalca Box2D, ideale per movimenti a griglia).
    * `snapToGrid`: Forza l'allineamento dello sprite ai multipli della griglia impostata.
    * `clampToScreen`: Impedisce all'entità di uscire dai bordi visivi della telecamera (ideale per shooter a schermo fisso alla *Space Invaders*).

### 🎨 4. Grafica & Animazione (Graphics)
* **Trigger:** `onAnimationEnd` (per sincronizzare morti, esplosioni o combo di attacchi).
* **Azioni:** `setAnimation`, `setVisible`, `setFlipX` / `setFlipY`.

### 🎥 5. Telecamera (Camera)
* **Azioni:** `setCameraTarget` (inseguimento fluido dell'entità), `cameraShake` (impatto visivo e game feel).

### 💾 6. Stato & Variabili (State & Logic)
* **Condizioni:** `compareVariable` (locali/globali), `chance` (calcolo probabilistico in percentuale per drop o IA).
* **Azioni:** `setVariable`, `addVariable`.

### 📦 7. Gerarchia Entità (Entities)
* **Condizioni:** `compareClass`, `hasTag` (gestione flessibile tramite tag multipli come "Infiammabile", "Nemico").
* **Azioni:** * `spawnEntity`: Creazione di oggetti con parametri avanzati (vedi Sezione 3).
    * `destroyEntity`: Rimozione logica e dalla memoria.

### 🔊 8. Audio & 📡 Segnali (Audio & Messaging)
* **Trigger:** `onMessage` (ascolto disaccoppiato di eventi custom).
* **Azioni:** `playSound`, `stopAllAudio`, `emitEvent` (invia messaggi con target mirati: *Globale*, *Self*, o a un'intera *Classe di Entità*).

---

## 3. Risoluzione dei Problemi Critici del 2D (UX Soluzioni)

### A. Gestione dell'Input Diretto
* **Flusso:** Invece di mappare tramite stringhe di codice o file JSON astratti, l'utente clicca sul trigger `onInput` nell'interfaccia React. Si apre un **Dialog Modale** che attende la pressione fisica di un tasto sulla tastiera dell'utente. React intercetta l'evento, riempie il campo `keyCode` (es. `Space`) e chiude il modale. Immediato, a prova di errore.

### B. Il Problema dello "Sparo Invertito" (Flip & Local Space)
* **Il problema:** Ruotare graficamente un personaggio a sinistra tramite `setFlipX` non ruota il suo asse fisico. Di conseguenza, un proiettile generato si muoverebbe comunque a destra (all'indietro rispetto allo sguardo).
* **La soluzione:** 1.  Nell'azione `spawnEntity`, abbiamo aggiunto la checkbox esplicita `inheritFlip` (Eredita Flip e Rotazione dal creatore).
    2.  Nell'azione `moveInDirection` (strutturata visivamente con un widget a bussola), l'utente può impostare la direzione speciale **"Forward" (Avanti)** o **"Backward"**. In modalità "Forward", il runtime Lua controlla lo stato di `FlipX` dell'entità stessa e inverte autonomamente il vettore di movimento, sollevando l'utente da qualsiasi calcolo trigonometrico o controllo condizionale (IF/ELSE).

### C. Gestione dello Spawn tramite "Image Points"
* Invece di obbligare l'utente a calcolare matematicamente gli offset di coordinate (es. `Player.X + 20`), l'editor degli sprite consente di piazzare visivamente dei punti di ancoraggio sulla texture (es. Punto 1 = "CannaFucile"). L'azione `spawnEntity` permette di selezionare questo punto dal menu a tendina.

---

## 4. Shaders Built-In Integrati (Raylib)
Per elevare l'estetica dei giochi senza richiedere codice GLSL, l'engine include 5 fragment shader nativi pronti all'uso tramite le azioni `setEntityShader` e `setScreenShader`:
1.  **📺 CRT / Scanlines:** (Globale) Distorsione bombata e linee orizzontali per un perfetto feeling da cabinato arcade.
2.  **🖍️ Outline:** (Entità) Contorno colorato dinamico che evidenzia lo sprite, utilissimo per lo stato di hover del mouse o per entità interattive.
3.  **💥 Hit Flash / Pure White:** (Entità) Sostituisce temporaneamente tutti i pixel dello sprite con il bianco o rosso puro per 0.1 secondi. Fornisce un feedback di danno nettamente superiore rispetto al semplice viraggio di colore.
4.  **🎨 Palette Swap:** (Entità) Sostituisce un colore specifico presente sulla texture con un altro a scelta tramite Color Picker. Permette di riciclare lo stesso sprite per creare varianti di nemici (es. Slime Verde -> Slime Rosso) senza caricare nuovi asset.
5.  **🌊 Wave / Distortion:** (Entità/Globale) Effetto onda sinusoidale sulle coordinate UV per simulare acqua o calore atmosferico.

---

## 5. Struttura Suggerita per la UI (IDE React/Tauri)
L'interfaccia utente è pensata come un ambiente scuro (Dark Mode), pulito ed enterprise-grade basato su pannelli ridimensionabili (layout a 4 colonne):
* **Colonna 1 (Sinistra):** Esploratore delle Scene e dell'albero degli Asset (Sprite, Audio, Classi). Supporta il drag-and-drop diretto dal sistema operativo.
* **Colonna 2 (Centro):** Area di lavoro principale divisa in Tab intercambiabili: la *Scena Visiva* (livello su griglia WYSIWYG) e la *Logic Board* (i blocchi logici disposti in verticale con codice colore associato per macro-categoria).
* **Colonna 3 (Destra):** Pannello delle Proprietà contestuale. Ospita controlli **artist-friendly**:
    * La bussola rotante per definire gli angoli di movimento.
    * Il Color Picker nativo per tinte e shader.
    * Le checkbox per l'ereditarietà delle trasformazioni (`inheritFlip`).
    * Number input e slider con unità esplicite per valori di design (`px/s`, `s`, `%`, `hp`), evitando preset opachi quando il bilanciamento richiede precisione.
* **Barra Superiore:** Controlli di esecuzione globale, dominati dal grande tasto **Play (Verde Neon)** per avviare istantaneamente l'anteprima di gioco.

---

## 6. Suggerimenti per la Prossima Fase di Sviluppo (Next Steps)
1.  **Formalizzazione dei JSON Schema:** Il prossimo passo logico è definire i JSON Schema per validare la struttura dati salvata dall'interfaccia React. Ogni Logic Component deve avere uno schema rigido in modo che il frontend possa generare i moduli e le proprietà in modo dinamico e senza bug di compilazione.
2.  **Architettura del Compilatore (TS ➔ Lua):** La pipeline schema-first prende il JSON strutturato della Logic Board e produce Lua eseguibile. `wait` oggi usa la Time API; un futuro livello coroutine può rendere ancora più naturali sequenze narrative e dialoghi, senza sporcare il ciclo di `update` principale.
3.  **Blackboard Globale per la Persistenza:** Configurare un sistema di memoria persistente lato C++ ("Blackboard globale") che mantenga variabili critiche come il punteggio o la vita del giocatore durante l'azione `loadScene`, impedendo al motore di svuotare la RAM tra un livello e l'altro.
