# ArtCade Studio — UI Canvas & Logic Board (spec)

> Estratto da `ArtCade_specifica_ui_logic_board.docx` (cartella `Desktop/New_UI_artCade`).  
> **Prodotto:** **ArtCade Studio**. Nei mockup PNG/docx originali compare *PixelForge 2D* solo come placeholder grafico — non usare quel nome in UI, menu o documentazione.

**ArtCade Studio**

Specifica sintetica UI, Canvas e Logic Board per il refactor editor (2026).

Riferimenti visivi: `New_UI_canvas.png`, `New_UI_logicBoard.png`, `Trigger-action-struttura_UI.png` (stessa cartella Desktop).

| Area | Decisione consolidata |
| --- | --- |
| Stile UI | Flat professionale, monocromatico antracite/charcoal, senza neon, glow, ombre forti o estetica web-app/AI. |
| Layout base | Top toolbar 96 px, left column 280 px, center 920 px, right inspector 320 px, bottom dock 300 px, larghezza minima consigliata 1520 px. |
| Canvas | Viewport box ridimensionabile; render interno scalabile; camera frame 512 x 320 px visibile; zoom a step Fit/100/200/400/800%. |
| Logic Board | Rulesheet editor entity-based: ogni entita/oggetto ha il proprio rulesheet con eventi Trigger/Conditions/Actions. |
| Picker logico | Selettore gerarchico Category -> Subcategory -> Block; parametri sempre configurati nel Logic Inspector. |

## Indice

- 1. Visione generale e principi di design

- 2. Layout generale dell'editor

- 3. Canvas tab: viewport, camera frame, timeline e debug

- 4. Scene Layers e gestione layer

- 5. Logic Board: rulesheet per entita

- 6. Single Event Editor

- 7. Picker gerarchici Trigger / Condition / Action

- 8. Catalogo Trigger

- 9. Catalogo Conditions

- 10. Catalogo Actions

- 11. Target e scope: Self, Other, Scene, Global

- 12. Debug, Execution Trace e Variable Watch

- 13. Struttura dati consigliata

- 14. MVP consigliato

- 15. Checklist finale UI/UX

## 1. Visione generale e principi di design

L'editor ArtCade Studio è stato ragionato come un game engine 2D visuale, orientato a scena, oggetti, rulesheet e logica event-driven. La UI deve sembrare un software desktop professionale, non una web app vistosa o un render promozionale.

| Principio | Scelta |
| --- | --- |
| Stile visivo | Flat, sobrio, tecnico, leggibile. |
| Palette | Monocromatica su antracite, charcoal, graphite, dark gray, medium gray e testo off-white. |
| Da evitare | Neon, glow, bloom, ombre drammatiche, gradienti glossy, accenti saturi, estetica AI generativa. |
| Gerarchia | Contrasto minimo ma leggibile: selected row, active tab e focus state in grigi leggermente piu chiari. |
| Obiettivo UX | Struttura scalabile, densa ma ordinata, adatta a progetti reali con molte scene, eventi e assets. |

Canvas = costruzione scena
Logic Board = rulesheet editor dell'entita
Script Editor = codice Lua / scripting avanzato

## 2. Layout generale dell'editor

Il layout e stato definito con misure reali di riferimento, non come schermata casuale. La box centrale del Canvas o della Logic Board non rappresenta necessariamente la risoluzione del gioco: e un workspace editoriale ridimensionabile.

| Sezione | Dimensione proposta | Ruolo |
| --- | --- | --- |
| Top Menu + Toolbar | 96 px | Menu, comandi file, play controls, build, settings, layout selector. |
| Left Column | 280 px | Scene tree, assets, rulesheet browser, event list, variables, layers. |
| Center Workspace | 920 px | Canvas viewport o editor centrale della Logic Board. |
| Right Inspector | 320 px | Inspector oggetto, layer, blocco logico o parametri script. |
| Bottom Dock | 300 px | Timeline, debug console, execution trace, variable watch, event debugger. |
| Larghezza minima | 1520 px | 280 + 920 + 320 px, esclusi margini/annotazioni. |

Nota: Tutti gli splitter principali devono essere ridimensionabili: left/center, center/right e center/bottom dock.

