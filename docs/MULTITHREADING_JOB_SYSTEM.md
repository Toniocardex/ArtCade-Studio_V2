# ArtCade V2: Evoluzione Multithreading & Job System

**Versione:** 1.0 (Architecture Proposal)  
**Stato:** Progettazione Avanzata  

**Obiettivo:** Sfruttare i core multipli su Desktop mantenendo la compatibilità sequenziale su WASM.

---

## 1. Architettura Base: Thread Pool (Task Queue)

Questa è l'architettura «motore» che gestisce la distribuzione del carico. Invece di creare thread al volo, utilizziamo un numero fisso di thread dormienti che si svegliano solo quando c'è lavoro.

### Caratteristiche principali

- **Worker Threads persistenti:** creati all'avvio dell'engine.
- **WASM Safe:** il sistema si comporta in modo sincrono su browser tramite macro del preprocessore.
- **Zero Overhead:** nessun costo di creazione/distruzione thread durante il game loop.

### Codice di riferimento: `JobSystem.hpp`

```cpp
#include <vector>
#include <thread>
#include <queue>
#include <functional>
#include <mutex>
#include <condition_variable>

class JobSystem {
public:
    static void Init() {
#ifndef __EMSCRIPTEN__
        unsigned int numThreads = std::thread::hardware_concurrency() - 1;
        for (unsigned int i = 0; i < numThreads; ++i) {
            workers.emplace_back([] {
                while (true) {
                    std::function<void()> task;
                    {
                        std::unique_lock<std::mutex> lock(queueMutex);
                        condition.wait(lock, [] { return stop || !tasks.empty(); });
                        if (stop && tasks.empty()) return;
                        task = std::move(tasks.front());
                        tasks.pop();
                    }
                    task(); // Esecuzione del lavoro
                }
            });
        }
#endif
    }

    static void Enqueue(std::function<void()> task) {
#ifdef __EMSCRIPTEN__
        // Su WebAssembly eseguiamo immediatamente (Sincrono)
        task();
#else
        // Su Desktop mettiamo in coda per i Worker Threads (Asincrono)
        {
            std::unique_lock<std::mutex> lock(queueMutex);
            tasks.push(std::move(task));
        }
        condition.notify_one();
#endif
    }

private:
    static inline std::vector<std::thread> workers;
    static inline std::queue<std::function<void()>> tasks;
    static inline std::mutex queueMutex;
    static inline std::condition_variable condition;
    static inline bool stop = false;
};
```

---

## 2. Rifiniture avanzate (produzione commerciale)

Una volta consolidato il Thread Pool, l'architettura viene «blindata» con quattro rifiniture che garantiscono stabilità e performance estreme.

### A. Coda lock-free (performance)

Sostituzione del `std::mutex` con una coda atomica (es. `moodycamel::ConcurrentQueue`).

**Vantaggio:** elimina i tempi di attesa del main thread quando deve inviare molti piccoli task (es. particelle o logica entità).

### B. Double buffering per ECS (sicurezza dati)

Implementazione di due stati separati per il `entt::registry`.

**Meccanismo:** mentre i thread scrivono i nuovi dati (posizione, velocità) nello **Stato B**, il renderer legge in totale sicurezza dallo **Stato A**.

**Vantaggio:** elimina il rischio di data race e sfarfallii grafici senza usare mutex.

### C. Grafo delle dipendenze (task graph)

Gestione dell'ordine di esecuzione dei lavori.

**Esempio:** il sistema di telecamera deve attendere che il sistema fisico abbia finito di muovere il giocatore.

**Implementazione:** ogni task può avere un elenco di «pre-requisiti». Il JobSystem sveglia i thread solo quando le dipendenze sono soddisfatte.

### D. Future-proofing: WASM Web Workers

Predisposizione per il supporto multithreading su browser moderni.

**Evoluzione:** utilizzo di pthreads di Emscripten che mappano il codice C++ su veri Web Workers JavaScript tramite `SharedArrayBuffer`.

---

## 3. Strategia di implementazione (roadmap)

| Fase | Contenuto |
|------|-----------|
| **Fase corrente** | Implementazione ECS (EnTT) rigorosamente single-thread. |
| **Consolidamento** | Sviluppo del bridge WASM/React (black box). |
| **Ottimizzazione** | Introduzione del JobSystem (thread pool) per asset loading asincrono. |
| **Finale** | Parallelizzazione dei sistemi ECS pesanti (fisica/AI) tramite task graph. |

### Nota per lo Store

I plugin che verranno venduti o scaricati dovranno essere **thread-safe**, ovvero non devono tentare di modificare risorse globali dell'engine senza passare per il JobSystem.
