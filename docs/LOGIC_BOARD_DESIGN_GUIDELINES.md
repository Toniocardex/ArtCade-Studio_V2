# ArtCade V2 — Linee Guida per il Design della Logic Board

> **Stato**: Documento di Supporto alla Progettazione (Fase 19-20)
> **Data**: 2026-05-11
> **Obiettivo**: Consolidare le best practice per l'implementazione del sistema di logica visiva.

**Principio prodotto correlato:** [`ARTIST_FRIENDLY_COMPONENTS.md`](ARTIST_FRIENDLY_COMPONENTS.md)
definisce la regola "numeri di design visibili, complessità tecnica nascosta".
Queste linee guida la applicano alla Logic Board.

---

## 1. Gestione Variabili: Il Blackboard Pattern
Per evitare conflitti di "scope" e garantire performance costanti, la gestione dei dati deve seguire il pattern della **Blackboard**.

### 1.1 Local Blackboard (Logic Component)
Ogni entità possiede una tabella Lua privata (`self.vars`).
- **Utilizzo**: Salute, timer interni, stati specifici dell'IA.
- **Vantaggio**: Isolamento totale. Se un nemico cambia la sua variabile "salute", gli altri non ne risentono.

### 1.2 Global Blackboard (Engine Context)
**Implementazione:** `VariableManager` esposto a Lua come `state.get` / `state.set` / `state.add` (`state-api.cpp`). Persiste tra `scene.load` (non viene svuotato al cambio scena).
- **Utilizzo**: Punteggio totale, stato del livello (es. "isGameOver"), variabili persistenti.
- **Vantaggio**: Facilita la comunicazione tra entità distanti e la persistenza dei salvataggi (`save.*` usa lo stesso store).

---

## 2. Comunicazione Inter-Entità: Logic Messaging
Invece di permettere alle Board di modificare direttamente i componenti di altre entità, si utilizza un sistema di **Segnali (Signals)**.

- **Emissione**: Un nodo azione `EmitSignal("NOME_SEGNALE", target_id, payload)`.
- **Ricezione**: Un **Logic Event** `OnSignal` che reagisce filtrando per nome.
- **Perché**: Questo approccio "Fire and Forget" disaccoppia le entità. Un pulsante non deve sapere come funziona una porta; deve solo inviare il segnale "Open".

---

## 2.1 Logic Board vs Component runtime

La Logic Board deve restare uno strumento di orchestrazione: condizioni,
trigger e azioni leggibili dall'utente. La simulazione frequente e costosa
deve vivere nei Component runtime nativi e nei sistemi C++.

Formula guida:

```text
Logic Board orchestra. Component esegue. Core simula.
```

Esempi corretti:

- `player enters coin radius` -> azione `collect coin`; attrazione gestita da
  `MagneticItemComponent`.
- `input pressed` -> azione `fire grappling hook`; rope/joint gestiti da
  `GrapplingHookComponent`.
- `enemy sees player` -> azione `set target`; steering gestito da
  `HordeMemberComponent`.

Non generare loop Lua nascosti per implementare feature che sono Component
runtime. Lua e Logic Board restano livello thin script/eventi.

---

## 2.2 Componenti Artist-Friendly

ArtCade non deve sostituire i valori utili con preset opachi. `Speed: 240 px/s`
e `Cooldown: 0.35 s` sono più chiari di "veloce" o "medio" quando l'autore
sta bilanciando il gioco.

La UI deve quindi separare:

- **parametri espliciti**: speed, jump force, damage, health, cooldown,
  duration, radius, range, volume;
- **scelte di comportamento**: movement style, follow mode, patrol mode,
  collision response, trigger mode, facing mode;
- **dettagli Advanced**: delta time, handle fisici, fixture, registry, sync,
  callback raw, diagnostica runtime.

Regola:

```text
Se un parametro cambia il feeling del gioco, mostralo.
Se un parametro serve solo al motore per funzionare, nascondilo o mettilo in Advanced.
```

---

## 3. Scalabilità: Architettura Data-Driven dei Nodi
Per evitare di dover modificare il compilatore TypeScript o il bridge C++ per ogni nuovo nodo, la definizione deve essere esterna (JSON Schema).

- **Schema JSON**: Ogni nodo viene definito con un `type`, una categoria UI e un `lua_template`.
- **Compilazione**: Il compilatore TS esegue un semplice "search and replace" dei parametri nel template Lua durante il salvataggio.
- **Esempio**: `Entity.setPosition({{id}}, {{x}}, {{y}})` diventa codice lineare istantaneo per l'engine.

---

## 4. UX & Debugging: Visual Flow e Organizzazione
L'editor in React deve fornire feedback immediato per ridurre il tempo di debug.

### 4.1 Highlight del Flusso (Current Flow)
Quando un **Logic Event** scatta nel C++, l'engine invia al buffer di polling l'ID della Board e del Nodo attivato.
- **Effetto UI**: Il nodo corrispondente nella Logic Board di React si illumina brevemente (Glow effect).

### 4.2 Strumenti di Ordine
- **Sticky Notes**: Possibilità di aggiungere note testuali nel grafo.
- **Comment Boxes**: Aree colorate per raggruppare nodi logici (es. "Movimento Base", "Attacco"). Previene lo "Spaghetti Code" visivo.

---

## 5. Precisione Numerica e Bridge
Un punto critico del bridge `sol2` tra Lua (che usa `double`) e Raylib/Box2D (che usano spesso `float`).

- **Casting Safe**: Il bridge deve gestire internamente l'arrotondamento o il troncamento dei valori numerici.
- **Jittering**: Assicurarsi che le posizioni calcolate da Lua non introducano micro-scostamenti (es. `0.999999`) che potrebbero causare tremolii nel rendering dello sprite.

---

## Conclusioni
L'adozione di questi suggerimenti garantirà che la **Logic Board** non sia solo uno strumento potente, ma anche facile da manutenere e piacevole da usare per l'utente finale.
