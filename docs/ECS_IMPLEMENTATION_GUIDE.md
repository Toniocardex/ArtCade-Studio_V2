# ArtCade V2 — ECS Implementation Guide (EnTT)

> **Audience**: Sviluppatori C++  
> **Libreria**: EnTT 3.13.0 (header-only)  
> **Versione**: 1.0  
> **Data**: 2026-05-10

---

## TL;DR — ECS in ArtCade

**Entity**: Numero intero (ID)  
**Component**: Struct C++ con dati (Transform, Sprite, RigidBody, etc.)  
**System**: Funzione che itera entity con specifici componenti e li aggiorna  
**Registry**: Contenitore centrale (EnTT::registry)

```cpp
// Create entity con componenti
EntityId player = registry.create();
registry.emplace<Transform>(player, pos, rot, scale);
registry.emplace<Sprite>(player, assetId, tint, alpha);
registry.emplace<RigidBody>(player, handle);

// Query: tutte le entity con Transform + Sprite
auto view = registry.view<Transform, Sprite>();
for (auto entity : view) {
    auto& trans = view.get<Transform>(entity);
    auto& spr = view.get<Sprite>(entity);
    renderer->drawSprite(spr, trans);
}

// Destroy
registry.destroy(player);
```

---

## 1. Struttura Componenti

### Definizione

Un **Component** è un semplice struct C++, zero logica:

```cpp
// core/components.h (o components/<nome>.h)

struct Transform {
    Vec2 position;
    float rotation;      // radianti
    Vec2 scale;
    // Zero methods — solo dati
};

struct Sprite {
    std::string spriteAssetId;   // "hero_idle.png"
    Color tint;                  // {r, g, b, a}
    float alpha;
    Vec2 pivot;                  // {0.5, 1.0} = center-bottom
    int renderOrder;             // z-depth
};

struct RigidBody {
    uint32_t handle;             // Box2D body handle
    Vec2 velocity;
    Vec2 force;
};

struct Script {
    std::string scriptPath;      // "scripts/player.lua"
    sol::object luaRef;          // Lua reference (se caricato)
};

struct Health {
    int maxHp;
    int currentHp;
};

struct Collectible {
    int value;                   // score points
    bool collected;
};
```

**Regole**:
- Struct pure — zero virtual methods
- Zero inheritance
- Dati pubblici OK
- No smart pointers (store copyable data solo)
- Se serve logica → usa System (non Component)

### Component Registry

Nel `types.h` registra tutti i componenti disponibili:

```cpp
// core/types.h
using ComponentList = std::tuple<
    Transform, Sprite, RigidBody, Script, Health, Collectible,
    // aggiungi qui...
>;

// Helper per iterazione componenti
template<typename F>
void forEachComponentType(F&& f) {
    std::apply([&](auto&&... component) {
        (..., f(component));
    }, ComponentList{});
}
```

---

## 2. Registry (il World)

### Dichiarazione

```cpp
// world/world.h
class World {
    entt::registry registry;
    
public:
    EntityId createEntity() {
        return registry.create();
    }
    
    void destroyEntity(EntityId id) {
        registry.destroy(id);
    }
    
    template<typename C>
    void emplace(EntityId entity, C&& component) {
        registry.emplace<C>(entity, std::forward<C>(component));
    }
    
    template<typename C>
    C& get(EntityId entity) {
        return registry.get<C>(entity);
    }
    
    template<typename C>
    bool has(EntityId entity) {
        return registry.any_of<C>(entity);
    }
    
    template<typename... Cs>
    auto view() {
        return registry.view<Cs...>();
    }
};
```

### Uso

```cpp
// app.cpp
World world;

// Crea giocatore
EntityId player = world.createEntity();
world.emplace<Transform>(player, Vec2{640, 360}, 0.f, Vec2{1, 1});
world.emplace<Sprite>(player, "hero.png", Color{1,1,1,1}, 1.f);
world.emplace<RigidBody>(player, physics->createBody(...));

// Query
auto view = world.view<Transform, Sprite>();
for (auto e : view) {
    auto& t = view.get<Transform>(e);
    auto& s = view.get<Sprite>(e);
    // render...
}

// Has component?
if (world.has<Health>(player)) {
    auto& hp = world.get<Health>(player);
    hp.currentHp--;
}

// Destroy
world.destroyEntity(player);
```

