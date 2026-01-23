# Task List

> **Status:** ACTIVE
> **Current Phase:** Stability & Monitoring (Phase A)
> **Master Plan:** See [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md)

---

## Current Sprint: v1.0 Final Stretch (Lubricant & Validation)

**Goal:** Implement remaining high-ROI UX features, automate distribution logic, and perform exhaustive validation.

### 📊 Baseline Testing (PRIORITY)
- [ ] Run 10+ samples with gemma3:4b using `docs/internal/qa/TEST_DRILL.md`
- [ ] Document baseline metrics (Latency vs Duration)
- [ ] Test various input lengths (1s, 5s, 10s, 30s)
- [ ] **Verify**: 30-minute session with 0 failures to Baseline Specs.

### 🧪 Verification Pending
- [ ] **Mode Model Switching**: Investigate instability in mode-specific model selection (User reported).
- [x] **Ask Mode Injection**: Verify that the new `inject_text` handler correctly types LLM answers (Fixed & Verified).
- [ ] **Instant Text Injection**: Test in 5+ applications (Notepad, Chrome, Slack, VS Code, Word)
- [ ] **Settings Persistence**: Verify settings persist across app restarts (Double-check)

### 🐛 Fixes
- [x] **Code Cleanup**: Resolve `PROMPT_LITERAL` assigned twice in `prompts.py` (Fixed)

### 📦 Phase D: Distribution & Hardware (Locked)
- [ ] **Ollama Sidecar**: Automatic detection & background spawning of bundled Ollama
- [ ] **Hardware Auto-Tiering**: Detect GPU/VRAM and auto-select best Whisper/LLM models
- [ ] **License Check**: 
  - [ ] Implement LemonSqueezy API verification + 3-device limit inside the app.
  - [ ] Integrate LS Checkout overlay/link on `dikta.me`.
  - [ ] Configure post-purchase redirection to download/key page.
- [ ] **Packaging**: Configure `electron-builder` for Windows NSIS (Signed EXE)
- [ ] **Python Bundling**: Set up `PyInstaller` for a single-executable engine
- [ ] **Web Assistant (CRM)**: Deploy floating chatbot + Google Sheets bridge to `dikta.me`
- [ ] **Security Audit**: Verify `DIKTATE_DEBUG` is DISABLED in production
- [ ] **Ko-fi Membership**: 
  - [ ] Set up Ko-fi tiers for **Auto-Updates** & **Ecosystem Access**.
  - [ ] Integrate "Stay Updated" buttons on landing page.

---

## 📋 Sprint 2: Modes & Intelligence (Week 2)

### 🚧 Ask Mode (In Progress)
- [x] **UI Integration**: Add mode toggle in Control Panel (DONE)
- [x] **Custom Prompts**: Full UI for per-mode prompt editing (DONE)
- [x] **Raw Mode**: True passthrough bypass (DONE)
- [x] **Translate Toggle**: UI toggle + `Ctrl+Alt+T` hotkey (DONE)
- [ ] **Settings**: Configure default output (Type vs Clipboard)
- [ ] **Optimization**: Response handling

---

## 🚀 Launch Preparation (Final Cleanup)

### Polish & Internationalization
- [ ] Set up `react-i18next` (or lightweight alternative)
- [ ] Extract UI strings for ES/EN localization
- [ ] Refine Status Window design (animations)

### Commercial & Marketing
- [ ] Set up `dikta.me` landing page
- [ ] **Web Chatbot**: Integrate Gemini Flash for FAQ & Lead Capture
- [ ] Set up monetization/licensing backend
- [ ] Prepare demo video/GIF

---

## 🧪 Phase F: Final Validation & Methodical Quality

### 🖼️ UI/UX Audit (Screens & Windows)
- [ ] **Control Panel**: Verify state transitions (Idle -> Rec -> Proc -> Inject) for both Mini and Full modes.
- [ ] **Settings Master-Detail**: Methodically test every category (Audio, AI, General, Modes).
- [ ] **History Scroll**: Verify last 10 dictations appear and are re-injectable.
- [ ] **Multi-Monitor**: Verify window positioning and "Always on Top" persistence.

### 🎤 Dictation Stress & Quality
- [ ] **YouTube Stress Test**: Run 60-min endurance loop using "AI Content Creator" variety (Fast talkers, accents).
- [ ] **Human Edge Cases**: The "Weird Dictation" run (whispering, shouting, 30s silence, mid-sentence interrupts).
- [ ] **App Compatibility**: Methodical test in Notepad, VS Code, Chrome, Slack, Word, and Excel.
- [ ] **Oops Check**: Verify `Ctrl+Alt+V` across 5 different app switches.
- [ ] **Mute Detection**: 
  - [ ] **Hardware Mute**: Verify app blocks recording and notifies when mic is hardware-muted (pycaw).
  - [ ] **Silence Detection**: Verify log warnings/notifications when recording silent/low-RMS audio.

### 📊 Final Benchmarking
- [ ] **Tier Validation**: Verify Auto-Tiering correctly assigns Tiny/Medium/Turbo based on VRAM.
- [ ] **Distribution Check**: Run installer on a "Virgin" machine (no previous Python/Ollama).
- [ ] **Sidecar Lifecycle**: Verify Ollama starts on boot, pulls models, and shuts down properly.
- [ ] **License Activation**: Test key activation on 1st, 2nd, 3rd, and 4th devices (verify 4th fails).

---

## Roadmap Reference

**Master Plan:** [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md)

| Phase | Focus | Status |
|-------|-------|--------|
| A-C | Stability & Hardening | ✅ |
| D | Distribution & Sidecar | [/] In Progress |
| E | UX Polish (Oops/Mini) | [/] In Progress |
| F | Methodical Validation | [ ] NEXT |

> For deferred ideas, see `docs/internal/L3_MEMORY/DEFERRED_FEATURES.md`.
