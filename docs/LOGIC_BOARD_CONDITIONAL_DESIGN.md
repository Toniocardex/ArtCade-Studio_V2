# ArtCade V2 — Design condizionale della Logic Board

> **Versione:** 1.0  
> **Stato:** Proposta di architettura / design (allineamento con `LOGIC_BOARD_SPEC.md` Parte III)  
> **Data:** 2026-05-11  
> **Audience:** Editor UI, compilatore TS → Lua, product / didattica  

Questo documento definisce **logica booleana composita** (AND / OR annidati) e **branching IF/ELSE** nella Logic Board, senza duplicare il glossario né il contratto MVP completo: resta in [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md). Qui si risponde a: *come evitare eventi duplicati*, *come serializzare*, *come compilare in Lua*, *quale filosofia UX privilegiare* (flow vs compatto), *implicazioni didattiche*.

---

## 1. Problema e obiettivi

### 1.1 Problema

In un sistema **event-centric** con lista piatta di condizioni interpretata come **AND** tra tutte le clausole:

- mancano **OR** e composizioni annidate → l’utente duplica **Logic Event** con le stesse azioni solo per combinare trigger/condizioni diverse;
- manca un **ELSE** esplicito → stesso effetto (copia-incolla di eventi speculari).

### 1.2 Obiettivi

| Obiettivo | Descrizione |
|-----------|-------------|
| **Espressività** | Combinazioni booleane senza moltiplicare gli eventi. |
| **Manutenibilità** | Un solo punto di verità per “stessa azione, condizioni diverse”. |
| **Runtime** | Il C++ **non** interpreta OR/ELSE: riceve **Lua** già linearizzata (`if … then … else … end`). |
| **Didattica** | Percorsi comprensibili in contesti scuola / principianti (vedi §7). |

---

## 2. Architettura logica (semantic layer)

### 2.1 Principi

1. **Trigger** resta ciò che “attiva” il contesto di valutazione (es. `onCollision`, `onUpdate`).
2. **Condizione** diventa un **albero** (`LogicConditionGroup`), non solo una lista piatta di predicati in AND implicito.
3. **Esecuzione** dopo valutazione positiva: sequenza di azioni sul ramo **then**; opzionalmente sequenza sul ramo **else**.

### 2.2 LogicConditionGroup (albero booleano)

Un gruppo è un nodo interno con operatore e figli; le foglie sono predicati atomici (tipi già in linea con `LogicCondition` nel SPEC, estendibili).

**Semantica:**

- `operator: "AND"` — tutte le `statements` devono essere vere.
- `operator: "OR"` — almeno una `statement` vera.
- Ogni elemento di `statements` è **o** un predicato foglia **o** un altro `LogicConditionGroup` (ricorsione).

**Esempio JSON (schema concettuale):**

```json
{
  "conditionRoot": {
    "kind": "group",
    "operator": "OR",
    "statements": [
      { "kind": "leaf", "type": "compareVariable", "key": "hasKey", "operator": "==", "value": 1 },
      {
        "kind": "group",
        "operator": "AND",
        "statements": [
          { "kind": "leaf", "type": "compareVariable", "key": "isMasterThief", "operator": "==", "value": 1 },
          { "kind": "leaf", "type": "compareVariable", "key": "hasLockpick", "operator": "==", "value": 1 }
        ]
      }
    ]
  }
}
```

> **Nota:** i nomi esatti dei campi (`kind`, `leaf`, …) vanno allineati a `types/logic-board.ts` al momento dell’implementazione; la forma è **ad albero**, non lista piatta AND-only.

### 2.3 Anti-pattern da documentare per l’utente

| Approccio | Valutazione |
|-----------|-------------|
| **Più eventi identici** con sole condizioni diverse | Sconsigliato: duplica azioni, peggiora manutenzione e diff. |
| **LogicConditionGroup** | Raccomandato: una politica, un posto per le azioni. |

---

## 3. Branching IF/ELSE

### 3.1 Due filosofie di presentazione

Stessa **semantica** (`if cond then A else B end`), due modi di **mostrarla** in editor:

| Filosofia | Idea | Pro principale | Contro principale |
|-----------|------|------------------|-------------------|
| **Blocco compatto (inline)** | Un contenitore per evento: SE / THEN / ELSE in sezioni verticali | Poco spazio, niente fili incrociati | Azioni “nascoste” fino ad espansione; annidamento IF-in-IF può diventare UI a matriosca |
| **Branch fisico (flow-based)** | Nodo **If/Branch** con pin **Exec** in ingresso e uscite **True** / **False** verso catene di nodi | Leggibilità, annidamento naturale, **visual debugging** (fili che si illuminano) | Più area schermo; rischio disordine senza layout e raggruppamenti |

### 3.2 Scelta di prodotto per ArtCade V2

**Filosofia primaria: Branch fisico (flow-based)** — coerente con il nome **Board** (scheda / circuito), con il debug visivo previsto nelle linee guida, e con l’inserimento futuro di nodi di controllo (es. delay) **solo su un ramo** senza rigidizzare un form compatto.

**Mitigazioni** per i contro del flow:

- **Auto-layout** (pulsante) su grafo React Flow.
- **Color-coding** pin: esecuzione vs dati vs ramo fallito (design system da definire con UI).
- **Sticky notes / comment boxes** (già in `LOGIC_BOARD_DESIGN_GUIDELINES.md`).
- **Inspector compatto** opzionale sul nodo selezionato: riepilogo testuale della stessa semantica (non secondo modello dati diverso).

