# Technical Debt Review - ArtCade V2

Data review: 2026-05-21

## Summary

Questa review fotografa il debito tecnico emerso durante l'integrazione recente di Scene Settings, viewport runtime, editor guides, toolbar, grid editor-only, fix bordo nero in edit mode e pulizia warning build.

Lo stato generale e buono: React GUI e runtime WASM sono rimasti separati, il canvas continua a essere una black box del runtime, il packaging/build e piu stabile, e la preview ora usa `worldSize`, `viewportSize`, pan e grid editor in modo piu reale.

Il debito piu importante non e grafico. Sta nel contratto di sincronizzazione editor-runtime: alcune modifiche passano da `editor_load_project`, altre da wrapper incrementali, e alcune modifiche dell'Inspector non arrivano ancora in preview finche non avviene un reload piu ampio.

## Findings Prioritari

### P1 - Drag entita resetta rotation/scale

**Area:** Runtime WASM / EditorAPI  
**File:** `runtime-cpp/src/modules/editor-api/src/editor-api.cpp`

Nel mouse-up del drag entita, il runtime notifica React con:

```cpp
notifyTransformChanged(s_selectedEntityId, finalX, finalY, 0.f, 1.f, 1.f);
```

Questo significa che un'entita gia ruotata o scalata puo perdere rotation/scale quando viene trascinata dal canvas. La posizione e corretta, ma i valori non modificati vengono sovrascritti da default.

**Impatto:**

- Possibile perdita dati nel ProjectDoc.
- Inspector e runtime possono divergere.
- Il bug e facile da attivare quando si usa lo scale nell'Inspector e poi si trascina dal canvas.

**Soluzione consigliata:**

- In `onMouseUp`, leggere l'entita corrente dal `RuntimeEntityGateway`.
- Notificare React con rotation e scale reali:
  - `ent->transform.rotation`
  - `ent->transform.scale.x`
  - `ent->transform.scale.y`
- Aggiungere test manuale:
  - impostare scale `3,1`;
  - trascinare dal canvas;
  - verificare che scale resti `3,1`.

**Priorita:** Alta. Da correggere prima di nuove feature editor.

### P1 - Tile painting puo smettere di persistere dopo rebind canvas

**Area:** Frontend WASM bridge / PreviewPanel  
**File:** `editor/src/panels/PreviewPanel.tsx`, `editor/src/utils/wasm-bridge.ts`

Quando si torna alla canvas view, `PreviewPanel` richiama `loadWasmRuntime` per ribindare il canvas. In quel secondo path vengono passate alcune callback, ma non `onTilemapPainted`.

Il bridge assegna comunque:

```ts
window.onTilemapPainted = cbs.onTilemapPainted
```

Se la callback manca, puo diventare `undefined`. Il runtime continua a dipingere internamente, ma React non riceve piu la cella dipinta e quindi il salvataggio del progetto puo perdere i cambi tilemap.

**Impatto:**

- Tile visibili in preview ma non persistiti nel ProjectDoc.
- Bug intermittente, legato a cambio view/tab/HMR/rebind.
- Difficile da diagnosticare per l'utente.

**Soluzione consigliata:**

- Centralizzare le callback WASM in un oggetto stabile.
- Garantire che ogni chiamata a `loadWasmRuntime` riceva sempre tutte le callback richieste.
- In alternativa, modificare `bindWindowCallbacks` per non sovrascrivere una callback esistente con `undefined`.

**Test consigliato:**

1. Aprire canvas.
2. Cambiare view o tab.
3. Tornare al canvas.
4. Dipingere un tile.
5. Salvare e riaprire.
6. Verificare che il tile sia ancora presente.

**Priorita:** Alta. Da correggere insieme al bug drag transform.

### P2 - Sync preview incompleto per modifiche Inspector

**Area:** Frontend runtime sync  
**File:** `editor/src/panels/PreviewPanel.tsx`

La sync verso WASM usa una chiave ridotta per evitare flood di `editor_load_project`. Attualmente include:

- project path/name;
- project version;
- active scene id;
- numero entita;
- numero scene;
- world/viewport size;
- struttura tilemap;
- sprite asset id.

