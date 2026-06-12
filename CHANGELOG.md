# Changelog

All notable changes to ArtCade Studio are documented here.

---

## [2.0.0-ea.1] — 2026-06-12 · Early Access

First public release of ArtCade Studio V2.

### Editor
- Dual-pane layout: full-height sidebars, unified topbar, collapsible bottom dock
- Scene Explorer: objects grouped by type (Construct-style), clone renaming (`Name_N`)
- Logic Board: single-surface panel — rules list + categorized "Add rule" modal
- Viewport: canvas duplicate via Ctrl+D / Ctrl+click, origin aligned with runtime
- Grid restores correctly after preview stop
- F5 triggers Play/Stop instead of reloading the page (WebView2 capture-phase guard)
- Themed `EditorSelect` listbox replaces all native `<select>` elements
- Layer system: dynamic `LayerDef` model persisted in `ProjectDoc`

### Preview / Runtime
- WASM canvas is a persistent singleton — no flicker across `PreviewPanel` remounts
- Canvas tracks viewport size live during play
- New objects spawn inside play viewport bounds

### Project
- Save As can create new project directories
- Hardened project loading with legacy entity migration warnings

### Infrastructure
- CI: GitHub Actions for C++ runtime (CMake + CTest) and editor (tsc + vitest)
- 815 automated tests across editor utilities, hooks, and components
- Proprietary license

---

## Versioning

Format: `MAJOR.MINOR.PATCH[-STAGE.N]`  
Stages: `ea` (Early Access) → `rc` (Release Candidate) → stable
