# DEV_HANDOFF.md

> **Last Updated:** 2026-01-20 05:25
> **Last Model:** Gemini (Antigravity)
> **Session Focus:** Analysis & Specs for TTS and Injection Recall

---

## ✅ Completed This Session

### 🧠 Feature Analysis & Specification
- **Spec Created:** `docs/specs/SPEC_001_TTS_AND_REINJECT.md` detailing:
  - **TTS for Ask Mode:** Using `pyttsx3` for local audio delivery.
  - **Paste Last Injection:** "Recall" feature with `Injector` caching and Global Hotkey.
- **Planning:** Updated `TASKS.md` to include these features in the roadmap (Sprint 2 / Sprint 2.5).

---

## ⚠️ Known Issues / Broken

- [ ] **Mode Model Switching Instability**: Previous session noted instability in mode-specific model overrides. Needs verification.
- [ ] **Phase A.4: Baseline Testing**: Pending execution of `docs/qa/TEST_DRILL.md`.

---

## 🔄 In Progress / Pending

- [ ] **Implement TTS Support**: See `docs/specs/SPEC_001_TTS_AND_REINJECT.md` (Section 1).
- [ ] **Implement Paste Last Injection**: See `docs/specs/SPEC_001_TTS_AND_REINJECT.md` (Section 2).

---

## 📋 Instructions for Next Model

### Priority Order
1. **Implement TTS for Ask Mode** (High Value/Low Effort):
   - Install `pyttsx3`.
   - Create `python/core/tts.py`.
   - Update `ipc_server.py` to use it.
2. **Implement Paste Last Injection**:
   - Update `Injector` class to cache text.
   - Add `Ctrl+Alt+V` global hotkey in `main.ts`.
3. **Information**: The spec `docs/specs/SPEC_001_TTS_AND_REINJECT.md` contains the exact implementation plan. **Read it first.**

### Context Needed
- `docs/specs/SPEC_001_TTS_AND_REINJECT.md` (The Master Plan for next tasks)
- `python/ipc_server.py` (Target for TTS integration)
- `src/main.ts` (Target for Hotkey integration)

---

## Session Log (Last 3 Sessions)

### 2026-01-20 05:25 - Gemini
- **Docs:** Created detailed spec for **TTS** and **Injection Recall**.
- **Plan:** Updated `TASKS.md` with new feature tasks.

### 2026-01-19 22:45 - Gemini
- **Refactor:** Complete redesign of Status Dashboard UI.
- **Feat:** Added Personality Control Bar and Performance Grid.
- **Polish:** Typography updates and layout adjustments.

### 2026-01-19 21:45 - Gemini
- **Fix:** Implemented `inject_text` in Python backend for Ask mode.
- **Fix:** Fixed unhandled promise rejection in `main.ts` for Ask injection.
- **Docs:** Updated `TASKS.md` and created `walkthrough.md`.
