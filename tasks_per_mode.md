# Task: Per-Mode Provider Selection

- [x] **Phase 1: Backend (Python)**
    - [x] Refactor `processor.py` factory to accept provider names <!-- id: 1 -->
    - [x] Implement `ProcessorRegistry` in `ipc_server.py` to cache multiple instances <!-- id: 2 -->
    - [x] Add `mode_providers` storage and `_get_processor_for_mode(mode)` helper <!-- id: 3 -->
    - [x] Update dictation, ask, and note pipelines to use per-mode processors <!-- id: 4 -->
- [x] **Phase 2: Frontend (TypeScript)**
    - [x] Update `loadApiKeyStatuses` to expose available providers to mode settings <!-- id: 5 -->
    - [x] Modify `modes.ts` to populate the dropdown with available providers instead of models <!-- id: 6 -->
    - [x] Save/Load `modeProvider_[mode]` setting and Sync with backend <!-- id: 7 -->
- [x] **Phase 3: Verification & Polish**
    - [x] Verify local fallback if cloud key is missing <!-- id: 8 -->
    - [x] Test mode switching without VRAM reload overhead <!-- id: 9 -->
