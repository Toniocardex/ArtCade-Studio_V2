# Third-Party Notices

ArtCade bundles or fetches third-party components. This file is informational;
each component's full license text is under `licenses/` where applicable.

This repo ships:

- **Game runtime** — C++ / Raylib / Lua (native + WASM)
- **Headless artcade_editor_core** — C++ authoring commands / ProjectDoc

Product UI is the sibling **ArtCade_Editor_RmlUi** repository (RmlUi / FreeType /
Raylib). Obsolete authoring UI stacks are not part of this tree.

Runtime vendored libraries (Raylib, Lua, Monocypher, sol2, nlohmann/json) retain
their upstream license files under `runtime-cpp/libs/`.

The ArtCade project license itself is unchanged (`LICENSE`).
