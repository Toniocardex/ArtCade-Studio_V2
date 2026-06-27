# Third-Party Notices

ArtCade bundles or fetches the following third-party components. This file is
informational; each component's full license text is under `licenses/`.

These notices currently cover the dependencies introduced by the **native RmlUi
editor spike** (`runtime-cpp/src/editor-native`, built only with
`-DARTCADE_BUILD_NATIVE_EDITOR=ON`). The existing runtime's vendored libraries
(Raylib, Lua, Monocypher, sol2, nlohmann/json) retain their own upstream license
files under `runtime-cpp/libs/`.

---

## RmlUi 6.1
- Purpose: native editor UI toolkit (HTML/CSS-like layout + styling).
- License: MIT.
- Source: https://github.com/mikke89/RmlUi (tag `6.1`), fetched via CMake
  FetchContent.
- Full text: [`licenses/RmlUi.txt`](licenses/RmlUi.txt)

## FreeType 2.13.3
- Purpose: font rasterisation for RmlUi's default font engine.
- License: dual FreeType License (FTL) / GPLv2 — used here under the FTL.
- Source: https://github.com/freetype/freetype (tag `VER-2-13-3`), fetched via
  CMake FetchContent.
- Full text: [`licenses/FreeType-FTL.txt`](licenses/FreeType-FTL.txt)

---

## Inter 4.1
- Purpose: local native editor UI font family.
- License: SIL Open Font License 1.1.
- Source: https://github.com/rsms/inter (release `v4.1`).
- Bundled files:
  `runtime-cpp/src/editor-native/resources/fonts/inter/Inter-Regular.ttf`,
  `Inter-Medium.ttf`, `Inter-SemiBold.ttf`, and `Inter-Bold.ttf`.
- Full text:
  [`runtime-cpp/src/editor-native/resources/fonts/inter/LICENSE.txt`](runtime-cpp/src/editor-native/resources/fonts/inter/LICENSE.txt)

The ArtCade project license itself is unchanged (`LICENSE`).
