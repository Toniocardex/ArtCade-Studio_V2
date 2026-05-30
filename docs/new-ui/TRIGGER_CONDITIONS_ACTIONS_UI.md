# ArtCade Studio — Trigger / Conditions / Actions (struttura UI)

> Estratto da `Trigger-condizioni.azioni-struttura.docx` (cartella `Desktop/New_UI_artCade`).  
> **Prodotto:** **ArtCade Studio**. *PixelForge* nei file sorgente è solo placeholder del mockup.  
> Riferimento visivo: `Trigger-action-struttura_UI.png`.

Selettore gerarchico a categorie, dove l’utente sceglie prima il dominio logico, poi l’evento/trigger specifico, e solo dopo configura i parametri.

La struttura corretta sarebbe:

```text
																Trigger Picker
├─ System
│  ├─ Every Tick
│  ├─ On Game Start
│  ├─ On Layout Load
│  ├─ On Layout End
│  └─ On Pause / Resume
│
├─ Input
│  ├─ Keyboard
│  │  ├─ On Press
│  │  ├─ On Release
│  │  ├─ Is Held
│  │  └─ Key Combo
│  │
│  ├─ Mouse
│  │  ├─ Left Click
│  │  ├─ Right Click
│  │  ├─ Middle Click
│  │  ├─ Mouse Move
│  │  ├─ Wheel Up / Down
│  │  └─ Cursor Over Object
│  │
│  └─ Gamepad
│     ├─ Button Pressed
│     ├─ Button Released
│     ├─ Axis Moved
│     └─ Stick Direction
│
├─ Object
│  ├─ On Created
│  ├─ On Destroyed
│  ├─ On Visible
│  ├─ On Hidden
│  └─ On Variable Changed
│
├─ Collision
│  ├─ On Collision Enter
│  ├─ On Collision Stay
│  ├─ On Collision Exit
│  ├─ On Trigger Enter
│  ├─ On Trigger Stay
│  └─ On Trigger Exit
│
├─ Animation
│  ├─ On Animation Start
│  ├─ On Animation Finished
│  ├─ On Frame Reached
│  └─ On Animation Loop
│
├─ Timer
│  ├─ Every X Seconds
│  ├─ After Delay
│  ├─ On Timer Start
│  ├─ On Timer Finished
│  └─ On Timer Cancelled
│
├─ Audio
│  ├─ On Sound Finished
│  ├─ On Music Finished
│  └─ On Audio Channel Empty
│
└─ Custom
   ├─ On Custom Event
   ├─ On EventBus Message
   └─ On Signal Received
```

Il punto forte è questo: il menù non deve mostrare tutto insieme, ma deve guidare l’utente per livelli.

Come lo integrerei nella UI

Nel centro, nella sezione Trigger, quando clicchi:

+ Add Trigger

oppure:

Replace Trigger

si apre un pannello/modale laterale strutturato così:

Add Trigger
────────────────────────────
Search trigger...

Categories
System
Input
Object
Collision
Animation
Timer
Audio
Custom

[Categoria selezionata]
Input > Keyboard
────────────────────────────
On Key Pressed
On Key Released
Key Is Held
Key Combo

[Preview / Description]
Runs when a keyboard key is pressed.

Quindi avresti una navigazione a colonne:

```text
																┌─────────────┬──────────────┬────────────────────┐
│ Category    │ Subcategory  │ Trigger             │
├─────────────┼──────────────┼────────────────────┤
│ System      │              │ Every Tick          │
│ Input       │ Keyboard     │ On Key Pressed      │
│ Object      │ Mouse        │ On Key Released     │
│ Collision   │ Gamepad      │ Key Is Held         │
│ Animation   │              │ Key Combo           │
└─────────────┴──────────────┴────────────────────┘
```

Per esempio:

Input → Keyboard → On Key Pressed

Poi, una volta scelto il trigger, nel pannello centrale compare:

Trigger
────────────────────────────
On Key Pressed

