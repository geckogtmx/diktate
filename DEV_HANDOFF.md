# DEV_HANDOFF.md

> **Last Updated:** 2026-01-16T19:25:00-06:00
> **Last Model:** Gemini
> **Session Focus:** Phase 4 Validation, Unicode Fixes, Hallucination Resolution, PTT Experiment

---

## ✅ Completed This Session

- **UnicodeEncodeError Resolved:** Replaced unicode arrow `→` with `->` in `python/ipc_server.py` and `python/main.py`. Logs now clean on Windows.
- **Hallucination Fixed:** Updated `python/core/processor.py` to use `mistral:latest` (was `llama3:8b`) and added logic to **block empty transcriptions** in `ipc_server.py`. This prevents the "He's actually going to the store..." loop.
- **Global Hotkey (Toggle) Working:** Verified `Ctrl+Alt+D` works reliably in **Toggle Mode** (Electron-based).
- **Debug UI:** Verified connection status and log streaming are functional.
- **Updated Tasks:** Marked Phase 4.1 (UAT) and 4.2 (Bug Fixes) items as complete in `TASKS.md`.

## ⚠️ Known Issues / Broken

- [ ] **Push-to-Talk (PTT) Failed:** Attempted to migrate hotkey logic to Python (`pynput`) to enable "Hold-to-Talk". Failed because keys were not registering on the user's system. **Reverted** to Electron Toggle mode.
- [ ] **Hotkey Toggle Confusion:** Current toggle mode works but can be confusing (user forgets if they are recording). PTT is still the desired UX.

## 🔄 In Progress / Pending

- [ ] **Phase 5 (Documentation):** Next scheduled phase.
- [ ] **PTT Re-attempt:** Needs a different approach (maybe Electron `globalShortcut` with a "key released" check, or troubleshooting `pynput` permissions/context).

## 📋 Instructions for Next Model

1.  **Read `walkthrough.md`** to understand the verification steps just performed.
2.  **Verify Stability:** Start the app (`npm run dev`) and confirm the Toggle hotkey (`Ctrl+Alt+D`) works and injects text.
3.  **Choose Path:**
    *   **Path A (Feature Polish):** Re-investigate Push-to-Talk. Consider using `iohook` or a native node module instead of Python `pynput` if `pynput` is unreliable in this context.
    *   **Path B (Documentation):** Proceed immediately to Phase 5 (README, INSTALLATION.md) as per `TASKS.md`.

### Priority Order
1.  Ensure stability of current "Toggle" mode.
2.  Update internal docs (`README.md` is slightly out of date regarding model usage).
3.  Decide on PTT vs Toggle for MVP v1.0.

### Context Needed
- `TASKS.md` (Check Phase 5)
- `python/ipc_server.py` (Logic for handling commands)
- `src/main.ts` (Electron hotkey handling)

### Do NOT
- Do NOT re-enable `pynput` listener in `ipc_server.py` without a specific hypothesis on why it failed (requires admin? requires window focus?).
- Do NOT change the Ollama model back to `llama3` without checking user availability.

---

## Session Log (Last 3 Sessions)

### 2026-01-16 19:25 - Gemini
- Fixed Unicode crash in logs.
- Fixed Ollama 404 and hallucinations (switched to Mistral, blocked empty inputs).
- Attempted PTT migration (Failed, Reverted).
- Validated text injection works.

### 2026-01-16 19:00 - Gemini
- Debugging UI hotkeys.
- Identified Unicode error.

### 2026-01-15 23:53 - previous session
- Debugging UI & IPC.
- UI implementation.