Il **blocco compatto** resta utile come **vista secondaria** o **step didattico iniziale** (vedi §7), non come concorrenza di due serializzazioni diverse.

### 3.3 Modello dati (grafo + branch)

A livello di persistenza, un **Branch** è un **nodo di controllo** nel grafo dell’evento (o del sotto-documento logic board), non un secondo trigger:

- **Ingressi:** filo di esecuzione + (opzionale) pin dati per la condizione se separati.
- **Uscite:** `true` e `false`, ciascuna collegata a una **catena** di nodi (azioni o altri branch).
- Il compilatore TS **visita** il grafo a partire dal trigger, ordina i nodi raggiungibili da ogni pin, ed emette Lua lineare con `if` / `else` annidati.

**Regole di implementazione da definire in fase codegen:**

- Ordine deterministico tra nodi sullo stesso pin (es. topological sort, o ordine Y del layout).
- Policy su **merge** dopo i due rami (se entrambi riconvergono su uno stesso nodo).
- **Cicli** nel grafo: vietati nel MVP o limitati a costrutti espliciti (timer) — da normare nello SPEC quando il grafo diventa normativo.

---

## 4. Compilazione TypeScript → Lua

### 4.1 ConditionGroup → espressione

Il compilatore **appiattisce** l’albero in un’espressione booleana Lua con parentesi corrette:

```lua
-- Esempio concettuale dall’albero OR + AND annidato della §2.2
if (state.get("hasKey") == 1) or ((state.get("isMasterThief") == 1) and (state.get("hasLockpick") == 1)) then
  -- azioni ramo TRUE del branch collegato
else
  -- azioni ramo FALSE (se presenti)
end
```

I nomi delle API (`state.get`, ecc.) vanno allineati al contratto reale (`LUA_GAME_API`, `GameAPI`).

### 4.2 Branch fisico → `if` / `else`

```lua
local condition = (self.vars.health > 0) -- o espressione da conditionRoot
if condition then
  -- sequenza nodi collegati al pin TRUE
else
  -- sequenza nodi collegati al pin FALSE
end
```

**Perché è elegante:** il runtime C++ non conosce OR/AND/ELSE nel JSON; esegue solo **Lua**. Il costo booleano sta nella VM Lua, adatta a questo compito.

---

## 5. Struttura documentale e dipendenze

```text
LOGIC_BOARD_SPEC.md          → glossario, formato sheet, modello event-centric MVP, AND piatto oggi descritto
        │
        ├── LOGIC_BOARD_DESIGN_GUIDELINES.md   → blackboard, segnali, UX grafo, bridge numerico
        │
        └── LOGIC_BOARD_CONDITIONAL_DESIGN.md  → (questo file) OR/ELSE, gruppi, branch vs compatto, codegen, didattica
```

Quando il modello dati del grafo + `conditionRoot` sarà **stabile**, le sezioni rilevanti di questo file andranno **riflesse o estratte** in `LOGIC_BOARD_SPEC.md` Parte III (tipi TypeScript, esempi JSON ufficiali) per evitare drift.

---

## 6. UI / React (Fase 20 — indicazioni)

- **Libreria grafo:** es. React Flow; nodi custom per Branch, azioni, trigger.
- **Auto-layout:** riduce il difetto principale del flow-based (occupazione spazio).
- **Highlight esecuzione:** ID nodo / pin attivo dal buffer di polling C++ → glow sul filo o sul nodo (coerente con `LOGIC_BOARD_DESIGN_GUIDELINES.md` §4).
- **Validazione:** ramo TRUE/FALSE non collegato → warning soft in editor, errore hard opzionale in export.

---

## 7. Uso didattico (scuole, principianti, “primo gioco”)

| Aspetto | Raccomandazione |
|---------|-----------------|
| **Leggibilità** | Il branch fisico richiama **diagrammi di flusso** già familiari in curricula STEM. |
| **Progressione** | Tutorial corti: 1) solo THEN, 2) THEN + ELSE, 3) OR in `conditionRoot`, 4) annidamento. |
| **Sovraccarico** | Senza auto-layout e template, il grafo diventa illeggibile: prevedere **esempi guidati** e **snippet** (“raccolta moneta”, “danno + morte”). |
| **Vista compatto** | Opzionale come **riepilogo** o per chi ha poco tempo in aula; non sostituisce il modello flow come fonte di verità se il prodotto punta sulla Board. |
| **Valutazione** | I docenti possono valutare **struttura del ramo** (corretto IF/ELSE) più facilmente che lunghe liste in un solo blocco. |

---

## 8. Checklist implementazione (sintesi)

- [ ] Tipi TS: `LogicConditionGroup` + foglie allineate a `LogicCondition` esistenti.  
- [ ] Persistenza grafo: nodi `branch`, edge tipizzati (`true` / `false` / `exec`).  
- [ ] Compilatore: visita grafo → `if`/`else` + espressioni da albero.  
- [ ] Policy MVP: cicli, merge, profondità massima.  
- [ ] UI: Branch come nodo primario; inspector riepilogo; auto-layout; color pin.  
- [ ] Allineamento doc: aggiornare `LOGIC_BOARD_SPEC.md` Parte III quando il JSON è definitivo.

---

*Documento satellite. Per terminologia Logic Board / Event / Component vedi `LOGIC_BOARD_SPEC.md` Parte I.*
