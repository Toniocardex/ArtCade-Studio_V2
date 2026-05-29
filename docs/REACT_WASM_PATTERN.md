# ArtCade V2 — React ↔ WASM Decoupling Pattern

> **Criticità**: ALTA — Il flash durante gameplay è causato dalla violazione di questo pattern.  
> **Versione**: 1.0  
> **Data**: 2026-05-10  
> **Autori**: Antonio Cardelli + Claude

---

## TL;DR — La Regola Aurea

**PreviewPanel è una scatola nera che vive autonomamente nel WASM.  
React non la tocca durante gameplay. C++ callbacks scrivono in buffer globali.  
React legge i buffer asincrono (polling ogni 100–200ms), mai real-time.**

---

## Problema

Quando il coin viene raccolto, il C++ chiama `window.onConsoleLine()` e `window.onEntitySelected()` durante il game loop (rAF callback di Emscripten).

Se React dispatch immediato, succede:

```
60Hz game loop (Emscripten rAF)
  │
  ├─ C++ luaHost->tick()
  │  └─ Lua destroyEntity(coin)
  │     └─ EM_ASM { window.onConsoleLine("coin collected") }
  │        └─ dispatch({ type: 'LOG' })  ← React dispatch QUI
  │           └─ React reconciliation  ← Durante il rAF!
  │              └─ Browser ha perso il controllo
  │
  └─ WebGL endFrame()  ← mentre React sta updatando il DOM

Result: Frame incompleto = Bordo scompare per 1 frame
```

**La causa è che React reconciliation e WebGL rendering entrano in contesa per il frame.**

---

## Soluzione: Buffering Model

### Fase 1: C++ Callbacks Scrivono in Buffer (Non Dispatch)

```typescript
export function loadWasmRuntime(canvas, gameSrc, _cbs) {
  // Setup buffer globali
  window._consoleLogs = []
  window._selectedEntity = null
  window._transforms = {}
  
  // C++ → Buffer (zero React)
  window.onConsoleLine = (msg, level) => {
    window._consoleLogs.push({ msg, level, time: Date.now() })
  }
  
  window.onEntitySelected = (entityId) => {
    window._selectedEntity = entityId
  }
  
  window.onEntityTransformChanged = (id, x, y, rot, sx, sy) => {
    window._transforms[id] = { x, y, rot, sx, sy }
  }
  
  // Carica WASM (game loop corre autonomamente)
  const script = document.createElement('script')
  script.src = `${gameSrc}?v=${Date.now()}`
  script.async = true
  document.body.appendChild(script)
}
```

### Fase 2: React Legge Asincrono (Polling)

```typescript
// PreviewPanel — Scatola nera
function PreviewPanel() {
  const canvasRef = useRef(null)
  const [wasmReady, setWasmReady] = useState(false)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    loadWasmRuntime(canvas, WASM_RUNTIME_SRC, {
      onReady: () => setWasmReady(true)  // Solo questa callback!
    })
  }, [])
  
  // ⚠️ IMPORTANTE: Non sottoscrivi consoleLogs o selection
  // Lasciali nel buffer globale
  
  return (
    <div className="border border-[#1A253A]">
      <canvas ref={canvasRef} id="artcade-canvas" />
    </div>
  )
}

// ConsolePanel — Drena il buffer ogni 100ms
function ConsolePanel() {
  const [logs, setLogs] = useState([])
  
  useEffect(() => {
    const interval = setInterval(() => {
      if (window._consoleLogs?.length) {
        setLogs(prev => [...prev, ...window._consoleLogs])
        window._consoleLogs = []  // Drain
      }
    }, 100)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="console">
      {logs.map(log => (
        <div key={log.time} className={`level-${log.level}`}>
          {log.msg}
        </div>
      ))}
    </div>
  )
}

// InspectorPanel — Legge selection ogni 200ms
function InspectorPanel() {
  const [selectedId, setSelectedId] = useState(null)
  
  useEffect(() => {
    const interval = setInterval(() => {
      const current = window._selectedEntity ?? null
      if (current !== selectedId) {
        setSelectedId(current)
      }
    }, 200)
    
    return () => clearInterval(interval)
  }, [selectedId])
  
  if (selectedId === null) {
    return <div>No selection</div>
  }
  
  return (
    <div className="inspector">
      <p>Entity: {selectedId}</p>
      <p>Transform: {JSON.stringify(window._transforms[selectedId])}</p>
      {/* ... */}
    </div>
  )
}
```

### Fase 3: React Comandi Imperativi (Verso C++)

```typescript
// Quando l'utente cambia le proprietà nell'Inspector, inviare al C++
function handleTransformChange(entityId, x, y, rot, sx, sy) {
  // Imperativo: React → C++
  window.Module.ccall(
    'editor_set_transform',
    null,
    ['number', 'number', 'number', 'number', 'number', 'number'],
    [entityId, x, y, rot, sx, sy]
  )
}

// Quando l'utente clicca PLAY
function handlePlayClick() {
  window.Module.ccall('editor_set_mode', null, ['number'], [1])
}

// Quando l'utente apre un nuovo progetto
function handleLoadProject(projectJson) {
  // Async OK — non entra nel game loop, è un comando separato
  window.Module.ccall(
    'editor_load_project',
    null,
    ['number'],  // Viene passato un pointer (malloc)
    [marshalString(projectJson)]
  )
}
```

---

## Timing Diagram

