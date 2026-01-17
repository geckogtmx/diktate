# Design System: dIKtate (Waal)

> **Status:** SET IN STONE (2026-01-17)
> **Aesthetic:** Premium, Dark, Minimalistic, Obsidian-like.

---

## 🎨 Core Color Palette

The primary palette is a transition from deep Ink Black to Vibrant Teal. This palette is used for backgrounds, borders, and depth-shading.

| Variable | Hex Code | Usage |
|----------|----------|-------|
| `--ink-black` | `#002029ff` | Primary Background (Deepest layer) |
| `--jet-black` | `#00303dff` | Secondary Background (Panels, Sidebars) |
| `--dark-teal` | `#004052ff` | Borders, Tertiary layers |
| `--dark-teal-2` | `#005066ff` | Hover states, Secondary accents |
| `--dark-teal-3` | `#00607aff` | Primary Accents, High-contrast elements (Lightest) |

### Functional Mappings

- **Background (App):** `var(--ink-black)`
- **Background (Containers):** `var(--jet-black)`
- **Borders:** `var(--dark-teal)`
- **Active/Hover:** `var(--dark-teal-2)`
- **Highlights/Icons:** `var(--dark-teal-3)`

---

## 🖋️ Typography

- **Primary Sans:** 'Plus Jakarta Sans', 'Inter', 'Segoe UI', sans-serif
- **Mono:** 'JetBrains Mono', 'Consolas', monospace

---

## ✨ Aesthetic Principles

1. **Depth via Color:** Use the palette range to represent Z-space. `--ink-black` is the furthest back; `--dark-teal-3` is the closest to the user.
2. **Subtle Gradients:** Prefer very subtle gradients between the teal steps rather than flat colors where possible.
3. **High Contrast Text:** Always use `white` or `#e0e0e0` against these dark backgrounds.
4. **Minimalistic Chrome:** Remove thick borders. Use 1px borders of `var(--dark-teal)` or light shadows.

---

## 🔗 Implementation Status

- [x] **index.html**: Update `:root` variables
- [x] **settings.html**: Update `:root` variables
- [x] **assets/icons**: Review SVG colors for alignment