## 3. Canvas tab: viewport, camera frame, timeline e debug

La Canvas tab e la modalita di costruzione della scena. Il Canvas contiene un workspace ampio, navigabile e zoomabile. Dentro il workspace si mostra il frame camera reale del gioco.

| Elemento | Decisione |
| --- | --- |
| Canvas viewport box | Default consigliato circa 920 x 560 px nel layout spec; resizable tramite splitter. |
| Render interno | Scalabile, centrato, con grid e snap. Non blocca la dimensione del pannello UI. |
| Camera frame | 512 x 320 px visibile dentro il viewport. Rappresenta cio che vede il giocatore. |
| Zoom | Non slider libero: controlli a step Fit, 100%, 200%, 400%, 800%. |
| Toolbar Canvas | Grid 16x16, snap, active layer, zoom step, fit/fullscreen. |
| Bottom area | Animation Timeline, Logic Board Preview, Debug Console, Event Debugger. |

Canvas Viewport = workspace editoriale
Camera View = 512 x 320 px
Zoom = Fit | 100% | 200% | 400% | 800%

### 3.1 Debug Console e Runtime Event Debugger

La console debug va nel Bottom Dock, non nell'Inspector. Ha bisogno di spazio orizzontale per log, warning, errori e trace runtime.

| Pannello | Contenuto |
| --- | --- |
| Debug Console | Log generali, Info/Warning/Error, Lua, Physics, Events, Clear, Copy, Export Log, Pause on Error. |
| Event Debugger | Last Executed Events, Variable Changes, breakpoint, trace evento, ultimo evento eseguito. |
| Logic Board Preview | Solo riepilogo rapido degli eventi del selected object, non editor completo. |

## 4. Scene Layers e gestione layer

I layer sono parte della struttura della scena. La creazione, l'ordinamento, la visibilita e il lock dei layer devono stare vicino alla Scene Tree, non nell'Inspector principale.

Left Column 280 px
Scene
  [Hierarchy] [Layers]
Assets

| Layer consigliato | Tipo | Order | Uso |
| --- | --- | --- | --- |
| Debug | Utility | 700 | Gizmo, collision box, path, trigger area, editor only. |
| UI | UI | 600 | HUD, menu, dialoghi, screen space. |
| Foreground | Sprite/Tilemap | 500 | Elementi davanti al player. |
| Gameplay | Object | 400 | Player, nemici, pickups, projectiles. |
| Collision | Collision | 300 | Hitbox, trigger e collisioni invisibili. |
| Platforms | Tilemap | 200 | Terreno, piattaforme, tile solide. |
| Background | Tilemap/Sprite | 100 | Fondale vicino e decorazioni. |
| Parallax Far | Parallax | 0 | Montagne, cielo, nuvole lontane. |

| Controllo layer | Funzione |
| --- | --- |
| Drag/reorder | Modifica ordine visivo. Piu alto = disegnato sopra. |
| Eye | Mostra/nasconde layer in editor. |
| Lock | Blocca modifiche e selezione. |
| Active layer | Layer usato per creare nuovi oggetti. |
| Solo | Mostra temporaneamente solo quel layer/gruppo. |
| Move selected here | Sposta oggetti selezionati nel layer scelto. |

Nota: Nell'Inspector dell'oggetto selezionato restano Layer, Order in Layer e Sorting Mode, ma la gestione completa dei layer appartiene al pannello Layers.

## 5. Logic Board: rulesheet per entita

La Logic Board non e globale per default. Ogni evento vive dentro il rulesheet dell'entita o oggetto selezionato. Questa e la decisione architetturale centrale.

Entity -> Rulesheet -> Events -> Trigger / Conditions / Actions

Player -> Player.rulesheet -> Jump -> Trigger / Conditions / Actions

| Concetto | Significato |
| --- | --- |
| Entity Rulesheet | Foglio logico associato a un oggetto: Player.rulesheet, Slime.rulesheet, Torch.rulesheet. |
| Scene Rulesheet | Logica di scena: musica, spawn globali, obiettivi, cambio livello. |
| Global Rulesheet | Logica globale o cross-scene. |
| Self | Oggetto proprietario del rulesheet corrente. In Player.rulesheet, Self = Player. |
| Other | Oggetto coinvolto in collisione/trigger/evento. |

