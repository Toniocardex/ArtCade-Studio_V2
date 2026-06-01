Report tecnico — Struttura consigliata di ArtCade
1. Definizione del progetto

ArtCade dovrebbe essere progettato come un game engine/editor 2D custom, composto da due macro-aree ben separate:

ArtCade Editor
→ serve a creare, modificare, organizzare e salvare il progetto

ArtCade Runtime
→ serve a eseguire il gioco usando i dati prodotti dall’editor

La scelta tecnica aggiornata è:

Rendering / Window / Input / Audio → Raylib
Matematica vettoriale              → raymath
Fisica 2D                          → modulo custom basato su raymath
Logica visuale                     → Logic Board
Scripting                          → Lua

La cosa più importante è questa:

Raylib non deve diventare “il motore”.
Raylib deve essere il backend tecnico usato dal motore.

ArtCade deve rimanere sopra Raylib, con una propria architettura, propri componenti, propri dati e proprie API.

2. Architettura generale

La struttura ideale è questa:

ArtCade
├── Editor
│   ├── Canvas Editor
│   ├── Logic Board
│   ├── Script Editor
│   ├── Inspector
│   ├── Asset Browser
│   ├── Layer Panel
│   └── Debug Console
│
├── Runtime
│   ├── Game Loop
│   ├── Scene System
│   ├── Object System
│   ├── Rendering System
│   ├── Physics System
│   ├── Input System
│   ├── Audio System
│   ├── Logic Runtime
│   ├── Lua Runtime
│   └── Debug Runtime
│
├── Core
│   ├── Project Model
│   ├── Commands
│   ├── Events
│   ├── Serialization
│   ├── Validation
│   └── Shared Types
│
├── Platform Layer
│   ├── Raylib Backend
│   ├── File System
│   ├── Window Backend
│   ├── Input Backend
│   └── Audio Backend
│
└── Tools
    ├── Exporter
    ├── Project Migrator
    ├── Asset Importer
    └── Debug Tools

Il principio è:

Editor modifica dati
Runtime esegue dati
Core definisce dati e regole
Platform Layer collega ArtCade a Raylib e al sistema operativo
3. Separazione fondamentale: Editor, Core, Runtime, Backend
Editor

L’editor è la parte visiva e interattiva di ArtCade.

Contiene:

Canvas
Logic Board
Script Editor Lua
Inspector
Asset Browser
Scene Hierarchy
Layer Manager UI
Debug Console
Project Settings

L’editor non dovrebbe contenere logica runtime vera.

Esempio sbagliato:

Il pannello Canvas muove direttamente il player nel motore.

Esempio corretto:

Il pannello Canvas modifica il Project Model.
Il Runtime legge il Project Model ed esegue la scena.
Core

Il Core è il centro stabile del software.

Contiene:

struttura del progetto
scene
oggetti
componenti
variabili
eventi
regole Logic Board
comandi editor
validazione
serializzazione
tipi condivisi

Il Core non dovrebbe dipendere da Raylib, dalla GUI o dal sistema operativo.

Deve essere la parte più pulita di ArtCade.

Runtime

Il Runtime è ciò che esegue il gioco.

Contiene:

loop di gioco
update degli oggetti
input
fisica
collisioni
rendering
audio
script Lua
Logic Board runtime
debug runtime

Il Runtime usa il Core, ma non dovrebbe conoscere i dettagli dell’Editor.

Backend Raylib

Il backend Raylib è il livello concreto che parla con Raylib.

Contiene wrapper per:

finestra
rendering
texture
input
audio
camera
timing

Raylib deve essere isolato qui, non sparso ovunque.

Esempio corretto:

Renderer Interface
    ↓
RaylibRenderer
    ↓
DrawTexturePro()

Esempio sbagliato:

Player.c chiama direttamente DrawTexturePro()
Enemy.c chiama direttamente DrawTexture()
LogicRuntime chiama direttamente IsKeyPressed()
SceneManager carica direttamente Texture2D

Questo creerebbe dipendenza forte da Raylib in tutto il progetto.

4. Regola delle dipendenze

ArtCade dovrebbe seguire questa direzione:

