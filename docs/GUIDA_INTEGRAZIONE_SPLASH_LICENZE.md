# Guida all'Integrazione: Splash Screen e Gestione Licenze (Free/Pro)

> **Versione:** 1.0  
> **Data:** 2026-05-11  
> **Stato:** Implementazione MVP allineata al codice (editor + packaging + runtime)  
> **Audience:** React/Tauri, tooling Python, runtime C++

In ArtCade V2, la **Splash Screen** ha due ruoli fondamentali che richiedono **due implementazioni parallele** ma concettualmente allineate, rispettando la natura **dual-runtime** dell’engine.

| Contesto | Ruolo |
|----------|--------|
| **Editor (React/Tauri)** | Mascherare il caricamento del **WASM** e l’inizializzazione del **backend Tauri**. |
| **Runtime esportato (C++)** | **Watermark obbligatorio** (“tassa visiva”) per gli utenti che esportano con la **Free Edition**; assente o ridotto con **Pro**. |

> **Nota stato repo (2026-05-20):** `licenseTier` è parte di `ProjectDoc`, `pack-artcade.py` lo copia nel manifest con default `"free"`, e il runtime legge il tier in `Application::loadProject()` per attivare `SplashState` nel caso Free. I frammenti sotto restano riferimento architetturale; il codice reale vive in `runtime-cpp/src/app/`, `runtime-cpp/src/modules/game-state/` e `runtime-cpp/tools/pack-artcade.py`.

---

## 1. Integrazione nell’Editor (React/Tauri)

Il file `SplashScreen.tsx` esiste in `editor/src/components/SplashScreen.tsx`. Nell'MVP resta splash editor separata dal runtime; il controllo licenza completo non è ancora un servizio remoto, ma il tier `free | pro` è già rappresentato nel `ProjectDoc`.

### Directory coinvolte

- `editor/src/components/SplashScreen.tsx` (componente splash)
- `editor/src/App.tsx` (entry: boot vs UI principale)
- `editor/src/store/editor-store.tsx` (`project.licenseTier`, default `free`)

### A. Entry point — `editor/src/App.tsx`

Ritardare il rendering della UI principale (`MenuBar`, `HierarchyPanel`, ecc.) finché l’animazione della splash non è terminata; in background, verifica licenza.

```tsx
// Percorso: editor/src/App.tsx
import React, { useState, useEffect } from 'react';
import SplashScreen from './components/SplashScreen';
// Importa i tuoi pannelli...
import MenuBar from './components/MenuBar';
import HierarchyPanel from './panels/HierarchyPanel';
import { useEditorStore } from './store/editor-store';

const App: React.FC = () => {
  const [isBooting, setIsBooting] = useState<boolean>(true);
  const checkLicense = useEditorStore((state) => state.checkLicense);

  useEffect(() => {
    // Mentre la splash gira, verifica la licenza (Tauri / backend)
    void checkLicense();
  }, [checkLicense]);

  if (isBooting) {
    return <SplashScreen onComplete={() => setIsBooting(false)} />;
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#0B1121] text-white">
      <MenuBar />
      <div className="flex flex-1 overflow-hidden">
        <HierarchyPanel />
        {/* Altri pannelli dell&apos;editor */}
      </div>
    </div>
  );
};

export default App;
```

---

## 2. Iniezione del flag di licenza in fase di esportazione

All’azione **Esporta**, la pipeline usa `licenseTier` dal `project.json`/`ProjectDoc` e lo inserisce nel `manifest.json` del pacchetto `.artcade`. Se manca, il default è `free`.

### Directory coinvolte

- `runtime-cpp/tools/pack-artcade.py` — script di packaging verso `.artcade` (implementato).

### A. Estensione dello script di packaging

**Stato attuale:** il packer non sovrascrive il `project.json` sorgente dell’utente. Legge `licenseTier` / `license_tier`, defaulta a `"free"` e lo scrive nel manifest del pacchetto.

```python
# Percorso: runtime-cpp/tools/pack-artcade.py (estensione concettuale)
import json
import os
import zipfile
import sys


def pack_project(source_dir: str, output_file: str, license_type: str = "free") -> None:
    # ... raccolta file, manifest, zip come oggi ...

    project_json_path = os.path.join(source_dir, "project.json")
    with open(project_json_path, "r", encoding="utf-8") as f:
        project_data = json.load(f)

    # INIEZIONE FLAG (da passare dall'editor in base alla licenza verificata)
    project_data.setdefault("build_info", {})
    project_data["build_info"]["license_tier"] = license_type  # "free" | "pro"

    # Serializza project_data nella copia che entra nello ZIP (non necessariamente sul file originale)
    # ... aggiungi project.json all'archivio con json.dumps(project_data) ...
```

