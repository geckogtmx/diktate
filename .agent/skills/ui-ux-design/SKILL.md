---
name: ui-ux-design
description: Design system and UX guidelines for the dIKtate desktop application. Use this skill when building React components, designing the settings window, the floating pill UI, or system tray interactions. Focuses on native desktop feel, privacy aesthetics, and "lubricant" smooth animations.
---

# UI/UX Design Specialist (dIKtate)

This skill governs the visual and interactive design of the dIKtate desktop application.

## 🎨 Brand Aesthetic

**Core Concept:** The "Wall" + "Lubricant".
1.  **Privacy (The Wall):** Solid, opaque, protective, distinct boundaries.
2.  **Flow (The Lubricant):** Liquid animations, smooth transitions, rounding.

**Visual Language:**
- **Colors:** Deep privacy/security blues (`#0f172a`), slate grays, and a "recording red" accent.
- **Shapes:** Pill shapes (rounded-full), distinct cards (walls).
- **Typography:** Inter or System UI (native feel).

## 🖥️ Desktop-First UX Rules

1.  **Not a Website:** Avoid scrolling where possible. Use fixed-position layouts.
2.  **Short Interactions:** Interactions are micro (seconds), not macro (minutes).
3.  **System Integration:**
    - Drag app by background (`-webkit-app-region: drag`).
    - Use native cursors.
    - Respect system theme (Light/Dark).

## 🧩 Component Architecture (React + Tailwind)

**Stack:** React, TailwindCSS, Framer Motion, Radix UI (Headless).

### 1. The Floating Pill (Phase 4+)
The primary UI is minimal and unobtrusive.
- **State:** Idle (Invisible/Small) -> Recording (Pulsing Red) -> Processing (Spinning/Flowing).
- **Behavior:** Always on top, draggable, snaps to edges.

### 2. Settings Window
- **Layout:** Sidebar navigation + Content pane.
- **Controls:** Native-feeling switches, inputs, and selects.

## 🎭 Animation Guidelines (Framer Motion)

The "Lubricant" metaphor dictates motion.
- **Transitions:** `type: "spring", stiffness: 300, damping: 30` (Snappy but liquid).
- **Feedback:** UI must react instantly to voice state changes (VAD visualization).

**Example:**
```jsx
<motion.div
  initial={{ scale: 0.9, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  className="bg-slate-900 rounded-full p-4 shadow-xl"
>
  <RecordingIndicator active={isRecording} />
</motion.div>
```
