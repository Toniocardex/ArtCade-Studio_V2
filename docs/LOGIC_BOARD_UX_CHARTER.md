# Logic Board — UX Charter (artist-first, advanced-ready)

> **Stato:** principio di prodotto + checklist implementazione editor  
> **Data:** 2026-05-25  
> **Audience:** product, editor UI, Logic Board, QA  
> **Collegamenti:** [`ARTIST_FRIENDLY_COMPONENTS.md`](ARTIST_FRIENDLY_COMPONENTS.md) · [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md) Parte I–III · [`LOGIC_BOARD_CONDITIONAL_DESIGN.md`](LOGIC_BOARD_CONDITIONAL_DESIGN.md)

---

## 1. Filosofia

ArtCade è per **artisti e creatori senza programmazione** che vogliono finire un gioco 2D, con **tutti gli strumenti sempre disponibili** (Canvas, Inspector, Logic Board, **Script**, Build). La complessità la sceglie chi crea — non il motore nascondendo funzioni.

| Principio | Significato |
|-----------|-------------|
| **Visual-first** | Regole **When / Also require… / Then** come percorso principale; Script opzionale ma **sempre visibile** nella rail. |
| **Stesso gioco ovunque** | Preview WASM = build web. |
| **Base / Advanced = presentazione** | Stessi trigger, stesse azioni, stesso JSON, stesso compilatore. Cambiano guida, densità, enfasi — non permessi. |
| **Trigger sempre completi** | Il catalogo When non si filtra in Base. |
| **Default Base** | Nuova installazione e assenza preferenza → `authoringMode: base` (classico onboarding). |

Regola per ogni feature UI:

1. In **Base**, il caso comune è chiaro in &lt; 1 minuto (hint, Common checks, Also require… spesso spento).
2. In **Advanced**, meno testo guida, stessa potenza, picker più denso.
3. **Mai** rimuovere Script, PLAY, o un tipo di trigger dal runtime.

---

## 2. Modalità Base vs Advanced (implementazione editor)

Toggle **View → Base | Advanced** sulla module rail (persistito in `localStorage`, chiave `artcade.authoringMode`).

| Aspetto | Base (default) | Advanced |
|---------|----------------|----------|
| **Canvas / Inspector / Script** | Sempre accessibili | Identico |
| **Trigger (When)** | Catalogo **completo**, raggruppato + badge esecuzione | Identico |
| **Also require…** | Hint estesi; blocco opzionale enfatizzato | Hint brevi |
| **Condizioni** | Common checks in cima; `Key held` nascosto se When = keyboard (evita duplicare tasti) | Tutte le condizioni nel picker |
| **Tasti in When** | `OR` / `AND` tra tasti (`keyCombine` + `alternateKeyCodes`) | Identico |
| **AND/OR tra controlli** | Match rules (AND \| OR), visibile con blocco acceso | Identico |
| **Albero nested** | Link “Nested AND/OR groups (advanced)…” | Link “Nested AND/OR groups…” |
| **Then (add row)** | **Select action…** placeholder; Add disabled until chosen; resets after each add | Same flow |
| **Class rulesheet** | `<details>` Advanced (già esistente) | Identico |

Attributo DOM: `html[data-authoring-mode="base|advanced"]` per eventuali stili CSS.

---

## 3. Percorso utente base (artista)

**Si aspetta:** editor visivo, PLAY immediato, regole in linguaggio umano, Script presente ma non obbligatorio.

**Flusso tipico:**

1. File → **Platformer** (o Arcade).
2. **Canvas** — oggetti e numeri di design nell’Inspector (velocità, salto).
3. **Logic** — rulesheet per il Player.
4. Regola salto: **When** → tastiera → W **[OR]** Space → Just pressed → **Then** → Platformer jump (**Also require…** spento).
5. Regola doppio salto (se serve): **When** → W **[AND]** Ctrl → Just pressed → **Then** → (azione dedicata o script).
6. **PLAY** — prova; Console se serve.
7. Monete / nemici: stesso schema (When tocca / zona → Then).
8. **Script** — solo se vuole crescere; non è un secondo prodotto.

**Modello mentale:** *“Ogni oggetto ha regole: quando … allora … Opzionale: anche solo se …”*

---

## 4. Percorso utente avanzato

**Si aspetta:** board + Lua sullo stesso runtime, trigger completi, physics/sensor/messaggi, refactor per classe.

**Flusso tipico:**