Key: Space
Input Source: Keyboard
Consume Input: false
Repeat: false

E le condizioni?

Qui la tua idea è ancora più interessante: le condizioni possono aprirsi in un menù laterale contestuale alla categoria.

Esempio: se stai lavorando con un trigger di tipo Keyboard, il sistema può suggerire condizioni legate all’input.

Trigger: On Key Pressed Space

Suggested Conditions
────────────────────────────
Input
- Key Is Held
- Key Was Released
- Key Combo Active

Object
- Self.isGrounded == true
- Self.canMove == true

Game State
- GameState == Gameplay
- Not Paused

Quindi non solo scegli da una lista globale: il sistema ti propone condizioni sensate in base al contesto.

Struttura ideale del Condition Picker

Add Condition
────────────────────────────
Search condition...

Categories
System
Input
Object
Variable
Collision
Animation
Timer
Scene
Custom

Selected Category: Variable
────────────────────────────
Compare Variable
Variable Is True
Variable Is False
Variable Changed
Value In Range

Configuration
────────────────────────────
Target: Self
Variable: isGrounded
Operator: ==
Value: true

Esempio pratico per il salto:

Trigger:
Input > Keyboard > On Key Pressed

Parameters:
Key = Space

Conditions:
Variable > Compare Variable
Target = Self
Variable = isGrounded
Operator = ==
Value = true

Variable > Compare Variable
Target = Self
Variable = canMove
Operator = ==
Value = true

Risultato nell’evento:

Event Editor — Jump

Trigger
On Key Pressed: Space

Conditions
Self.isGrounded == true
Self.canMove == true

Actions
Add Force Y = -jumpForce
Set isGrounded = false
Play Animation = jump
Play Sound = jump.wav

Differenza tra Trigger e Condition

È importante mantenerla chiara.

Trigger

Il trigger risponde alla domanda:

Quando deve partire l’evento?

Esempi:

Every Tick
On Game Start
On Key Pressed
On Collision Enter
On Animation Finished

Condition

La condition risponde alla domanda:

L’evento può essere eseguito?

Esempi:

Self.isGrounded == true
GameState == Gameplay
Other.Tag == Enemy
Mouse is over Self
Timer is finished

Quindi:

Trigger = quando succede qualcosa
Condition = se certe regole sono vere
Action = cosa succede dopo

Come lo farei visivamente

Quando clicchi su + Add Trigger, aprirei un pannello laterale temporaneo nel centro, non una finestra modale bloccante.

Esempio:

```text
																Event Editor — Jump
────────────────────────────────────────────

Trigger
[ + Add Trigger ]

────────────────────────────────────────────
Trigger Picker aperto a destra della sezione

┌───────────────────────────┬───────────────────────────┐
│ Categories                │ Trigger List               │
│                           │                           │
│ System                    │ Every Tick                 │
│ Input       selected      │ On Game Start              │
│ Object                    │ On Layout Load             │
│ Collision                 │                           │
│ Animation                 │ Input > Keyboard           │
│ Timer                     │ On Key Pressed selected    │
│ Custom                    │ On Key Released            │
│                           │ Key Is Held                │
└───────────────────────────┴───────────────────────────┘
```

Per condizioni e azioni userei lo stesso schema:

+ Add Trigger    → Trigger Picker
+ Add Condition  → Condition Picker
+ Add Action     → Action Picker

Così il sistema è coerente.

Action Picker coerente con lo stesso sistema

Per completare il flusso, anche le action andrebbero a categorie:

