# ArtCade Studio — Editor UI Design System

> **Status**: Active (2026 UI).  
> **Scope**: React/Tailwind shell, Logic Board chrome, Inspector, docks — **not** game viewport pixels (WASM/Raylib) or in-game sprites.  
> **Principle**: Desktop-professional chrome; game art stays primary. Flat, no neon/glow/heavy shadows.

Two editor themes:

| Theme | `data-theme` | Use |
|-------|----------------|-----|
| **Dark Anthracite** | `dark` (default) | Production authoring — cold graphite, muted blue-gray accents |
| **Industrial Mid-Grey** | `light` | Alternate — neutral mid-grey for sprite colour judgement |

Toggle: **VIEW** menu in the editor.

---

## 1. Dark Anthracite (`data-theme="dark"`)

Monochrome, flat, professional. Accents only for selection/focus.

### Base surfaces

| Token | Hex | Role |
|-------|-----|------|
| `bg-app` | `#0E1113` | Deepest app background |
| `bg-window` | `#15191C` | Editor frame, inspector shell, bottom dock |
| `void` | `#11161A` | Canvas / viewport workspace |
| `logic-bg` | `#14191D` | Logic Board workspace |
| `surface` | `#1B2024` | Side panels, main chrome |
| `surface-2` | `#20262A` | Section headers, secondary panels |
| `surface-3` | `#111518` | Inputs, console well |
| `surface-hover` | `#252B30` | Row/button hover |
| `surface-selected` | `#2B3640` | List selection |
| `surface-selected-strong` | `#35424D` | Strong focus |

### Borders

| Token | Hex |
|-------|-----|
| `outline-subtle` | `#22282D` |
| `outline` | `#2A3035` |
| `outline-strong` | `#3A4248` |
| `outline-focus` | `#6B7C87` |

### Text

| Token | Hex |
|-------|-----|
| `primary` | `#D8DEE3` |
| `primary-soft` | `#AAB2B8` |
| `muted` | `#7E878E` |
| `muted-2` | `#555E65` |
| `text-on-selected` | `#EEF2F4` |
| `text-meta` | `#8D969E` |

### Accent (sparingly)

| Token | Hex | Use |
|-------|-----|-----|
| `accent` | `#4A5D6A` | Active tab, selected control |
| `accent-hover` | `#5C6F7D` | Hover on accent control |
| `accent-selected` | `#33414C` | Deep selection fill |

No glow. No saturated “web app” blue.

### Status (badges only)

| Token | Hex |
|-------|-----|
| `info` | `#6F8A9B` |
| `success` | `#6F8F7A` |
| `warn` | `#B59A5B` |
| `danger` | `#B86A62` |
| `debug` | `#8A9298` |

### Logic Board

| Token | Hex |
|-------|-----|
| `logic-card` | `#1B2024` |
| `logic-card-header` | `#20262A` |
| `logic-block` | `#1E2428` |
| `logic-row-disabled` | `#171B1E` |

Trigger / condition / action blocks are distinguished by icon, label, and layout — not strong colours.

### Canvas chrome

| Token | Hex |
|-------|-----|
| `grid-primary` | `#252B30` |
| `grid-secondary` | `#1B2024` |
| `camera-frame` | `#B7C0C7` |
| `selection-outline` | `#6B7C87` |
| `gizmo-x` / `gizmo-y` | `#A86A64` / `#7E9A78` (desaturated) |

---

## 2. Industrial Mid-Grey (`data-theme="light"`)

Mid-grey UI so sprite preview colours are not biased by pure black or paper white.

| Token | Hex | Role |
|-------|-----|------|
| `void` | `#404040` | Workspace |
| `surface` | `#535353` | Panels, menu |
| `surface-3` | `#3A3A3A` | Inputs, script wells |
| `outline` | `#222222` | Borders |
| `primary` | `#E0E0E0` | Body text |
| `muted` | `#999999` | Secondary labels |
| `accent` | `#5C83C4` | Selection, Play |

Boot splash / Tauri window: `editor/boot-surfaces.json` → `npm run sync-boot-chrome`.

---

## 3. Component rules (both themes)

### Geometry

- **No pill buttons.** `border-radius: 2px` default; `4px` max for modals.
- Square icon buttons.

### Hover / focus

- Flat fill only; ≤ 100ms transitions.
- No outer glow, glassmorphism, or heavy shadows.
- Focus: 1px `outline-focus` or 2px left rail — not box-shadow rings.

### Typography

| Use | Font |
|-----|------|
| UI | IBM Plex Sans |
| Console, coords, Lua | JetBrains Mono |

---

## 4. CSS implementation

Source of truth: `editor/src/index.css` (`:root` / `[data-theme="dark"]` / `[data-theme="light"]`).

Legacy aliases used by components: `--bg`, `--panel`, `--panel-3`, `--text`, `--border`, `--accent`, etc.

CodeMirror: `editor/src/codemirror/artcade-theme.ts` (`artcade-dark` / `artcade-light`).

---

## 5. Layout tokens

| Region | Default |
|--------|---------|
| Left column | 280px |
| Right Inspector | 320px |
| Bottom dock | 300px |
| Min editor width | 1520px |

---

## 6. Related assets

| Asset | Path |
|-------|------|
| Index (mockups) | [`new-ui/README.md`](new-ui/README.md) |
| Logic Board spec | [`new-ui/LOGIC_BOARD_UI_SPEC.md`](new-ui/LOGIC_BOARD_UI_SPEC.md) |

**Product name:** ArtCade Studio in shipped UI. Mockup title bars may still say *PixelForge 2D* — layout reference only.

---

## 7. Review checklist

- [ ] Default launch uses **Dark Anthracite** (`dark`)
- [ ] Light theme restores **Industrial Mid-Grey** only when toggled
- [ ] Workspace uses `void` / `logic-bg`, not flat black `#000`
- [ ] Accents appear on selection/focus only
- [ ] No pill primary buttons; hovers are flat
- [ ] User-facing strings in **English**
