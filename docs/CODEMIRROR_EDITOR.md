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

## File

| File | Ruolo |
|------|--------|
| `editor/codemirror-frame.html` | Entry HTML iframe (Vite MPA) |
| `editor/src/codemirror-frame/main.tsx` | Editor React nel frame |
| `editor/src/codemirror-frame/frame.css` | Solo reset minimale (no Tailwind) |
| `editor/src/codemirror-frame/protocol.ts` | Tipi postMessage |
| `editor/src/components/EngineScriptEditor.tsx` | Host iframe |
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
3. `UPDATE_SCRIPT` da sorgente esterna (non digitazione iframe) → `update-from-logic` (anti-loop via `lastSyncedRef`).

## Riferimenti

- [`REACT_WASM_PATTERN.md`](REACT_WASM_PATTERN.md)