### 5.1 Layout della Logic Board entity-based

| Area | Contenuto |
| --- | --- |
| Left Column | Rulesheet Browser, Player Events, Player Variables. |
| Center Workspace | Single Event Editor per l'evento selezionato. |
| Right Column | Logic Inspector del blocco selezionato. |
| Bottom Dock | Debug Console - Player.rulesheet, Execution Trace - Player.rulesheet, Variable Watch - Player. |

## 6. Single Event Editor

Il layout con card affiancate e scenografico, ma scala male. La soluzione pratica e mostrare a sinistra la lista eventi e al centro un solo evento selezionato.

Player.rulesheet
Attached Entity: Player      Object ID: player_001

Event Editor - Jump
Event Settings
Trigger
Conditions
Actions

| Sezione | Campi e comportamento |
| --- | --- |
| Event Settings | Name, Group, Enabled, Run While Paused, Comment. |
| Trigger | Un trigger principale: quando parte l'evento. Esempio: On Key Pressed: Space. |
| Conditions | Lista di condizioni; Logic Mode ALL/ANY/CUSTOM. |
| Actions | Lista ordinata e verticale; Execution Sequential; drag handle, numero, enabled toggle, menu. |
| View mode | Single Event come default; Event List e Compact Overview come viste alternative. |

### 6.1 Esempio evento Jump

Event Editor - Jump

Event Settings
Name: Jump
Group: Movement
Enabled: true
Run While Paused: false
Comment: Handles player jump

Trigger
On Key Pressed: Space
Input Source: Keyboard
Consume Input: false

Conditions
Logic Mode: ALL
1. Self.isGrounded == true
2. Self.canMove == true

Actions
Execution: Sequential
01 Add Force Y = -jumpForce
02 Set isGrounded = false
03 Play Animation = jump
04 Play Sound = jump.wav

## 7. Picker gerarchici Trigger / Condition / Action

Trigger, Condition e Action devono essere selezionati tramite lo stesso pattern gerarchico. Il picker sceglie il tipo di blocco; il Logic Inspector configura i parametri.

Category -> Subcategory -> Block -> Parameters in Inspector

| Picker | Domanda a cui risponde | Esempio |
| --- | --- | --- |
| Trigger Picker | Quando parte l'evento? | Input -> Keyboard -> On Key Pressed. |
| Condition Picker | L'evento puo essere eseguito? | Variable -> Compare Variable. |
| Action Picker | Cosa deve succedere? | Physics -> Add Force. |

### 7.1 UI del Trigger Picker

Add Trigger
Search trigger...

Category        Subcategory       Trigger
System          Keyboard          On Key Pressed
Input           Mouse             On Key Released
Object          Gamepad           Key Is Held
Collision                         Key Combo
Animation
Timer
Audio
Custom

Breadcrumb: Input > Keyboard
Description: Runs when a keyboard key is pressed.

Nota: Il drawer interno al center workspace puo occupare circa 300 px, lasciando il Single Event Editor a circa 620 px. L'Inspector destro resta sempre dedicato ai parametri del blocco selezionato.

## 8. Catalogo Trigger

