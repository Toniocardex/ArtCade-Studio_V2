# RmlUi Migration Contract

Questo documento e' il contratto di migrazione dall'editor React al nuovo editor
nativo RmlUi. Il suo scopo e' impedire che la complessita' del vecchio editor
venga semplicemente trasportata in C++.

## Regola di precedenza

Quando una feature React esistente entra in conflitto con questo contratto,
vince questo contratto.

La migrazione non deve preservare automaticamente orchestratori, sync, bridge,
stato duplicato o percorsi indiretti solo perche' esistono gia' nella versione
React. Se una feature React richiede piu' fonti di verita' o piu' entry point per
una singola operazione, va semplificata durante il porting.

## Autorita'

`ProjectDocument` e' l'unica autorita' persistente del progetto:

- scene salvate;
- entity e istanze;
- componenti;
- asset reference;
- Logic Board;
- dati che finiscono nel salvataggio.

Deve contenere la scena iniziale del gioco, non la scena aperta nell'editor.
Nel `ProjectDoc` legacy questo dato puo' ancora chiamarsi `activeSceneId`; nel
contratto di migrazione va trattato come `startSceneId`.

`EditorState` e' l'autorita' del workspace editoriale:

- selezione corrente;
- scena aperta nell'editor;
- tool attivo.

`EditorUiState` e' l'autorita' del layout e dei filtri UI:

- dimensioni splitter;
- pannelli aperti;
- filtri;
- sezioni espanse.

RmlUi possiede solo presentazione e stato visuale locale:

- hover;
- focus;
- buffer temporanei dei controlli;
- menu aperti;
- sezioni espanse;
- drag temporanei.

Il runtime in Edit Mode e' derivato, opzionale e ricostruibile. Non e' mai la
fonte authoring.

`PlaySession` e' stato runtime mutabile. Nasce da una fotografia del documento
e puo' mutare liberamente:

```text
Play Project
-> ProjectDocument.startSceneId
-> PlaySession

Play Current Scene
-> EditorState.activeSceneId
-> PlaySession

Stop
-> distrugge PlaySession
-> ProjectDocument rimane intatto
```

`SceneFrameSnapshot` e' stato immutabile consumato dal renderer:

```text
ProjectDocument / PlaySession
-> Presentation
-> SceneFrameSnapshot
-> Renderer
```

Queste quattro autorita' devono essere separate prima di portare Inspector,
Hierarchy e Logic Board:

```text
ProjectDocument   dati persistenti del progetto
EditorState       stato del workspace condiviso
EditorUiState     layout e filtri UI
PlaySession       stato runtime mutabile
SceneFrameSnapshot stato immutabile per il renderer
```

## Direzione delle dipendenze

La direzione ammessa e':

```text
UI
-> Application
-> Authoring / Runtime
-> Presentation
-> Rendering / Platform
```

Mai il contrario.

Esempi ammessi:

- RmlUi conosce `EditorCoordinator`.
- `EditorCoordinator` conosce `ProjectDocument`.
- Renderer conosce `SceneFrameSnapshot`.

Esempi vietati:

- `ProjectDocument` conosce RmlUi.
- `SceneManager` conosce `InspectorPanel`.
- Renderer conosce `EditorCoordinator`.

## Command vs Intent

Se l'operazione deve comparire nel salvataggio o nell'undo, e' un
`EditorCommand`.

Esempi:

- `CreateEntityCommand`
- `DeleteEntityCommand`
- `RenameEntityCommand`
- `SetEntityPositionCommand`
- `SetSpriteCommand`
- `RenameSceneCommand`

Se l'operazione modifica solo il workspace condiviso, e' un `EditorIntent`.

Esempi:

- `SelectEntityIntent`
- `SelectSceneIntent`
- `PanSceneViewIntent`
- `SetSceneZoomIntent`
- `ResizePanelIntent`
- `SetHierarchyFilterIntent`

La UI puo' modificare stato visuale locale senza intent. Per esempio, la
digitazione in un `NumberField` resta nel controllo finche' non viene eseguito
il commit; il commit crea il command.

Regola definitiva per gli input RmlUi:

```text
input event
-> aggiorna soltanto il buffer locale del controllo

Enter o blur
-> valida e normalizza
-> confronta con il valore autorevole
-> esegue un Command solo se il valore e' valido e diverso

Escape
-> annulla il buffer
-> ripristina il valore autorevole
-> nessun Command

input incompleto o invalido
-> nessun Command
-> nessuna revision
-> nessun undo
-> nessuna invalidazione
```

`change` di RmlUi non equivale a una mutazione del dominio. E' il commit
applicativo, non la semplice modifica del testo, a costruire un `EditorCommand`.

Esempi numerici:

```text
"12."  -> commit valido come 12.0
"-"    -> incompleto
"."    -> incompleto
"1e"   -> incompleto
"nan"  -> invalido
"inf"  -> invalido
"12px" -> invalido
```

## Coordinator

`EditorCoordinator` e' un facade applicativo, non un monolite.

Puo' coordinare:

- `ProjectDocument`;
- `EditorState`;
- `CommandStack`;
- `PlaySession`;
- `RuntimeProjection`;
- `InvalidationSet`.

