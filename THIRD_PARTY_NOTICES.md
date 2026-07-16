# Third-Party Notices

ArtCade bundles or fetches third-party components. This file is informational;
each component's full license text is under `licenses/` where applicable.

This repo ships:

- **ArtCade Studio editor** — Qt 6.8 Quick/QML (`artcade-editor-qt`), LGPL v3 dynamic linking
- **Game runtime** — C++ / Raylib / Lua (native + WASM)

See `docs/qt-migration/qt-lgpl-compliance.md` for Qt LGPL obligations.

Runtime vendored libraries (Raylib, Lua, Monocypher, sol2, nlohmann/json) retain
their upstream license files under `runtime-cpp/libs/`.

The ArtCade project license itself is unchanged (`LICENSE`).

## Qt (editor)

Qt is linked **dynamically** under **LGPL v3** (Community Edition). Ship `Qt6*.dll`
beside the exe (`windeployqt`). ArtCade application source may remain closed.
