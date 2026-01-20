# DEV_HANDOFF.md

> **Last Updated:** 2026-01-20 11:05
> **Last Model:** Gemini (Antigravity)
> **Session Focus:** Marketing Website (sitex) Scrollytelling & UI Refinement

---

## ✅ Completed This Session

### 🌐 Marketing Website (sitex)
- **Hero Animation:** Refined vertical spacing and word cycler order ("TALKING", "THINKING", "WORKING", "WINNING").
- **Specs Section:** Refactored into two sticky slides of 8 cards each (16 features total) with animated progress pills.
- **Versus Section:** Implemented row-by-row scroll-driven revelation for the comparison table.
- **Spotlight Interactions:**
  - Independent sticky tracks for **Bilingual** and **Just Ask** sections.
  - Sequential text revelation: "Input" line types (0-45% scroll) followed by "Output" line (55-100% scroll).
  - Dynamic "typing cursors" with theme-aware colors (Secondary for Input, Primary for Output).
- **Apps Ticker:** Updated with modern tools (Antigravity, Cursor, Terminal, etc.) and added a "Use it with..." prompt.
- **Features Modal:** Added a high-end modal pop-up for the "Barebones" and "Power" versions showing the full feature arsenal.

---

## ⚠️ Known Issues / Broken

- [ ] **Mode Model Switching Instability**: Re-confirmed as a potential area of concern for the core app (needs verification in Python/Electron).
- [ ] **Mobile Touch Sensitivity**: The marketing site scrollytelling is fine-tuned for mouse wheels; touch-swipe timing may need testing on actual devices.

---

## 🔄 In Progress / Pending

- [ ] **Implement TTS Support**: See `docs/specs/SPEC_001_TTS_AND_REINJECT.md` (Section 1).
- [ ] **Implement Paste Last Injection**: See `docs/specs/SPEC_001_TTS_AND_REINJECT.md` (Section 2).

---

## 📋 Instructions for Next Model

### Priority Order
1. **Resume Core App Development**:
   - Focus on **TTS for Ask Mode** implementation in the Python backend.
   - Ref: `docs/specs/SPEC_001_TTS_AND_REINJECT.md`.
2. **Website Content Sync**:
   - If the core app features change, ensure the **Features Modal** in `sitex/index.html` stays in sync with `docs/FEATURE_LIST.md`.
3. **Mobile Polish**:
   - Check the `sitex` scrollytelling on mobile viewport heights.

### Context Needed
- `docs/specs/SPEC_001_TTS_AND_REINJECT.md` (Core app next steps)
- `sitex/index.html` & `sitex/src/main.js` (Marketing site assets)
- `docs/FEATURE_LIST.md` (Master feature list)

---

## Session Log (Last 3 Sessions)

### 2026-01-20 11:05 - Gemini
- **UI/UX:** Massive overhaul of marketing site scrollytelling and sequential animations.
- **Docs:** Updated `FEATURE_LIST.md` and created the "Arsenal" modal.

### 2026-01-20 05:25 - Gemini
- **Docs:** Created detailed spec for **TTS** and **Injection Recall**.
- **Plan:** Updated `TASKS.md` with new feature tasks.

### 2026-01-19 22:45 - Gemini
- **Refactor:** Complete redesign of Status Dashboard UI.
- **Feat:** Added Personality Control Bar and Performance Grid.
