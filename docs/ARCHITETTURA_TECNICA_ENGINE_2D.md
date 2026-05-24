# Architettura tecnica: Custom 2D Game Engine

L’engine è basato su un’architettura **data-oriented** e **multi-layer**, progettata per garantire massime prestazioni grafiche e un workflow produttivo basato su tecnologie web moderne.

**Glossario:** termini ufficiali (Logic Board, Logic Event, Logic Component, ECS, …) in [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md) — **Parte I**.

---

## 1. Core stack e tecnologie chiave

| Componente | Tecnologia | Ruolo |
|--------------|------------|--------|
| Language | C++ 17/20 | Logica core ad alte prestazioni e gestione memoria. |
| Rendering | Raylib | Backend grafico (OpenGL/WebGL) e astrazione input/audio. |
| ECS | EnTT | Gestione delle entità e dei dati tramite Entity Component System. |
| Physics | Box2D | Simulazione fisica 2D deterministica. |
| Scripting | Lua (via Sol2) | Logica di gioco ad alto livello e bridge verso il visual scripting. |
| Frontend UI | React | Interfaccia dell’editor e gestione dello stato dei tool. |
| Desktop shell | Tauri | Bridge tra l’interfaccia web e il sistema operativo. |

---

## 2. Diagramma architetturale

L’architettura si divide in **tre domini** principali che comunicano tramite canali specifici:

- **Native layer (C++/Rust):** gestione del file system, watcher degli asset e finestra nativa tramite Tauri.
- **Engine layer (WASM/Raylib):** il cuore che processa fisica, script e rendering sul `<canvas>`.
- **UI layer (React):** l’editor visivo che manipola i dati e invia comandi al cuore WASM.

---

## 3. Gestione del tempo e fisica (fixed timestep)

Per garantire la stabilità della simulazione indipendentemente dal refresh rate del monitor (60 Hz, 144 Hz, ecc.), l’engine adotta un **accumulatore di tempo**.

- **Fixed update:** la fisica (Box2D) e la logica degli script procedono a passi costanti (\(1/60\) s).
- **Variable render:** il rendering segue il `requestAnimationFrame` del browser.
- **Interpolazione:** viene calcolato un fattore \(\alpha\) per correggere il micro-stuttering, permettendo al renderer di interpolare le posizioni tra l’ultimo stato fisico e quello precedente.

L’**ordine delle fasi** nel frame (input, script pre/post, fisica, sync, render) è definito in **§9**.

---

## 4. Asset management e memoria

Il sistema utilizza un **custom asset manager** basato su smart pointer per ottimizzare l’uso della RAM e della VRAM:

- **Shared ownership:** le entità possiedono uno `std::shared_ptr` all’asset.
- **Weak cache:** il manager mantiene uno `std::weak_ptr`. Se nessuna entità usa più l’asset, la memoria viene liberata automaticamente (RAII) invocando le funzioni di unload di Raylib.
- **Hot-reloading:** tramite il file watcher di Tauri, le modifiche sui file (PNG, LUA) vengono rilevate e iniettate nel wrapper dell’asset senza riavviare l’engine.
- **Path virtuali e alias:** l’`AssetManager` risolve identificatori stabili nel progetto (es. `@textures/player.png` o path relativi alla root progetto) verso file su disco **o** byte in RAM; evita path assoluti Windows nel JSON serializzato. Strategia WASM e pacchetti in **§10**.

---

## 5. Pipeline di serializzazione (JSON)

L’interscambio di dati tra il cuore C++ e l’interfaccia React avviene tramite la libreria **nlohmann/json**:

- **Scene export:** il registro EnTT viene scansionato; ogni componente viene convertito in JSON tramite funzioni `to_json` dedicate.
- **React integration:** la stringa JSON viene passata tramite i binding Emscripten (**embind**) all’editor.
- **Persistence:** Tauri si occupa di scrivere i file sul disco locale, permettendo salvataggio e caricamento dei progetti.

---

## 6. Scripting e visual programming

