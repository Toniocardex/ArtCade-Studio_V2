# ArtCade Studio — Editor UI Design System (Monochrome)

> **Status**: Reference for the visual-only editor refactor (2026 UI).  
> **Scope**: React/Tailwind shell, Logic Board chrome, Inspector, docks — **not** game viewport pixels (WASM/Raylib) or in-game sprites.  
> **Principle**: Strictly monochrome so the editor never competes with user-authored game art (sprites, tilemaps).

Source palette aligned with the logo: anthracite void + pearl white typography. Optional single accent for selection only.

---

## 1. Base palette (exact hex)

| Token | Name | Hex | Role |
|-------|------|-----|------|
| `void` | Base Void (Nero antracite) | `#121212` | “Empty” workspace — where visual content lives |
| `surface` | Surface (Grigio scuro) | `#1A1A1A` | Panel chrome, menu bar, status bar |
| `outline` | Outline / Muted | `#555555` | Dividers, disabled icons, secondary labels |
| `primary` | Primary / High contrast | `#F4F4F4` | Body text, active icons, focus |
| `accent` | Accent (optional) | `#4A72B2` | Selection, checkboxes, focus ring — **flat fills only** |

No sage green, navy, or warm accent in the new system unless explicitly re-approved for a single semantic (e.g. errors).

---

## 2. Where each color goes

### 2.1 Base Void — `#121212`

Use for areas where the user focuses on **game or logic content**, not chrome:

- Scene View background (entity placement)
- Logic Board infinite / central workspace background
- Script editor (CodeMirror) canvas background
- Full-bleed preview letterboxing around the WASM canvas

### 2.2 Surface — `#1A1A1A`

Slightly lighter than void; defines **editor architecture**:

- Left sidebar (Scene tree, Assets, Rulesheet browser)
- Right Inspector / Logic Inspector
- Top menu bar and bottom status bar
- Bottom dock panel bodies (console, timeline shell, trace shell)
- Raised cards inside a void workspace (e.g. event editor cards on Logic Board)

The void ↔ surface step creates a clear separation between **controls** and **content** without heavy shadows.

### 2.3 Outline — `#555555`

Premium dividers stay quiet:

- 1px borders between Inspector ↔ canvas, dock ↔ workspace, panel sections
- Row separators in Transform / component lists
- Disabled toolbar icons
- Secondary field labels (`X`, `Y`, `W`, `H`, unit hints)

**Opacity variants** (same hue): `rgba(85, 85, 85, 0.5)` for hairline splits; `rgba(85, 85, 85, 0.35)` for grid lines in lists.

### 2.4 Primary — `#F4F4F4`

Action and readability:

- Primary typography (entity names, panel titles, menu labels)
- Selected / hovered icon strokes (when not using inverted fill)
- Input text, active tab labels
- Console log body text (severity colors may tint **only** the level badge, not the whole line)

### 2.5 Accent — `#4A72B2` (optional, restrained)

Use **sparingly** for:

- Current selection (entity in scene tree, active event, focused logic block)
- Checked checkboxes / toggle on state
- Active tab underline or 2px left rail (not full panel tint)

**Do not** use accent for: large backgrounds, gradients, glow, or decorative icons.

---

## 3. Component rules

### 3.1 Geometry

- **No pill buttons** (fully rounded caps). No ovals for tags.
- **Sharp technical look**: `border-radius: 2px` default; `4px` max for large panels or modals.
- Square icon buttons: 2px radius; equal padding.

### 3.2 Hover and interaction (flat)

- **No** outer glow, neon, or colored drop shadows.
- **No** glassmorphism or heavy elevation shadows.
- Preferred hover: **invert or fill** — e.g. button background `#1A1A1A` → `#555555`, text stays `#F4F4F4`.
- Active/pressed: background `#555555` or outline border `primary` at 1px.
- Transitions: ≤ 100ms, opacity or background-color only.

### 3.3 Focus

- 1px solid `#4A72B2` outline **or** 2px left bar in accent on list rows.
- No box-shadow focus rings.

### 3.4 Status semantics (exceptions to monochrome)

Keep functional color **only** on small badges, not panel backgrounds:

| Semantic | Suggested hex | Usage |
|----------|---------------|--------|
| Warning | `#C49A4A` | Console WARN badge, non-blocking banner |
| Error | `#A84343` | Console ERROR badge, compile failure banner |
| Success | `#6FA083` | Rare; apply/sync OK toast only |

---

## 4. Typography

| Use | Font | Notes |
|-----|------|--------|
| UI labels, menus, Inspector | IBM Plex Sans | Weights 400 / 500 / 600 |
| Console, UUIDs, numeric fields, Lua | JetBrains Mono | 11–12px for dense rows |

