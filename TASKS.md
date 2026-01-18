# Master Task List

> **Status:** ACTIVE
> **Focus:** V1.0 Commercial Launch Sprint
> **Context:** Single Source of Truth for all development activities.

---

## ⚡ Current Sprint: Core UX & Settings (Week 1)

**Goal:** Ship settings window, cloud/local toggle, and ensure core stability.
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
- [ ] **High: IPC Validation** - Add Zod schemas (Deferred to Phase 3)
- [ ] **High: Log Redaction** - Mask sensitive transcripts in logs (Deferred)

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

## 🛣️ Roadmap Reference

*High-level phases from `PHASE_ROADMAP.md`.*

*   **Phase 1 (MVP)**: Core Dictation & Offline functionality. (In Progress/Polishing)
*   **Phase 2 (v0.2)**: User Experience (Settings, Modes). (Current Sprint)
*   **Phase 3 (v0.3)**: Advanced Architecture (WebSocket, Zod, State Management).
*   **Phase 4 (v0.4)**: Premium UI/UX (Floating Pill, Design System).
*   **Phase 5 (v1.0)**: Power Features (Custom Prompts, History).

> For detailed specs, see `docs/L3_MEMORY/PHASE_ROADMAP.md`.
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