Editor → Core
Runtime → Core
Runtime → Platform Layer
Platform Layer → Raylib
Core → nessuna dipendenza esterna pesante

Schema:

┌─────────────────────┐
│       Editor        │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│        Core         │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│       Runtime       │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│   Platform Layer    │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│       Raylib        │
└─────────────────────┘

Il Core non deve sapere se sotto c’è Raylib, SDL, OpenGL diretto o altro.

5. Project Model: la fonte di verità

Il centro di ArtCade deve essere il Project Model.

Non la GUI.
Non Raylib.
Non il codice Lua.
Non la Logic Board visiva.

Il Project Model rappresenta tutto il progetto in forma dati.

Esempio:

Project
├── Metadata
├── Settings
├── Scenes
├── Objects
├── Components
├── Layers
├── Assets
├── Logic Rules
├── Variables
├── Scripts
└── Export Settings

L’editor modifica il Project Model.

Il runtime esegue il Project Model.

Il serializer salva il Project Model.

Il validator controlla il Project Model.

L’exporter esporta il Project Model.

Questa è la struttura più solida.

6. Struttura del progetto su disco

Una possibile struttura dei file generati da ArtCade:

MyGame/
├── project.artcade
├── scenes/
│   ├── main_menu.scene.json
│   ├── level_01.scene.json
│   └── level_02.scene.json
│
├── objects/
│   ├── player.object.json
│   ├── enemy.object.json
│   └── door.object.json
│
├── logic/
│   ├── player.logic.json
│   ├── enemy.logic.json
│   └── global.logic.json
│
├── scripts/
│   ├── player.lua
│   ├── enemy_ai.lua
│   └── game_manager.lua
│
├── assets/
│   ├── sprites/
│   ├── audio/
│   ├── fonts/
│   └── tilesets/
│
├── settings/
│   ├── input.json
│   ├── physics.json
│   └── export.json
│
└── build/

project.artcade potrebbe contenere:

{
  "projectName": "MyGame",
  "projectVersion": "1.0.0",
  "artcadeVersion": "0.1.0",
  "startScene": "level_01",
  "settings": {
    "resolution": {
      "width": 1280,
      "height": 720
    },
    "targetFps": 60
  }
}
7. Responsabilità principali dei moduli
7.1 Editor Layer
Modulo	Responsabilità
Canvas Editor	Modifica visiva della scena, posizionamento oggetti, griglia, snapping, camera editor
Logic Board UI	Creazione e modifica di trigger, condizioni e azioni
Script Editor	Scrittura e modifica script Lua
Inspector	Modifica proprietà dell’oggetto selezionato
Asset Browser	Gestione asset importati
Scene Hierarchy	Lista oggetti presenti nella scena
Layer Panel	Gestione layer, ordine, visibilità e blocco
Debug Console	Log editor, errori runtime, messaggi sistema
Project Settings	Configurazione progetto, input, fisica, rendering, export

L’Editor Layer deve occuparsi di interazione utente, non di logica runtime.

7.2 Core Layer
Modulo	Responsabilità
Project Model	Rappresentazione dati completa del progetto
Scene Model	Dati delle scene
Object Model	Dati degli oggetti
Component Model	Dati dei componenti assegnati agli oggetti
Logic Model	Dati delle regole Logic Board
Script Model	Collegamenti tra oggetti e script Lua
Command System	Azioni editor con undo/redo
Event System	Comunicazione interna disaccoppiata
Validator	Controllo validità dei dati
Serializer	Salvataggio e caricamento
Type Registry	Catalogo tipi: componenti, trigger, azioni, condizioni

Il Core Layer deve essere indipendente dalla tecnologia.

7.3 Runtime Layer
Modulo	Responsabilità
GameLoop	Ciclo principale del gioco
TimeManager	Delta time, fixed timestep, pausa, timer
SceneManager	Caricamento, cambio e reset scene
ObjectManager	Creazione, distruzione e ricerca oggetti
ComponentSystem	Aggiornamento componenti
InputManager	Stato input normalizzato
LogicRuntime	Esecuzione Logic Board
LuaRuntime	Esecuzione script Lua
PhysicsWorld	Simulazione fisica custom
CollisionSystem	Rilevamento e risoluzione collisioni
Renderer	Raccolta e disegno comandi grafici
AudioManager	Riproduzione musica e suoni
RuntimeDebugger	Debug di eventi, fisica, script e performance