L’engine implementa un sistema di scripting e authoring a **più livelli** (testuale, tabellare, visuale → Lua). La terminologia **Logic Board / Logic Event / Logic Component** è nella [**Parte I** di `LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md).

1. **Logic Board:** scheda di lavoro dove si assemblano **Logic Event** e **Logic Component** — vocabolario [**Parte I**](LOGIC_BOARD_SPEC.md), specifica implementativa [**Parte III**](LOGIC_BOARD_SPEC.md). *Editor attuale:* modalità Visual (eventi) + Lua generato/sync; editor script = CodeMirror in iframe ([`CODEMIRROR_EDITOR.md`](CODEMIRROR_EDITOR.md)).
2. **Visual nodes (React):** interfaccia a nodi (es. React Flow), quando integrata, sotto o accanto alla Logic Board.
3. **Logic Sheet:** formato tabellare riga → condizioni/azioni — [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md) **Parte II** (bozza v0.1); complementare alla Logic Board.
4. **Code generation:** nodi o sheet → Lua.
5. **Lua VM:** esecuzione via Sol2 (bytecode), anche su web.

---

## 7. Build system (CMake)

Il progetto utilizza **CMake** per la multi-piattaforma:

- **Target Windows:** compilazione nativa in `.exe` con collegamento diretto a Raylib e Box2D.
- **Target Web (WASM):** compilazione tramite Emscripten per generare i moduli `.wasm` e `.js` pronti per essere importati nel progetto React/Tauri.

### Nota di design

Questa architettura **2D-first** è pensata per essere estesa in modo modulare verso il 3D, sostituendo o affiancando Box2D con motori fisici 3D e introducendo sistemi di frustum culling all’interno dei sistemi di rendering di EnTT.

---

## 8. Contesto motore (`EngineContext`)

Lo stato del runtime non è disperso in molte variabili globali (`globalRegistry`, manager sparsi, ecc.): è raccolto in una **struct di contesto** (o classe equivalente). Questo è fondamentale per funzioni tipo **«Reset scena»** nell’editor senza ricaricare l’intera pagina, per i **test** e per **Embind**, che beneficiano di **un solo puntatore** noto al bridge JavaScript.

**Principi**

- Un **unico ingresso** (`EngineContext*` o `g_Context`) usato dai wrapper esposti a JS (`getScene`, `tick`, …) che delegano ai membri del contesto.
- **`Reset()`** deve ripulire **tutti** i sottosistemi con memoria propria, non solo `registry.clear()`.

**Checklist `Reset()`**

- **EnTT:** `registry.clear()` (o politica equivalente per pool di entità).
- **Box2D:** distruggere o ricreare `b2World` e body/fixture; nessun handle orfano.
- **Asset / Raylib:** scaricare texture/audio in linea con le API Raylib e con la cache `weak_ptr`.
- **Lua:** documentare **reset completo VM** vs ricreazione di soli `environment` / script.

**Esempio strutturale (illustrativo)**

```cpp
struct EngineContext {
    entt::registry registry;
    AssetManager assetManager;
    std::unique_ptr<b2World> physicsWorld;  // #include <box2d/box2d.h> nel .cpp
    sol::state lua;

    void Reset() {
        registry.clear();
        // Ricreare o svuotare b2World e tutti i body/fixture
        // Svuotare / re-inizializzare asset manager (Unload coerente con Raylib)
        // Policy Lua: reset VM vs solo script — da documentare per il team
    }
};

// Bootstrap embind: un puntatore documentato (service locator).
// Evoluzione: unique_ptr nel main e registrazione esplicita dei wrapper all'avvio.
static EngineContext* g_Context = nullptr;
```

Il puntatore globale **non elimina** il globale: **concentra** lo stato e rende prevedibile il ciclo di vita. L’alternativa a medio termine è possedere `EngineContext` dal `main` (o modulo lifecycle) e passare il puntatore solo ai layer che ne hanno bisogno.

**Nota (repository ArtCade oggi):** `EngineContext` è implementato in `runtime-cpp/src/core/engine-context.h` come **contenitore di dipendenze** (puntatori non-owning a `Renderer`, `Physics`, `LuaHost`, `World`, `RuntimeEntityGateway`, `SceneManager`, …). `Application` (`app/include/app.h`, `app/src/app.cpp`) **possiede** i moduli e popola `ctx_`. L’esempio struct in cima a questa sezione è il **modello logico** (reset unificato, embind) da avvicinare incrementalmente; il dettaglio «cosa c’è già / cosa manca» è in **§11**.

---

## 9. Pipeline di frame e doppia fonte di verità

Se Box2D e Lua (o l’input) **scrivono la posizione** nello stesso frame senza regole, compare **jitter**. Si impone una **pipeline rigida** e si definisce **chi è autorità** sui dati.

| Fase | Responsabilità |
|------|----------------|
| **Input e comandi UI** | React invia comandi al C++ (IPC / buffer); nessun accesso diretto al canvas durante il gameplay (cfr. `REACT_WASM_PATTERN.md`). |
| **Scripting (pre-fisica)** | Lua legge lo stato e applica **forze, impulsi o velocità desiderata** — non teletrasporti arbitrari sulla posizione integrata da Box2D, salvo spawn/cutscene espliciti. |
| **Physics step** | Solo Box2D integra a passo fisso (`FIXED_DT`). |
| **Sync** | Solo C++: **Box2D → `TransformComponent`** (posizione, rotazione). |
| **Scripting (post-fisica)** | Lua legge posizioni e contatti per logica di gioco. |
| **Rendering** | Raylib usa i **`TransformComponent`** (eventualmente interpolati come in §3). |

**Rifiniture consigliate**

- Corpi **kinematic** o «motore»: lo script esprime **intento di movimento**; il C++ traduce in comandi Box2D stabili.
- Entità **solo visive** (senza body): il transform non passa dal sync fisico.

---

## 10. WASM, asset e path virtuali

Su **WASM** non c’è un file system locale come su desktop: il piano di caricamento deve essere **portabile** e, dove possibile, **batched**.

1. **Preload / `.data` (Emscripten):** inclusione del **minimo** per l’avvio (shell, font base) per ridurre la latenza al primo frame.
2. **Pacchetto progetto (es. `.artcade`):** una lettura → **buffer in RAM** → indice path→bytes; l’`AssetManager` risolve da lì senza molteplici fetch di rete casuali durante il gameplay.
3. **Alias e path virtuali:** nel JSON e negli script usare chiavi stabili (es. `@textures/player.png`, path relativi alla root progetto). **Evitare** path assoluti da macchina di sviluppo.

L’`AssetManager` (§4) implementa la risoluzione **alias → file o blob**; lo stesso schema aiuta anche il **native** (workspace diversi, CI).

Evitare **lazy loading** non controllato dalla rete per ogni singolo file nel frame di gioco: preferire caricamenti **espliciti** o schermate di loading.

---

## 11. Stato nel repository e migrazione verso l’architettura completa

Questa sezione allinea **ciò che il codice fa oggi** con gli obiettivi delle sezioni **§8–10** e dell’**appendice**, e propone una **roadmap incrementale** (basso rischio, senza «big bang»).

### 11.1 Cosa è già presente (runtime + editor)

| Area | Implementazione attuale (indicativa) |
|------|--------------------------------------|
| **Orchestrazione** | `Application` in `runtime-cpp/src/app/` — possiede i moduli (`std::unique_ptr<Modules>`), espone il game loop nativo e la callback WASM (`webInstance_` + `emscripten_set_main_loop`). |
| **`EngineContext`** | `runtime-cpp/src/core/engine-context.h` — **DI**: solo puntatori ai sottosistemi; lifetime gestito da `Application`. Regole già scritte nel file (non-owning, `nullptr` se non init). |
| **Fixed timestep** | `Application::loopIteration()` in `app/src/app.cpp` — accumulatore, cap anti–spiral-of-death, `targetDt_` 1/60. |
| **Input nel frame** | `input->poll()` all’inizio dell’iterazione; `resetFrameState()` dopo il render. |
| **Fisica e sync** | Nel passo fisso: `physics->step(targetDt_)` poi `world->syncPhysicsToEntities()` — allineato al **sync post-step** descritto in §9 e nell’appendice. |
| **Lua nel frame** | `luaHost->tick(targetDt_)` **prima** di `physics->step` nello stesso passo fisso (ordine reale oggi). |
| **Stato entità** | `EntityRegistry` (`entt::registry` interno) + `RuntimeEntityGateway`; `EntityDef` solo DTO al load. Modulo `entity-system` rimosso (2026-05). |
| **World** | `World` orchestra scena, stato globale, `syncPhysicsToEntities` delegando a `RuntimeEntityGateway` + `Physics`. |
| **Asset / progetto** | `AssetLoader`, `TextureManager`, lettura `project.json` / ZIP (es. `asset-system/`) — base per path e pacchetti; alias virtuali §10 da estendere in modo esplicito dove servono. |
| **Editor** | `editor/` (React + Vite), shell **Tauri** in `editor/src-tauri/`. |

### 11.2 Dove il documento è «target» rispetto al codice

- **§8 — struct con `registry` / `AssetManager` / `b2World` / `lua`:** nel repo oggi il mondo è **modulare** (`World`, `Physics`, `LuaHost`, …) e `EngineContext` è solo **wiring**. La struct dell’§8 resta **obiettivo di consolidamento** (reset scena, embind) non la copia byte-per-byte del tree attuale.
- **§9 — due fasi Lua (pre/post fisica):** oggi c’è **una** `luaHost->tick` prima della fisica. La tabella dell’§9 è il **modello di riferimento anti-jitter**; allineamento possibile in due modi indolenti: (A) **documentare** che in questo tick Lua non vede ancora le pose post–fisica e che la logica che legge posizioni deve stare dopo sync (es. hook o tick diviso in futuro); (B) **evolvere** il runtime con `tickPrePhysics` / `tickPostPhysics` quando servirà.
- **Appendice — `entt::registry`, `SerializeScene(registry)`:** storage runtime già su EnTT dietro `EntityRegistry`; la serializzazione editor/React continua a passare da JSON/`EntityDef` e gateway getter, non da `registry` esposto a JS.
- **`g_Context` nell’appendice:** pattern pedagogico; in WASM l’istanza reale è **`Application`** (o un handle esposto). I wrapper embind dovranno delegare a `Application*` o a funzioni che ricevono il contesto già inizializzato.

### 11.3 Roadmap incrementale (indolore)

Ordine consigliato: **nessun passo richiede di rompere il build**; ogni fase è verificabile da sola.

1. **Contratti e doc (fatto / in corso)** — Tenere §8–11 e `TECHNICAL_OVERVIEW.md` allineati sull’ordine reale del loop e su cosa è ancora «target».
2. **Bridge Embind / JS (basso rischio)** — Introdurre funzioni C esposte che delegano a `Application` o a `EngineContext` (es. `getSceneJson()` che serializza lo stato attuale senza passare `registry` da JS). Nessun cambio al modello dati obbligatorio.
3. **`Reset` scena / editor (medio-basso)** — Centralizzare in `Application` (o `World`) una sequenza **documentata**: stop audio, clear draw queue, reset gateway/registry + scene attiva, `Physics` shutdown/reinit, policy Lua (clear env vs VM). Riutilizza i puntatori già in `EngineContext` invece di introdurre nuovi globali.
4. **Path virtuali e alias (incrementale)** — Un livello di risoluzione sopra `AssetLoader` / `TextureManager`: chiavi stabili nel JSON progetto → path file o entry ZIP; stesso codice su native e WASM.
5. **Pipeline Lua pre/post (opzionale, quando serve)** — Solo se emergono jitter o dipendenze ordinate; altrimenti resta la convenzione «tick Lua prima della fisica» ben documentata in §11.2.
6. **Evoluzione ECS (opzionale)** — View-based systems nel `World` / render loop che iterano componenti EnTT direttamente (oggi si usa `gateway->activeSceneIds()` + getter). Appendice e `SerializeScene(registry)` restano riferimento per API embind future.

### 11.4 Criterio di «completamento»

L’architettura del documento si considera **integralmente adottata** quando: (i) reset scena / embind passano da API uniche e testate; (ii) path e asset su WASM seguono la strategia §10; (iii) la pipeline di frame è **o** allineata alla tabella §9 **o** esplicitamente documentata come variante supportata; (iv) eventuale EnTT è in produzione nel runtime se la roadmap lo prevede.

---

## Appendice A — Esempi di riferimento (illustrativi)

Ecco il codice completo e strutturato per i punti cardine della tua architettura. Ho unito le best practice di C++17, EnTT, Sol2 e Raylib per creare un sistema che sia performante ma anche "resiliente" ai crash, specialmente nella comunicazione tra i vari moduli.

> **§11:** storage runtime su `entt::registry` (modulo `runtime-entity-gateway`). Gli snippet sotto che mostrano `registry` nel `World` o in embind sono ancora **target di consolidamento**; vedi **§11.2–11.3** per cosa è già in produzione vs cosa resta da avvicinare.

### Da esempio dimostrativo a produzione (WASM / Emscripten)

Il codice fornito è concettualmente corretto e segue le best practice del settore, ma trattandosi di un esempio dimostrativo «da manuale», ci sono **dettagli tecnici critici** da sistemare per renderlo pronto alla produzione (specialmente in ambiente WebAssembly/Emscripten).

Ecco l'analisi delle omissioni necessarie e come correggerle.

#### 1. L'errore del «contesto grafico» (Raylib)

**Il problema:** nell'`AssetManager`, `GetTexture` chiama `LoadTexture`.

**Perché è un rischio:** se il C++ istanzia l'`AssetManager` come variabile globale o lo usa prima di `InitWindow()`, Raylib può crashare o restituire una texture vuota (ID 0). Le API grafiche di Raylib non funzionano finché OpenGL non è inizializzato.

**Il fix:** ordine rigoroso di bootstrap:

1. `InitWindow(...)`
2. `InitAudioDevice(...)` (se usi audio)
3. **Solo dopo** istanzia o usa l'`AssetManager`.

#### 2. Inquinamento della mappa (`AssetManager`)

**Il problema:** usare `textureCache[path]` prima di `.lock()`.

**L'errore tecnico:** su `std::unordered_map`, l'operatore `[]` **inserisce** la chiave se non esiste. Una lookup su una texture assente crea comunque una entry con `weak_ptr` vuoto: la mappa si riempie di rumore.

**Il fix:** usare `.find()` per lookup e inserimento esplicito solo dopo il caricamento.

#### 3. Bindings Emscripten (embind)

**Il problema:** `emscripten::function("serializeScene", &SerializeScene);` con `SerializeScene(entt::registry&)`.

**L'errore tecnico:** Emscripten non può passare da JavaScript un riferimento a `entt::registry` senza un binding completo del tipo (impraticabile per un editor).

**Il fix:** registro dentro **`EngineContext`** (vedi §8) e funzione **senza parametri** esposta a JS:

```cpp
// g_Context inizializzato all'avvio del motore (§8)
extern EngineContext* g_Context;

std::string GetSceneJSON() {
    return SerializeScene(g_Context->registry);
}

EMSCRIPTEN_BINDINGS(engine_module) {
    emscripten::function("getScene", &GetSceneJSON); // Ora JS può chiamarla senza parametri
}
```

Stesso schema per `tick`, `hotReload`, ecc.: wrapper senza tipi non bindabili o uso di `class_` con istanza registrata.

#### 4. Box2D e EnTT

**Il problema:** dopo `physicsWorld->Step(...)`, Box2D aggiorna le pose interne ma **EnTT non viene aggiornato da solo**.

**Cosa manca:** uno **sync** post-step: per ogni entità con body Box2D **e** `TransformComponent`, copiare `body->GetPosition()` (e rotazione se serve) in `transform.position`. Senza questo, script Lua e renderer vedono entità ferme mentre la fisica si muove.

---

### 1. Asset Manager Robusto (shared_ptr + weak_ptr)

Questo modulo evita i memory leak e garantisce che una risorsa venga caricata una sola volta. **Nota:** rispettare l'ordine Raylib della sezione precedente; `GetTexture` e `HotReload` usano `find()` per non inquinare la cache.

```cpp
#include <raylib.h>
#include <unordered_map>
#include <memory>
#include <string>
#include <iostream>

// Wrapper RAII: Carica all'inizio, scarica alla distruzione
struct TextureResource {
    Texture2D texture;
    std::string path;

    TextureResource(const std::string& filePath) : path(filePath) {
        texture = LoadTexture(filePath.c_str());
    }

    ~TextureResource() {
        if (texture.id > 0) UnloadTexture(texture);
    }

    void Reload() {
        UnloadTexture(texture);
        texture = LoadTexture(path.c_str());
    }
};

class AssetManager {
private:
    std::unordered_map<std::string, std::weak_ptr<TextureResource>> textureCache;

public:
    std::shared_ptr<TextureResource> GetTexture(const std::string& path) {
        auto it = textureCache.find(path);
        if (it != textureCache.end()) {
            if (auto shared = it->second.lock()) {
                return shared;
            }
        }
        // ... caricamento ...
        auto newResource = std::make_shared<TextureResource>(path);
        textureCache[path] = newResource;
        return newResource;
    }

    void HotReload(const std::string& path) {
        auto it = textureCache.find(path);
        if (it != textureCache.end()) {
            if (auto shared = it->second.lock()) {
                shared->Reload();
            }
        }
    }
};
```

### 2. Serializzazione EnTT + nlohmann (Ponte verso React)

Il codice per esportare la scena in un formato leggibile dall'Editor Tauri.

```cpp
#include <nlohmann/json.hpp>
#include <entt/entt.hpp>

using json = nlohmann::json;

// Helper per Raylib types
void to_json(json& j, const Vector2& v) { j = {{"x", v.x}, {"y", v.y}}; }

// Componenti
struct TransformComponent { Vector2 position; float rotation; };
void to_json(json& j, const TransformComponent& t) {
    j = json{{"pos", t.position}, {"rot", t.rotation}};
}

// Funzione di esportazione Scena
std::string SerializeScene(entt::registry& registry) {
    json root = json::array();

    registry.each([&](auto entity) {
        json e;
        e["id"] = (uint32_t)entity;
        
        if (auto* t = registry.try_get<TransformComponent>(entity)) {
            e["components"]["Transform"] = *t;
        }
        // Aggiungi qui gli altri componenti...

        root.push_back(e);
    });

    return root.dump(); // Restituisce la stringa per Emscripten/React
}
```

### 3. Integrazione Scripting (Sol2 + Script System)

Gestione della logica Lua attaccata alle entità.

```cpp
#include <sol/sol.hpp>

struct ScriptComponent {
    sol::environment env;
    sol::protected_function updateFunc;
    bool hasError = false;
};

// Sistema che esegue gli script
void UpdateScripts(entt::registry& registry, float dt) {
    auto view = registry.view<ScriptComponent>();

    for (auto entity : view) {
        auto& script = view.get<ScriptComponent>(entity);
        
        if (!script.hasError && script.updateFunc.valid()) {
            // Chiamata protetta per evitare che un errore Lua faccia crashare il C++
            auto result = script.updateFunc(dt);
            if (!result.valid()) {
                sol::error err = result;
                std::cerr << "LUA ERROR: " << err.what() << std::endl;
                script.hasError = true; // Disabilita lo script fino al fix
            }
        }
    }
}
```

### 4. Il Game Loop con Fixed Timestep

La logica per rendere la fisica di Box2D fluida e deterministica.

```cpp
class Engine {
    const float FIXED_DT = 1.0f / 60.0f;
    float accumulator = 0.0f;
    entt::registry registry;
    AssetManager assets;

public:
    void Tick() {
        float frameTime = GetFrameTime();
        if (frameTime > 0.25f) frameTime = 0.25f; // Evita spirali della morte

        accumulator += frameTime;

        while (accumulator >= FIXED_DT) {
            // 1. Fisica
            // physicsWorld->Step(FIXED_DT, 8, 3);
            // Poi: sync Box2D -> TransformComponent su EnTT (body->GetPosition() -> transform.position)

            // 2. Logica Script
            UpdateScripts(registry, FIXED_DT);
            
            accumulator -= FIXED_DT;
        }

        // 3. Rendering con Interpolazione
        float alpha = accumulator / FIXED_DT;
        Render(alpha);
    }

    void Render(float alpha) {
        BeginDrawing();
        ClearBackground(BLACK);
        
        auto view = registry.view<TransformComponent>();
        for (auto entity : view) {
            // Qui useresti alpha per interpolare tra vecchia e nuova posizione
            // per un movimento perfetto a qualsiasi framerate
        }
        
        EndDrawing();
    }
};
```

### 5. Emscripten Bindings (Il "Collante")

Per esporre la scena a React/Tauri senza passare un `entt::registry` da JavaScript, usa un **wrapper senza parametri** (vedi la sezione «Bindings Emscripten» sopra e **`EngineContext`** in §8). `tick`, `hotReload` e metodi di istanza richiedono lo stesso pattern (funzione globale che delega a `g_Context`, oppure `class_` con oggetto già istanziato lato C++).

```cpp
#include <emscripten/bind.h>

extern EngineContext* g_Context;

std::string GetSceneJSON() {
    return SerializeScene(g_Context->registry);
}

EMSCRIPTEN_BINDINGS(engine_module) {
    emscripten::function("getScene", &GetSceneJSON); // Ora JS può chiamarla senza parametri
}
```

### Sintesi finale della robustezza

Il codice è solido al **95%**. Per il restante **5%**:

- **Controlla i percorsi:** su WASM/Tauri, i percorsi dei file sono sensibili (usa percorsi relativi stabili, es. `assets/image.png`).
- **try_get vs get:** in EnTT usa sempre `try_get` se non sei sicuro che il componente esista (come in `SerializeScene`). `get` su componente assente → asserzione e crash difficile da diagnosticare in WASM.
- **Errori Lua:** `sol::protected_function` è essenziale; evita chiamate dirette tipo `lua["func"]()`. Un errore nel visual scripting non deve chiudere l'intero editor.
- **WASM memory:** in CMake/Emscripten considera `-s ALLOW_MEMORY_GROWTH=1` quando EnTT e JSON allocano molto durante l'editing.