Parametro `license_type`: l’editor (via **Tauri command** o IPC) lo passa allo script dopo `checkLicense()`.

---

## 3. Integrazione nel runtime nativo (C++)

Il gioco esportato contiene `licenseTier` nel `ProjectDoc` e nel `manifest.json`. Il motore, all’avvio dopo aver letto `project.json` dal pacchetto `.artcade`, decide se inserire **`SplashState`** prima/durante l’avvio del gioco.

### Directory coinvolte (target)

- `runtime-cpp/src/modules/game-state/include/splash-state.h`
- `runtime-cpp/src/modules/game-state/src/splash-state.cpp`
- `runtime-cpp/src/app/src/app.cpp` (`Application::loadProject`)

### A. Classe `SplashState` (Raylib)

Riproduce in C++ l’animazione / watermark (logo, testo “MADE WITH ARTCADE”, fade), poi passa allo stato di gioco (es. `PlayState`).

```cpp
// Percorso indicativo: runtime-cpp/src/modules/game-state/src/splash-state.cpp
#include "splash-state.h"
// #include "game-state-manager.h"
// #include "renderer.h"
// #include "time-manager.h"

void SplashState::Enter() {
    timer = 0.0f;
    // logoTexture = ... Load da asset interno o path riservato nel .artcade
}

void SplashState::Update() {
    // timer += GetFrameTime();
    // if (timer > 4.5f) GameStateManager::Instance().ChangeState(std::make_unique<PlayState>());
}

void SplashState::Render() {
    // ClearBackground ... DrawTexture con alpha ... DrawText "MADE WITH ARTCADE"
}
```

### B. Lettura del flag all’avvio — `app.cpp` (concettuale)

```cpp
// Percorso: runtime-cpp/src/app/src/app.cpp (estratto concettuale)
#include "app.h"
// #include "game-state-manager.h"
// #include "splash-state.h"
#include <nlohmann/json.hpp>

using json = nlohmann::json;

bool App::Init() {
    // 1. Init core: Raylib, Lua, fisica, caricamento .artcade ...

    // 2. project.json come stringa dal pacchetto già montato
    // std::string projectJsonString = ...;
    // auto projectData = json::parse(projectJsonString);

    std::string licenseTier = "free";
    // if (projectData.contains("build_info") && projectData["build_info"].contains("license_tier"))
    //     licenseTier = projectData["build_info"]["license_tier"].get<std::string>();

    // if (licenseTier == "free")
    //     GameStateManager::Instance().PushState(std::make_unique<SplashState>());
    // else
    //     GameStateManager::Instance().PushState(std::make_unique<PlayState>());

    return true;
}
```

**Default sicuro:** se `build_info` / `license_tier` mancano, trattare come **`free`** (watermark on) per evitare bypass accidentale.

---

## 4. Riassunto del flusso

1. **Apertura ArtCade Studio:** `App.tsx` mostra `SplashScreen.tsx` e lancia `checkLicense()` in background.  
2. **Esporta:** React invia **Free/Pro** a Tauri → argomento allo **`pack-artcade.py`** (o pipeline equivalente).  
3. **Packaging:** `manifest.json` nel `.artcade` include `licenseTier`, e `project.json` conserva il campo quando presente.  
4. **Gioco esportato:** il runtime C++ legge il JSON; se `free`, abilita **SplashState** / watermark; se `pro`, niente watermark Free.

---

## 5. Collegamenti documentazione

- [`REACT_WASM_PATTERN.md`](REACT_WASM_PATTERN.md) — decoupling editor / WASM, buffering.  
- [`ARCHITECTURE_INTEGRATION.md`](ARCHITECTURE_INTEGRATION.md) — flussi end-to-end.  
- [`TECHNICAL_OVERVIEW.md`](TECHNICAL_OVERVIEW.md) — IPC, formato progetto.

---

*Ultimo aggiornamento: 2026-05-20 — MVP implementato con `licenseTier`, manifest `.artcade` e `SplashState`; controllo licenza commerciale completo resta fuori scope.*