Il Runtime Layer deve eseguire il progetto in modo prevedibile.

7.4 Platform Layer
Modulo	Responsabilità
RaylibWindow	Creazione finestra, resize, fullscreen
RaylibRenderer	Traduzione dei render command in chiamate Raylib
RaylibInput	Lettura tastiera, mouse, gamepad
RaylibAudio	Audio backend
RaylibTextureLoader	Caricamento texture
FileSystem	Lettura/scrittura file
PlatformTime	Tempo reale e misurazioni

Il Platform Layer contiene il codice dipendente da Raylib e dal sistema operativo.

8. Rendering System con Raylib

Raylib dovrebbe stare dietro un’interfaccia.

Responsabilità del Renderer
- ricevere comandi di disegno
- ordinare per layer
- applicare camera
- applicare trasformazioni
- disegnare sprite
- disegnare forme debug
- gestire texture
- gestire viewport

Il Runtime non dovrebbe chiamare direttamente Raylib.

Struttura:

SpriteComponent
    ↓
RenderCommand
    ↓
RenderQueue
    ↓
LayerManager
    ↓
CameraManager
    ↓
RaylibRenderer
    ↓
Raylib

Esempio di comando di rendering:

typedef struct RenderSpriteCommand {
    int textureId;
    Rectangle source;
    Rectangle destination;
    Vector2 origin;
    float rotation;
    Color tint;
    int layer;
    bool visible;
} RenderSpriteCommand;

Il vantaggio è che gli oggetti non disegnano sé stessi direttamente.

Gli oggetti descrivono cosa va disegnato.
Il renderer decide come disegnarlo.

9. Physics System custom con raymath

La fisica di ArtCade dovrebbe essere un modulo separato.

raymath va usata internamente per calcoli vettoriali.

Responsabilità del Physics System
- aggiornare velocità
- aggiornare posizione
- applicare gravità
- applicare forza
- applicare impulso
- gestire damping/friction
- rilevare collisioni
- risolvere collisioni
- produrre eventi collisione
- gestire trigger
- eseguire raycast semplici
- fornire debug fisico

Struttura:

PhysicsWorld
├── Rigidbody2D
├── Collider2D
├── CollisionSystem
├── TriggerSystem
├── RaycastSystem
├── PhysicsMaterial
└── PhysicsDebugDraw
Rigidbody2D

Responsabilità:

- posizione fisica
- velocità
- accelerazione
- massa
- gravità
- damping
- stato statico/dinamico/kinematic

Esempio:

typedef struct Rigidbody2D {
    Vector2 position;
    Vector2 velocity;
    Vector2 acceleration;

    float mass;
    float inverseMass;
    float gravityScale;
    float damping;

    bool useGravity;
    bool isStatic;
    bool isKinematic;
} Rigidbody2D;
Collider2D

Responsabilità:

- definire la forma collisionale
- sapere se è solido o trigger
- contenere offset rispetto all’oggetto
- indicare layer/mask collisionale

Esempio:

typedef enum ColliderType {
    COLLIDER_AABB,
    COLLIDER_CIRCLE
} ColliderType;

typedef struct Collider2D {
    ColliderType type;
    Vector2 offset;
    bool isTrigger;
    int collisionLayer;
    int collisionMask;
} Collider2D;
CollisionSystem

Responsabilità:

- test AABB vs AABB
- test Circle vs Circle
- test Circle vs AABB
- generare collision info
- calcolare normal
- calcolare penetration depth
- risolvere separazione

Esempio dati collisione:

typedef struct CollisionInfo {
    int entityA;
    int entityB;
    Vector2 normal;
    float penetration;
    bool isTrigger;
} CollisionInfo;
TriggerSystem

Responsabilità:

- rilevare entrata in trigger
- rilevare permanenza in trigger
- rilevare uscita da trigger
- inviare eventi a LogicRuntime e LuaRuntime

Eventi:

OnTriggerEnter
OnTriggerStay
OnTriggerExit
PhysicsDebugDraw

Responsabilità:

