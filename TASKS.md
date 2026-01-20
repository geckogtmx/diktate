# Task List

> **Status:** ACTIVE
> **Current Phase:** Stability & Monitoring (Phase A)
> **Master Plan:** See [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md)

---

## Current Sprint: Phase A - Stability & Verification

**Goal:** Ensure rock-solid dictation with gemma3:4b and prepare for distribution.

### 📊 Baseline Testing (PRIORITY)
- [ ] Run 10+ samples with gemma3:4b using `docs/qa/TEST_DRILL.md`
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

### 📦 Phase D: Distribution Prep (NEXT)
- [ ] **Packaging**: Configure `electron-builder` for Windows NSIS
- [ ] **Python Bundling**: Set up `PyInstaller` to bundle the engine
- [ ] **First-Run**: Implement "Embedded Sidecar" detection for Ollama
- [ ] **Hardware Tiering**: Refine auto-detection suggestions

---

## 📋 Sprint 2: Modes & Intelligence (Week 2)

### 🚧 Ask Mode (In Progress)
- [ ] **UI Integration**: Add mode toggle in Status Dashboard
- [ ] **Settings**: Configure default output (Type vs Clipboard)
- [ ] **Optimization**: Response handling

---

## 🚀 Launch Preparation (Weeks 3-4)

### Polish & Internationalization
- [ ] Set up `react-i18next` (or lightweight alternative)
- [ ] Extract UI strings for ES/EN localization
- [ ] Refine Status Window design (animations)

### Commercial & Marketing
- [ ] Set up `dikta.me` domain (Purchase pending)
- [ ] Create simple landing page (Tailwind)
- [ ] Set up Ko-fi page (Tiers: Starter, Pro)
- [ ] Prepare demo video/GIF

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
