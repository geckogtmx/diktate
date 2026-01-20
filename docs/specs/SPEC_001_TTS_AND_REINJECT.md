# Feature Specification: TTS Delivery & Injection Recall

> **Status:** DRAFT
> **Target Phase:** Sprint 2 / Polish
> **Related Components:** `ipc_server.py`, `injector.py`, `renderer` (Ask Mode)

## 1. Feature: Text-to-Speech (TTS) for Ask Mode

### Objective
Provide an audio delivery mode for the "Ask" feature, allowing the user to hear the LLM's answer instead of (or in addition to) having it typed/copied. This enhances the accessibility and "assistant" feel of the application.

### Technical Analysis

#### Backend (`python/`)
*   **Library:** Use `pyttsx3` for offline, cross-platform (SAPI5 on Windows) TTS. It is lightweight (`pip install pyttsx3`) and local-first.
*   **New Module:** `python/core/tts.py`
    *   `class TTSEngine`: Wraps `pyttsx3`.
    *   Methods: `speak(text: str)`, `stop()`, `set_voice(voice_id)`, `set_rate(rate)`.
    *   **Concurrency:** `pyttsx3` has a blocking event loop (`runAndWait`). This MUST run in a separate thread or be managed carefully to avoid blocking the IPC server (FastAPI/socket) main loop. Use `engine.iterate()` within a non-blocking loop or a dedicated worker thread.
*   **Integration:** `python/ipc_server.py`
    *   Initialize `TTSEngine` in `_initialize_components`.
    *   In `_process_ask_recording`:
        *   Check `tts_enabled` flag (from config/settings).
        *   If enabled, call `tts.speak(answer)` after receiving the LLM response.

#### Frontend (`src/`)
*   **Settings UI (`settings.html` / `settings.ts`):**
    *   Add toggle: "Enable Text-to-Speech".
    *   (Optional) Add Dropdown: "Select Voice" (fetch voices via IPC from Python).
*   **Main Process (`main.ts`):**
    *   Pass the TTS preference to Python via `syncPythonConfig` or `start_recording` payload.

### Implementation Tasks
- [ ] Install `pyttsx3` in Python environment.
- [ ] Create `python/core/tts.py` with thread-safe implementation.
- [ ] Update `IpcServer` to initialize and use TTS in `_process_ask_recording`.
- [ ] Update Electron settings to Include TTS toggle.

---

## 2. Feature: Paste Last Injection

### Objective
Allow the user to re-paste the last text that was successfully processed and injected. This solves the UX friction where a user might dictate something but have the wrong window focused, losing the text.

### Technical Analysis

#### Backend (`python/`)
*   **State Management:** `python/core/injector.py`
    *   Add `self.last_injected_text: Optional[str] = None` to `Injector` class.
*   **Logic:**
    *   Update `paste_text(text)` and `type_text(text)`:
        *   Store `text` into `self.last_injected_text` *before* execution.
    *   Add method `reinject_last()`:
        *   If `self.last_injected_text` is present, call `paste_text(self.last_injected_text)`.
        *   Return success/fail status (to notify user if nothing to paste).
*   **IPC:** `python/ipc_server.py`
    *   Add handler for `python:reinject-last` command.

#### Frontend (`src/`)
*   **User Trigger:**
    *   **Global Hotkey:** Register a new global shortcut (default: `Ctrl+Alt+V` or `Ctrl+Alt+L`?).
    *   **Tray Menu:** Add "Paste Last Injection" item to the system tray.
*   **Main Process (`main.ts`):**
    *   Register `globalShortcut`.
    *   Handler sends `reinject_last` command to Python.
    *   If successful, play success sound.
    *   If empty (no history), show error notification.

### Implementation Tasks
- [ ] Modify `Injector` class to cache last text.
- [ ] Add `reinject_last` method and IPC handler.
- [ ] Add "Paste Last Injection" to System Tray menu.
- [ ] (Optional) Add configurable Hotkey in Settings for "Re-inject".

---

## 3. Risks & Considerations
*   **Privacy (Clipboard):** The `Injector` already handles clipboard save/restore. `reinject_last` should use the same safe mechanism.
*   **Memory:** Storing one string is negligible.
*   **TTS Blocking:** Crucial to ensure `pyttsx3` does not freeze the `ipc_server` while speaking. Threading is mandatory.
