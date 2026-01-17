# DEV_HANDOFF.md

> **Last Updated:** 2026-01-17
> **Last Model:** Gemini (Antigravity)
> **Session Focus:** V1.0 Sprint 1 - Core UX

---

## ✅ Completed This Session

### 1. Instant Text Injection (Fixed Slow Typing)
- **Implemented:** `pyperclip`-based injection in `python/core/injector.py`.
- **Logic:** Saves clipboard → Copies text → Sends Ctrl+V → Restores clipboard.
- **Why:** Character-by-character typing was too slow (100ms/char). Now it's instant.
- **Dependency:** Added `pyperclip` to `requirements.txt`.

### 2. Settings Window (UI & Foundation)
- **Implemented:** Full Settings UI in Vanilla JS/HTML (`src/settings.html`, `src/settings.js`).
- **Features:** 
  - Tabs: General, Audio, Modes, About.
  - Hotkey recording UI.
  - Mode switching UI.
- **Persistence:** Configured `electron-store` in `main.ts` to save settings.
- **Access:** Available via System Tray -> "Settings...".
- **Fix:** Updated `package.json` to copy `settings.*` to `dist/` on build.

### 3. Syntax Fixes
- Fixed duplicate variable declarations in `main.ts`.
- Fixed strict Python environmental warnings.

---

## ⚠️ Known Issues / Testing Needed

- **Settings Logic:** The settings UI saves values to `electron-store`, but the **backend (Python) does not yet read them**. changing "Cloud/Local" in the UI won't actually switch the engine yet.
- **Audio Devices:** The dropdown is mapped in UI but empty. Needs `navigator.mediaDevices.enumerateDevices()` logic in `settings.js`.
- **Restart Required:** User must restart `pnpm dev` to see `main.ts` changes.

---

## 📋 Instructions for Next Model

> **Context:** V1.0 Launch Sprint. We are building the **Cloud/Local Toggle** logic.

### Priority Queue:

1.  **Backend Config Bridge (P0):**
    -   Modify `services/pythonManager.ts` to listen for config changes from `electron-store`.
    -   Implement `configure()` handler in `python/ipc_server.py` to accept mode switches (Cloud/Local).
    -   Update `python/core/processor.py` to respect the mode.

2.  **Audio Device Enumeration (P1):**
    -   Update `src/settings.js` to list input devices.
    -   Send selected device ID to Python recorder.

3.  **Mode Prompts (P1):**
    -   The UI has modes (Standard, Developer, etc.).
    -   Need to implement the actual system prompts in `python/core/processor.py` mapping to these keys.

### Key Files
- `src/main.ts` (Store & IPC)
- `src/settings.js` (UI Logic)
- `python/ipc_server.py` (Command handling)
- `services/pythonManager.ts` (Bridge)

---

## 💡 Developer Note
The "Big Box" UI is still the primary interaction point. The Settings Window is a secondary view for configuration. Do not replace the Big Box.
