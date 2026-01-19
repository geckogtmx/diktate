# DEV_HANDOFF.md

> **Last Updated:** 2026-01-18
> **Last Model:** Gemini (Antigravity)
> **Session Focus:** Extensive Website Refinement & Deployment Strategy

---

## ✅ Completed This Session

### Website (`site/index.html`)
- [x] **Hero Iteration:** Removed "PRODUCING" from generic word scroll.
- [x] **Download Buttons:** Unified style for Windows/Mac (White filled, shadow) and reorganized layout (Windows/Mac side-by-side, iOS/Android below).
- [x] **Truth-First Section:** Replaced sterile icons with **Abstract Glass Textures** (Privacy, Honest Pricing, Radical Transparency) generated via `generate_image`.
- [x] **Comparison Table:** Updated title to "The Standard vs dIKta.me", widened Feature column, added Latency disclaimer (* < 700ms).
- [x] **Specs Grid:** Expanded to 16 cards (Added: Voice Macros, Model Agnostic, Smart Fallback, Hackable Core).
- [x] **Ask Mode Section:** Added inverted "Dark Mode" section below Bilingual section.
- [x] **Bilingual Section:** Updated copy to "We Speak Spanish. / Hablamos Inglés."
- [x] **Copy Tweaks:** "Outperform other available options", "Small 4b Model Cleanup", "Global Hotkeys".

### Strategy & Documentation
- [x] **Embedded Sidecar Strategy:** Defined packaging strategy for Ollama: bundle binary, detect existing install, auto-pull model.
- [x] **Docs Updated:** Detailed this strategy in `DEVELOPMENT_ROADMAP.md` (Phase D) and `docs/BUILD_GUIDE.md` (Section 5).

---

## ⚠️ Known Issues / Broken

- [ ] **Ask Mode UI Missing:** The actual `[Dictate | Ask]` toggle in the React app (`src/components/StatusWindow.tsx`) is NOT implemented yet. The website claims it exists ("Ctrl+Alt+A"), but the code doesn't support it yet.
- [ ] **Status Window Design:** Current React UI is basic. User requested a redesign to match the "Smart Control Panel" aesthetic (Glass/Neon) seen on the website.

---

## 🔄 In Progress / Pending

- [ ] **Phase 2: Ask Mode UI:** Needs toggle button and state management in `renderer.ts`.
- [ ] **Packaging (Phase D):** Need to implement the `ollama.exe` bundling and detection logic defined in `BUILD_GUIDE.md`.

---

## 📋 Instructions for Next Model

**Role:** You are the **Builder** (Claude).
**Goal:** Make the App match the Website.

### Priority Order
1.  **Redesign Status Window:**
    *   Open `src/components/StatusWindow.tsx` (or whatever the main React component is).
    *   Implement the "Glass/Neon" design using Tailwind.
    *   Add placeholder "cards" for VRAM, Speed, Model status (as seen on the site).
2.  **Implement Ask Mode Toggle:**
    *   Add visual Toggle `[Dictate | Ask]`.
    *   Wire it to `ipcRenderer.send('set-mode', 'ask')` (you may need to add this handler in `main.ts`).
3.  **Run the Build:**
    *   `npm run build` to verify everything compiles.

### Context Needed
-   Read `docs/BUILD_GUIDE.md` (Section 5) for the packaging context (future task).
-   Look at `site/index.html` (specifically the "Smart Control Panel" section) for design inspiration.

### Do NOT
-   Do not change the website anymore. Focus on the electron app.

---

## Session Log (Last 3 Sessions)

### 2026-01-18 - Gemini
- Extensive website overhaul (Textures, Copy, Layout).
- Defined "Embedded Sidecar" packaging strategy.
- Updated Roadmap and Build Guide.

### 2026-01-18 - Gemini
- Refined Product Architecture (Libre vs Pro vs Streamer).
- Updated website pricing tables.

### 2026-01-18 - Claude
- Implemented core Python backend for Ask Mode.
- Fixed hotkeys.
