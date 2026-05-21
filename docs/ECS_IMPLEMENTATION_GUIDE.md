# ArtCade V2 — ECS Implementation Guide (EnTT)

> **Audience**: Sviluppatori C++ del runtime  
> **Libreria**: EnTT 3.13.2 (header-only, vendored via CMake `FetchContent`)  
> **Versione**: 2.0 (post-migrazione EnTT)
> **Data**: 2026-05-21

---

## TL;DR — Architettura ECS in ArtCade

ArtCade *non* espone `entt::registry` direttamente al resto del runtime.
La storia componenti è dietro una facciata stabile (`RuntimeEntityGateway`)
così che Lua, editor e sistemi di gioco vedano un'API uniforme e i call
site non cambino quando l'implementazione interna evolve.

```
+----------------------------------+
| Lua scripts (entity.*, pool.*)   |
| Editor API (editor_set_transform)|
| Game systems (World, render, …)  |
+----------------┬-----------------+
                 │   typed get/set + visitors
                 ▼
+----------------------------------+
| RuntimeEntityGateway             |  ← API pubblica (header)
+----------------┬-----------------+
                 │   delega
                 ▼
+----------------------------------+
| EntityRegistry  (PIMPL)          |  ← implementazione privata
|   struct Impl { entt::registry } |     (entt headers NON nel public API)
+----------------------------------+
```

**Regole d'oro**:

1. **Nessun nuovo sistema deve includere `<entt/entt.hpp>` fuori da
   `entity-registry.cpp`.** Tutti gli accessi passano per il gateway.
2. **Ordine di iterazione deterministico**: il gateway garantisce
   insertion-order su `allIds()`, sui visitor (`forEachActive*`) e sugli
   indici `byTag` / `poolByClass`. EnTT da solo non lo garantisce — vedi §4.
3. **Authoring vs runtime**: `EntityDef` (in `core/types.h`) è un DTO
   usato solo per caricare il `ProjectDoc` JSON. Una volta caricata la
   scena, i dati vivono nei componenti EnTT, non in `EntityDef`.

---

## 1. Componenti

I componenti sono struct pure definite in `runtime-cpp/src/core/types.h`
(o in moduli specifici per quelli più contestuali, p.es. logic-system).

Tipi che il registry istanzia automaticamente alla creazione di una
entità (vedi `EntityRegistry::Impl::ensure`):

- `Transform`           — posizione, rotazione, scala, velocity
- `SpriteComponent`     — asset sprite, tint, alpha, shader effect
- `PhysicsComponent`    — body type, shape, friction, restituzione
- `PhysicsHandleComp`   — `uint32_t value` (handle Box2D, 0 se assente)
- `Identity`            — className + tags (usati anche per gli indici)

Tipi opzionali (emplace on demand via `EntityRegistry::set*`):

- `SensorComponent`              — sensori overlap (targetTag, eventType)
- `PlatformerControllerComponent`— config controller jump/run
- `AutoDestroyComponent`         — `lifespan` + `_timeAlive`
- `AnimationComponent`           — sprite animator
- `Sprite4DirComponent`          — 4-direction sprite
- *(estendibili — vedi §6)*

Tag interni:

- `SceneActiveTag`               — entità live nella scena corrente

**Regole sui componenti**:

- Struct semplici, niente metodi virtuali, niente eredità.
- Solo dati copiabili (no smart pointer owning).
- Logica → un sistema (visitor sul gateway o module dedicato), mai nel
  componente.

---

## 2. RuntimeEntityGateway — facciata pubblica

Il gateway è il punto di contatto unico per leggere/scrivere componenti
runtime. La sua API include:

```cpp
// Ciclo di vita
EntityId create();                              // alloca id + componenti default
EntityId spawnFromClass(const std::string&);    // alloca + copia da EntityDef di classe
void     queueDestroy(EntityId);
bool     exists(EntityId) const;

// Component accessors (typed, value-based)
bool getTransform(EntityId, Transform&) const;
void setTransform(EntityId, const Transform&);
bool getSprite(EntityId, SpriteComponent&) const;
void setSprite(EntityId, const SpriteComponent&);
// ... idem per Physics, Sensor, Platformer, AutoDestroy, ...

// Pool/tag query (deterministici, insertion order)
std::vector<EntityId> poolByClass(const std::string&) const;
std::vector<EntityId> byTag(const std::string&) const;
std::vector<EntityId> allIds() const;
std::vector<EntityId> activeSceneIds() const;
```

`get*` ritorna `bool` (`true` se il componente è presente *e* l'entità
esiste); `set*` fa `emplace_or_replace` sotto il cofano.

---

## 3. Visitor system (pattern moderno per i sistemi)

Per i sistemi che girano ogni frame su gruppi di entità è disponibile
una famiglia di visitor sul gateway. Ogni visitor fa una sola
iterazione del registry, filtra per `SceneActiveTag`, fa `try_get` dei
componenti richiesti e invoca la callback solo se tutti sono presenti.

