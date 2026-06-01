# New UI — ArtCade Studio editor refactor (reference pack)

Visual-only refactor of the Tauri/React editor shell. **Out of scope:** C++/WASM runtime, Logic Board JSON schema, Lua compiler, `.artcade` format.

## Product naming

| Use | Name |
|-----|------|
| Editor, menus, window title, all new docs | **ArtCade Studio** (or **ArtCade** where space is tight) |
| Mockup PNG / original Word exports | May show *PixelForge 2D* in the chrome — **placeholder only**, do not ship |

When re-extracting `.docx` with `editor/scripts/extract_docx_to_md.py`, run the post-edit pass in this folder or keep the disclaimer blocks at the top of the generated specs.

## Documents in this folder

| File | Purpose |
|------|---------|
| [LOGIC_BOARD_UI_SPEC.md](LOGIC_BOARD_UI_SPEC.md) | Layout 1520px, Canvas tab, Logic Board 3-column, catalogs, JSON examples, checklist |
| [TRIGGER_CONDITIONS_ACTIONS_UI.md](TRIGGER_CONDITIONS_ACTIONS_UI.md) | Hierarchical Category → Subcategory → Block pickers |
| [DEFERRED_UI_ITEMS.md](DEFERRED_UI_ITEMS.md) | Runtime trace, event metadata, full catalogs — separate tickets |
| [UI_REFACTOR_FIX_PLAN.md](UI_REFACTOR_FIX_PLAN.md) | Post-audit fix order (hooks, inspector, dead code) |
| [UI_REFACTOR_PHASE2.md](UI_REFACTOR_PHASE2.md) | Layout 96/280/320/280, camera frame, dock, contextual inspector |
| [../EDITOR_UI_DESIGN_SYSTEM.md](../EDITOR_UI_DESIGN_SYSTEM.md) | Monochrome palette `#121212`–`#F4F4F4`, CSS tokens, hover/geometry rules |

## Visual mockups (source)

Bundled in repo: [`docs/assets/new-ui/`](../assets/new-ui/) (also on Desktop source folder):

| PNG | Shows |
|-----|--------|
| `New_UI_canvas.png` | Scene tree, viewport + camera frame, Inspector, bottom dock |
| `New_UI_logicBoard.png` | Rulesheet browser, single event editor, Logic Inspector, debug dock |
| `Trigger-action-struttura_UI.png` | 3-column trigger picker + inspector |

## Word sources (optional re-extract)

- `ArtCade_specifica_ui_logic_board.docx`
- `Trigger-condizioni.azioni-struttura.docx`

```powershell
python editor/scripts/extract_docx_to_md.py
```

Then replace any remaining *PixelForge* strings with **ArtCade Studio** and restore the disclaimer block at the top of each spec if the script overwrote it.