Restano fuori diversi campi modificabili dall'Inspector:

- entity name;
- className;
- tags;
- transform non inviati via drag;
- sprite tint/alpha/renderOrder;
- componenti gameplay;
- sensor/collider/physics;
- altri campi component registry.

**Impatto:**

- Il ProjectDoc puo essere corretto, ma la preview runtime puo restare stale.
- L'utente puo credere che una modifica non funzioni, anche se e stata salvata nello stato React.
- Aumenta il rischio di fix ad hoc nel tempo.

**Soluzione consigliata MVP:**

- Creare una funzione `runtimeProjectFingerprint(project, activeSceneId)`.
- Includere nel fingerprint solo i campi runtime-affecting della scena attiva:
  - `activeSceneId`;
  - `worldSize`, `viewportSize`, `backgroundColor`;
  - `entityIds`;
  - per ogni entita nella scena: `id`, `className`, `tags`, `transform`, `sprite`, componenti runtime;
  - tilemap metadata e tileset reference;
  - assets/tilesets necessari.
- Continuare a escludere `tilemap.data` durante painting live per evitare flood.

**Soluzione migliore a medio termine:**

- Introdurre un `RuntimeSyncService` frontend con due strade:
  - full project load solo su open project / scene switch / structural changes;
  - API incrementali per modifiche frequenti o locali.
- API incrementali possibili:
  - `editor_update_entity(jsonPtr)`;
  - `editor_set_sprite(entityId, jsonPtr)`;
  - `editor_set_component(entityId, keyPtr, jsonPtr)`;
  - `editor_set_scene_settings(jsonPtr)`;

**Priorita:** Medio-alta. Necessaria prima di estendere molto l'Inspector.

### P2 - Click/drag puo marcare dirty anche senza cambio reale

**Area:** Editor store / EditorAPI callback  
**File:** `editor/src/store/editor-store.tsx`

`UPDATE_ENTITY_TRANSFORM` marca sempre `projectDirty = true`. Se il runtime notifica una transform identica, oppure se l'utente clicca senza muovere davvero l'entita, il progetto puo diventare `UNSAVED` senza una modifica reale.

**Impatto:**

- UX rumorosa.
- Difficile capire se ci sono cambi veri.
- Aumenta il rischio di salvataggi inutili.

**Soluzione consigliata:**

- Nel reducer, confrontare transform corrente e transform nuova.
- Se posizione, rotation e scale sono uguali entro una piccola epsilon, ritornare `state`.
- In `EditorAPI`, inviare callback transform solo se il drag ha prodotto movimento reale.

**Priorita:** Media.

### P3 - Encoding/mojibake in stringhe e commenti

**Area:** Docs/log/UI source  
**File esempio:** `editor/src-tauri/src/main.rs`

Restano caratteri corrotti come `âœ—`, `âœ“`, `â†’`, `â€”` in alcuni file. Alcuni sono solo commenti, altri possono finire in ConsolePanel.

**Impatto:**

- Console meno professionale.
- Possibili regressioni su Windows o shell non UTF-8.
- Difficolta a leggere codice e docs.

**Soluzione consigliata:**

- Per log runtime/build, usare ASCII:
  - `Failed`
  - `Created`
  - `->`
- Per docs, convertire correttamente a UTF-8 solo quando necessario.
- Aggiungere una scansione testuale periodica per sequenze mojibake note:
  - `â`
  - `Ã`
  - `�`

**Priorita:** Bassa-media. Non blocca feature, ma conviene pulire prima del prossimo commit pubblico.

## Debito Tecnico Per Area

### 1. Sync React -> WASM

**Stato attuale:**

Il sistema e ibrido:

- `editor_load_project` per sync ampio;
- wrapper mirati per mode, selection, transform, tool, guides, grid;
- callback globali `window.on*` per eventi C++ -> React.

**Debito:**

- Non esiste un punto unico che definisce quali cambi React devono arrivare al runtime.
- Il fingerprint e fragile e va aggiornato manualmente ogni volta che un campo diventa runtime-affecting.
- Le callback globali possono essere sovrascritte da rebind incompleti.