```cpp
// Visitor disponibili (RuntimeEntityGateway):
forEachActiveRenderable(fn)   // (id, const Transform&, const SpriteComponent&)
forEachActivePhysicsBody(fn)  // (id, uint32_t handle, Transform&)        ← Transform mutabile
forEachActivePlatformer(fn)   // (id, const PlatformerControllerComponent&)
forEachActiveSensor(fn)       // (id, const SensorComponent&)
forEachActiveAutoDestroy(fn)  // (id, AutoDestroyComponent&)              ← componente mutabile
```

### Esempio: rendering sprite (app.cpp)

```cpp
mod_->entityGateway->forEachActiveRenderable(
    [renderer = mod_->renderer.get()]
    (EntityId, const Transform& t, const SpriteComponent& s) {
        renderer->drawSprite(
            s.spriteAssetId,
            t.position, t.rotation, t.scale,
            s.tint, s.alpha, s.shaderEffect);
    });
```

### Esempio: sync fisica → entità (World)

```cpp
void World::syncPhysicsToEntities() {
    entityGateway_.forEachActivePhysicsBody(
        [this](EntityId, uint32_t handle, Transform& t) {
            t.position = physics_.getPosition(handle);
            t.velocity = physics_.getLinearVelocity(handle);
        });
}
```

### Esempio: countdown autoDestroy (mutazione in-place)

```cpp
auto* gateway = mod_->entityGateway.get();
gateway->forEachActiveAutoDestroy(
    [gateway, dt](EntityId id, AutoDestroyComponent& a) {
        if (a.lifespan <= 0.f) return;
        a._timeAlive += dt;
        if (a._timeAlive >= a.lifespan)
            gateway->queueDestroy(id);
    });
gateway->flushPendingOperations();
```

**Quando usare un visitor** vs `for (id : activeSceneIds())`:

- Sempre, se accedi a uno o più componenti per entità.
- Il visitor evita la doppia lookup (`activeSceneIds()` poi `getX(id)`)
  e usa direttamente `entt::registry::try_get` interno.

**Quando ricadere sui pool**:

- `pool.getAll(class)` o `byTag(tag)` quando vuoi un sottoinsieme già
  indicizzato per className/tag (es. proiettili di una classe).

---

## 4. Determinismo

ArtCade è single-threaded, fixed-timestep e Lua-driven: per essere
riproducibile (replay, network sync futuro) l'iterazione lato C++ deve
essere stabile run su run.

**Politiche enforced da `EntityRegistry`**:

| API                              | Ordine                                      |
| -------------------------------- | ------------------------------------------- |
| `allIds()`                       | insertion order (vettore `insertionOrder`)  |
| `forEachActive*()` visitor       | insertion order + filtro `try_get`          |
| `poolByClass(className)`         | insertion order, filtrato per classe        |
| `byTag(tag)`                     | insertion order, filtrato per tag           |
| `activeSceneIds()`               | ordine `scene->entityIds` (autoring order)  |

EnTT *non* garantisce nulla sull'ordine di `view::each` cross-run, perciò
il registry non lo espone mai direttamente. Gli indici `classIndex` /
`tagIndex` sono mantenuti a mano su `setIdentity` / `erase`.

Se in futuro vorrai esporre una variante "fast path" non deterministica
(es. rendering massive), aggiungi un metodo separato e marca il
`SceneActiveTag` come ordering, **senza** rimuovere i visitor attuali.

---

## 5. Ciclo di vita di un'entità

```text
[carica progetto]
  ProjectDoc JSON → EntityDef[] (DTO authoring)
       │
       ▼
  RuntimeEntityGateway::replaceProject(doc)
       │  per ogni EntityDef:
       │   1. registry.allocate(hint = def.id)
       │   2. setTransform/Sprite/Physics/Identity da def
       ▼
  Scene caricata: SceneManager::activate(scene) +
                  registry.set(SceneActiveTag) sui suoi entityIds

[runtime]
  Lua/system chiamano set*(id, …) → entt::emplace_or_replace
  Lua/system chiamano get*(id, …) → entt::try_get
  Lua/system iterano  forEachActive*() → 1 pass, deterministico

[spawn dinamico]
  gateway.spawnFromClass("Bullet") → alloca id, copia componenti dalla
  classe-EntityDef cached, marca scene-active, appende a
  scene->entityIds (ordine deterministico)

[destroy]
  gateway.queueDestroy(id) → entrata in pendingDestroy_
  fine frame: flushPendingOperations() → registry.erase(id) →
              entt::registry::destroy + cleanup indici
```

---

## 6. Aggiungere un nuovo componente

Esempio: aggiungere `HealthComponent`.

1. **Definisci lo struct** in `core/types.h`:

   ```cpp
   struct HealthComponent {
       int currentHp = 0;
       int maxHp     = 0;
   };
   ```

