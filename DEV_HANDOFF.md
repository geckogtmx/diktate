# DEV_HANDOFF.md

> **Last Updated:** 2026-01-17
> **Last Model:** Gemini (Antigravity)
> **Session Focus:** Performance Regression Fix, Settings UI, Clean Session

---

## ✅ Completed This Session

-   **Performance Regression FIXED:**
    -   Reduced processing time from ~35s to **~2-4s** (Confirmed via Manual UAT).
    -   **Benchmarks (Llama3 + Whisper Turbo):**
        -   Short phrase: ~4.1s Total (Processing: 0.5s)
        -   Long phrase: ~14.5s Total (Processing: 2s)
        -   Intelligent Editing: Correctly removed false starts ("pineapples... no sorry").
    -   Fix: Optimized `python/config/prompts.py` to be concise.
-   **QA Standardized:**
    -   Created `docs/qa/MANUAL_TEST_SCRIPT.txt` and `docs/qa/TEST_PROCEDURE.md`.
    -   Created `.agent/workflows/test-diktate.md` for AI verification.
    -   Updated `AI_CODEX.md` to mandate manual testing.
-   **Features Committed:**
    -   **Settings UI:** `src/settings.html` skeleton, IPC wiring, Audio Device dropdown (UI only).

    -   **Modes:** `python/config/prompts.py` implements Standard/Professional/Literal modes.
    -   **Frontend:** `renderer.ts` and `main.ts` updated for Settings IPC.


## ⚠️ Known Issues / Broken

-   **Audio Device Enumeration:**
    -   Implemented `navigator.mediaDevices` in Settings UI.
    -   Backend (`ipc_server.py`, `recorder.py`) now accepts Device ID and Label.
    -   Implemented fuzzy matching for PyAudio device selection.
-   **Prompt Tuning:**
    -   Removed meta-commentary ("Here is the cleaned text") from `PROMPT_STANDARD`.
    -   Verified clean output via manual test.

## ⚠️ Known Issues / Broken

-   **VRAM Margin:** Llama3 + Whisper Large is tight on 8GB VRAM. Keep prompts concise.

## 🔄 In Progress / Pending

-   [ ] **Cloud/Local Toggle** - UI exists, need to test wiring.

## 📋 Instructions for Next Model

1.  **Cloud/Local Toggle:**
    -   Implement the logic to switch between Local (Ollama) and Cloud (OpenAI/Anthropic) in `ipc_server.py`.
    -   Wire the Settings UI toggle to this logic.
2.  **Verify UI:**
    -   Check if the Settings window opens and saves preferences correctly.
3.  **Mode Testing:**
    -   Test "Professional" vs "Standard" modes to ensure they actually differ in output style.

---

## Session Log (Last 3 Sessions)

### 2026-01-17 - Gemini (Antigravity)
-   **CRITICAL FIX:** Debugged and fixed 35s latency regression.
-   Committed pending UI/Frontend changes into a "Clean Session".

### 2026-01-17 - Gemini
-   Implemented Status Window Model Display.
-   Fixed critical Whisper GPU crash.