Non deve contenere:

- parsing del progetto;
- import asset;
- codice RmlUi;
- rendering;
- filesystem;
- implementazione dei singoli command;
- logica interna di ogni pannello.

Il coordinator espone il documento solo in lettura:

```cpp
const ProjectDocument& document() const;
```

Il `ProjectDocument` mutabile resta interno al command path. I pannelli e la UI
non devono poter chiamare direttamente metodi come `setInstancePosition()` o
`setSceneBackground()`.

## Risultati separati

Un command deve produrre due informazioni distinte:

```cpp
struct CommandResult {
    bool ok;
    DomainChange change;
    EditorInvalidation invalidation;
    std::string error;
};
```

`DomainChange` descrive cosa e' cambiato nel dominio. Serve alla projection
runtime, se esiste.

`EditorInvalidation` descrive cosa deve essere riletto dalla UI. Serve ai
pannelli e al viewport.

Esempi minimi di `DomainChange`:

- `ProjectReplaced`
- `SceneAdded`
- `SceneRemoved`
- `EntityAdded`
- `EntityRemoved`
- `EntityChanged`
- `AssetChanged`

Non introdurre event bus generale, stringhe dinamiche o sync service per
simulare questi cambiamenti.

Il risultato del command viene consumato dal coordinator e poi scartato. Nessun
subscriber, dispatcher o coda globale.

## Runtime e viewport

In Edit Mode preferire il percorso piu' diretto:

```text
ProjectDocument
-> SceneFrameSnapshot
-> Renderer
```

Per gli sprite del viewport Edit:

```text
AssetId
-> ImageAssetDef.sourcePath
-> TextureCache derivata
-> SceneFrameSprite
-> DrawTexturePro
```

`ProjectDocument` conserva solo dati authoring (`AssetId`, `sourcePath`,
metadata). Non conserva `Texture2D`, handle GPU, stato loaded/loading o
puntatori al renderer. `TextureCache` e' distruttibile e ricostruibile dal
catalogo asset, non e' persistita e deve essere svuotata prima della chiusura
del context Raylib/OpenGL.

Il renderer consuma `SceneFrameSnapshot` e `TextureCache`; non interroga
`ProjectDocument`, `EditorCoordinator`, pannelli o controlli RmlUi durante il
draw.

Usare una `RuntimeProjection` solo quando serve davvero. Se esiste, deve essere:

- unidirezionale;
- ricostruibile;
- non serializzata;
- non autorevole;
- aggiornata dallo stesso percorso dei command;
- mai modificata dalla UI.

In Play Mode:

```text
ProjectDocument
-> PlaySession indipendente
```

Edit e Play non condividono stato mutabile.

## Invalidazione pull-based

Il coordinator decide cosa e' invalido. I pannelli decidono come rappresentarlo.

Percorso corretto:

```text
Command / Intent
-> invalidation mirata
-> EditorUi consuma una volta
-> pannello legge query read-only
-> pannello aggiorna la propria rappresentazione
```

Percorso vietato:

```text
coordinator
-> setNameField()
-> setPositionX()
-> setPositionY()
-> rebuildHierarchy()
```

Niente refresh globale per frame. Niente polling dello stato authoring.

## Flussi canonici

Creazione entity:

```text
RmlUi click
-> CreateEntityCommand
-> ProjectDocument
-> DomainChange::EntityAdded
-> RuntimeProjection.patch(), se necessaria
-> Invalidation Hierarchy | Inspector | Viewport
```

Modifica posizione:

```text
commit input Inspector
-> SetEntityPositionCommand
-> ProjectDocument
-> DomainChange::EntityTransformChanged
-> RuntimeProjection.patch(), se necessaria
-> Invalidation Inspector | Viewport
```

Cambio scena editoriale:

```text
click scena
-> SelectSceneIntent
-> EditorState.activeSceneId
-> valida o azzera SelectionState
-> RuntimeProjection.selectScene(), se necessaria
-> Invalidation Hierarchy | Inspector | Viewport | Toolbar
```

## Checklist per ogni feature migrata

Ogni feature React portata in RmlUi deve dichiarare:

- Source of truth
- Command o Intent
- DomainChange
- EditorInvalidation
- Runtime effect
- Undo
- Test

Se non e' possibile compilare questa checklist in modo lineare, la feature non
va portata com'e'. Va prima semplificata.

Portare feature, non componenti React. Non fare porting meccanico:

```text
React Hierarchy -> RmlUi Hierarchy
React Inspector -> RmlUi Inspector
```

Portare invece casi d'uso:

- selezionare un'entita';
- rinominare un'entita';
- modificare un transform;
- creare una scena;
- eliminare una scena;
- assegnare uno sprite.

Ogni errore deve essere restituito, mostrabile, testabile e non silenzioso.

## Divieti

- Nessun JSON bridge nel normale editing.
- Nessun polling dello stato authoring.
- Nessun sync service.
- Nessuna runtime copy autorevole.
- Nessun coordinator monolitico.
- Nessun pannello come fonte di verita'.
- Nessun porting meccanico da React quando viola questo contratto.
