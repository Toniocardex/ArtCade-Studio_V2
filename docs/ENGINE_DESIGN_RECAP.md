# ArtCade V2 — Documento di Progettazione

> Riepilogo delle decisioni architetturali, dal paradigma ECS alla fisica e collisioni.
> Nomenclatura allineata al codebase reale — versione 2026-05-28.
>
> **Nel repo:** questo file. Onboarding rapido + link operativi: [`ENGINE_STATE_RECAP_COLLABORATORS.md`](ENGINE_STATE_RECAP_COLLABORATORS.md). Tick order canonico: [`FIXED_STEP_CONTRACT.md`](FIXED_STEP_CONTRACT.md).

---

## 1. Paradigma: OOP vs ECS EnTT

### Confronto

| Aspetto | OOP | ECS (EnTT) |
|---|---|---|
| Intuitività | Alta per progetti piccoli | Curva iniziale più ripida |
| Flessibilità | Gerarchia rigida | Composizione totale |
| Performance | Cache peggiore | Cache-friendly (dati contigui) |
| Scalabilità | Faticosa oltre un certo punto | Scala con centinaia/migliaia di entità |
| Refactoring | Spesso necessario | Minimo, si aggiungono componenti |

### Decisione

**ECS con EnTT** come storage di dati e sistemi. I motivi principali:

- Composizione senza ereditarietà rigida
- Performance migliore per molte entità
- Separazione netta tra dati (componenti) e logica (sistemi)
- EnTT è header-only, matura e ben testata

> OOP e ECS non si escludono: ECS per la logica runtime, OOP per strutture di alto livello (scene manager, asset loader).

**Regola d'oro:** se la regola è "quando il player tocca la moneta, distruggi la moneta", va sulla **Logic Board del tipo Player** (o script Lua), non in un componente C++.

---

## 2. Architettura Generale

```
┌─────────────────┐     compile      ┌──────────────┐
│  Logic Board    │ ───────────────► │  main.lua    │
│  (editor JSON)  │                  │  (bytecode)  │
└─────────────────┘                  └──────┬───────┘
                                             │ luaHost.tick
┌─────────────────┐     materialize   ┌─────▼───────┐
│ objectTypes +   │ ───────────────► │    World     │
│ scene instances │                  │ platformer   │
└─────────────────┘                  │ sensors      │
                                     └─────┬───────┘
                                           │ opzionale
                                     ┌─────▼───────┐
                                     │   physics   │
                                     │   .step     │
                                     └─────────────┘
         EnTT ◄── RuntimeEntityGateway (spawn, components, pools)
```

### Stack tecnologico

| Layer | Tecnologia | Note |
|---|---|---|
| Rendering | Raylib | Native + WASM Emscripten |
| Matematica / Fisica | Raymath custom | No Box2D |
| ECS | EnTT | `EntityRegistry`, gateway |
| Event Bus | `EventBus` custom | Non eventpp — regole in Lua compilato |
| Scripting | Lua via **sol2** | Non LuaBridge |
| Editor | React + TypeScript | Logic Board, Object Types |

### Flusso di un frame — `Application::tickFixedStep`

1. Gameplay systems (`linearMover`, top-down, …) — **non** platformer
2. **`luaHost.tick`** — intent movement/platformer, regole compilate
3. **`tickPlatformerControllers`** — integrazione kinematic + `resolvePlatformerSolidSurfaces`
4. **`physics.step`** (se `physicsMode` lo consente)
5. Sync physics → Transform, sensor edges, lifecycle, auto-destroy

---

## 3. Sistema Eventi — Logic Board

### Pattern When/Then

Il cuore della Logic Board segue il modello mentale:

> *"Se succede questo, fai questa cosa"*

```
WHEN: [condizione]
THEN: [azione]
      → SE [sotto-condizione]:
          THEN: [azione annidata]
```

### Feature della Logic Board

