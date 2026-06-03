# ArtCade Studio - Editor UI Design System

> **Status**: Active 2026 UI.
> **Scope**: React/Tailwind shell, Logic Board chrome, Inspector, docks, boot chrome. Game viewport pixels rendered by WASM/Raylib are not themed here.
> **Principle**: premium desktop editor chrome; game art remains the visual priority.

Two editor themes:

| Theme | `data-theme` | Use |
|-------|--------------|-----|
| **Dark Premium Anthracite** | `dark` (default) | Production authoring - refined black surfaces, restrained blue-gray/silver accents |
| **Industrial Mid-Grey** | `light` | Alternate - neutral mid-grey for sprite colour judgement |

Toggle: **VIEW** menu in the editor.

---

## 1. Dark Premium Anthracite

Deep, minimal, professional. No neon, no decorative glow. Accents appear only where they improve state recognition.

### Base surfaces

| Token | Hex | Role |
|-------|-----|------|
| `bg-app` | `#050505` | Tauri window, boot shell, deepest app background |
| `bg-window` | `#0B0B0C` | Status bar, top chrome underside, dock shell |
| `void` | `#08090A` | Canvas / viewport workspace |
| `logic-bg` | `#0B0D0F` | Logic Board workspace |
| `surface` | `#111214` | Side panels, main chrome |
| `surface-2` | `#16181B` | Section headers, raised controls |
| `surface-3` | `#0B0B0C` | Inputs, console wells |
| `surface-hover` | `#1C2025` | Row/button hover |
| `surface-selected` | `#263143` | Selected rows and segmented controls |
| `surface-selected-strong` | `#33425B` | Stronger active/control fill |

### Borders

| Token | Hex |
|-------|-----|
| `outline-subtle` | `#1B1E23` |
| `outline` | `#24272D` |
| `outline-strong` | `#30343B` |
| `outline-focus` | `#6E7684` |
| `outline-faint` | `#15171B` |

### Text

| Token | Hex |
|-------|-----|
| `primary` | `#F2F2F2` |
| `primary-soft` | `#C7CCD4` |
| `muted` | `#A0A4AB` |
| `text-on-selected` | `#F2F2F2` |

### Accents and status

| Token | Hex | Use |
|-------|-----|-----|
| `accent` | `#6E7684` | Focus, subtle active state |
| `accent-hover` | `#C7CCD4` | Silver hover/active icon color |
| `warn` | `#B8973F` | Warning badges |
| `success` | `#4F8F73` | Success badges |
| `danger` | `#A35656` | Error/danger badges |
| `info` | `#6E7684` | Informational metadata |
| `purple` | `#9B7BFF` | Rare Logic Board or asset accent |

### Logic Board

| Token | Hex |
|-------|-----|
| `logic-card` | `#111418` |
| `logic-block` | `#15191E` |

Trigger, condition, and action blocks are distinguished by layout, title, icon, and thin left accent rails rather than large saturated fills.

### Canvas chrome

| Token | Hex |
|-------|-----|
| `grid-primary` | `#24272D` |
| `grid-secondary` | `#14171B` |
| `camera-frame` | `#80D6FF` |

---

## 2. Industrial Mid-Grey

Mid-grey UI so sprite preview colours are not biased by pure black or paper white.

| Token | Hex | Role |
|-------|-----|------|
| `void` | `#404040` | Workspace |
| `surface` | `#535353` | Panels, menu |
| `surface-3` | `#3A3A3A` | Inputs, script wells |
| `outline` | `#222222` | Borders |
| `primary` | `#E0E0E0` | Body text |
| `muted` | `#999999` | Secondary labels |
| `accent` | `#5C83C4` | Selection/focus |

Boot splash and Tauri window surfaces are generated from `editor/boot-surfaces.json`.

---

## 3. Component Rules

### Geometry

- Default radius: `4px`; compact controls may use `3px`; larger framed tools may use `6px` only when needed.
- Use square icon buttons for tools and symbolic actions.
- Avoid card-in-card layouts. Cards are for repeated items, modals, or genuinely framed tools.

### Hover and focus

- Flat fill only, 100ms transition cap.
- No glassmorphism or decorative glow.
- Focus is a 1px border/focus ring based on `outline-focus`.

### Typography

| Use | Font |
|-----|------|
| UI | IBM Plex Sans |
| Console, coords, Lua | JetBrains Mono |

---

## 4. CSS Implementation

Source of truth: `editor/src/index.css`.

Boot source of truth: `editor/boot-surfaces.json`.

Generated boot files:

- `editor/public/boot-theme-init.js`
- `editor/public/critical-layout.css`

Regenerate them with:

```powershell
cd editor; npm run sync-boot-chrome
```

Current component aliases retained for TSX class names:

`--bg`, `--panel`, `--panel-2`, `--panel-3`, `--border`, `--border-2`, `--text`, `--text-2`, `--accent-2`, `--accent-bd`, `--accent-bg`, `--accent-bg-h`, `--accent-fg-on-bg`, `--yellow`, `--green-2`, `--blue`.

Removed legacy spec aliases:

`--bg-panel`, `--bg-input`, `--text-primary`, `--border-default`, `--tab-active-bg`, and similar unused aliases are no longer part of the active contract.

---

## 5. Layout Tokens

| Region | Default |
|--------|---------|
| Top menu + toolbar | 96px |
| Left column | 280px |
| Right Inspector | 320px |
| Bottom dock | 300px |
| Recommended minimum editor width | 1520px |

### Bottom Dock Panels

Four fixed-order columns when the dock is expanded: **Debug Console**, **Animation Timeline**, **Logic Preview**, **Event Debugger**.

Visibility is toggled in **VIEW -> Bottom panels** and persisted in `localStorage` key `artcade.dock-panels-v1`. First run defaults to Console + Logic Preview.

---

## 6. Review Checklist

- [ ] Default launch uses **Dark Premium Anthracite** (`dark`)
- [ ] `boot-surfaces.json`, Tauri `backgroundColor`, and `index.css --bg-app` match
- [ ] Light theme restores **Industrial Mid-Grey** only when toggled
- [ ] Workspace uses `void` / `logic-bg`, not raw `#000`
- [ ] Accents appear on selection/focus only
- [ ] User-facing strings are in English