**Soluzione proposta:**

Creare `RuntimeSyncService` in frontend:

- possiede callback WASM stabili;
- calcola fingerprint runtime;
- decide full reload vs update incrementale;
- espone funzioni:
  - `syncProject(project, activeSceneId)`;
  - `syncMode(isPlaying)`;
  - `syncSelection(entityId)`;
  - `syncTool(tool)`;
  - `syncEditorGrid(size)`;
  - `syncTransform(entity)`.

**Beneficio:**

- Meno regressioni.
- Preview piu prevedibile.
- Meno logica dentro `PreviewPanel`.

### 2. PreviewPanel troppo responsabile

**Stato attuale:**

`PreviewPanel` gestisce:

- loading WASM;
- callback C++ -> React;
- sync progetto;
- asset upload;
- tool palette;
- editor guides state;
- snap-to-grid echo guard;
- rendering della canvas UI shell.

**Debito:**

- File grande e delicato.
- Cambi piccoli possono toccare piu responsabilita.
- Difficile testare senza montare l'intero pannello.

**Soluzione proposta:**

Estrarre:

- `useWasmRuntimeLifecycle`;
- `useRuntimeProjectSync`;
- `useRuntimeAssetUpload`;
- `CanvasToolbar`;
- `PreviewMetricsBadge`.

**Priorita:** Media. Da fare dopo i P1.

### 3. InspectorPanel in crescita

**Stato attuale:**

`InspectorPanel` contiene:

- componenti UI generici (`Field`, `NumberField`, `InspectorSection`);
- Scene Settings;
- Entity Settings;
- Transform/Sprite/Components/Script;
- component registry rendering;
- logica snap transform.

**Debito:**

- 500+ righe.
- Difficile mantenere UX coerente mentre crescono nuove sezioni.
- Alcuni controlli committano on-change, altri on-blur.

**Soluzione proposta:**

Estrarre moduli:

- `InspectorSection`;
- `SceneSettingsSection`;
- `EntitySettingsSection`;
- `TransformSection`;
- `SpriteSection`;
- `ComponentsSection`.

Standardizzare:

- numerici ad alta frequenza: commit on blur/Enter oppure debounce;
- checkbox/toggle: commit immediato;
- select: commit immediato.

**Priorita:** Media.

### 4. Editor store monolitico

**Stato attuale:**

`editor-store.tsx` contiene stato, azioni, reducer core, reducer volatile, sample project, helper e context provider.

**Debito:**

- 800+ righe.
- Azioni molto diverse nello stesso reducer.
- Ogni nuova feature aumenta il rischio di conflitti e regressioni.

**Soluzione proposta:**

Spezzare in reducer specializzati mantenendo lo stesso provider pubblico:

- `projectReducer`;
- `entityReducer`;
- `sceneReducer`;
- `tilemapReducer`;
- `assetReducer`;
- `logicBoardReducer`;
- `uiReducer`.

Il dispatch pubblico puo restare invariato.

**Priorita:** Medio-alta, ma da fare in passaggi piccoli.

### 5. EditorAPI C++ monolitico

**Stato attuale:**

`editor-api.cpp` gestisce:

- static state;
- JSON parsing;
- mouse input;
- tile painting;
- entity picking;
- EM_ASM callbacks;
- exported functions.

**Debito:**

- Logica input e parsing sono accoppiate.
- Difficile testare senza WASM.
- Commenti storici non sempre aggiornati.

**Soluzione proposta:**

Estrarre:

- `project-doc-parser.cpp`;
- `editor-input-controller.cpp`;
- `editor-callbacks.cpp`;
- lasciare in `editor-api.cpp` solo exports e wiring.

**Priorita:** Media, dopo stabilizzazione sync.

### 6. Renderer e camera policy

**Stato attuale:**

Il renderer usa zoom uniforme `min(sx, sy)`, camera top-left e clamp sul world. Il backdrop editor risolve il bordo nero in edit mode senza cambiare runtime/play.

**Debito:**