| Feature | Stato |
|---|---|
| When/Then visuale (`wait`, `repeatTimes`) | ✅ |
| Variabili globali `state.*` (blackboard condiviso) | ✅ |
| Sequenze temporali | ✅ |
| Messaggi `event.emit` / `onMessage` | ✅ |
| Target regole su **Object Type** | ✅ |
| Collisioni per regole pickup | ✅ |
| Lua editor per utente avanzato | ✅ |
| Debug overlay board in PLAY | ❌ |

### Sistema Messaggi — EventBus

Permette la comunicazione tra entità senza riferimenti diretti tramite `EventBus` custom:

```
Entity "Switch"
  WHEN: player tocca switch
  THEN: → event.emit("OpenDoor") a [Door_01]

Entity "Door_01"
  WHEN: onMessage "OpenDoor"
  THEN: → play animation "open"
```

### Lua come IR (Intermediate Representation)

Ogni blocco visuale della Logic Board compila in Lua tramite il compiler TypeScript → Lua:

```lua
-- Generato dalla Logic Board del tipo Player
onCollision("Coin", function(self, other)
  if not self.invincible then
    pool.destroy(other)
    state.score = state.score + 10
    audio.play("pickup.wav")
    if state.score > 100 then
      scene.load("Win")
    end
  end
end)
```

L'utente avanzato può aprire e modificare questo codice direttamente nell'editor.

**Ricetta pickup corretta:** Logic Board sul tipo **Player** — *While touching `Coin`* → *Destroy objects of class `Coin`*. Non usare *Destroy This* sul player.

---

## 4. Object Types — Component System

### Concetto

In ArtCade i componenti non sono classi C++ con `attach/detach` — sono **campi JSON** su `ObjectTypeDef` / `EntityDef`. Un Object Type è il corrispondente del prefab Unity / Object Type Construct.

| Concetto | Storage | Runtime |
|---|---|---|
| **Object Type** | `project.objectTypes[id]` | Prototype + Logic Board default |
| **Istanza scena** | `scenes[].instances[]` | `transform`, `instanceName`, `visible` |
| **Pool / classe** | `className === objectTypeId` | `pool.getAll("Coin")` in Lua |

### Formato progetto

- **Versione corrente:** `formatVersion: 2`
- **Legacy:** `entities` solo in lettura alla migrazione — banner in editor se ancora presente
- **Merge:** editor e C++ materializzano `EntityDef` = tipo + override istanza

### Catalogo componenti JSON

| Componente | Ruolo | Stato |
|---|---|---|
| `platformerController` | Velocità, salto, coyote, jump buffer | ✅ |
| `solid` + `surfaceKind: solid` | Blocca da tutti i lati | ✅ |
| `solid` + `surfaceKind: oneWay` | Blocca solo dall'alto | ✅ |
| `sensor` | Trigger enter/exit → eventi | ✅ |
| `linearMover` | Movimento lineare continuo | ✅ |
| Top-down movement | Movimento 8 direzioni | ✅ parziale |
| `PhysicsComponent` + `BodyType` | Corpo fisico dinamico/statico | ✅ |
| Slope | Risoluzione pendenze | ❌ |
| Ladder | Arrampicata / stato OnLadder | ❌ |

> **Nota nomenclatura:** quello che nei doc di design viene chiamato `RigidbodyComponent` nel codebase è `PhysicsComponent` + `BodyType`. Quello che viene chiamato `IBehavior::attach()` nel codebase sono **preset JSON** su Object Types.

### Component System custom in Lua (utente avanzato)

> **Stato:** design intent — l’API `Component { ... }` in Lua **non è ancora** nel runtime; oggi i preset restano JSON su Object Types + script Lua libero.

```lua
-- Definizione componente custom (target)
Component {
    name = "FollowTarget",
    fields = { speed = 100, target = nil },
    onAttach = function(entity)
        entity.follow.speed = 100
    end
}
```

---

## 5. Fisica — Raymath custom, no Box2D

