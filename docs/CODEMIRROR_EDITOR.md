# Script Editor - CodeMirror 6 (iframe)

> **Versione:** 2.1 - **Data:** 2026-06-13

CodeMirror gira in un documento isolato (`codemirror-frame.html`) dentro un
`iframe`, quindi gli stili dell'app non interferiscono con layout e syntax
highlighting.

## Architettura

```text
ScriptEditorPanel
  -> EngineScriptEditor (host React)
     -> codemirror-frame.html
        -> codemirror-frame/main.tsx
```

La comunicazione usa `postMessage` e i tipi in
`editor/src/codemirror-frame/protocol.ts`.

| Messaggio parent -> frame | Effetto |
|---|---|
| `init` | Carica testo, tema e stato read-only |
| `set-theme` | Cambia tema CodeMirror |
| `set-read-only` | Aggiorna `EditorState.readOnly` e `EditorView.editable` |
| `update-from-logic` | Aggiorna il documento virtuale senza remount |

Ricerca, selezione e copia restano disponibili nelle viste read-only.

## Viste main.lua

`main.lua` espone tre viste nello Script Editor:

- **My Script**: file reale, modificabile, con dirty state e salvataggio normale.
- **Logic Board**: Lua generato virtuale, read-only.
- **Combined Preview**: sorgente eseguito da preview e build, read-only.

Gli script associati agli oggetti restano normali file modificabili.
`activeScriptPath` rappresenta soltanto file reali; le viste generate non sono
salvate nel progetto.

## Composizione runtime

`composeProjectLua()` costruisce un'unica sorgente eseguibile:

1. definizione, cleanup e inizializzazione del modulo Logic Board;
2. esecuzione di My Script;
3. bootstrap ArtCade, con tick della Board prima del tick manuale.

La Logic Board non scrive mai in `main.lua`. Apply, Play, preview, build e pack
usano il sorgente combinato. Save e Save As persistono soltanto My Script.

Durante hot reload, il modulo precedente esegue `dispose()` prima della nuova
inizializzazione. Se tutte le Board vengono eliminate, il compositore rimuove
gli handler generati e lascia attivo soltanto il tick manuale.

## File principali

| File | Ruolo |
|---|---|
| `editor/codemirror-frame.html` | Entry HTML iframe |
| `editor/src/codemirror-frame/main.tsx` | CodeMirror nel frame |
| `editor/src/codemirror-frame/protocol.ts` | Contratto postMessage |
| `editor/src/components/EngineScriptEditor.tsx` | Host iframe |
| `editor/src/panels/ScriptEditorPanel.tsx` | Selettore delle tre viste |
| `editor/src/utils/project-lua-composer.ts` | Compositore Lua centrale |
| `editor/src/utils/logic-board-project-flow.ts` | Navigazione Board -> Combined Preview |

## Verifica

1. My Script resta modificabile e mantiene il proprio dirty state.
2. Logic Board e Combined Preview non accettano modifiche o salvataggi file.
3. Combined Preview si aggiorna dopo modifiche visuali o manuali.
4. Open Combined Preview dalla Logic Board carica prima il buffer manuale.
5. Apply e hot reload non modificano il contenuto di `main.lua`.

## Riferimenti

- [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md)
- [`REACT_WASM_PATTERN.md`](REACT_WASM_PATTERN.md)