| Categoria | Trigger disponibili |
| --- | --- |
| System | Every Tick, Every Fixed Tick, On Game Start, On Game Pause, On Game Resume, On Game Stop, On Window Focus, On Window Blur, On Resize, On Error |
| Scene | On Scene Load, On Scene Start, On Scene Ready, On Scene End, On Scene Unload, On Scene Paused, On Scene Resumed, On Object Added To Scene, On Object Removed From Scene, On Scene Variable Changed |
| Input > Keyboard | On Key Pressed, On Key Released, Key Is Held, Key Combo Pressed, Any Key Pressed, Text Input |
| Input > Mouse | On Left Click, On Right Click, On Middle Click, On Button Released, On Double Click, On Mouse Move, On Wheel Up, On Wheel Down, On Cursor Over Object, On Cursor Enter Object, On Cursor Exit Object, On Drag |
| Input > Gamepad | On Button Pressed, On Button Released, Button Is Held, On Axis Changed, On Stick Direction, On Trigger Pressed, On Gamepad Connected, On Gamepad Disconnected |
| Input > Touch | On Tap, On Double Tap, On Hold, On Swipe, On Pinch, On Drag, On Touch Start, On Touch Move, On Touch End |
| Object | On Created, On Initialized, On Enabled, On Disabled, On Destroyed, On Visible, On Hidden, On Position Changed, On Rotation Changed, On Scale Changed, On Variable Changed, On Tag Changed, On Layer Changed, On State Changed |
| Collision | On Collision Enter, On Collision Stay, On Collision Exit, On Trigger Enter, On Trigger Stay, On Trigger Exit, On Overlap Start, On Overlap End, On Raycast Hit |
| Physics | On Body Awake, On Body Sleep, On Grounded, On Ungrounded, On Velocity Changed, On Force Applied, On Impulse Applied, On Fall Start, On Landed, On Wall Contact |
| Animation | On Animation Start, On Animation Finished, On Animation Loop, On Frame Reached, On Frame Changed, On Animation Changed, On Animation Event |
| Timer | Every X Seconds, After Delay, On Timer Start, On Timer Tick, On Timer Finished, On Timer Cancelled, On Cooldown Finished |
| Camera | On Camera Enter, On Camera Exit, On Camera Follow Start, On Camera Follow End, On Zoom Changed, On Shake Finished, On Target Changed |
| Audio | On Sound Started, On Sound Finished, On Music Started, On Music Finished, On Channel Empty, On Audio Error |
| UI | On Button Click, On Button Hover, On Button Pressed, On Button Released, On Slider Changed, On Checkbox Changed, On Input Submit, On Menu Opened, On Menu Closed |
| Variables | On Variable Changed, On Variable Reached Value, On Variable Increased, On Variable Decreased, On Boolean Toggled |
| Collections | On Item Added, On Item Removed, On Item Changed, On Collection Empty, On Collection Full, On Item Count Changed |
| Save / Load | On Save Started, On Save Completed, On Save Failed, On Load Started, On Load Completed, On Load Failed |
| Custom | On Custom Event, On Signal Received, On EventBus Message, On Lua Callback, On Plugin Event |

## 9. Catalogo Conditions

| Categoria | Conditions disponibili |
| --- | --- |
| System | Game Is Running, Game Is Paused, Game State Is, Time Scale Equals, Platform Is, Window Has Focus, Debug Mode Is Enabled |
| Scene | Current Scene Is, Scene Variable Equals, Scene Has Object, Scene Has Tag, Object Count In Scene, Scene Is Loaded, Scene Is Transitioning |
| Input > Keyboard | Key Is Pressed, Key Is Held, Key Is Released, Key Combo Is Active, Any Key Is Pressed |
| Input > Mouse | Mouse Button Is Pressed, Cursor Is Over Object, Cursor Is Inside Area, Mouse Is Dragging, Wheel Direction Is |
| Input > Gamepad | Button Is Pressed, Button Is Held, Axis Value Compare, Stick Direction Is, Gamepad Is Connected |
| Object | Object Exists, Object Is Enabled, Object Is Visible, Object Is On Layer, Object Has Tag, Object Has Component, Object Is Moving, Object Is Facing Direction, Object Is Within Distance, Object Is Inside Camera, Object State Is |
| Variable | Compare Variable, Boolean Is True, Boolean Is False, Variable Exists, Variable Is Empty, Variable Is Not Empty, Value In Range, Value Changed, Value Increased, Value Decreased |
| Comparison | Compare Numbers, Compare Strings, Compare Boolean, Compare Vector, Compare Distance, Compare Angle, Compare Expression |
| Collision | Is Colliding With, Is Overlapping, Is Touching Layer, Other Has Tag, Other Is Object, Raycast Hits, Raycast Does Not Hit, Collision Normal Is |
| Physics | Is Grounded, Is Falling, Is Jumping, Is On Wall, Velocity Compare, Speed Compare, Gravity Scale Compare, Body Is Dynamic, Body Is Static, Body Is Sleeping |
| Animation | Current Animation Is, Animation Is Playing, Animation Is Finished, Frame Equals, Frame Greater Than, Animation Speed Compare, Sprite Flip Is |
| Timer | Timer Exists, Timer Is Running, Timer Is Finished, Timer Progress Compare, Cooldown Is Ready, Delay Has Passed |
| Camera | Object Is In Camera, Object Is Outside Camera, Camera Zoom Compare, Camera Is Following, Camera Target Is |
| Audio | Sound Is Playing, Music Is Playing, Channel Is Playing, Volume Compare, Audio Muted |
| UI | Button Is Hovered, Button Is Pressed, Menu Is Open, UI Element Is Visible, Input Field Is Focused, Checkbox Is Checked |
| Layer / Tag | Object Has Tag, Object Does Not Have Tag, Object Is On Layer, Layer Is Visible, Layer Is Locked, Layer Is Active, Layer Contains Object |
| Collections | Collection Contains Item, Collection Does Not Contain Item, Collection Count Compare, Collection Is Empty, Collection Is Full, Item At Index Equals, Any Item Matches |
| Save / Load | Save Slot Exists, Save Slot Is Empty, Save Data Has Key, Save Data Compare, AutoSave Enabled |
| Custom | Lua Expression Is True, Custom Function Returns True, EventBus Has Message, Plugin Condition |
| Logic | AND Group, OR Group, NOT, NAND, XOR, Condition Group |