### Motivazioni

- Coerenza dello stack (tutto leggero, no dipendenze pesanti)
- Box2D è overkill per fisica platformer/top-down
- Controllo totale sul game-feel
- Raylib + Raymath già integrati nel renderer

### physicsMode

Configurato a livello **mondo** in `project.world.physicsMode` (non per singolo Object Type):

| Valore | Comportamento |
|---|---|
| `off` | `physics.step` mai — Transform authority (template platformer / arcade) |
| `auto` | Step solo se ci sono corpi attivi |
| `on` | Step sempre |

> Nei template platformer: `world.physicsMode: off`. Il player usa `platformerController` + grounding kinematic; corpo physics opzionale come follower. Dettaglio: [`PHYSICS_OPTIONAL_INTEGRATION_PLAN.md`](PHYSICS_OPTIONAL_INTEGRATION_PLAN.md).

### Limitazioni note

- No swept AABB generale — CCD parziale solo su dynamic in `physics.cpp`
- Slope con angoli arbitrari richiede SAT custom (non implementato)
- Piattaforme mobili: `linearMover` muove l'entità, ma l'ereditarietà della velocità sul player non è documentata

---

## 6. Collision Detection e Resolution — AABB

### Helper nel codebase

```cpp
// Detection
CheckCollisionRecs(rectA, rectB);   // → bool (Raymath)

// Bounding box mondo
shapeWorldAabb(entity);             // → Rectangle (ArtCade)
worldAabb(transform, collider);     // → Rectangle (ArtCade)

// Resolution (physics module + collision_math.h)
bool resolveAabbSeparation(Aabb& movable, const Aabb& fixed, Vec2& outCorrection);
```

### Struttura CollisionInfo (concettuale)

Il modulo physics non espone una struct `CollisionInfo`; la separazione restituisce un **vettore di correzione** (`Vec2 outCorrection`). Equivalente concettuale:

```cpp
struct CollisionInfo {
    bool hit;
    Vector2 normal;  // direzione di separazione
    float depth;     // entità della compenetrazione
};
```

### Calcolo MTV per AABB (pseudocodice)

```cpp
// Logica equivalente a collision_math.h — firma reale usa Aabb + outCorrection
CollisionInfo resolveAabbSeparation(Rectangle a, Rectangle b) {
    float overlapX = (a.x + a.width  / 2) - (b.x + b.width  / 2);
    float overlapY = (a.y + a.height / 2) - (b.y + b.height / 2);

    float combinedHalfW = (a.width  + b.width)  / 2;
    float combinedHalfH = (a.height + b.height) / 2;

    float penetrationX = combinedHalfW - std::abs(overlapX);
    float penetrationY = combinedHalfH - std::abs(overlapY);

    if (penetrationX <= 0 || penetrationY <= 0)
        return { false };

    if (penetrationX < penetrationY) {
        return { true, { overlapX < 0 ? -1.0f : 1.0f, 0.0f }, penetrationX };
    } else {
        return { true, { 0.0f, overlapY < 0 ? -1.0f : 1.0f }, penetrationY };
    }
}
```

---

## 7. Platformer — Pipeline `resolvePlatformerSolidSurfaces`

### Implementazione attuale (codebase)

| File | Ruolo |
|------|--------|
| `runtime-cpp/src/world/src/world_platformer_controller.cpp` | Coyote/buffer, intent, integrazione `position += velocity * dt` (**X e Y insieme**) |
| `runtime-cpp/src/world/src/world_grounding.cpp` | `resolvePlatformerSolidSurfaces` — **multi-pass** `tryResolveAgainstSurface` (solid, one-way, tilemap), poi floor snap |

Non c’è un loop EnTT con `Rigidbody` nel platformer: authority = **Transform** via `World` + `RuntimeEntityGateway`.

### Obiettivo design: separare Y e X

Risolvere X e Y nello stesso pass di separation può dare bug agli angoli. Per **Slope/Ladder** conviene evolvere verso:

