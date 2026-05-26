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
| **Visual-first** | Regole When / If / Then come percorso principale; Script opzionale ma **sempre visibile** nella rail. |
| **Stesso gioco ovunque** | Preview WASM = build web. |
| **Base / Advanced = presentazione** | Stessi trigger, stesse azioni, stesso JSON, stesso compilatore. Cambiano guida, densità, enfasi — non permessi. |
| **Trigger sempre completi** | Il catalogo When non si filtra in Base. |
| **Default Base** | Nuova installazione e assenza preferenza → `authoringMode: base` (classico onboarding). |

Regola per ogni feature UI:

1. In **Base**, il caso comune è chiaro in &lt; 1 minuto (hint, Common checks, If spesso spento).
2. In **Advanced**, meno testo guida, stessa potenza, picker più denso.
3. **Mai** rimuovere Script, PLAY, o un tipo di trigger dal runtime.

---

## 2. Modalità Base vs Advanced (implementazione editor)

Toggle **View → Base | Advanced** sulla module rail (persistito in `localStorage`, chiave `artcade.authoringMode`).

| Aspetto | Base (default) | Advanced |
|---------|----------------|----------|
| **Canvas / Inspector / Script** | Sempre accessibili | Identico |
| **Trigger (When)** | Catalogo **completo**, raggruppato + badge esecuzione | Identico |
| **If** | Hint estesi; If opzionale enfatizzato | Hint brevi |
| **Condizioni** | Common checks in cima; `Key held` nascosto se When = keyboard (evita confusione OR) | Tutte le condizioni nel picker |
| **OR tasti** | When → + Add key (OR) | Identico |
| **OR tra controlli If** | Combine checks (≥ 2 controlli) | Identico |
| **Albero nested** | Link “Nested AND/OR groups (advanced)…” | Link “Nested AND/OR groups…” |
| **Class rulesheet** | `<details>` Advanced (già esistente) | Identico |

Attributo DOM: `html[data-authoring-mode="base|advanced"]` per eventuali stili CSS.

---

## 3. Percorso utente base (artista)

**Si aspetta:** editor visivo, PLAY immediato, regole in linguaggio umano, Script presente ma non obbligatorio.

**Flusso tipico:**

1. File → **Platformer** (o Arcade).
2. **Canvas** — oggetti e numeri di design nell’Inspector (velocità, salto).
3. **Logic** — rulesheet per il Player.
4. Regola: **When** → tastiera → W + OR Space → Just pressed → **Then** → Platformer jump (**If** spento).
5. **PLAY** — prova; Console se serve.
6. Monete / nemici: stesso schema (When tocca / zona → Then).
7. **Script** — solo se vuole crescere; non è un secondo prodotto.

**Modello mentale:** *“Ogni oggetto ha regole: quando … allora … Opzionale: solo se …”*

---

## 4. Percorso utente avanzato

**Si aspetta:** board + Lua sullo stesso runtime, trigger completi, physics/sensor/messaggi, refactor per classe.

**Flusso tipico:**

1. Template o Blank; `world.physicsMode` esplicito.
2. Entità con componenti; rulesheet per classe se molti istanze.
3. **When** completi + **If** con OR o albero nested + **Then** con wait, messaggi, toggle regole.
4. **Script** per sistemi che la board renderebbe verbosa.
5. **Advanced** view: meno hint, `Key held` anche con trigger keyboard se serve un caso limite.

**Modello mentale:** *“La board compila in Lua; scelgo il livello di astrazione per sottosistema.”*

---

## 5. When vs If — contratto UX

| Intento | Dove |
|---------|------|
| W **or** Space → salto | **When** (+ Add key OR) |
| Solo se a terra / score | **If** |
| (A and B) or C | Nested groups **oppure** evoluzione futura |

**Anti-pattern:** Space in If “Key held” + W in When → AND, non OR.

---

## 6. OR booleano — un posto per scopo

| OR tra… | Meccanismo |
|---------|------------|
| Tasti | `onInput.alternateKeyCodes` |
| Controlli If semplici | `conditionsOperator: 'OR'` |
| Gruppi annidati | `conditionRoot` |

---

## 7. Catalogo condizioni (tier UI, non runtime)

| Tier | Tipi |
|------|------|
| **Common** | variable, touching type, grounded, health, chance |
| **Resto** | tag, distance, mouse, raycast, grid, key held, … |

In **Base**, Common in cima; in **Advanced**, stesso catalogo, meno enfasi sulla gerarchia.

---

## 8. Checklist PR (Logic Board UI)

- [ ] Base è il default per nuovi utenti?
- [ ] Trigger catalogo completo in entrambe le modalità?
- [ ] Script tab sempre nella rail?
- [ ] Hint When/If coerenti con keyboard OR?
- [ ] Progetti salvati invariati al cambio View?
- [ ] Test Vitest per `authoringMode` e `condition-picker`?

---

## 9. Template rapidi

| Gioco | When | If | Then |
|-------|------|-----|------|
| Platformer | W or Space, pressed | Off o On ground | Platformer jump |
| Arcade | Space, pressed | — | Spawn / move |
| RPG leggero | Sensor enter | Variable hasKey | Load scene |

---

## 10. Roadmap (non normativa)

- Preset regola “Jump / Shoot / Hurt”
- ELSE esplicito (vedi condizionale design)
- Grafo React Flow (livello 3, non sostituisce When/If/Then)

---

*Satellite a `LOGIC_BOARD_SPEC.md` Parte IV. Implementazione toggle: `AuthoringModeSwitch`, `SET_AUTHORING_MODE`, `condition-picker.ts`.*