- disegnare collider
- disegnare vettori velocità
- disegnare normali collisione
- mostrare stato grounded
- mostrare collision layer

Questo è essenziale per un engine con editor.

10. TimeManager e Fixed Timestep

Per una fisica custom, il TimeManager diventa centrale.

Dovresti separare:

deltaTime      → tempo variabile per rendering e animazioni
fixedDeltaTime → tempo fisso per fisica
realDeltaTime  → tempo reale non influenzato da pausa

Struttura consigliata:

TimeManager
├── deltaTime
├── fixedDeltaTime
├── realDeltaTime
├── timeScale
├── paused
├── accumulator
└── timers

Loop consigliato:

while running:
    realDeltaTime = getTime()
    deltaTime = realDeltaTime * timeScale

    process input
    update logic

    accumulator += deltaTime

    while accumulator >= fixedDeltaTime:
        update physics
        accumulator -= fixedDeltaTime

    update animations
    render

Nota importante per ArtCade:

La pausa deve essere configurabile per layer.

Esempio:

Sistema	Influenzato dalla pausa?
UI Editor	No
Debug Console	No
Audio UI	Dipende
Gameplay Logic	Sì
Timers gameplay	Sì
Timers reali	No
Physics	scelta configurabile, ma nel tuo approccio può restare indipendente dalla pausa
Rendering	No

Nel tuo caso, dato che hai già chiarito questa scelta, puoi trattare la fisica come un sistema che può essere non influenzato dalla pausa, oppure renderla configurabile per progetto.

11. Input System con Raylib

Raylib legge l’input reale.

ArtCade deve normalizzarlo.

Struttura:

RaylibInputBackend
    ↓
InputManager
    ↓
Input Events
    ↓
LogicRuntime / LuaRuntime

L’InputManager non dovrebbe esporre direttamente Raylib.

Esempio API interna:

bool Input_IsKeyPressed(InputKey key);
bool Input_IsKeyDown(InputKey key);
bool Input_IsMousePressed(MouseButton button);
Vector2 Input_GetMousePosition(void);

Così la Logic Board può usare:

Input > Keyboard > On Press > Space
Input > Mouse > Left Click
Input > Gamepad > Button Pressed

Senza sapere che sotto c’è Raylib.

12. Logic Board

La Logic Board deve essere un sistema dati, non solo una GUI.

Ogni regola dovrebbe essere salvata come struttura:

Rule
├── id
├── name
├── enabled
├── owner object
├── trigger
├── conditions
└── actions

Esempio:

{
  "id": "rule_player_jump",
  "name": "Player Jump",
  "enabled": true,
  "owner": "player",
  "trigger": {
    "type": "input.keyboard.onPress",
    "key": "Space"
  },
  "conditions": [
    {
      "type": "physics.isOnGround",
      "target": "player"
    }
  ],
  "actions": [
    {
      "type": "physics.addImpulse",
      "target": "player",
      "x": 0,
      "y": -420
    }
  ]
}
Responsabilità della Logic Board UI
- mostrare lista regole
- mostrare trigger disponibili
- mostrare condizioni disponibili
- mostrare azioni disponibili
- permettere ordinamento
- permettere enable/disable
- permettere duplicazione regole
- validare input visivo
Responsabilità del LogicRuntime
- ricevere eventi
- valutare trigger
- valutare condizioni
- eseguire azioni
- produrre log di debug
- comunicare con ObjectManager, PhysicsWorld, AudioManager, LuaRuntime

La UI non esegue le regole.
Il Runtime esegue le regole.

13. Lua Scripting

Lua dovrebbe essere un’estensione, non il centro caotico del motore.

Responsabilità del LuaRuntime
- caricare script
- inizializzare ambiente Lua
- esporre API sicure di ArtCade
- chiamare funzioni lifecycle
- gestire errori script
- inviare log alla Debug Console

Esempio lifecycle:

function on_start()
end

function on_update(dt)
end

function on_collision_enter(other)
end
API Lua consigliata

Lua non dovrebbe poter modificare tutto liberamente.

Meglio esporre API controllate:

ArtCade.Object.set_position("player", 100, 200)
ArtCade.Physics.add_impulse("player", 0, -420)
ArtCade.Audio.play("jump")
ArtCade.Scene.load("level_02")
ArtCade.Variable.set("score", 100)