1. **Prima Y** — gravità, grounded, collisioni verticali  
2. **Poi X** — muri e spigoli  

Il blocco sotto è **riferimento didattico** (target), non il codice copy-paste di oggi.

```cpp
// TARGET / pseudocodice — non corrisponde 1:1 al sorgente attuale
void resolvePlatformerSolidSurfaces(entt::registry& reg, float dt) {

    for (auto [dynE, rb, dynTf, dynCol] : dynamic.each()) {
        auto& state = reg.get<PlatformerControllerComponent>(dynE);
        state.grounded = false;

        // Gravità
        if (!state.grounded) {
            rb.velocity.y += gravity * dt;
            rb.velocity.y = std::min(rb.velocity.y, maxFallSpeed);
        }

        // ── PASS 1: solo Y ─────────────────────────────────────────
        dynTf.position.y += rb.velocity.y * dt;

        for (auto [stE, stTf, stCol] : statics.each()) {
            auto info = resolveAabbSeparation(
                worldAabb(dynTf, dynCol),
                worldAabb(stTf, stCol)
            );
            if (!info.hit || info.normal.y == 0) continue;

            // surfaceKind oneWay: risolvi solo se player viene dall'alto
            if (stCol.surfaceKind == SurfaceKind::OneWay) {
                if (info.normal.y >= 0) continue;
                if (rb.velocity.y < 0) continue;
            }

            dynTf.position.y += info.normal.y * info.depth;
            rb.velocity.y = 0;
            if (info.normal.y < 0) state.grounded = true;
        }

        // ── PASS 2: solo X ─────────────────────────────────────────
        dynTf.position.x += rb.velocity.x * dt;

        for (auto [stE, stTf, stCol] : statics.each()) {
            if (stCol.surfaceKind == SurfaceKind::Trigger) continue;

            auto info = resolveAabbSeparation(
                worldAabb(dynTf, dynCol),
                worldAabb(stTf, stCol)
            );
            if (!info.hit || info.normal.x == 0) continue;

            dynTf.position.x += info.normal.x * info.depth;
            rb.velocity.x = 0;
        }
    }
}
```

---

## 8. Ladder System ❌ — Design Intent

> Non ancora implementato. Chi lo implementa deve agganciarsi a `resolvePlatformerSolidSurfaces`.

### Componenti previsti

```cpp
struct LadderComponent {
    float topY;
    float bottomY;
};

struct OnLadderComponent {
    entt::entity ladder;
};
```

### Logica di stato

```
Player entra nel sensor della scala
    └── Premi SU/GIÙ → aggancia
            ├── physicsMode: off (già default)
            ├── disabilita gravità nel platformer controller
            ├── velocity.y = input * ladderSpeed
            └── Premi Jump → sgancia + jumpForce
                Raggiungi topY → sgancia automaticamente
```

Il `LadderComponent` usa `surfaceKind: trigger` — non blocca fisicamente.

---

## 9. Game Feel — Coyote Time e Jump Buffer

Implementati in `PlatformerControllerComponent` + `world_platformer_controller.cpp`.
Test di riferimento: `world-intent-test.cpp`.

```cpp
struct PlatformerControllerComponent {
    bool grounded;
    float coyoteTimer;      // es. 0.1f sec dopo aver lasciato il bordo
    float jumpBufferTimer;  // es. 0.1f sec per input anticipato
};
```

### Coyote Time

```cpp
if (state.grounded) {
    state.coyoteTimer = coyoteTime;
} else {
    state.coyoteTimer -= dt;
}

bool canJump = state.grounded || state.coyoteTimer > 0;
if (input.isPressed("Jump") && canJump) {
    rb.velocity.y = jumpForce;
    state.coyoteTimer = 0;
}
```

### Jump Buffer

