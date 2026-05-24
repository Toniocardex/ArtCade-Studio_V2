# Editor Script — CodeMirror 6 (iframe)

> **Versione:** 2.0 · **Data:** 2026-05-20

CodeMirror gira in un **documento isolato** (`codemirror-frame.html`) dentro un `<iframe>`, così Tailwind e `index.css` dell’app non toccano il layout né l’highlighting.

## Architettura

```
ScriptEditorPanel
  └── EngineScriptEditor (host React)
        └── <iframe src="./codemirror-frame.html">
              └── frame/main.tsx → @uiw/react-codemirror + Lua + tema ArtCade
```

Comunicazione: `postMessage` (`src/codemirror-frame/protocol.ts`).

| Messaggio (parent → frame) | Effetto |
|---------------------------|---------|
| `init` | Carica testo + tema |
| `set-theme` | Cambia `artcade-dark` / `artcade-light` |
| `update-from-logic` | Aggiorna testo dallo store (Logic Board, reload) senza remount iframe |

| Messaggio (frame → parent) | Effetto |
|---------------------------|---------|
| `ready` | Frame pronto, parent invia `init` |
| `change` | Testo modificato → store |

## Sync Logic Board → script (non toccare senza test)

Flusso **unidirezionale** (board → Lua testo; parsing Lua → board non è v1):

```
LogicBoardPanel (store LOGIC_*)
  → compileLogicBoard(project.logicBoards)
  → syncLogicBoardToScript()  (utils/sync-logic-board-script.ts)
       → UPDATE_SCRIPT nello store
       → EngineScriptEditor: postMessage update-from-logic
  → Apply: editorReloadScript(lua) sul WASM
```

- `LogicBoardPanel`: `useEffect` su revisione `logicBoards` + `handleApply` chiama sync prima del reload.
- `lastSyncedRef` in `EngineScriptEditor` evita loop quando l’iframe emette `change` dopo un push esterno.
- **Non implementato (v1):** parsing Lua → ricostruzione blocchi Logic Board.

## File

| File | Ruolo |
|------|--------|
| `editor/codemirror-frame.html` | Entry HTML iframe (Vite MPA) |
| `editor/src/codemirror-frame/main.tsx` | Editor React nel frame |
| `editor/src/codemirror-frame/frame.css` | Solo reset minimale (no Tailwind) |
| `editor/src/codemirror-frame/protocol.ts` | Tipi postMessage |
| `editor/src/components/EngineScriptEditor.tsx` | Host iframe |
| `editor/src/utils/sync-logic-board-script.ts` | Compila board → `UPDATE_SCRIPT` |
| `editor/src/codemirror/*.ts` | Lua, tema, autocomplete (condivisi col frame) |

## Build

`vite.config.ts` — `rollupOptions.input` include `codemirror-frame.html`.

```bash
cd editor && npm run build && npm run tauri:build
```

Output: `dist/index.html` + `dist/codemirror-frame.html` (+ chunk JS dedicati).

## Verifica

1. `tauri:build` → Editor Script: righe allineate, syntax highlight Lua, tema dark/light.
2. Cambio tab script / tema app → iframe riceve `set-theme` o remount con `key={path}`.
3. Logic Board **Visual**: solo eventi; tab **Script**: anteprima Lua + main in store; **Apri in Editor Script** → modulo Script con tab bar; **Apply & hot-reload** aggiorna il runtime.
4. `UPDATE_SCRIPT` da sorgente esterna (non digitazione iframe) → `update-from-logic` (anti-loop via `lastSyncedRef`).

## Riferimenti

- [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md) — terminologia e UI target
- [`REACT_WASM_PATTERN.md`](REACT_WASM_PATTERN.md)