Non dare accesso diretto alle strutture interne del motore.

14. Object System

Gli oggetti dovrebbero essere composti da componenti.

Esempio:

Player
├── TransformComponent
├── SpriteComponent
├── Rigidbody2DComponent
├── Collider2DComponent
├── AnimationComponent
├── LogicComponent
└── ScriptComponent
Responsabilità dell’ObjectManager
- creare oggetti
- distruggere oggetti
- trovare oggetti per id/nome/tag
- gestire gerarchie semplici
- collegare componenti
- inviare eventi di lifecycle

Non dovrebbe fare rendering, fisica o logica direttamente.

15. Component System

Ogni componente deve avere responsabilità chiara.

Componente	Responsabilità
TransformComponent	posizione, rotazione, scala
SpriteComponent	riferimento texture, source rect, tint, visibilità
AnimatorComponent	animazioni frame-based
Rigidbody2DComponent	dati fisici
Collider2DComponent	forma collisionale
LogicComponent	riferimento alle rules dell’oggetto
ScriptComponent	riferimento agli script Lua
AudioSourceComponent	suoni legati all’oggetto
CameraComponent	camera attiva o camera secondaria
TilemapComponent	tilemap della scena

Il Transform è centrale, ma attenzione: nel caso di oggetti fisici, la posizione finale dovrebbe essere sincronizzata dal PhysicsWorld.

16. Scene System
Responsabilità del SceneManager
- caricare scene
- scaricare scene
- cambiare scena
- riavviare scena
- istanziare oggetti
- inizializzare componenti
- notificare runtime e script

Flusso:

Load Scene
    ↓
Deserialize Scene Data
    ↓
Create Objects
    ↓
Attach Components
    ↓
Initialize Physics
    ↓
Initialize Logic Rules
    ↓
Initialize Scripts
    ↓
Start Runtime
17. Asset System
Responsabilità dell’AssetManager
- registrare asset
- importare asset
- generare id asset
- controllare riferimenti mancanti
- gestire path
- preparare asset per il runtime
Responsabilità del TextureManager
- caricare texture tramite Raylib
- evitare duplicati
- scaricare texture inutilizzate
- fornire textureId al renderer

L’editor vede asset logici.
Il backend Raylib vede Texture2D.

Non mischiare i due livelli.

18. Audio System con Raylib

Raylib può gestire audio, ma ArtCade dovrebbe avere un AudioManager.

Responsabilità dell’AudioManager
- play sound
- stop sound
- play music
- pause/resume
- volume globale
- volume per categoria
- spatial audio 2D base, se previsto

Categorie utili:

Master
Music
SFX
UI
Ambience

Logic Board actions:

Audio > Play Sound
Audio > Stop Sound
Audio > Set Volume
Audio > Play Music
Audio > Fade Music
19. EventBus

L’EventBus serve a non accoppiare tutto.

Esempi di eventi:

InputEvent
CollisionEnterEvent
TriggerEnterEvent
SceneLoadedEvent
ObjectCreatedEvent
ObjectDestroyedEvent
VariableChangedEvent
ScriptErrorEvent
LogicRuleExecutedEvent

Il PhysicsWorld non dovrebbe chiamare direttamente la Logic Board.

Meglio:

PhysicsWorld rileva collisione
    ↓
EventBus emette CollisionEnterEvent
    ↓
LogicRuntime reagisce
    ↓
LuaRuntime può reagire
    ↓
DebugConsole registra

Questo rende il sistema più modulare.

20. Command System per l’editor

Per un editor serio, serve un sistema comandi.

Ogni modifica dell’utente dovrebbe passare da un comando.

Esempi:

CreateObjectCommand
DeleteObjectCommand
MoveObjectCommand
RenameObjectCommand
AddComponentCommand
RemoveComponentCommand
AddLogicRuleCommand
DeleteLogicRuleCommand
EditConditionCommand
CreateLayerCommand
ImportAssetCommand
AttachScriptCommand

Ogni comando dovrebbe avere:

execute()
undo()
redo()
validate()

Vantaggi:

undo/redo pulito
cronologia modifiche
debug delle azioni editor
salvataggio più sicuro
validazione centralizzata
21. Validation System

Il Validator controlla che il progetto sia coerente.

Deve intercettare problemi come:

oggetto referenziato ma inesistente
asset mancante
script mancante
trigger non valido
azione senza target
collider senza rigidbody dove necessario
scene iniziale non impostata
layer duplicato
variabile usata ma non definita

Esempio errore utile:

Rule "Player Jump" non valida:
azione physics.addImpulse richiede un target con Rigidbody2DComponent.
Oggetto "player" non contiene Rigidbody2DComponent.

Questo è molto meglio di un errore generico a runtime.

22. Debug System

ArtCade dovrebbe avere debug integrato fin dall’inizio.

Debug Runtime
- FPS
- frame time
- fixed update count
- object count
- draw calls
- collision count
- active rules
- script errors
- physics state
Debug Logic Board
- ultima rule eseguita
- trigger attivati
- condizioni passate/fallite
- azioni eseguite
- tempo di esecuzione rule

Esempio:

[LogicRuntime]
Rule: Player Jump
Trigger: input.keyboard.onPress.Space → true
Condition: physics.isOnGround(player) → true
Action: physics.addImpulse(player, 0, -420) → executed
Debug Physics
- collider visibili
- velocity vector
- collision normals
- trigger area
- grounded state
- rigidbody state

Per un engine, questo non è extra. È essenziale.

23. Flusso runtime completo

Il ciclo runtime consigliato:

1. Window update
2. TimeManager update
3. InputManager update
4. EventBus dispatch input events
5. LogicRuntime update
6. LuaRuntime update
7. Fixed Physics update
8. Collision events dispatch
9. Scene/Object state sync
10. Animation update
11. Camera update
12. RenderQueue build
13. RaylibRenderer draw
14. Debug overlay draw

Schema:

RaylibInput
    ↓
InputManager
    ↓
EventBus
    ↓
LogicRuntime / LuaRuntime
    ↓
PhysicsWorld
    ↓
ObjectManager
    ↓
Renderer
    ↓
RaylibRenderer
24. Flusso editor completo

Quando l’utente modifica qualcosa:

User Action
    ↓
Editor UI
    ↓
Command
    ↓
Project Model
    ↓
Validation
    ↓
Editor State Update
    ↓
Optional Runtime Preview Update

Esempio:

L’utente aggiunge una condizione nella Logic Board
    ↓
LogicBoardPanel
    ↓
AddConditionCommand
    ↓
ProjectModel.logicRules
    ↓
Validator
    ↓
UI refresh
    ↓
Debug log editor

La UI non deve modificare dati a caso.
Deve passare da comandi controllati.

25. Responsabilità: cosa NON deve fare ogni modulo

Questa parte è importante.

Canvas Editor non deve:
- eseguire la fisica
- modificare direttamente Raylib
- salvare file da solo
- interpretare Logic Board

Deve solo modificare la scena attraverso comandi.

Logic Board UI non deve:
- eseguire le regole
- conoscere Raylib
- modificare oggetti runtime direttamente
- chiamare PhysicsWorld direttamente

Deve solo creare/modificare il modello delle regole.

LogicRuntime non deve:
- disegnare
- leggere input diretto da Raylib
- salvare file
- modificare la UI editor

Deve solo valutare trigger, condizioni e azioni.

PhysicsWorld non deve:
- disegnare sprite
- leggere input
- eseguire script Lua direttamente
- conoscere la Logic Board UI

Deve aggiornare corpi, collisioni e produrre eventi.

Renderer non deve:
- fare fisica
- gestire input
- decidere logica di gioco
- modificare scene

Deve solo disegnare ciò che gli viene passato.

RaylibBackend non deve:
- contenere logica di gioco
- conoscere rules della Logic Board
- conoscere il formato progetto

Deve solo adattare ArtCade a Raylib.

26. Struttura cartelle consigliata

Una struttura C/C++ plausibile:

