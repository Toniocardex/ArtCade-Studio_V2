# 📢 ArtCade V2 — Aggiornamento Architetturale per Collaboratori

**Data**: 2026-05-10  
**Priorità**: ALTA  
**Leggere**: TUTTI I DEVELOPER REACT

---

## 🔴 Problema Identificato

Il **flash visibile durante coin pickup** (bordo dell'editor che scompare per 1 frame) è causato da React che si re-renderizza durante il game loop WASM.

**Root cause**: `onConsoleLine()` e `onEntitySelected()` trigghiano `dispatch()` in tempo reale → React reconciliation entra in contesa con WebGL → frame incompleto.

---

## ✅ Soluzione: Decoupling Completo

**Nuova architettura**:
- **PreviewPanel** = Scatola nera autonoma (ZERO re-render durante gameplay)
- **C++ callbacks** = Scrivono in buffer globale (`window._consoleLogs`, `window._selectedEntity`)
- **React legge asincrono** = Polling ogni 100–200ms, non real-time
- **ConsolePanel / InspectorPanel** = Leggono dal buffer con `setInterval`, non `useContext` volatile

**Risultato**: Zero flash, zero glitch. PreviewPanel è completamente disaccoppiata da React state volatile.

---

## 🎯 DOCUMENTO CRITICO (Leggere PRIMA)

### ARCHITECTURAL_RATIONALE.md

> **Se sei interessato al PERCHÉ dietro le decisioni, non solo il COME**: Questo è il documento che fa la differenza.

**Contenuto**:
- ✅ **ECS vs OOP**: Confronto con dati (10.000 entity ECS vs 500 entity OOP in WASM)
- ✅ **Canvas Black Box**: Perché React non deve toccare WebGL (spiegazione tecnica del flash)
- ✅ **WASM Memory**: Perché 128MB + growth (vs 16MB default)
- ✅ **Hot-Reload**: 5ms vs 20sec rebuild (impact su developer experience)
- ✅ **Audio Sandboxing**: Perché defer initialization (browser policy)
- ✅ **Piano d'azione**: 3 step implementazione concreti

**Tempo di lettura**: 20–30 min  
**Pubblico**: Team, architects, decision makers  
**Perché importa**: Comprenderai il razionale — non sarà "Trust me" ma "Guarda i dati"

---

## 📚 Documentazione Aggiornata

1. **TECHNICAL_OVERVIEW.md** (v2.2 — Completo)
   - §2: Architettura generale con diagramma black box
   - §3.5: **Entity Component System (ECS) Architecture** (nuovo)
   - §4.0: **ECS Integration Pattern** con Systems
   - §4.3: **World** come wrapper EnTT (aggiornato)
   - §5.5: **React-WASM Decoupling Pattern** (400+ righe)
   - §6: **Game Loop dettagliato con ECS Systems**
   - §12: Regole operative (aggiornate con ECS + React)
   - **Fase 19**: Hot-reload Lua con buffering + ECS

2. **ARCHITECTURE_INTEGRATION.md** (nuovo)
   - Vista complessiva: 3 pilastri (ECS + Moduli + React-WASM)
   - Flusso di dati: scenario User clicks PLAY
   - Tabelle integrazione componenti
   - Lifecycle entity
   - Checklist Fase 19

3. **ECS_IMPLEMENTATION_GUIDE.md** (nuovo)
   - Guida pratica EnTT per dev C++
   - 9 sezioni: Componenti, Registry, Systems, Patterns, Performance, Hot-reload, Mistakes, Testing, Integration

4. **REACT_WASM_PATTERN.md** (nuovo)
   - Quick reference buffering model
   - Timing diagram (corretto vs sbagliato)
   - Checklist implementazione
   - Anti-pattern da evitare
   - FAQ

---

## 🎯 Cosa Fare Adesso

### Se sei uno sviluppatore React

1. **Leggi priorità 1**: `docs/REACT_WASM_PATTERN.md` (10 min)
2. **Leggi priorità 2**: `docs/TECHNICAL_OVERVIEW.md` §5.5 (15 min)
3. **Implementazione**: Fase 19 (vedi checklist in REACT_WASM_PATTERN.md)

### Checklist Implementazione

- [ ] PreviewPanel: Rimuovi `useEditor()`, `useConsoleLogs()`
- [ ] wasm-bridge.ts: Setup buffer globali prima di carica game.js
- [ ] ConsolePanel: Polling `window._consoleLogs` ogni 100ms
- [ ] InspectorPanel: Polling `window._selectedEntity` ogni 200ms
- [ ] Test: Coin pickup — verifica NO flash (bordo non scompare)

### Se sei uno sviluppatore C++

1. **Architettura ECS (CRITICO)**:
   - Leggi: `docs/TECHNICAL_OVERVIEW.md` §3.5 "Entity Component System"
   - Leggi: `docs/ECS_IMPLEMENTATION_GUIDE.md` (nuovo)
   - Key point: EnTT registry, components sono struct pure, systems iterano view

2. **Callback WASM**:
   - Leggi: `docs/TECHNICAL_OVERVIEW.md` §5.5 (consapevolezza pattern React)
   - Non toccare: Callback scrivono in buffer globale, non direttamente React
   - Assicurati: `onConsoleLine()`, `onEntitySelected()`, `onEntityTransformChanged()` vengono chiamati normalmente nel game loop

3. **Integrazione Fase 19**:
   - EditorLoadProject deve ricaricare scene + entity correttamente
   - Lua hot-reload deve preservare/resettare state controllabilmente
   - Vedi checkpoint in `docs/TECHNICAL_OVERVIEW.md` Fase 19

---

## 🔬 Confronto Architetture

| Aspetto | VECCHIO | NUOVO |
|---------|--------|-------|
| **Callback timing** | Real-time dispatch() | Buffer globale |
| **PreviewPanel state** | Subscriber volatile context | ZERO state subs |
| **Re-render frequency** | 60+ al secondo | 0 durante gameplay |
| **Console update** | Real-time (60Hz) | Poll ogni 100ms |
| **Selection update** | Real-time (60Hz) | Poll ogni 200ms |
| **Flash visibile** | ❌ Sì (bordo scompare) | ✅ No |
| **Latenza UI** | 0ms (ma causa glitch) | ~100ms (invisibile) |

---

## 📊 Dettagli Tecnici

### Buffer Model

```typescript
// C++ callbacks → Buffer (no React)
window._consoleLogs = []
window._selectedEntity = null
window._transforms = {}

// React → setInterval polling
setInterval(() => {
  if (window._consoleLogs?.length) {
    setLogs(prev => [...prev, ...window._consoleLogs])
    window._consoleLogs = []
  }
}, 100)  // Ogni 100ms, decoupled da 60Hz game loop
```

### Performance Impact

- **Game loop**: 0% overhead (buffer write = array push = O(1))
- **React polling**: negligibile (5–10 interval callbacks al secondo, non 60)
- **Memory**: ~1KB per buffer (non cresce)
- **Latency**: +100ms per UI update (invisibile all'utente)

---

## ❓ Domande Frequenti

**D: Ma il console.log in tempo reale non è importante?**  
R: Nì. Importante è che sia *disponibile*. Poll ogni 100ms è abbastanza rapido — l'utente non vede il delay.

**D: E se durante il gameplay mi serve aggiornare l'Inspector in tempo reale?**  
R: Raro. Gameplay è autosufficiente in C++. Inspector è per editing, che è lento (click → change → poll).

**D: Posso ignorare il pattern e usare `setTimeout(0)` come prima?**  
R: No. `setTimeout(0)` non basta — React state update entra comunque in contesa col rAF.

**D: Chi controlla che il pattern sia applicato?**  
R: Code review. Se vedi `dispatch()` dentro `window.onConsoleLine`, è sbagliato — respingi il PR.

---

## 🚀 Timeline

- **2026-05-10**: Documentazione distribuita ← Sei qui
- **2026-05-11–12**: Implementazione Fase 19
- **2026-05-13**: Test + fix flash
- **2026-05-14**: Code review + merge

---

## 📞 Supporto

- Domande tecniche: Vedi `docs/REACT_WASM_PATTERN.md` §FAQ
- Domande architetturali: Vedi `docs/TECHNICAL_OVERVIEW.md` §5.5
- Discussioni team: [Discord / Slack / etc.]

---

## 📎 File Correlati

**Documentazione Principale**:
- `docs/ARCHITECTURAL_RATIONALE.md` (⭐ LEGGI PRIMA) — Perché queste decisioni (ECS, Canvas, Memory, Hot-reload, Audio)
- `docs/TECHNICAL_OVERVIEW.md` (v2.2) — Architettura completa (ECS + Moduli + React)
- `docs/ARCHITECTURE_INTEGRATION.md` — Come tutto si integra end-to-end
- `docs/REACT_WASM_PATTERN.md` — Pattern buffering per dev React
- `docs/ECS_IMPLEMENTATION_GUIDE.md` — Guida pratica EnTT per dev C++
- `docs/COLLABORATORS_UPDATE.md` (questo file) — Distribuzione team

**Codice React** (Fase 19):
- `editor/src/utils/wasm-bridge.ts` — Bridge (da aggiornare con buffering)
- `editor/src/panels/PreviewPanel.tsx` — Canvas (da fare scatola nera)
- `editor/src/panels/ConsolePanel.tsx` — Console (da fare polling)
- `editor/src/panels/InspectorPanel.tsx` — Inspector (da fare polling)

**Codice C++** (Supporto):
- `runtime-cpp/src/core/components.h` — Component definitions
- `runtime-cpp/src/world/world.h` — World/Registry wrapper
- `runtime-cpp/src/app/app.cpp` — Game loop (Systems execution)

---

**Distribuzione**: Tutti i collaboratori React + C++ (per consapevolezza)  
**Azione Richiesta**: Leggi, fai domande, implementa in Fase 19

*Fine comunicato.*