1. Template o Blank; `world.physicsMode` esplicito.
2. Entità con componenti; rulesheet per classe se molti istanze.
3. **When** completi + **Also require…** con OR o albero nested + **Then** con wait, messaggi, toggle regole.
4. **Script** per sistemi che la board renderebbe verbosa.
5. **Advanced** view: meno hint, `Key held` anche con trigger keyboard se serve un caso limite documentato.

**Modello mentale:** *“La board compila in Lua; scelgo il livello di astrazione per sottosistema.”*

---

## 5. When vs Also require… — contratto UX

| Intento | Dove |
|---------|------|
| W **or** Space → salto | **When** → tasti + **OR** |
| W **and** Ctrl → doppio salto / modifier | **When** → tasti + **AND** |
| Solo se a terra / score / HP | **Also require…** |
| (A and B) or C tra controlli mondo | `conditionsOperator` o nested groups |

**Anti-pattern:** Ctrl in **Also require…** come “Key held” mentre W è in When → due concetti mescolati; usare **When [W] AND [Ctrl]**.

**Nota collisioni:** due regole entrambe su **W** (salto vs doppio salto) possono entrambe scattare su **W+Ctrl** — usare **Also require…** → Pass/NOT (es. Ctrl NOT held) o regole separate.

**NOT (implementato):** dropdown **Match rules** (AND | OR | NOT) + per ogni check **Pass | NOT**. NOT di gruppo = `not (c1 or c2 …)`; NOT su una riga = `not (check)`.

---

## 6. Booleani — un posto per scopo

| Combinazione | Meccanismo | Campo / UI |
|--------------|------------|------------|
| Tasti OR | Qualsiasi tasto della lista | `onInput.keyCombine: "OR"` (default) + `alternateKeyCodes` |
| Tasti AND | Tutti i tasti insieme | `onInput.keyCombine: "AND"` |
| Controlli mondo AND/OR/NOT | Tra check in Also require… | `conditionsOperator: 'AND' \| 'OR' \| 'NOT'` + **Match rules** |
| Inversione singola check | Pass / NOT per riga | `negated: true` su ogni condizione |
| Gruppi annidati | Albero | `conditionRoot` |

**Compilazione (tasti):**

- **OR + pressed/released:** registrazione per ogni tasto (handler separati).
- **AND + pressed/released:** registrazione solo sul tasto primario + gate Lua `wasKeyPressed(primary) and isKeyDown(modifier…)`.
- **down (polling):** gate unico in tick (`isKeyDown` con `or` / `and`).

---

## 7. Catalogo condizioni (tier UI, non runtime)

| Tier | Tipi |
|------|------|
| **Common** | variable, touching type, grounded, health, chance |
| **Resto** | tag, distance, mouse, raycast, grid, key held, … |

In **Base**, Common in cima; con trigger **onInput**, `Key held` nascosto nel picker (i tasti stanno in **When**). In **Advanced**, stesso catalogo completo.

---

## 8. Checklist PR (Logic Board UI)

- [x] Base è il default per nuovi utenti?
- [x] Trigger catalogo completo in entrambe le modalità?
- [x] Script tab sempre nella rail?
- [x] Hint When / Also require… coerenti con OR/AND tasti?
- [x] `keyCombine` AND/OR in When (`OnInputTriggerFields`)?
- [x] Blocco editor rinominato **Also require…** (JSON: `onlyIfEnabled` invariato)?
- [ ] Progetti salvati invariati al cambio View?
- [x] Test Vitest per `on-input-keys`, compiler AND combo?
- [x] NOT in Match rules + Pass/NOT per check?

---

## 9. Template rapidi

| Gioco | When | Also require… | Then |
|-------|------|----------------|------|
| Platformer | W or Space, pressed | Off o On ground | Platformer jump |
| Platformer (modifier) | W and Ctrl, pressed | Off o On ground | (custom / script) |
| Arcade | Space, pressed | — | Spawn / move |
| RPG leggero | Sensor enter | Variable hasKey | Load scene |

---

## 10. Roadmap (non normativa)

- Preset regola “Jump / Shoot / Hurt”
- Gruppi annidati più visibili in Base (NOT già in tree mode)
- ELSE esplicito (vedi condizionale design)
- Grafo React Flow (livello 3, non sostituisce When/Also require…/Then)

---

*Satellite a `LOGIC_BOARD_SPEC.md` Parte IV. Implementazione: `AuthoringModeSwitch`, `OnInputTriggerFields`, `keyCombine`, `condition-picker.ts`, `EventEditor` (Also require…).*
