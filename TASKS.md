# Task List

> **Status:** ACTIVE
> **Current Phase:** Stability & Monitoring (Phase A)
> **Master Plan:** See [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md)

---

## Current Sprint: Phase A - Stability

**Goal:** Ensure rock-solid dictation with gemma3:4b before adding features.

### ✅ Cloud/Local Toggle (COMPLETE)
- [x] Decrypt API keys from secure storage when switching providers
- [x] Pass decrypted keys to Python via IPC
- [x] Python sets keys in environment for processor factory
- [x] Toggle shows actual processor state on load
- [x] Badge updates after switching providers
- **Status:** Working. User tested Gemini ↔ Gemma switching.

### Settings Bugs (LOW PRIORITY - Optional)
See `DEV_HANDOFF.md` for exact code fixes. These don't block functionality.
- [ ] Fix `loadApiKeys()` not called on init (`settings.ts:30-40`)
- [ ] Fix `saveSetting()` missing await/error handling (`settings.ts:132-135`)
- [ ] Add missing `audioDeviceId`/`audioDeviceLabel` types (`main.ts:19-26`)
- [ ] Verify settings persist across app restart

### Model Monitoring
- [ ] Add model health check (is Ollama responding?)
- [ ] Log inference times to persistent file
- [ ] Alert when processing > 2s threshold

### Pipeline Observability
- [ ] Persist performance metrics to JSON
- [ ] Add session stats (success rate, avg time)

### Error Recovery
- [ ] Verify Ollama reconnection after timeout
- [ ] Test behavior when Ollama restarts mid-session

### Baseline Testing
- [ ] Run 10+ samples with gemma3:4b
- [ ] Document baseline metrics
- [ ] Test various input lengths (1s, 5s, 10s, 30s)

**Exit Criteria:** 30-minute session with 0 failures.

---

## Completed (MVP)
### P0: Status Dashboard ✅ COMPLETE
- [x] **UI/UX Redesign**
    - [x] Removed large circle, replaced with compact data-rich dashboard
    - [x] Background color changes for state (idle/recording/processing)
    - [x] Stats grid: Sessions, Characters, Avg Time, Last Total
    - [x] Token stats: Tokens Saved, Est. Savings (with highlight)
    - [x] Quick toggles: Sound, Cloud
    - [x] Performance timeline with active step highlighting
    - [x] Live status messages with typing dots animation
- [x] **Bug Fix**: Normalize Python log levels (INFO vs ERROR categorization)

### P0: Security Hardening ✅ COMPLETE
- [x] **Critical: Settings Window** - Migrated to secure preload bridge (`preloadSettings.ts`)
- [x] **Critical: XSS Prevention** - Replaced `innerHTML` with safe `textContent` in `renderer.ts`
- [x] **High: IPC Validation** - Add Zod schemas (Completed)
- [x] **High: Log Redaction** - Mask sensitive transcripts in logs (Completed)

### P0: Cloud/Local Toggle ✅ COMPLETE
- [x] **Backend (Python)**
    - [x] Implement `configure(provider)` logic in `ipc_server.py`
    - [x] Cloud Provider classes exist (`processor.py`: Gemini, Anthropic, OpenAI)
    - [x] Hot-swap processor on settings change
- [x] **Frontend (Electron)**
    - [x] Wire `settings.ts` to send `processingMode` via IPC
    - [x] Verify `main.ts` passes settings to Python
    - [x] Show current mode in system tray tooltip

### P0: Settings Persistence & UI
- [x] Create settings window component (Vanilla JS/HTML)
- [x] Add hotkey configuration UI
- [x] Add audio device selector (UI only)
- [x] Add processing mode selector (Cloud/Local toggle UI)
- [x] Wire up IPC for settings persistence
- [x] Store settings in electron-store
- [ ] **Verify**: Check if settings persist across restarts

### P0: Instant Text Injection
- [x] Implement clipboard paste in `injector.py`
- [x] Replace character-by-character with Ctrl+V (Wrapper implemented)
- [x] Restore original clipboard after paste
- [ ] **Verify**: Test in 5+ applications (Notepad, Chrome, Slack, etc.)

---

## 📋 Sprint 2: Modes & Intelligence (Week 2)

**Goal:** Differentiate the product with "Personality" and "Translation".

### P1: Personality Modes ✅ COMPLETE
- [x] **Backend Implementation** (`processor.py`)
    - [x] Standard (General purpose)
    - [x] Prompt (For LLM prompts)
    - [x] Professional (Business-ready)
    - [x] Raw (Literal transcription)
- [x] **UI Integration**
    - [x] Add mode selector in Settings (4 modes with emoji icons)
    - [x] `set_mode()` added to all processors (Local + Cloud)
    - [x] Mode persisted via electron-store

### P1: Translation Modes ✅ COMPLETE
- [x] Translation prompts: ES→EN, EN→ES in `config/prompts.py`
- [x] Post-processing step in `ipc_server.py` pipeline
- [x] Translation selector in Settings UI (already existed)
- [x] `transMode` IPC wiring from Electron → Python

### P1: Cloud Provider Authentication
**Phase 1: API Key Entry ✅ COMPLETE**
- [x] API Keys tab in Settings (Gemini, Anthropic, OpenAI)
- [x] Secure storage with Electron safeStorage
- [x] Test buttons for key validation
- [x] Keys passed to Python via configure()

**Phase 2: Google OAuth (Future)**
- [ ] Google Cloud Console OAuth Client ID setup
- [ ] "Login with Google" button
- [ ] Use AI Pro subscription quotas

---

## 🚀 Launch Preparation (Weeks 3-4)

### Polish & Internationalization
- [ ] Set up `react-i18next` (or lightweight alternative)
- [ ] Extract UI strings for ES/EN localization
- [ ] Refine Status Window design (animations)

### Packaging & Distribution
- [ ] Configure `electron-builder` for Windows NSIS
- [ ] Bundle Python backend (PyInstaller)
- [ ] **Validate**: Install on clean Windows machine

### Commercial & Marketing
- [ ] Set up `dikta.me` domain (Purchase pending)
- [ ] Create simple landing page (Tailwind)
- [ ] Set up Ko-fi page (Tiers: Starter, Pro)
- [ ] Prepare demo video/GIF

---

## Next Session Quick Start

1. **Optional:** Fix settings bugs (low priority, see DEV_HANDOFF.md)
2. **Ready to test:** Run baseline test suite
   - Follow `docs/qa/TEST_PROCEDURE.md`
   - Use `/test-diktate` workflow to analyze logs
   - Compare Gemini vs Gemma performance
3. **Then:** Move to Phase B (Testing Infrastructure) or Phase C.1 (Settings Persistence)

---

## Roadmap Reference

**Master Plan:** [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md)

| Phase | Focus | Status |
|-------|-------|--------|
| A | Stability & Monitoring | **CURRENT** |
| B | Testing Infrastructure | NEXT |
| C | Hardening | PENDING |
| D | Distribution | PENDING |
| E | Features | FUTURE |

> For deferred ideas, see `docs/L3_MEMORY/DEFERRED_FEATURES.md`.

---

## 🧪 Verification & Success Criteria

**V1.0 Launch Criteria:**
- [ ] Works on clean Windows install
- [ ] Cloud mode works out of box (no setup)
- [ ] Local mode works with Ollama guide
- [ ] Settings persist across restarts
- [ ] 5+ modes available
- [ ] No crashes in 1-hour session
