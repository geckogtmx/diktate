# Polish and Bug Crushing Plan

## User Review Required
> [!IMPORTANT]
> The "Modes" page redesign involves a new "Master-Detail" flow. User prompts will need to be stored. I will persist them in the Electron `store` and pass them to Python during configuration.

## Proposed Changes

### Frontend - Settings & Control Panel
#### [MODIFY] [src/settings.html](file:///e:/git/diktate/src/settings.html)
- **General Tab**: Reorder items:
    1. Processing Mode (Local/Cloud)
    2. Default Model
    3. Default Local/Cloud settings (Keep-alive/URL)
    4. Hotkeys (Dictate, Ask, Translate)
    5. Start at Login
- **Control Panel**:
    - Rename "Status" to "Control Panel".
    - Move "Translate" toggle from Settings -> Control Panel.
    - Add "Raw" button to the Personality/Mode toggle bar (Standard, Prompt, Pro, [Raw]).
- **Modes Tab**:
    - Implement Master-Detail view:
        - List of Modes (Standard, Prompt, Pro, Raw)
        - Detail View: 
            - Model Dropdown
            - System Prompt Text Area (Editable)
            - "Reset to Default" button
            - "Save" button

#### [MODIFY] [src/settings.ts](file:///e:/git/diktate/src/settings.ts)
- Update logic to handle the new Modes UI.
- Implement storage for Custom Prompts in Electron Store.
- Update `saveModeModel` to also save `saveModePrompt`.

#### [MODIFY] [src/index.html](file:///e:/git/diktate/src/index.html)
- Rename title/header to "Control Panel".
- Add "Translate" toggle to `toggles-bar`.
- Add "Raw" button to `mode-toggle-bar`.

#### [MODIFY] [src/renderer.ts](file:///e:/git/diktate/src/renderer.ts)
- Add logic for the new Translate toggle (IPC to main).
- Handle "Raw" mode selection in `switchPersonality`.

### Backend - Electron & Python
#### [MODIFY] [src/main.ts](file:///e:/git/diktate/src/main.ts)
- **Hotkeys**: Register `Ctrl+Alt+T` for Translate toggle.
- **IPC**: 
    - Add handlers for saving/loading custom prompts.
    - Pass custom prompts to Python during `syncPythonConfig` or a new `update_prompts` command.
- **Ollama Restart**: Improve error handling in `restartOllama` (check `fetch` issues).

#### [MODIFY] [python/ipc_server.py](file:///e:/git/diktate/python/ipc_server.py)
- **Startup**: Improve `_ensure_ollama_ready` logic to avoid race conditions and bind errors.
    - Check port -> if free, start process -> wait loop -> check health.
    - **CRITICAL**: If `self.processor` failed to initialize in `__init__` (because Ollama wasn't running), re-attempt initialization here after Ollama is confirmed running.
- **Configuration**:
    - Update `configure` to accept `customPrompts` map.
    - Track the current `processing_mode` (Standard, Prompt, Pro, Raw).
- **Processing**:
    - In `_process_recording`, check if mode is `raw`.
    - If `raw`, SKIP `self.processor.process()` and use `raw_text` directly.
    - Ensure performance metrics handle the skipped step correctly.

#### [MODIFY] [python/core/processor.py](file:///e:/git/diktate/python/core/processor.py)
- Ensure `LocalProcessor` and `CloudProcessor` can update their system prompts dynamically.

### Auto Loop Test Script Investigation
- The user suspects `endurance_stress_test.py` might be causing issues.
- **Action**: Check `endurance_stress_test.py` for any orphaned processes or configuration changes it might perform.
- **Action**: Ensure `endurance_stress_test.py` properly closes any Ollama processes it starts.
- **Action (in ipc_server.py)**: Add robustness to `_ensure_ollama_ready` to handle cases where a "zombie" Ollama process might be holding the port but not responding correctly.

---

## Investigation Findings (2026-01-22)

### Current Implementation Status

#### ✅ Already Implemented
1. **Prompts System**: `raw` mode prompt exists in `python/config/prompts.py`
2. **Hotkeys**: Dictate (Ctrl+Alt+D) and Ask (Ctrl+Alt+A) are registered in main.ts:1113, 1137
3. **Ollama Management**: Restart and warmup handlers exist (main.ts:949, 996)
4. **Mode System**: Standard, Prompt, Professional modes exist with model-specific overrides
5. **Translation**: Translation modes (es-en, en-es) exist in prompts.py
6. **Fallback Logic**: Automatic fallback to raw transcription when processor fails (ipc_server.py:537-550)

#### ❌ Missing / Needs Implementation
1. **UI - Control Panel**:
   - Title is still "dIKtate Status" not "Control Panel" (index.html:7)
   - NO Translate toggle in toggles-bar (index.html:551-567)
   - NO "Raw" button in mode-toggle-bar (index.html:569-583 has only Standard/Prompt/Pro)

2. **UI - Settings**:
   - General tab items are NOT in proposed order (settings.html:326-388)
   - NO Translate hotkey field
   - Modes tab has NO Master-Detail view or prompt editing (settings.html:605-703)

3. **Backend - Hotkeys**:
   - NO Ctrl+Alt+T hotkey registered (main.ts:1108-1148 only has Dictate/Ask)

4. **Backend - Custom Prompts**:
   - NO IPC handlers for custom prompt storage/loading
   - NO custom prompts passed to Python in syncPythonConfig (main.ts:572-627)
   - NO `configure` method to accept customPrompts in ipc_server.py

5. **Backend - Raw Mode**:
   - NO explicit skip of LLM processing for raw mode
   - Current implementation would still call processor.process() with raw prompt
   - Plan suggests skipping processor entirely (ipc_server.py:530-553)

#### ⚠️ Issues Identified

**1. Processor Initialization Race Condition** (ipc_server.py:369-398):
- If Ollama is not running at startup, `self.processor` initialization fails and stays `None`
- `_startup_warmup` runs in background thread and starts Ollama
- **BUT**: Processor is never re-initialized after Ollama becomes available
- **IMPACT**: App uses raw transcription fallback until restart

**2. Raw Mode Architecture Concern**:
- Plan proposes skipping `processor.process()` entirely for raw mode
- This means NO punctuation/capitalization cleanup
- Current "raw" prompt in prompts.py:44-53 adds punctuation while preserving words
- **DECISION NEEDED**: Should raw mode be:
  - A) True passthrough (no LLM call) - fast, literal Whisper output
  - B) Minimal LLM cleanup (current raw prompt) - adds punctuation