2. **Aggiungi accessor sul registry** (`entity-registry.h/.cpp`):

   ```cpp
   bool getHealth(EntityId id, HealthComponent& out) const;
   void setHealth(EntityId id, const HealthComponent& comp);
   void removeHealth(EntityId id);
   ```

   Implementazione tipica nel `.cpp`:

   ```cpp
   bool EntityRegistry::getHealth(EntityId id, HealthComponent& out) const {
       const entt::entity e = impl_->toEntt(id);
       if (e == entt::null) return false;
       if (const auto* c = impl_->reg.try_get<HealthComponent>(e)) {
           out = *c;
           return true;
       }
       return false;
   }

   void EntityRegistry::setHealth(EntityId id, const HealthComponent& comp) {
       const entt::entity e = impl_->ensure(id);
       impl_->reg.emplace_or_replace<HealthComponent>(e, comp);
   }
   ```

3. **Esponilo sul gateway** con la stessa firma: il gateway delega a
   `registry_->get/setHealth(...)`.

4. **(Opzionale) Visitor** se userai il componente in un sistema per
   frame:

   ```cpp
   using ActiveHealthFn = std::function<void(EntityId, HealthComponent&)>;
   void forEachActiveHealth(const ActiveHealthFn& fn);
   ```

   Implementa la callback iterando `insertionOrder`, filtrando per
   `SceneActiveTag`, `try_get<HealthComponent>`.

5. **Lua binding** (se l'API è esposta): aggiungi in
   `entity-api.cpp` o un nuovo `health-api.cpp`, usando il gateway
   pubblico — niente `entt` nel binding.

---

## 7. EntityId mapping

`EntityId` (alias di `uint32_t` in `core/types.h`) è l'identificativo
*stabile per progetto* usato da JSON, save file, editor e Lua.

`entt::entity` è un id compatto interno a EnTT che cambia ad ogni run
(non è persistente). Il mapping vive in `EntityRegistry::Impl::ids`:

```cpp
std::unordered_map<EntityId, entt::entity> ids;
```

`EntityRegistry::Impl::ensure(id)` crea il record EnTT, applica i
componenti default e registra la mappa. `erase(id)` rimuove anche
dalla mappa.

*Nota futura*: si potrebbe sfruttare `entt::entity_traits` per usare
direttamente `EntityId` come tipo entità, eliminando l'unordered_map.
Per ora il mapping a parte tiene il public type indipendente dalla
versione di EnTT.

---

## 8. Errori comuni

❌ **Includere `entt/entt.hpp` fuori da `entity-registry.cpp`**

Rompe la separazione PIMPL e fa esplodere i tempi di compilazione del
codice consumer.

✅ Usa solo l'API del gateway. Se ti serve nuovo accesso, aggiungilo al
registry e al gateway (vedi §6).

---

❌ **Iterare con `for (id : allIds())` e poi `getX(id)` ripetutamente**

Funziona ma fa due lookup per componente (mappa id→entt + entt try_get).
Su scene con migliaia di entità si sente.

✅ Usa un visitor (`forEachActive*`): un solo pass, `try_get` direttamente
sui pool EnTT.

---

❌ **Mutare il registry dentro un visitor (create / destroy / setIdentity)**

I visitor non sono rientranti: emplace/erase durante l'iterazione può
invalidare gli iteratori interni di EnTT.

✅ Accumula gli `EntityId` da modificare in un vettore locale; applica
fuori dal visitor, o usa `queueDestroy` + `flushPendingOperations`
(già reentrant-safe).

---

❌ **Affidarsi a `entt::view::each` per ordering Lua-osservabile**

EnTT non garantisce ordering stabile cross-run.

✅ Usa i visitor del gateway o `pool.getAll` / `byTag` — sono
deterministici.

---

## 9. Testing

I test runtime stanno in `runtime-cpp/tests/`. Pattern tipico per
testare un sistema nuovo (vedi `scene-gateway-test.cpp`):

```cpp
SceneManager sm;
RuntimeEntityGateway gw(sm);
gw.init();

EntityId id = gw.create();
gw.setIdentity(id, "Enemy", {"hostile"});
gw.setTransform(id, { /* pos */ });

// Sistema sotto test (esempio fittizio):
int visited = 0;
gw.forEachActiveRenderable(
    [&](EntityId, const Transform&, const SpriteComponent&) { ++visited; });
ASSERT_EQ(visited, /* atteso */);

gw.shutdown();
```

I test runnano via `ctest -C Release --output-on-failure` da
`runtime-cpp/build-msvc`.

---

## Riferimenti

- **TECHNICAL_OVERVIEW.md** — §3.5 ECS Architecture (snapshot moduli).
- **ARCHITECTURE_DUAL_RUNTIME.md** — runtime nativo + WASM, hot-paths.
- **EnTT docs**: <https://github.com/skypjack/entt>.
- **Sorgenti**:
  - `runtime-cpp/src/modules/runtime-entity-gateway/include/runtime-entity-gateway.h`
  - `runtime-cpp/src/modules/runtime-entity-gateway/src/entity-registry.{h,cpp}`
  - `runtime-cpp/src/core/types.h` (definizioni componenti)

---

*Questa guida riflette l'integrazione EnTT completata a 2026-05-21
(rimozione `EntityManager`, registry PIMPL, visitor view-based,
determinismo enforced). Per estensioni vedi §6.*