```cpp
if (input.isPressed("Jump")) {
    state.jumpBufferTimer = jumpBufferTime;
}
state.jumpBufferTimer -= dt;

if (state.grounded && state.jumpBufferTimer > 0) {
    rb.velocity.y = jumpForce;
    state.jumpBufferTimer = 0;
}
```

---

## 10. Dialog System — Design Intent

> Non ancora implementato. Da aggiungere in roadmap.

### Architettura prevista

```
Dialog Editor (nodi visivi)
        ↓ esporta
   dialog_npc.json
        ↓
  DialogComponent       ← attaccato all'Object Type NPC
        ↓
  DialogSystem          ← processa nodi, stato, condizioni Lua
        ↓
  DialogRenderer        ← box testo, typewriter, scelte — via Raylib
```

### Tipi di nodo

| Nodo | Funzione |
|---|---|
| `SayNode` | Un personaggio dice qualcosa |
| `ChoiceNode` | Il giocatore sceglie tra opzioni |
| `ConditionNode` | Branch su variabile `state.*` |
| `SetVariableNode` | Modifica `state.*` |
| `EmitEventNode` | `event.emit()` verso Logic Board |
| `EndNode` | Termina il dialogo |

### Integrazione Logic Board

```
WHEN: player invia messaggio "talk" a [NPC]
THEN: → attiva DialogComponent su [NPC]

WHEN: onMessage "QuestAccepted"         ← emesso da EmitEventNode
THEN: → aggiungi item "mappa"
      → attiva quest "trova_artefatto"
```

### Roadmap Dialog System

| Priorità | Step |
|---|---|
| 1 | Data Model + parser JSON |
| 2 | DialogComponent + DialogSystem |
| 3 | DialogRenderer + typewriter effect |
| 4 | Integrazione Logic Board via `event.emit` |
| 5 | Ritratti personaggio, flag "già visto", localizzazione |
| 6 | Dialog Editor visuale (imnodes + ImGui) |

---

## 11. Roadmap Aperta

| Priorità | Item | Note |
|---|---|---|
| 🔴 Alta | **Slope** — collision resolution | Agganciarsi a `resolvePlatformerSolidSurfaces` |
| 🔴 Alta | **Ladder** — componente + sistema | `surfaceKind: trigger` + stato `OnLadder` |
| 🔴 Alta | Documento `resolvePlatformerSolidSurfaces` | Prerequisito per Slope e Ladder |
| 🟡 Media | Piattaforme mobili — velocity inheritance | Valutare con `linearMover` esistente |
| 🟡 Media | Dialog System (vedi §10) | Data Model prima di tutto |
| 🟡 Media | CCD / swept AABB più generale | Solo parziale su dynamic oggi |
| 🟢 Bassa | Debug overlay Logic Board in PLAY | UX runtime — solo `debug.*` Lua oggi |

---

## 12. Tabella Nomenclatura — Doc esterni vs Codebase

| Doc di design / chat | ArtCade V2 — codebase reale |
|---|---|
| `RigidbodyComponent` | `PhysicsComponent` + `BodyType` |
| `StaticBodyComponent` | `solid` + `surfaceKind` (campo JSON) |
| `ColliderComponent (Trigger)` | `sensor` (campo JSON) |
| `IBehavior::attach()` | Preset JSON su `ObjectTypeDef` |
| `PlatformerStateComponent` | `PlatformerControllerComponent` |
| `getWorldRect()` | `shapeWorldAabb()` / `worldAabb()` |
| `resolveAABB()` | `resolveAabbSeparation()` |
| `eventpp` + `RuleEngine C++` | `EventBus` custom + Lua compilato |
| `LuaBridge` | **sol2** |
| `entity_class` | `object_type` (alias legacy in migrazione) |
| "Behavior System" | "Component System" (Object Types v2) |

---

*Documento aggiornato il 2026-05-28 — allineato alla nomenclatura reale di ArtCade V2.*
*Aggiornare quando cambiano: formato progetto, tick order, physicsMode, nuovi sistemi.*