**3. Translate Toggle Architecture**:
- Current translation is a post-processing step (ipc_server.py:563-574)
- Plan suggests making it a toggle in Control Panel
- **QUESTION**: Should translate be:
  - A) A persistent setting (like current transMode in store)
  - B) A session toggle (on/off for current session only)
  - C) Applied only when explicitly enabled per dictation

**4. Custom Prompts Storage**:
- Plan mentions storing in Electron store
- **CONSIDERATION**: Prompts can be long (200+ chars)
- Store structure suggestion: `customPrompts: { standard: "...", prompt: "...", professional: "...", raw: "..." }`
- Need validation to prevent prompt injection attacks

### Endurance Stress Test Investigation

**File**: `python/endurance_stress_test.py`

**Analysis**:
- ✅ Standalone test script, creates its own Transcriber and Processor instances
- ✅ Does NOT start or manage Ollama processes automatically
- ✅ Does NOT modify global configuration or settings
- ✅ Properly cleans up temp audio files in `finally` blocks
- ✅ Uses daemon threads for monitoring (won't block exit)

**VERDICT**: endurance_stress_test.py is **NOT** causing auto-loop or configuration issues. It's designed for manual testing only and does not interfere with the main application.

### Architecture Dependencies

**Implementation Order** (to avoid breaking changes):

1. **Phase 1 - Backend Foundation**:
   - Fix processor re-initialization after Ollama startup (ipc_server.py)
   - Add custom prompts storage structure to Electron store
   - Add IPC handlers for custom prompt save/load (main.ts)
   - Update syncPythonConfig to pass custom prompts (main.ts)

2. **Phase 2 - Python Integration**:
   - Add custom prompts acceptance in processor.py
   - Implement raw mode bypass (skip processor.process() entirely)
   - Update configure command to handle custom prompts (ipc_server.py)

3. **Phase 3 - UI Changes**:
   - Add Raw button to Control Panel mode toggle bar
   - Add Translate toggle to Control Panel
   - Register Ctrl+Alt+T hotkey
   - Reorder General tab items

4. **Phase 4 - Advanced Features**:
   - Implement Master-Detail Modes UI
   - Add system prompt editing capability
   - Add Reset to Default functionality

**Critical Files**:
- src/main.ts:1108-1148 (hotkey registration)
- src/main.ts:572-627 (syncPythonConfig)
- python/ipc_server.py:369-398 (component initialization)
- python/ipc_server.py:492-610 (_process_recording)
- python/core/processor.py:35-68 (mode/prompt management)

---

## Verification Plan

### Automated Tests
- None strictly for UI layout, will rely on manual verification.
- Unit tests for Python prompt override logic.

### Manual Verification
1. **Settings Reorder**: Open Settings, verify General tab order.
2. **Control Panel**:
    - Check title.
    - Verify Translate toggle works (updates state).
    - Verify "Raw" button exists and can be selected.
    - Verify "Raw" mode produces text with NO LLM processing (fast, literal).
3. **Hotkeys**: Test Ctrl+Alt+T toggles translation.
4. **Modes**:
    - Select a mode, change its model, edit its prompt, save.
    - Restart app, verify changes persist.
    - Click "Reset", verify return to default.
5. **Ollama Startup**:
    - Stop Ollama manually (`taskkill`).
    - Start App. Verify Ollama starts AND `self.processor` comes online (no "Processor unavailable" warning).
    - Use "Restart Ollama" button. Verify success.