---

## 3. Systems

### Pattern System

Un **System** è una funzione che:
1. Crea una view con componenti specifici
2. Itera entity in quella view
3. Aggiorna i componenti

```cpp
// systems/physics_system.h
class PhysicsSystem {
    Physics* physics_;
    World* world_;
    
public:
    PhysicsSystem(Physics* p, World* w) : physics_(p), world_(w) {}
    
    void update(float dt) {
        // Query entity con RigidBody + Transform
        auto view = world_->view<RigidBody, Transform>();
        
        for (auto entity : view) {
            auto& rb = view.get<RigidBody>(entity);
            auto& trans = view.get<Transform>(entity);
            
            // Aggiorna Box2D
            physics_->setLinearVelocity(rb.handle, rb.velocity);
            
            // Sync posizione
            auto pos = physics_->getPosition(rb.handle);
            trans.position = pos;
        }
    }
};

// systems/render_system.h
class RenderSystem {
    Renderer* renderer_;
    World* world_;
    
public:
    RenderSystem(Renderer* r, World* w) : renderer_(r), world_(w) {}
    
    void draw() {
        auto view = world_->view<Transform, Sprite>();
        
        for (auto entity : view) {
            auto& trans = view.get<Transform>(entity);
            auto& spr = view.get<Sprite>(entity);
            
            renderer_->drawSprite(spr, trans.position, trans.rotation, trans.scale);
        }
    }
};

// systems/lua_system.h
class LuaSystem {
    LuaHost* lua_;
    World* world_;
    
public:
    LuaSystem(LuaHost* l, World* w) : lua_(l), world_(w) {}
    
    void tick(float dt) {
        auto view = world_->view<Script, Transform>();
        
        for (auto entity : view) {
            auto& script = view.get<Script>(entity);
            auto& trans = view.get<Transform>(entity);
            
            // Chiama tick(dt) per questo entity in Lua
            if (script.luaRef.valid()) {
                lua_->callEntityTick(script.luaRef, entity, dt);
            }
        }
    }
};
```

### Integration nel Game Loop

```cpp
// app.cpp::loopIteration()
void Application::loopIteration() {
    // ...
    
    while (accumulator >= targetDt) {
        renderer->clearDrawQueue();
        
        timeManager->tick(targetDt);
        tweenManager->update(targetDt);
        spriteAnimator->update(targetDt);
        
        // ⚠️ IMPORTANTE: Svuota draw queue prima di Lua
        // così che il tick() di questo frame non accumuli disegni del precedente
        
        luaSystem->tick(targetDt);      // Lua modifica Transform, Sprite, etc.
        physics->step(targetDt);        // Physics engine aggiorna RigidBody
        physicsSystem->update(targetDt);  // Sync Box2D → Transform
        
        eventBus->flushDeferred();
        audio->update();
        
        accumulator -= targetDt;
    }
    
    renderer->beginFrame(bgColor);
    renderSystem->draw();              // Query Transform + Sprite
    renderer->endFrame();
    
    input->resetFrameState();
}
```

---

## 4. Common Patterns

### 4.1 Query with Multiple Components

```cpp
// Entity con sia Transform che Sprite
auto view = world.view<Transform, Sprite>();

for (auto entity : view) {
    auto [trans, sprite] = view.get<Transform, Sprite>(entity);
    // Structured binding (C++17)
}

// Equivalente (C++11):
for (auto entity : view) {
    auto& trans = view.get<Transform>(entity);
    auto& sprite = view.get<Sprite>(entity);
    // ...
}
```

### 4.2 Query with Exclude

```cpp
// Tutte le entity con Sprite che NON sono Collectible
auto view = world.view<Sprite>(entt::exclude<Collectible>);

for (auto entity : view) {
    // Questo non ha Collectible
}
```