## 10. Catalogo Actions

| Categoria | Actions disponibili |
| --- | --- |
| Flow | Stop Event, Skip Next Action, Wait, Wait Until, Repeat, For Each Object, If / Else, Break, Continue, Run Action Group, Enable / Disable Event |
| System | Pause Game, Resume Game, Set Time Scale, Set Game State, Toggle Fullscreen, Quit Game, Open URL |
| Scene | Load Scene, Reload Scene, Restart Scene, End Scene, Pause Scene, Resume Scene, Spawn Object, Destroy All In Scene, Set Scene Variable |
| Object | Create Object, Destroy Object, Enable Object, Disable Object, Show Object, Hide Object, Set Tag, Add Tag, Remove Tag, Set Layer, Move To Layer, Select Object, Clone Object |
| Transform | Set Position, Add Position, Set X, Set Y, Add X, Add Y, Set Rotation, Add Rotation, Set Scale, Flip X, Flip Y, Look At Object, Look At Point |
| Movement | Move Left, Move Right, Move Up, Move Down, Move Toward Point, Move Toward Object, Stop Movement, Set Direction, Set Speed, Apply Platformer Movement |
| Physics | Set Velocity, Set Velocity X, Set Velocity Y, Add Force, Add Impulse, Set Gravity Scale, Set Mass, Set Friction, Set Bounciness, Enable Physics Body, Disable Physics Body, Set Body Type, Wake Body |
| Collision | Enable Collider, Disable Collider, Set Collider Size, Set Collider Offset, Set Trigger, Set Collision Layer, Set Collision Mask, Ignore Collision With |
| Animation | Play Animation, Stop Animation, Pause Animation, Resume Animation, Set Animation, Set Animation Speed, Set Frame, Set Loop, Restart Animation, Play Animation Once |
| Sprite | Set Sprite, Set Texture, Set Opacity, Set Tint, Set Visible, Set Flip X, Set Flip Y, Set Draw Order, Set Order In Layer |
| Audio | Play Sound, Stop Sound, Pause Sound, Resume Sound, Play Music, Stop Music, Pause Music, Resume Music, Set Volume, Fade In, Fade Out, Set Audio Channel |
| Camera | Follow Object, Stop Following, Set Position, Move Camera, Set Zoom, Shake Camera, Set Bounds, Fade In, Fade Out, Focus On Object |
| UI | Show UI Element, Hide UI Element, Set Text, Set Image, Set Progress Bar, Set Button Enabled, Open Menu, Close Menu, Toggle Menu, Show Dialogue |
| Variable | Set Variable, Add To Variable, Subtract From Variable, Multiply Variable, Divide Variable, Toggle Boolean, Clamp Variable, Randomize Variable, Copy Variable, Reset Variable |
| Collections | Add Item, Remove Item, Clear Collection, Set Item At Index, Sort Collection, Shuffle Collection, For Each Item, Count Items |
| Save / Load | Save Game, Load Game, Delete Save, Write Save Value, Read Save Value, Create Save Slot, AutoSave |
| Timer | Start Timer, Stop Timer, Pause Timer, Resume Timer, Reset Timer, Start Cooldown, Clear Cooldown |
| EventBus | Emit Event, Emit Signal, Send Message, Broadcast To Group, Broadcast To Scene, Listen Once |
| Debug | Print Log, Print Warning, Print Error, Draw Debug Line, Draw Debug Box, Draw Debug Circle, Show Variable, Breakpoint, Pause Execution |
| Lua / Script | Run Lua Snippet, Call Lua Function, Set Lua Variable, Get Lua Variable, Open Script |

