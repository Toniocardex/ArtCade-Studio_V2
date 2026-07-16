# Qt Community Edition — LGPL compliance for ArtCade

> **Status:** Locked technical policy (2026-07-15).  
> **Not legal advice.** Validate the shipping package with a software-licensing counsel before commercial release (Phase 14).

## Policy (frozen)

ArtCade uses **Qt Community Edition** under **LGPL v3**, with **dynamic linking** only.

| Allowed | Not required |
|---|---|
| Sell ArtCade | Qt commercial license |
| Keep ArtCade source closed | Royalties to Qt |
| Ship a normal Windows executable | Static linking of Qt (avoided) |
| Use Qt Quick / QML for free | GPL-only Qt modules |

Commercial Qt remains an optional business choice (static link without LGPL mechanics, GPL-only modules, official support, simpler investor paperwork) — **not** a migration blocker.

## Distribution shape (Windows)

```
ArtCade.exe          (or artcade-editor-qt.exe)
Qt6Core.dll
Qt6Gui.dll
Qt6Qml.dll
Qt6Quick.dll
Qt6QuickControls2.dll
… (other Qt / plugin DLLs gathered by windeployqt)
```

Dynamic linking is preferred because users can replace the Qt libraries with a compatible build. Static linking is not automatically forbidden by LGPL, but requires providing relink materials — far more complex; **ArtCade does not use static Qt**.

## Practical obligations before shipping

1. State that ArtCade uses Qt.
2. Include the **LGPL v3** license text.
3. Include required copyright notices and attributions (Qt + third-party code inside Qt).
4. Say where to obtain the **source of the exact Qt version** used (e.g. Qt 6.8.x tag / archive URL).
5. Ship Qt as **replaceable dynamic libraries** (`windeployqt`).
6. Do **not** contractually forbid reverse engineering needed to modify or verify the LGPL libraries.
7. If ArtCade patches Qt itself, publish those patches under LGPL.
8. Verify licenses of third-party code bundled inside the Qt modules/plugins actually shipped.
9. Keep ArtCade application code **separate** from LGPL libraries; do not incorporate incompatible GPL code into ArtCade.

ArtCade’s own source need not be published while it stays separate from the LGPL libraries and does not pull in GPL-incompatible obligations.

## Module license matrix (Qt 6.8.3 LTS — installed kit)

Installed on the ArtCade Windows workstation via `aqtinstall`:

- Prefix: `C:\Qt\6.8.3\msvc2022_64`
- Arch: `win64_msvc2022_64`
- Marker file: repo `.qt-prefix.path`

Re-verify against the [Qt licensing documentation](https://doc.qt.io/qt-6/licensing.html) and the kit’s `LICENSE*` / module docs for this **exact** 6.8.3 build before freeze of the packaging toolchain.

| CMake / product module | Planned use | Expected license path (Community) | ArtCade policy |
|---|---|---|---|
| `Qt6::Core` | Always | LGPL v3 | **Allowed** |
| `Qt6::Gui` | Always | LGPL v3 | **Allowed** |
| `Qt6::Qml` | Always | LGPL v3 | **Allowed** |
| `Qt6::Quick` | Always | LGPL v3 | **Allowed** |
| `Qt6::QuickControls2` | Always | LGPL v3 | **Allowed** |
| `Qt6::QuickLayouts` | Always | LGPL v3 | **Allowed** |
| `Qt6::Test` / `Qt6::QuickTest` | Dev / CI only | LGPL v3 (typical) | Allowed in tooling; not shipped in retail if unused |
| `Qt6::Quick3D` | Not planned | Often **GPL v3 or commercial** | **Forbidden** in ArtCade shipping builds |
| Other GPL-only / commercial-only modules | — | Check per module | **Forbidden** unless commercial Qt is purchased for that module |

**Rule:** Before adding any new `find_package(Qt6 COMPONENTS …)` entry or QML import that pulls a new Qt module/plugin, update this matrix and confirm an LGPL-compatible path for Community Edition.

## Packaging checklist (Phase 14)

- [ ] `windeployqt` (or equivalent) copies only required Qt DLLs/plugins
- [ ] No static Qt link flags in Release shipping configs
- [ ] `THIRD_PARTY_NOTICES.md` (or installer legal pane) lists Qt + version + LGPL
- [ ] LGPL v3 text + Qt copyright notices on disk next to the app
- [ ] Public pointer to matching Qt 6.8.x sources
- [ ] EULA / Terms do not ban LGPL-required reverse engineering of Qt libs
- [ ] Final counsel review of the compliance pack

## Related docs

- [README.md](README.md) — build / migration overview  
- [phase0-module-classification.md](phase0-module-classification.md) — module PORT/EXTRACT tags  
- Repo root `THIRD_PARTY_NOTICES.md` — update when Qt enters a shipped binary