### 4.3 Query All (any component)

```cpp
// Tutte le entity che hanno Transform (indipendentemente da altri)
auto view = world.view<Transform>();

for (auto entity : view) {
    auto& trans = view.get<Transform>(entity);
}
```

### 4.4 Add/Remove Component Runtime

```cpp
// Add dopo creation
EntityId coin = world.createEntity();
world.emplace<Sprite>(coin, "coin.png", ...);
// ... più tardi ...
world.emplace<Collectible>(coin, 10, false);  // Add

// Remove
world.remove<Collectible>(coin);  // ora coin non appare in view<Collectible>

// Replace
auto& hp = world.get<Health>(entity);
hp.currentHp = 0;
// oppure
world.replace<Health>(entity, 0, 100);  // {currentHp, maxHp}
```

### 4.5 Get with Default / Optional

```cpp
// Check prima di get
if (world.has<Health>(entity)) {
    auto& hp = world.get<Health>(entity);
    // ...
}

// Oppure usa try_get (ritorna pointer, nullptr se non esiste)
if (auto* hp = world.try_get<Health>(entity)) {
    hp->currentHp--;
}
```

### 4.6 Iterate Over View with Payload

```cpp
// Vuoi passare dati extra dentro il loop
auto view = world.view<Transform, Sprite>();
view.each([&](auto entity, auto& trans, auto& spr) {
    renderer->drawSprite(spr, trans);
});
```

---

## 5. Performance Tips

### 1. Cache Locality

ECS è veloce **perché** i componenti dello stesso tipo sono in array densi:

```
❌ Bad (OOP):
Entity { Transform*, Sprite*, RigidBody*, ... }  // Pointer jumps
Entity { Transform*, Sprite*, RigidBody*, ... }
Entity { Transform*, Sprite*, RigidBody*, ... }
CPU cache miss ogni access

✅ Good (ECS):
Transform[] { pos, pos, pos, ... }               // Linear array
Sprite[] { asset, asset, asset, ... }            // Linear array
RigidBody[] { handle, handle, handle, ... }
CPU cache hit = 10× faster
```

**Lezione**: Iteru sugli array densi (view), non salta tra entity sparse.

### 2. View Caching

```cpp
// ❌ Slow: Crea view ogni frame
for (int frame = 0; frame < 1000; frame++) {
    auto view = world.view<Transform, Sprite>();  // Allocazione ogni volta
    for (auto e : view) { ... }
}

// ✅ Fast: Salva view
auto view = world.view<Transform, Sprite>();
for (int frame = 0; frame < 1000; frame++) {
    for (auto e : view) { ... }
}
```

View di EnTT sono **lazy** — non allocano, cachano solo il filtro internamente.

### 3. Batch Operations

```cpp
// ❌ Slow: Destroy uno per uno
for (auto entity : entities_to_delete) {
    world.destroyEntity(entity);
}

// ✅ Fast: Batch destroy
world.destroyEntity(entities_to_delete.begin(), entities_to_delete.end());
```

### 4. No Virtual Methods in Components

```cpp
// ❌ No
struct Entity {
    virtual void update(float dt) = 0;
};

// ✅ Yes: Logica in System
struct Transform { Vec2 pos; };
class TransformSystem {
    void update(float dt) {
        auto view = world.view<Transform>();
        for (auto e : view) { ... }
    }
};
```

---

## 6. Hot-Reload (Lua Integration)

### Pattern: Script Component

```cpp
struct Script {
    std::string scriptPath;
    sol::object luaRef;  // Reference Lua per this entity
};
```

### Reload on Save (from Editor)

```cpp
// Dalla editor React via WASM interop
void editorReloadScript(EntityId entity, const std::string& scriptCode) {
    // 1. Ricompila bytecode
    auto bytes = luaHost->compile(scriptCode);
    
    // 2. Riacaricar in VM
    luaHost->loadBytecodeBuffer(bytes.data(), bytes.size());
    
    // 3. Aggiorna reference
    auto& script = world.get<Script>(entity);
    script.luaRef = luaHost->getGlobal("onTick");
}
```