- Non esiste ancora una policy esplicita per output finale:
  - fit;
  - fill/crop;
  - letterbox;
  - stretch.
- Il comportamento play e quello editor potrebbero divergere senza una UI che lo spieghi.

**Soluzione proposta:**

In futuro aggiungere `Output Policy` in Project Settings, non in Scene Settings:

- `fit` default;
- `fill`;
- `letterbox`;
- `stretch` solo se esplicitamente voluto.

Per ora lasciare il runtime/play invariato.

**Priorita:** Bassa ora, media quando si lavora su export finale.

### 7. Tauri build pipeline

**Stato attuale:**

Il backend Tauri costruisce uno script `.cmd`, chiama VS DevCmd, CMake, build e packer. I log arrivano a ConsolePanel via `build-log`. I warning CMake vendor vengono filtrati.

**Debito:**

- Log filter non testato.
- Path Visual Studio hardcoded.
- Build script temporaneo scritto in `build-msvc`.
- Solo NMake/VS BuildTools, niente fallback Ninja se disponibile.

**Soluzione proposta:**

- Test unitario Rust per `BuildLogFilter`.
- Resolver toolchain:
  - provare VS DevCmd noto;
  - provare `vswhere`;
  - fallback Ninja se configurato.
- Rendere piu esplicito in console quale toolchain e stata scelta.

**Priorita:** Media per DX, bassa per runtime.

### 8. Asset pipeline e texture upload

**Stato attuale:**

Gli asset immagine vengono registrati nel runtime WASM con `editor_register_image`. La chiave cache frontend e `path + dataUrl/file`.

**Debito:**

- Non c'e invalidazione robusta se un file esterno cambia ma path resta uguale.
- Il runtime non ha ancora una strategia completa per reload/evict texture.
- Gli asset embedded vs filesystem sono trattati in modo diverso.

**Soluzione proposta:**

- Aggiungere fingerprint basato su size/mtime/hash quando disponibile.
- API runtime per replace texture gia registrata.
- Validazione packer: asset referenziati da sprite/tileset devono esistere.

**Priorita:** Media.

## Ordine Di Intervento Consigliato

1. **Fix drag transform preserving rotation/scale.**
2. **Fix callback `onTilemapPainted` stabile dopo rebind WASM.**
3. **Aggiungere equality guard per `UPDATE_ENTITY_TRANSFORM`.**
4. **Pulizia encoding log utente (`âœ—`, `âœ“`, frecce rotte).**
5. **Introdurre `RuntimeSyncService` frontend.**
6. **Ampliare fingerprint runtime o introdurre update incrementali per Inspector.**
7. **Spezzare `PreviewPanel` e `InspectorPanel`.**
8. **Spezzare `editor-store.tsx` in reducer dedicati.**
9. **Spezzare `editor-api.cpp` in parser/input/callback/export.**
10. **Aggiungere test Rust per build log filter.**

## Checklist Di Accettazione Per Le Prossime Fix

### Drag transform

- Entita con scale diversa da `1,1` resta scalata dopo drag canvas.
- Entita ruotata resta ruotata dopo drag canvas.
- Inspector e preview mostrano gli stessi valori.
- Nessun echo loop React/WASM.

### Tile painting persistence

- Dipingere tile dopo cambio tab/view aggiorna React.
- Salvare e riaprire mantiene i tile.
- Il callback `onTilemapPainted` non viene mai sovrascritto con `undefined`.

### Runtime sync

- Cambiare sprite tint/alpha aggiorna preview o viene esplicitamente rimandato.
- Cambiare componenti gameplay aggiorna preview quando il runtime li usa.
- Cambiare className/tags aggiorna pool/collisioni runtime se rilevante.

## Note Finali

Il debito e gestibile, ma sta entrando nella fase in cui nuove feature sull'Inspector o sul runtime rischiano regressioni se non si stabilizza prima il layer di sync.

La raccomandazione pratica e non fare un grande refactor immediato. Conviene prima correggere i due bug P1, poi introdurre una piccola astrazione di sync frontend. Solo dopo ha senso spezzare i file grandi.