```text
																Action Picker
├─ Object
│  ├─ Set Position
│  ├─ Move
│  ├─ Rotate
│  ├─ Destroy
│  └─ Spawn Object
│
├─ Physics
│  ├─ Set Velocity
│  ├─ Add Force
│  ├─ Add Impulse
│  └─ Set Gravity Scale
│
├─ Animation
│  ├─ Play Animation
│  ├─ Stop Animation
│  ├─ Set Frame
│  └─ Set Flip
│
├─ Audio
│  ├─ Play Sound
│  ├─ Stop Sound
│  ├─ Play Music
│  └─ Fade Music
│
├─ Variable
│  ├─ Set Variable
│  ├─ Add To Variable
│  ├─ Toggle Boolean
│  └─ Clamp Value
│
├─ Scene
│  ├─ Load Scene
│  ├─ Restart Scene
│  └─ Pause Game
│
└─ Custom
   ├─ Emit Event
   ├─ Call Function
   └─ Run Lua Snippet
```

In questo modo hai una grammatica unica:

Trigger Picker
Condition Picker
Action Picker

tutti con lo stesso pattern:

Category → Subcategory → Item → Parameters

Layout del picker che consiglio

La forma migliore secondo me è un drawer laterale interno, non un popup piccolo.

```text
																┌────────────────────────────────────────────┬──────────────────────────┐
│ Event Editor — Jump                        │ Add Trigger              │
│                                            │ Search...                │
│ Trigger                                    │                          │
│ Conditions                                 │ Categories               │
│ Actions                                    │ System                   │
│                                            │ Input                    │
│                                            │ Object                   │
│                                            │ Collision                │
│                                            │                          │
│                                            │ Input > Keyboard         │
│                                            │ On Key Pressed           │
│                                            │ On Key Released          │
│                                            │ Key Is Held              │
└────────────────────────────────────────────┴──────────────────────────┘
```

Il drawer può aprirsi sul lato destro del Center Workspace, prima dell’Inspector, oppure sovrapporsi leggermente al centro.

Io lo metterei così:

Center Workspace 920 px
────────────────────────────
Event Editor         Picker Drawer
~620 px              ~300 px

L’Inspector destro resta comunque fisso a 320 px e mostra i parametri del blocco selezionato.

Importante: configurazione dopo la selezione

Il picker deve solo scegliere il tipo.

Poi la configurazione dettagliata si fa nel Logic Inspector a destra.

Esempio:

Clicco + Add Trigger

Scelgo:

Input > Keyboard > On Key Pressed

Il blocco viene aggiunto al Trigger

Il Logic Inspector mostra:

Trigger Settings
Type: On Key Pressed
Key: Space
Consume Input: false
Repeat: false

Così il picker resta semplice e l’Inspector resta il luogo corretto per i parametri.

Flusso completo corretto

+ Add Trigger
↓
Picker:
Input > Keyboard > On Key Pressed
↓
Blocco aggiunto:
Trigger: On Key Pressed
↓
Inspector:
Key = Space
Consume Input = false

Per una condition:

+ Add Condition
↓
Picker:
Variable > Compare Variable
↓
Blocco aggiunto:
Self.Variable == value
↓
Inspector:
Target = Self
Variable = isGrounded
Operator = ==
Value = true

Per un’action:

+ Add Action
↓
Picker:
Physics > Add Force
↓
Blocco aggiunto:
Add Force
↓
Inspector:
Target = Self
Axis = Y
Value = -jumpForce
Mode = Impulse

Questo risolve un problema enorme

Eviti che l’utente debba sapere già il nome tecnico di tutto.

Invece di cercare:

OnKeyPressed
CompareVariable
AddForce

l’utente naviga logicamente:

Input → Keyboard → On Key Pressed
Variable → Compare Variable
Physics → Add Force

È molto più accessibile.

Formula definitiva

Sì, la tua idea è giusta. La imposterei così:

Trigger / Condition / Action Picker
────────────────────────────────────
Category
  → Subcategory
    → Item
      → Parameters in Inspector

Esempio concreto:

Trigger:
Input → Keyboard → On Press

Condition:
Variable → Compare Variable → Self.isGrounded == true

Action:
Physics → Add Force → Self Y -jumpForce

Questa struttura è molto più ordinata, scalabile e adatta a un engine visuale.