## 11. Target e scope: Self, Other, Scene, Global

| Target | Uso |
| --- | --- |
| Self | Entita proprietaria del rulesheet. In Player.rulesheet, Self = Player. |
| Other | Oggetto coinvolto dal trigger, per esempio Slime in una collisione con Player. |
| Scene | Scena corrente: MainScene, oggetti, variabili scena, load/restart. |
| Global | Variabili e sistemi globali: score, lives, difficulty, GameState. |
| Object Reference | Oggetto specifico scelto dall'utente: Door_01, Camera2D, Trigger_Area_01. |
| Group | Gruppo di oggetti: Enemies, Projectiles, Pickups. |
| Layer | Layer della scena: Gameplay, Collision, UI. |
| Collection | Lista/inventory/array dati: Inventory, QuestItems, EnemyWaves. |

Trigger: Collision > On Collision Enter
Self = Player
Other = Slime
Condition: Other.Tag == Enemy
Action: Self.SubtractHP(1)

## 12. Debug, Execution Trace e Variable Watch

Il debug deve essere contestuale al rulesheet attivo. Se si sta modificando Player.rulesheet, anche console, trace e variable watch devono comunicarlo chiaramente.

| Pannello | Esempio titolo | Scopo |
| --- | --- | --- |
| Debug Console | Debug Console - Player.rulesheet | Log filtrabili per All/Info/Warning/Error, clear/copy/pause on error. |
| Execution Trace | Execution Trace - Player.rulesheet | Mostra gli eventi eseguiti con Time, Event, Source, Details. |
| Variable Watch | Variable Watch / Changes - Player | Mostra variabili modificate: old value, new value, source. |

## 13. Struttura dati consigliata

Il runtime dovrebbe usare ID stabili e indipendenti dalla lingua UI. La UI puo tradurre le label, ma gli ID restano costanti.

### 13.1 Esempi ID stabili

trigger.input.keyboard.on_key_pressed
condition.variable.compare
action.physics.add_force
action.animation.play
action.audio.play_sound

### 13.2 Esempio JSON di blocco Trigger

{
  "id": "trigger.input.keyboard.on_key_pressed",
  "type": "trigger",
  "category": "Input",
  "subcategory": "Keyboard",
  "label": "On Key Pressed",
  "params": {
    "key": "Space",
    "consumeInput": false,
    "repeat": false
  }
}

### 13.3 Esempio JSON di blocco Condition

{
  "id": "condition.variable.compare",
  "type": "condition",
  "category": "Variable",
  "label": "Compare Variable",
  "params": {
    "target": "Self",
    "variable": "isGrounded",
    "operator": "==",
    "value": true
  }
}

### 13.4 Esempio JSON di blocco Action

{
  "id": "action.physics.add_force",
  "type": "action",
  "category": "Physics",
  "label": "Add Force",
  "enabled": true,
  "params": {
    "target": "Self",
    "axis": "Y",
    "value": "-jumpForce",
    "mode": "Impulse",
    "useDeltaTime": false
  }
}

### 13.5 Esempio evento completo