```
CORRETTO (Buffering Model):

Game Loop (60Hz) ──────────────────────────────────────────────
│ onConsoleLine("coin") → window._consoleLogs.push(...)  │
│ onEntitySelected(null) → window._selectedEntity = null │
│ [WebGL render — 100% React-free]                      │
└──────────────────────────────────────────────────────────

React Poll Thread (ogni 100ms) ──────────────────────
│ Check window._consoleLogs → setLogs()  │
│ Check window._selectedEntity → setSelectedId()  │
│ ConsolePanel re-render                 │
│ InspectorPanel re-render               │
└────────────────────────────────────────

PreviewPanel: ZERO re-render durante gameplay ✅
```

```
SBAGLIATO (Real-time Dispatch):

Game Loop (60Hz) ──────────────────────────────────────────────
│ onConsoleLine() → dispatch(LOG)  │
│   └─ React reconciliation ← DURANTE IL RAF!  │
│ [WebGL endFrame() — contesa con React]  │
│ Frame incompleto — Bordo scompare ❌  │
└──────────────────────────────────────────────────────────

PreviewPanel: 60+ re-render al secondo ❌
```

---

## Checklist di Implementazione

- [ ] **wasm-bridge.ts**: Buffer globali impostati PRIMA di caricare game.js
- [ ] **PreviewPanel.tsx**: Zero useContext di state volatile, solo canvas
- [ ] **ConsolePanel.tsx**: Polling `window._consoleLogs` ogni 100ms
- [ ] **InspectorPanel.tsx**: Polling `window._selectedEntity` ogni 200ms
- [ ] **Comandi React→C++**: editorSetMode, editorLoadProject via ccall (imperative)
- [ ] **Test**: Coin pickup — verifica che il bordo NON scompaia (nessun flash)
- [ ] **Documenti**: Team aggiornato su questo pattern (vedi TECHNICAL_OVERVIEW.md §5.5)

---

## Anti-Pattern (Da EVITARE)

❌ **Non fare questo:**

```typescript
// Sbagliato
window.onConsoleLine = (msg, level) => {
  setTimeout(() => dispatch({ type: 'LOG', ... }), 0)
  // Even setTimeout(0) non basta — React state update entra
  // in contesa con il rAF
}

// Sbagliato
function PreviewPanel() {
  const { state, dispatch } = useEditor()  // Subscriber volatile
  // PreviewPanel re-rende su OGNI LOG
  return <canvas />
}

// Sbagliato
function ConsolePanel() {
  const { consoleLogs } = useConsoleLogs()  // Subscriber volatile
  // ConsolePanel re-rende 60+ volte al secondo
  return <div>{consoleLogs.map(...)}</div>
}
```

✅ **Fare questo:**

```typescript
// Corretto
window.onConsoleLine = (msg, level) => {
  window._consoleLogs.push({ msg, level })  // Solo buffer, zero React
}

// Corretto
function PreviewPanel() {
  // Zero context subscription — vive autonomamente
  return <canvas ref={canvasRef} />  // Never re-render
}

// Corretto
function ConsolePanel() {
  const [logs, setLogs] = useState([])
  useEffect(() => {
    const iv = setInterval(() => {
      if (window._consoleLogs?.length) {
        setLogs(p => [...p, ...window._consoleLogs])
        window._consoleLogs = []
      }
    }, 100)  // Polling lento, decoupled da 60Hz
    return () => clearInterval(iv)
  }, [])
  return <div>{logs.map(...)}</div>
}
```

---

## FAQ

**D: Perché non usare `requestAnimationFrame` al contrario (React poll usando rAF)?**  
R: Perché rAF è unavailable in React thread. Polling con `setInterval` è la soluzione semplice, affidabile, decoupled.

**D: E se la UI deve essere super real-time (tipo 60fps selection feedback)?**  
R: Non è necessario. User interaction (click inspector) è lento (~100ms latenza percepita). Polling ogni 100ms è invisibile.

**D: Cosa succede se dimentico di drainare il buffer?**  
R: Il buffer cresce infinitamente e consuma RAM. Sempre fare `window._consoleLogs = []` dopo `setLogs()`.

**D: E se onConsoleLine viene chiamato durante PreviewPanel un-mount?**  
R: Buffer esiste nel window object globale — sopravvive. Nessun problema se nessuno lo legge. OK.

**D: Posso usare una coda (queue) anzichè array?**  
R: Sì, ma array + drain è più semplice. Implementa con `const q = []; q.push(...); [...q]; q.length = 0`.

---

## Scene asset upload (editor preview)

Preview textures and sounds are **not** bundled in `project.json`. After `editor_load_project`,
`AssetOrchestrator` uploads scene images, Logic Board audio paths, and all project fonts via
`editor_register_image` / `editor_register_audio` / `editor_register_font`.
Other scenes prefetch on `requestIdleCallback`. Hot-reload on disk changes re-registers the same
path key and logs `[Asset] Reloaded: …` to the console. All WASM calls go through `wasm-bridge.ts`;
panels use `runtime-sync-service` + `performRuntimeSceneAssetSync`, not direct `editor_*` from UI code.

---

## Riferimenti

- **TECHNICAL_OVERVIEW.md** — §2 Architettura generale, §5.5 React-WASM Decoupling Pattern
- **ASSET_PIPELINE_ARCHITECTURE.md** — scene collector, orchestrator, export, hot-reload
- **wasm-bridge.ts** — Implementazione del pattern (Fase 19)
- **PreviewPanel.tsx, ConsolePanel.tsx, InspectorPanel.tsx** — Applicazione del pattern

---

*Este documento serve da reference implementativa per il team. In caso di dubbi, consultare TECHNICAL_OVERVIEW.md §5.5.*