### Tick Entity's Lua

```cpp
void LuaSystem::tick(float dt) {
    auto view = world.view<Script>();
    for (auto entity : view) {
        auto& script = view.get<Script>(entity);
        if (script.luaRef.valid()) {
            // Chiama tick(entityId, dt) in Lua
            auto result = script.luaRef(entity, dt);
            // Opzionale: gestisci errori
        }
    }
}
```

---

## 7. Common Mistakes

❌ **Mistake 1**: Modificare component durante view iteration

```cpp
// Sbagliato — invalidate iterator
auto view = world.view<Transform>();
for (auto e : view) {
    if (some_condition) {
        world.emplace<Health>(e, 100, 100);  // Modifica durante iterazione!
    }
}
```

✅ **Fix**: Accumula modifiche, applica dopo

```cpp
std::vector<EntityId> toModify;
auto view = world.view<Transform>();
for (auto e : view) {
    if (some_condition) {
        toModify.push_back(e);
    }
}
for (auto e : toModify) {
    world.emplace<Health>(e, 100, 100);
}
```

❌ **Mistake 2**: View non è "sorted" — iterazione order è non-deterministica

```cpp
auto view = world.view<Transform>();
// Ordine non garantito tra frame — hazard Lua determinismo
```

✅ **Fix**: Se determinismo crittico, sort view

```cpp
auto view = world.view<Transform>();
std::vector<EntityId> sorted(view.begin(), view.end());
std::sort(sorted.begin(), sorted.end());
for (auto e : sorted) { ... }
```

❌ **Mistake 3**: Tenere pointer/reference a component tra frame

```cpp
auto& sprite = world.get<Sprite>(entity);
// Use sprite...
// Fine frame, altri system potrebbe aver modified registry
// sprite reference è INVALIDO
```

✅ **Fix**: Get inside loop, non cache

```cpp
for (auto e : view) {
    auto& sprite = view.get<Sprite>(e);  // Fresh ogni iterazione
}
```

---

## 8. Integration con EngineContext

```cpp
// core/engine-context.h
struct EngineContext {
    World* world;
    Physics* physics;
    Renderer* renderer;
    LuaHost* lua;
    // ...
};

// app/app.cpp
World world;
PhysicsSystem physicsSystem(&physics, &world);
RenderSystem renderSystem(&renderer, &world);
LuaSystem luaSystem(&luaHost, &world);

EngineContext ctx{&world, &physics, &renderer, &luaHost};
```

---

## 9. Testing

```cpp
// tests/ecs_test.cpp
TEST(ECS, CreateAndQuery) {
    World world;
    
    auto e1 = world.createEntity();
    world.emplace<Transform>(e1, Vec2{0, 0}, 0.f, Vec2{1, 1});
    world.emplace<Sprite>(e1, "test.png", Color{1,1,1,1}, 1.f);
    
    auto e2 = world.createEntity();
    world.emplace<Transform>(e2, Vec2{10, 10}, 0.f, Vec2{1, 1});
    // e2 NO Sprite
    
    auto view = world.view<Transform, Sprite>();
    int count = 0;
    for (auto e : view) {
        ASSERT_EQ(e, e1);  // Solo e1
        count++;
    }
    ASSERT_EQ(count, 1);
}

TEST(ECS, Destroy) {
    World world;
    auto e = world.createEntity();
    world.emplace<Transform>(e, {}, 0.f, {1,1});
    
    world.destroyEntity(e);
    
    auto view = world.view<Transform>();
    ASSERT_EQ(0, std::distance(view.begin(), view.end()));
}
```

---

## Riferimenti

- **TECHNICAL_OVERVIEW.md** — §3.5 ECS Architecture
- **EnTT Docs**: https://github.com/skypjack/entt
- **ArtCade Components**: `runtime-cpp/src/core/components.h` (future)
- **World Class**: `runtime-cpp/src/world/world.h` (future)

---

*Questa guida è per sviluppatori C++ che implementano moduli ECS. Domande? Vedi TECHNICAL_OVERVIEW.md o wiki interno.*