{
  "id": "event.player.jump",
  "name": "Jump",
  "group": "Movement",
  "enabled": true,
  "runWhilePaused": false,
  "comment": "Handles player jump",
  "trigger": {
    "id": "trigger.input.keyboard.on_key_pressed",
    "params": {
      "key": "Space",
      "consumeInput": false,
      "repeat": false
    }
  },
  "conditions": {
    "mode": "ALL",
    "items": [
      {
        "id": "condition.variable.compare",
        "params": {
          "target": "Self",
          "variable": "isGrounded",
          "operator": "==",
          "value": true
        }
      },
      {
        "id": "condition.variable.compare",
        "params": {
          "target": "Self",
          "variable": "canMove",
          "operator": "==",
          "value": true
        }
      }
    ]
  },
  "actions": [
    {
      "id": "action.physics.add_force",
      "enabled": true,
      "params": {
        "target": "Self",
        "axis": "Y",
        "value": "-jumpForce",
        "mode": "Impulse"
      }
    },
    {
      "id": "action.variable.set",
      "enabled": true,
      "params": {
        "target": "Self",
        "variable": "isGrounded",
        "value": false
      }
    }
  ]
}

## 14. MVP consigliato

Per partire senza esplodere in complessita, conviene implementare prima un sottoinsieme essenziale ma gia sufficiente per platformer, top-down, puzzle, shooter semplici e UI base.

| Tipo | MVP |
| --- | --- |
| Trigger | Every Tick, On Game Start, On Scene Load/Start, Keyboard On Key Pressed/Held/Released, Mouse Left/Right Click, Object Created/Destroyed/Variable Changed, Collision Enter/Exit, Trigger Enter/Exit, Animation Finished, Timer Every X Seconds/After Delay, Custom Event. |
| Conditions | Compare Variable, Boolean True/False, Key Is Held, Mouse Button Is Pressed, Object Has Tag, Object Visible/Exists, Other Has Tag, Is Colliding With, Is Grounded, Is Falling, Current Scene Is, Game State Is, Timer Finished. |
| Actions | Set/Add/Toggle Variable, Set/Add Position, Set X/Y, Flip X/Y, Set Velocity, Add Force, Add Impulse, Play/Stop Animation, Play Sound/Music, Create/Destroy/Enable/Disable Object, Load/Restart Scene, Start/Stop Timer, Print Log. |

## 15. Checklist finale UI/UX

- La Logic Board deve indicare sempre il rulesheet attivo: Player.rulesheet, Slime.rulesheet, Scene.rulesheet o Global.rulesheet.

- Il centro deve usare Single Event Editor come vista principale; niente card affiancate come editor primario.

- Il picker gerarchico deve mostrare Category, Subcategory, Block e descrizione del blocco selezionato.

- L'Inspector destro deve configurare il blocco selezionato, non il picker stesso.

- Ogni action deve avere enabled toggle, drag handle, numero e menu contestuale.

- Event Settings deve includere Enabled, Run While Paused e Comment.

- Player Events deve avere indicatori di stato: enabled, breakpoint, warning, error.

- Bottom Dock deve essere contestuale: Debug Console - Player.rulesheet, Execution Trace - Player.rulesheet, Variable Watch - Player.

- Canvas deve mantenere Camera View 512 x 320 px dentro un viewport resizable, con zoom step e Active Layer.

- La palette resta antracite monocromatica, flat, professionale e senza effetti glow/neon.

## Appendice A - Layout riassuntivo

ArtCade Studio
Top Menu + Toolbar = 96 px

Main Tabs:
Canvas | Logic Board | Script Editor

Logic Board active:
Left 280 px:
  Rulesheet Browser
  Player Events
  Player Variables

Center 920 px:
  Player.rulesheet
  Event Editor - Jump
    Event Settings
    Trigger
    Conditions
    Actions
  Picker Drawer: Category -> Subcategory -> Block

Right 320 px:
  Logic Inspector
    Context
    General
    Trigger/Condition/Action Settings
    Flow
    Metadata

Bottom Dock 300 px:
  Debug Console
  Execution Trace
  Variable Watch

## Appendice B - Regole lessicali consigliate

| Termine UI | Significato |
| --- | --- |
| Rulesheet | Foglio logico associato a entita, scena o globale. |
| Event | Unita logica composta da Trigger, Conditions e Actions. |
| Trigger | Quando parte l'evento. |
| Condition | Se l'evento puo proseguire. |
| Action | Cosa viene eseguito. |
| Self | Entita proprietaria del rulesheet. |
| Other | Oggetto coinvolto nel trigger corrente. |
| Inspector | Pannello di configurazione del blocco o oggetto selezionato. |
| Picker | Drawer gerarchico per scegliere il tipo di blocco. |
