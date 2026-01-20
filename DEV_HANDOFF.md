# DEV_HANDOFF.md

> **Last Updated:** 2026-01-19 21:30
> **Last Model:** Gemini
> **Session Focus:** High-Trust Model Switching & Backend Stability

---

## ✅ Completed This Session

### 🔄 High-Trust Model Switching
- **Mandatory Relaunch for Model Changes:** Pivot from unstable hot-swapping to a robust "Restart Required" policy for changing models.
  - File: `src/main.ts` (added `app:relaunch` IPC handler).
  - File: `src/settings.html` (added warning banner and glassmorphism modal).
  - File: `src/settings.ts` (implemented change detection and modal triggers).
  - File: `src/preloadSettings.ts` (exposed `relaunchApp`).
- **Status:** ✅ STABLE AND PREDICTABLE MODEL SWITCHING.

### 🛡️ Python Backend Stability
- **Fixed Pipe "Bleeding":** Restored missing `_process_ask_recording` function header in `ipc_server.py`. This resolves the "Recording Error" loop reported after the first transcript.
- **Asynchronous Startup Warmup:** The Python engine now initializes the LLM in a background thread.
  - App starts in `WARMUP` state immediately (Visual: "LOADING..." pulsing on pill).
  - Automatically transitions to `IDLE` once model is cached.
  - File: `python/ipc_server.py` (logic in `__init__` and `_startup_warmup`).
  - File: `src/services/pythonManager.ts` (initial state set to `warmup`).
- **Automatic Error Recovery:** Recordings can now be restarted even if the system is in an `ERROR` state.
- **Status:** ✅ BACKEND RECOVERED AND FLUID.

### 🧹 Fixes
- **Python Scope Bugs:** Centralized `os` and `wave` imports to fix `UnboundLocalError` when reading audio metadata.
- **Settings Sync:** Synchronized mode-specific model overrides with the Python backend during initialization.

---

## 🔄 In Progress / Pending

- [ ] **Phase A.4: Baseline Testing**
  - Establish baseline latency/quality with 10+ samples using `gemma3:4b`.
  - Correlate audio duration with processing time.
- [ ] **Phase D: Distribution Prep**
  - Configure `electron-builder` for production distribution.

## ⚠️ Known Issues / Broken

- **Minor:** `PROMPT_LITERAL` assigned twice in `prompts.py:57,73` (cosmetic).

---

## 📋 Instructions for Next Model

### Priority Order
1. **Baseline Testing (Phase A.4)**:
   - Run manual test script at `docs/qa/TEST_DRILL.md`.
   - Use `/test-diktate` to verify results.
2. **Distribution Setup**: Attempt a production build with `pnpm build` and `electron-builder`.

### Context Needed
- `python/ipc_server.py` (Check `_startup_warmup` and `start_recording` recovery logic).
- `src/settings.ts` (Review model change detection logic).

---

## Session Log (Last 3 Sessions)

### 2026-01-19 21:30 - Gemini
- **Feat:** Mandatory restart for model changes (Banner + Modal).
- **Fix:** Restored `_process_ask_recording` and fixed recording errors.
- **Feat:** Async background warmup on startup (Dashboard shows "WARMING UP").
- **Fix:** Centralized Python imports to resolve metadata errors.

### 2026-01-19 20:20 - Gemini
- **Feat:** Automated hardware detection on startup.
- **Fix:** Restored VRAM-aware model warnings.

### 2026-01-19 19:53 - Gemini
- **Fix:** Resolved "Mode dropdown not populating" bug.