Load via existing `@fontsource/*` packages in `editor/`.

---

## 5. Layout tokens (refactor target)

Aligned with `New_UI_artCade` mockups; widths are defaults, user-resizable where noted.

| Region | Default width / height |
|--------|-------------------------|
| Left column | 280px |
| Center column | flex (min workspace ~920px at 1520px total) |
| Right Inspector | 320px |
| Top menu + toolbar | 96px total |
| Bottom dock | 300px |

Minimum recommended editor width: **1520px**.

---

## 6. CSS custom properties (implementation map)

Target file: `editor/src/index.css`. Replace legacy sage/navy tokens when the UI refactor lands.

```css
:root,
[data-theme="dark"] {
  /* Surfaces */
  --void:        #121212;
  --surface:     #1A1A1A;
  --surface-2:   #1E1E1E;   /* optional: nested header inside surface */
  --surface-3:   #242424;   /* optional: input / code well */

  /* Borders & muted */
  --outline:     #555555;
  --outline-subtle: rgba(85, 85, 85, 0.5);
  --outline-faint:  rgba(85, 85, 85, 0.35);

  /* Text */
  --primary:     #F4F4F4;
  --primary-soft:#D8D8D8;
  --muted:       #555555;   /* same as outline for labels */
  --muted-2:     #444444;   /* disabled */

  /* Accent */
  --accent:      #4A72B2;
  --accent-muted:rgba(74, 114, 178, 0.25);

  /* Status (badges only) */
  --warn:        #C49A4A;
  --danger:      #A84343;
  --success:     #6FA083;

  /* Geometry */
  --radius:      2px;
  --radius-md:   4px;

  /* Layout */
  --font-ui:     'IBM Plex Sans', system-ui, sans-serif;
  --font-mono:   'JetBrains Mono', ui-monospace, monospace;

  /* Back-compat aliases (remove after refactor) */
  --bg:          var(--void);
  --panel:       var(--surface);
  --text:        var(--primary);
  --border:      var(--outline);
  --border-2:    var(--outline);
  --accent-2:    var(--accent);
}
```

Light theme: defer until dark refactor is stable; if added, invert void/surface relationship without introducing new accent hues.

---

## 7. Migration notes (current editor → this system)

| Current (`index.css`) | New token |
|------------------------|-----------|
| `--bg: #1A1A1A` | `--void` for workspace; menu may stay `--surface` |
| `--panel: #313131` | `--surface` `#1A1A1A` (panels darken to match logo) |
| `--accent: #7A9C7E` (sage) | Remove; use `--accent` `#4A72B2` or monochrome hover only |
| `--accent-2: #3F5D7E` (navy) | Remove; selection uses `--accent` |
| Pill radii on `ModuleRail` | Replace with 2–4px radius per §3.1 |

**Out of scope for this document:** Logic Board JSON schema, Lua codegen, WASM preview rendering, `.artcade` format.

---

## 8. Related assets

**Product name:** **ArtCade Studio** everywhere in shipped UI and docs. PNG/docx mockups may still show *PixelForge 2D* in the title bar — treat that as layout placeholder only.

| Asset | Path |
|-------|------|
| Index (mockups + specs) | [`new-ui/README.md`](new-ui/README.md) |
| Canvas layout mockup | `Desktop/New_UI_artCade/New_UI_canvas.png` |
| Logic Board mockup | `Desktop/New_UI_artCade/New_UI_logicBoard.png` |
| Trigger picker mockup | `Desktop/New_UI_artCade/Trigger-action-struttura_UI.png` |
| Logic Board UI spec (Markdown) | [`new-ui/LOGIC_BOARD_UI_SPEC.md`](new-ui/LOGIC_BOARD_UI_SPEC.md) |
| Trigger / conditions / actions UI (Markdown) | [`new-ui/TRIGGER_CONDITIONS_ACTIONS_UI.md`](new-ui/TRIGGER_CONDITIONS_ACTIONS_UI.md) |
| Source Word (re-extract) | `editor/scripts/extract_docx_to_md.py` → `Desktop/New_UI_artCade/*.docx` |

Consider copying PNG mockups into `docs/assets/new-ui/` when the refactor branch starts.

---

## 9. Checklist (review before merge)

- [ ] Workspace backgrounds use `#121212`, not `#1A1A1A`
- [ ] Panels / menu / status use `#1A1A1A`
- [ ] No pill-shaped primary buttons
- [ ] Hovers are flat fill, no glow
- [ ] Game sprites in viewport are never tinted by editor chrome
- [ ] Accent `#4A72B2` appears only on selection / focus / checked controls
- [ ] User-facing strings remain **English**