src/
├── artcade.h
├── main.c
│
├── core/
│   ├── project/
│   ├── scene/
│   ├── object/
│   ├── component/
│   ├── logic_model/
│   ├── commands/
│   ├── events/
│   ├── validation/
│   └── serialization/
│
├── runtime/
│   ├── engine/
│   ├── loop/
│   ├── time/
│   ├── input/
│   ├── scene/
│   ├── object/
│   ├── logic/
│   ├── scripting/
│   ├── physics/
│   ├── rendering/
│   ├── audio/
│   └── debug/
│
├── editor/
│   ├── canvas/
│   ├── logic_board/
│   ├── script_editor/
│   ├── inspector/
│   ├── asset_browser/
│   ├── hierarchy/
│   ├── layers/
│   └── console/
│
├── platform/
│   ├── raylib/
│   │   ├── raylib_window.c
│   │   ├── raylib_renderer.c
│   │   ├── raylib_input.c
│   │   ├── raylib_audio.c
│   │   └── raylib_texture.c
│   │
│   └── filesystem/
│
├── tools/
│   ├── exporter/
│   ├── importer/
│   └── migrator/
│
└── tests/
    ├── core/
    ├── runtime/
    ├── physics/
    ├── logic/
    └── serialization/
27. Componenti core aggiornati per ArtCade
Componente	Responsabilità
TimeManager	Delta time, fixed timestep, pausa, timers
InputManager	Input astratto da tastiera, mouse, gamepad
EventBus	Comunicazione disaccoppiata
SceneManager	Caricamento e cambio scene
ObjectManager	Gestione entità/oggetti
ComponentSystem	Gestione componenti
VariableManager	Variabili globali/locali
LogicRuntime	Esecuzione Logic Board
LuaRuntime	Esecuzione scripting Lua
PhysicsWorld	Simulazione fisica custom
CollisionSystem	Collisioni e trigger
Renderer	Sistema rendering astratto
RaylibRenderer	Implementazione Raylib del renderer
TextureManager	Caricamento e gestione texture
AudioManager	Suoni e musica
LayerManager	Ordine di disegno e layer
CameraManager	Camera 2D
SaveLoadManager	Persistenza progetto
DebugManager	Debug runtime/editor
ExportManager	Build/export del progetto
28. Roadmap tecnica consigliata
Fase 1 — Core minimo
Project Model
Scene Model
Object Model
TransformComponent
Command System base
Serializer JSON
Validator base

Obiettivo: creare, modificare, salvare e ricaricare una scena semplice.

Fase 2 — Runtime Raylib
Window
GameLoop
TimeManager
RaylibRenderer
TextureManager
InputManager
CameraManager

Obiettivo: aprire una scena e disegnare oggetti con Raylib.

Fase 3 — Fisica custom
Rigidbody2D
Collider2D AABB
PhysicsWorld
Gravity
Velocity
Collision detection
Collision resolution base
Physics debug draw

Obiettivo: movimento e collisioni base prevedibili.

Fase 4 — Logic Board Runtime
Trigger
Conditions
Actions
LogicRuntime
EventBus integration
Debug rule execution

Obiettivo: far reagire gli oggetti tramite regole visuali.

Fase 5 — Editor completo
Canvas Editor
Inspector
Scene Hierarchy
Layer Panel
Asset Browser
Logic Board UI
Debug Console

Obiettivo: creare una scena senza scrivere codice.

Fase 6 — Lua scripting
LuaRuntime
ScriptComponent
ArtCade Lua API
Script error handling
Script debugger base

Obiettivo: estendere il comportamento con codice Lua.

Fase 7 — Export e build
Project packager
Asset exporter
Runtime config
Build folder
Versioning
Migration system

Obiettivo: esportare un progetto giocabile.

29. Principio finale di progettazione

ArtCade dovrebbe seguire questa filosofia:

Editor = crea dati
Core = definisce regole e strutture
Runtime = esegue dati
Raylib = backend tecnico
raymath = base matematica
Physics = sistema custom proprietario
Lua = estensione controllata
Logic Board = logica visuale strutturata

La frase chiave è:

ArtCade non deve essere un insieme di funzioni Raylib con una GUI sopra.
Deve essere un motore 2D con architettura propria, che usa Raylib come backend.

Questa è la differenza tra un progetto amatoriale che cresce in modo caotico e un software serio che può essere mantenuto, esteso e trasformato in un vero editor/game engine.