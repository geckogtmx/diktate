# Development Roadmap

> **Status:** ACTIVE - Post-MVP Development
> **Last Updated:** 2026-01-17
> **Current Phase:** Stability & Monitoring
> **Model:** gemma3:4b (stable, 350-750ms processing)

---

## Where We Are

**MVP is complete.** The core dictation pipeline works:
- Recording (push-to-talk) → Transcription (Whisper) → Processing (Ollama) → Injection (keyboard)

**What's stable:**
- gemma3:4b with 2K context window
- Processing time: 350-750ms (down from 2-5s with llama3)
- No VRAM contention issues
- Model warmup on startup

**What needs work:**
- Monitoring and observability
- Automated testing infrastructure
- Settings persistence verification
- Multi-app injection testing

---

## Phase Structure

### v1.0 (Current Development)
| Phase | Focus | Status |
|-------|-------|--------|
| **A: Stability** | Model monitoring, model selection, error recovery | **CURRENT** |
| **B: Testing** | Automated + manual test suites | NEXT |
| **C: Hardening** | Fallback, retry logic, tray actions, safety | PENDING |
| **D: Distribution** | Packaging, installer, history panel | PENDING |
| **E: Polish** | Snippets, dictionary, final QA | PENDING |

### v1.1 (Post-Release Priority)
| Phase | Focus | Status |
|-------|-------|--------|
| **F: Wallet Backend** | Stripe, wallet credits, cloud API proxy | PLANNED |
| **1.1-A: Premium UI** | Floating pill, design system, waveform | PLANNED |
| **1.1-B: Power Features** | Custom prompts, advanced audio, extended history | PLANNED |
| **1.1-C: Architecture** | WebSocket, Zustand, enhanced IPC | PLANNED |
| **1.1-D: Research** | New speech/LLM models, benchmarking | PLANNED |
| **1.1-E: Backlog** | Mobile, browser extension, plugins | FUTURE |

---

## Phase A: Stability & Monitoring (CURRENT)

**Goal:** Ensure the dictation pipeline is rock-solid with gemma3:4b before adding anything new.

### A.1 Model Monitoring
- [x] Add model health check endpoint (is Ollama responding?)
- [x] Log model inference times to file (not just console)
- [x] Alert when processing exceeds 2s threshold
- [ ] Track consecutive failures and auto-recover

### A.2 Pipeline Observability
- [x] Persist performance metrics to JSON file
- [x] Add session-level stats (success rate, avg time, error count)
- [ ] Create simple metrics viewer in status window
- [ ] Log transcription confidence scores (if available from Whisper)
- [x] **Log audio duration** (correlate processing time with input length)
- [x] **Log audio file size** (detect recording issues)
- [x] **Log model version/name** (track exactly which model was used)
- [x] **Session summary at shutdown** (total dictations, avg times, errors)

### A.3 Error Recovery
- [ ] Verify Ollama reconnection after timeout
- [ ] Test behavior when Ollama is restarted mid-session
- [ ] Ensure graceful fallback to raw transcription works
- [ ] Add retry logic with exponential backoff

### A.4 Gemma 3 Baseline
- [ ] Run standard test (`docs/qa/MANUAL_TEST_SCRIPT.txt`)
- [ ] Use `/test-diktate` workflow to analyze results
- [ ] Establish baseline metrics (10+ samples)
- [ ] Test with various input lengths (1s, 5s, 10s, 30s utterances)
- [ ] Compare output quality: raw vs processed

### A.5 Model Selection UI (NEW)
- [ ] Add Ollama model dropdown to Settings window
- [ ] Query Ollama API for installed models (`ollama list`)
- [ ] Display model metadata (size, parameter count)
- [ ] Hot-swap model without app restart
- [ ] Persist selected model to settings

### A.6 Whisper Model Selection (NEW)
- [ ] Add Whisper model size selector (tiny/base/small/medium/large)
- [ ] Show speed vs accuracy tradeoff info
- [ ] Persist selected Whisper model to settings
- [ ] Apply on next recording (no restart needed)

### A.7 Audio Encoder/Transcriber Testing (NEW)

> **Goal:** Scientifically compare Whisper model options to validate current choice.

**Current:** Using `deepdml/faster-whisper-large-v3-turbo-ct2` (Turbo V3)

**Test Matrix:**
- [ ] Create standardized test audio files (5s, 15s, 30s utterances)
- [ ] Test each model with same audio:
  - [ ] `tiny` (39M params, ~10x faster)
  - [ ] `base` (74M params)
  - [ ] `small` (244M params)
  - [ ] `medium` (769M params)
  - [ ] `large-v3` (1.5B params)
  - [ ] `large-v3-turbo` (current - optimized large)
- [ ] Measure for each: transcription time, WER (if possible), VRAM usage
- [ ] Document results in `docs/BENCHMARKS.md`
- [ ] Validate current choice or switch to better option

**Success Criteria:** Data-backed recommendation for default model.

**Exit Criteria:** 30-minute session with 0 failures, `/test-diktate` shows < 7s latency, model selectors working, audio encoder validated.

---

## Phase B: Testing Infrastructure

**Goal:** Build test suites that we (human + AI) can run together.

### B.1 Automated Tests (Claude runs)
```
tests/
├── unit/
│   ├── test_processor.py      # Ollama wrapper tests
│   ├── test_transcriber.py    # Whisper wrapper tests
│   └── test_injector.py       # Keyboard injection tests
├── integration/
│   ├── test_pipeline.py       # Full pipeline E2E
│   └── test_ipc.py            # Electron ↔ Python communication
└── performance/
    └── test_benchmarks.py     # Timing assertions
```

**Automated test targets:**
- [ ] Unit tests for processor.py (mock Ollama responses)
- [ ] Unit tests for transcriber.py (mock Whisper)
- [ ] Integration test: IPC message roundtrip
- [ ] Integration test: Full pipeline with test audio file
- [ ] Performance test: Assert processing < 2s for gemma3:4b

### B.2 Manual Tests (Human runs, Claude monitors)

**Existing Infrastructure:**
- Test procedure: `docs/qa/TEST_PROCEDURE.md`
- Test script: `docs/qa/MANUAL_TEST_SCRIPT.txt`
- Log analysis: `.agent/workflows/test-diktate.md`

**Standard Test Flow:**
1. You run `pnpm dev` and open Notepad
2. You read the test script aloud (includes fillers, corrections, profanity)
3. You stop recording
4. I run `/test-diktate` to analyze logs and report metrics

**Pass/Fail Criteria:**
| Metric | Pass | Fail |
|--------|------|------|
| Total Latency | < 7s | > 10s |
| Fillers | Removed | Present |
| Corrections | Applied | Missing |
| Profanity | Preserved | Censored |

**Manual test targets:**
- [ ] Run standard test with gemma3:4b, document baseline
- [ ] Expand test script for additional scenarios
- [ ] Add app-specific tests (Chrome, VS Code, Slack, Word)
- [ ] Add edge case tests (short/long utterances, noise)
- [ ] Add error scenarios (Ollama offline, mic unplugged)

### B.3 Model Comparison Framework
- [ ] Create script to benchmark different models
- [ ] Test matrix: gemma3:4b, llama3:8B, mistral, phi3
- [ ] Metrics: latency, VRAM usage, output quality
- [ ] Document results for future model selection

**Exit Criteria:** `pytest tests/` passes, manual checklist complete with results.

---

## Phase C: Hardening

**Goal:** Fix known gaps and verify reliability.

### C.1 Settings Persistence
- [ ] Verify settings survive app restart
- [ ] Verify settings survive Windows restart
- [ ] Test settings migration (if schema changes)
- [ ] Add settings backup/restore

### C.2 Multi-App Injection Testing
Target applications:
- [ ] Notepad (basic)
- [ ] VS Code (editor)
- [ ] Chrome (browser input fields)
- [ ] Slack (Electron app)
- [ ] Microsoft Word (Office)
- [ ] Discord (another Electron app)
- [ ] Terminal/PowerShell

Document any app-specific issues.

### C.3 Edge Cases
- [ ] Very short utterances (< 1 second)
- [ ] Very long utterances (> 30 seconds)
- [ ] Rapid consecutive recordings
- [ ] Recording while previous is still processing
- [ ] App switch during processing

### C.4 Resource Management
- [ ] Monitor memory usage over 1-hour session
- [ ] Check for memory leaks in Python process
- [ ] Verify log rotation works (or implement it)
- [ ] Clean up temp audio files

### C.5 Automatic Fallback (NEW)
- [ ] Detect Ollama failure/timeout
- [ ] Fall back to raw transcription (skip LLM processing)
- [ ] Notify user when fallback is active
- [ ] Auto-retry Ollama on next recording
- [ ] Option to prefer raw mode when Ollama unavailable

### C.6 Retry Logic (NEW)
- [ ] Implement exponential backoff for Ollama calls
- [ ] Max 3 retries with 1s, 2s, 4s delays
- [ ] Log retry attempts for debugging
- [ ] Fail gracefully after max retries

### C.7 System Tray Quick Actions (NEW)
- [ ] Add "Show Logs" menu item (opens log folder)
- [ ] Add "Restart Python" menu item
- [ ] Add "Open Settings" menu item
- [ ] Add "Check for Updates" menu item
- [ ] Show current model in tooltip

### C.8 Recording Safety (NEW)
- [ ] Add max recording duration limit (default: 60s)
- [ ] Configurable in settings (30s, 60s, 120s, unlimited)
- [ ] Auto-stop with notification when limit reached
- [ ] Prevent runaway recordings

**Exit Criteria:** 1-hour stability session, all target apps tested, fallback working, no critical bugs.

---

## Phase D: Distribution

**Goal:** Package for clean Windows install.

### D.1 Packaging
- [ ] Configure electron-builder for Windows NSIS
- [ ] Bundle Python with PyInstaller
- [ ] Create single installer (.exe)
- [ ] Test on clean Windows VM

### D.2 First-Run Experience
- [ ] Detect if Ollama is installed
- [ ] Guide user to install Ollama if missing
- [ ] Auto-pull gemma3:4b model
- [ ] Show setup wizard on first launch

### D.3 Update Mechanism
- [ ] Plan for auto-updates (or manual download)
- [ ] Version checking
- [ ] Changelog display

### D.4 Basic History Panel (NEW)
- [ ] Store last 10 transcriptions in memory
- [ ] Add "History" tab or panel to status window
- [ ] Show timestamp, raw text, processed text
- [ ] Click to copy to clipboard
- [ ] Click to re-inject into active app
- [ ] Clear history button

### D.5 Hardware Auto-Detection (NEW)
- [ ] Detect NVIDIA GPU presence on first launch
- [ ] Query VRAM amount (nvidia-smi or CUDA API)
- [ ] Run quick benchmark with tiny model
- [ ] Recommend tier based on results:
  - CPU-only / 4GB VRAM → "Fast" (gemma3:4b + whisper-small)
  - 6-8GB VRAM → "Balanced" (gemma3:4b + whisper-medium)
  - 12GB+ VRAM → "Quality" (llama3:8b + whisper-large)
- [ ] Show expected latency range to user
- [ ] Let user override recommendation
- [ ] Auto-pull recommended models
- [ ] Save tier to settings

**Exit Criteria:** Fresh Windows install can run diktate with guided setup, hardware detected, appropriate models recommended.

---

## Phase E: Pre-Release Polish (v1.0 Final)

**Goal:** Final polish before v1.0 release.

### E.1 Re-implementation Queue
- [ ] Snippets/shortcuts (was reverted, needs re-implementation)
- [ ] Custom dictionary for domain-specific terms

### E.2 Quality of Life
- [ ] VRAM auto-detection and model recommendation
- [ ] Cost tracking for cloud providers (Gemini, OpenAI, Anthropic)
- [ ] Automatic provider fallback (cloud fails → local, local fails → raw)

### E.3 Documentation & Onboarding Materials

> **Goal:** Turn "install Ollama" friction into a VALUE-ADD. Users aren't just getting dikta.me—they're unlocking a local AI platform.

#### E.3.1 Ollama Value Proposition Docs
- [ ] "What is Ollama?" beginner guide
- [ ] "What else can you do with Ollama?" power user guide
  - Chat interfaces (Open WebUI, Chatbox)
  - Coding assistants (Continue, Aider, Cursor local)
  - Image analysis (LLaVA, Gemini Vision)
  - Document analysis
- [ ] Model recommendations by use case
- [ ] Hardware requirements guide (GPU/CPU/RAM)

#### E.3.2 Installation Guides
- [ ] dikta.me installation walkthrough (Windows)
- [ ] Ollama installation guide (Windows, with screenshots)
- [ ] Combined quick-start: "dikta.me + Ollama in 5 minutes"
- [ ] Troubleshooting FAQ
  - "Ollama not detected"
  - "Model download stuck"
  - "CUDA/GPU not recognized"
  - "App not injecting text"
  - "Audio device issues"

#### E.3.3 Video Content
- [ ] Installation walkthrough video (2-3 min)
- [ ] Quick-start demo video (30-60 sec)
- [ ] "First dictation" tutorial
- [ ] Troubleshooting common issues video
- [ ] YouTube Shorts: "Install dikta.me in 60 seconds"

#### E.3.4 Website Documentation Site
- [ ] Deploy docs site (VitePress/Docusaurus)
- [ ] Structure: Getting Started → User Guide → Troubleshooting → Developers
- [ ] Spanish translations for key pages

**Exit Criteria:** All v1.0 features complete, documentation ready, ready for public release.

---

## Phase F: Cloud Wallet Infrastructure (v1.1 Priority)

**Goal:** Backend infrastructure for wallet-based cloud credits (anti-subscription model).

> ⚠️ **Note:** v1.0 ships with BYOK (Bring Your Own Key) for Pro tier. Wallet is v1.1.

### F.1 Backend Setup
- [ ] Set up edge API project (Cloudflare Workers or Vercel Edge)
- [ ] Configure database (Supabase or PlanetScale)
- [ ] Implement Stripe webhook handlers for one-time payments
- [ ] Create license key generation/validation system
- [ ] Set up usage logging and analytics

### F.2 API Endpoints
- [ ] `/api/auth` - License key validation
- [ ] `/api/wallet` - Balance checking, top-up history
- [ ] `/api/transcribe` - Whisper proxy with credit deduction
- [ ] `/api/process` - LLM proxy with credit deduction
- [ ] `/api/usage` - Usage tracking, deduction logging

### F.3 Cloud Provider Integration
- [ ] Evaluate provider SDKs (Groq, DeepSeek, Cerebras, Gemini)
- [ ] Select primary provider (easiest integration wins)
- [ ] Implement fallback order for reliability
- [ ] Configure 25% margin pricing per provider

### F.4 Desktop App Integration
- [ ] Add license key input in Settings
- [ ] Add wallet balance display in status window
- [ ] Implement "Top Up Credits" → opens browser
- [ ] Show credit usage after each cloud transcription
- [ ] Graceful degradation when credits exhausted

**Exit Criteria:** User can purchase Pro, enter license key, top up wallet credits, use cloud transcription with balance tracking.

---

# Version 1.1 Roadmap (POST-RELEASE)

> **Status:** PLANNED - Do not start until v1.0 is shipped
> **Target:** After v1.0 stable release
> **Note:** These features are documented here to preserve knowledge. Full specs in `docs/L3_MEMORY/`.

---

## v1.1-A: Premium UI/UX

**Goal:** Elevate the visual experience beyond MVP.

### Floating Pill UI
*Spec: `docs/L3_MEMORY/FULL_VISION/DESIGN_SYSTEM_FULL.md`*
- [ ] Minimal presence (12px dot when idle)
- [ ] Expands to pill when recording (160px × 44px)
- [ ] State-based animations (breath pulse, shimmer, success burst)
- [ ] Waveform visualization (5 bars, center-weighted)
- [ ] Draggable, position persists
- [ ] Success state with text preview

### Design System Overhaul
*Spec: `docs/L3_MEMORY/FULL_VISION/DESIGN_SYSTEM_FULL.md` (1,691 lines)*
- [ ] Obsidian Minimalism aesthetic
- [ ] Custom color palette (Void, Smoke, Ash, Ember, Breath Spectrum)
- [ ] Typography system (JetBrains Mono + Plus Jakarta Sans)
- [ ] Component library (buttons, toggles, selects, radios)
- [ ] Animation library (breath pulse, shimmer, success burst)
- [ ] Micro-interactions throughout

### System Tray Enhancements
- [ ] Animated tray icons (pulse during recording, rotation during processing)
- [ ] Rich context menu with submenus
- [ ] Notification balloons with actions

### Waveform Visualization
- [ ] Real-time audio level display during recording
- [ ] 5-bar waveform with center weighting
- [ ] Animated bars (wave-bar keyframes)
- [ ] Audio level normalization

---

## v1.1-B: Power User Features

**Goal:** Features for advanced users and power workflows.

### Custom Prompts
*Spec: `docs/L3_MEMORY/FULL_VISION/STATE_MANAGEMENT_FULL.md`*
- [ ] User-defined prompts per context mode
- [ ] Prompt template editor in settings
- [ ] Prompt variables (e.g., {raw_text}, {language})
- [ ] Prompt library/sharing (import/export)
- [ ] Reset to defaults option

### Advanced Audio Settings
*Spec: `docs/L3_MEMORY/FULL_VISION/STATE_MANAGEMENT_FULL.md`*
- [ ] Sample rate configuration (16kHz, 44.1kHz, 48kHz)
- [ ] Silence threshold tuning
- [ ] Voice activity detection (VAD) for auto-stop
- [ ] Real-time audio level meter in settings
- [ ] Noise gate threshold configuration

### Extended History
- [ ] Store 50+ transcriptions (configurable)
- [ ] Search/filter history
- [ ] Export history to file (JSON, TXT, CSV)
- [ ] Pin important transcriptions
- [ ] Sync history across sessions (persist to disk)

### Keyboard Shortcuts
- [ ] Mode switching via hotkey (Ctrl+Shift+M cycles modes)
- [ ] Quick settings hotkey
- [ ] History panel hotkey
- [ ] Customizable shortcuts in settings

---

## v1.1-C: Architecture Upgrades

**Goal:** Technical improvements for scalability and real-time features.

### WebSocket Communication
*Spec: `docs/L3_MEMORY/FULL_VISION/IPC_DESIGN_FULL.md`*
- [ ] Replace stdin/stdout with WebSocket
- [ ] Real-time bidirectional communication
- [ ] Streaming transcription progress
- [ ] Connection health monitoring
- [ ] Auto-reconnect on disconnect

### State Management (Zustand)
*Spec: `docs/L3_MEMORY/FULL_VISION/STATE_MANAGEMENT_FULL.md`*
- [ ] 5 domain-driven stores (Recording, Transcription, Settings, UI, Provider)
- [ ] Middleware stack (devtools, persist, immer, subscribeWithSelector)
- [ ] Memoized selectors for performance
- [ ] State persistence across restarts
- [ ] Subscriptions for real-time UI updates

### Enhanced IPC
- [ ] Full error sanitization (user-friendly messages)
- [ ] Request/response correlation IDs
- [ ] Message queuing for reliability
- [ ] Structured logging with trace IDs

---

## v1.1-D: Research & Experimental

**Goal:** Evaluate next-generation models and technologies.

### Speech Model Candidates
| Model | Type | Potential |
|-------|------|-----------|
| NVIDIA Canary Qwen 2.5B | Speech-to-Text | Whisper replacement, faster? |
| Granite Speech 3.3 (IBM) | Speech-to-Text | Enterprise-grade, open weights |
| Whisper Large V3 Turbo | Speech-to-Text | Latest OpenAI, accuracy focus |

### LLM Candidates
| Model | Size | Potential |
|-------|------|-----------|
| gemma3:12b | 12B | Higher quality text cleanup |
| llama3.1:8b | 8B | Updated Llama with better context |
| mistral-nemo | 12B | Strong multilingual support |
| phi4 | ~4B | Microsoft's latest small model |

### Research Tasks
- [ ] Create benchmarking script (latency, VRAM, quality)
- [ ] Compare against Whisper V3 Turbo baseline
- [ ] Evaluate license compatibility for commercial use
- [ ] Test on consumer hardware (RTX 4060 Ti 8GB)
- [ ] Document findings in `docs/BENCHMARKS.md`

---

## v1.1-E: Future Consideration (Backlog)

**Goal:** Ideas captured but not yet planned.

These are not committed to v1.1 but preserved for future consideration:

| Feature | Notes |
|---------|-------|
| Multi-language UI | Localization (ES, DE, FR, etc.) |
| Cloud sync | Settings, history sync across devices |
| Team features | Shared prompts, admin dashboard |
| Mobile companion | iOS/Android app for remote control |
| Browser extension | Chrome/Firefox for web dictation |
| API/CLI | Programmatic access for automation |
| Plugins/extensions | Third-party integrations |
| Voice commands | Beyond dictation (app control) |
| Speaker diarization | Multi-speaker transcription |
| Real-time collab | Shared dictation sessions |

---

## Version Reference

| Version | Phases | Focus |
|---------|--------|-------|
| **v1.0** | A → E | Stability, Testing, Hardening, Distribution, Polish |
| **v1.1** | 1.1-A → 1.1-E | Premium UI, Power Features, Architecture, Research |
| **v2.0** | TBD | Platform expansion (macOS, Linux), major features |

**Brand:** diktate (dikta.me) - No rebrand planned.

---

## Model Testing Strategy

### Current Model: gemma3:4b
- **Why:** Best balance of speed (350-750ms) and quality for text cleanup
- **Context:** 2K tokens (sufficient for dictation)
- **VRAM:** ~3.3GB (fits alongside Whisper on 8GB GPU)

### Testing Other Models
As we develop, we can test alternatives:

| Model | Size | Use Case | Status |
|-------|------|----------|--------|
| gemma3:4b | 4B | Default, fast | **ACTIVE** |
| llama3:8B | 8B | Higher quality, slower | Benchmarked |
| mistral | 7B | Alternative | To test |
| phi3 | 3.8B | Smaller, faster | To test |

**Process for testing new models:**
1. Run `ollama pull <model>`
2. Update `processor.py` model config
3. Run benchmark script
4. Run manual test checklist
5. Document results

---

## Success Metrics

### Stability (Phase A)
- 0 failures in 30-minute session
- Processing time < 1s (p95) with gemma3:4b
- Graceful recovery from Ollama restart

### Testing (Phase B)
- 80%+ automated test coverage
- All manual test scenarios documented
- Known issues catalogued

### Hardening (Phase C)
- Works in 7+ applications
- 1-hour session with no crashes
- Settings persist correctly

### Distribution (Phase D)
- Installs on clean Windows in < 5 minutes
- First-run experience guides user through setup

---

## Quick Reference

### Daily Development Commands
```bash
# Start development
pnpm dev

# Run automated tests
pytest tests/

# Check environment
node smoke-test.cjs

# Pull a new model to test
ollama pull <model-name>
```

### Collaborative Testing (Human + AI)
```
1. You: pnpm dev → Open Notepad → Read test script → Stop recording
2. AI: /test-diktate → Analyze logs → Report metrics
```
Test script: `docs/qa/MANUAL_TEST_SCRIPT.txt`

### Key Files
- `python/core/processor.py` - Ollama integration (model config here)
- `python/core/transcriber.py` - Whisper integration
- `src/main.ts` - Electron main process
- `src/renderer.ts` - Status window UI

### Current Model Config
```python
# In processor.py
model = "gemma3:4b"
context_window = 2048
timeout = 20  # seconds
keep_alive = "10m"
```

---

## Document Hierarchy

```
DEVELOPMENT_ROADMAP.md  ← YOU ARE HERE (master plan)
    ↓ references
TASKS.md                ← Sprint-level tasks (short-term)
DEV_HANDOFF.md          ← Session notes (ephemeral)
AI_CODEX.md             ← Governance rules (stable)
```

**Rule:** When in doubt about what to work on, consult this roadmap first.

---

## Changelog

### 2026-01-17 (Update 4 - Session 2)
- ✅ Cloud/Local toggle fully implemented and tested
- ✅ API key decryption from secure storage working
- ✅ Badge updates when switching providers
- ✅ Performance comparison: Local 3x faster than Cloud (631ms vs 1800ms)
- ✅ Added D.5 Hardware Auto-Detection to Phase D
- ✅ DEVELOPMENT_ROADMAP.md is master plan (referenced everywhere)
- All changes documented in DEV_HANDOFF.md

### 2026-01-17 (Update 3)
- Added complete v1.1 roadmap with all deferred features
- Organized v1.1 into 5 phases: Premium UI, Power Features, Architecture, Research, Backlog
- Added spec file references for each major feature
- Added model candidates (speech + LLM) for future evaluation
- Added version reference table (v1.0 → v1.1 → v2.0)
- Nothing is lost - all features documented in one place

### 2026-01-17 (Update 2)
- Added to Phase A: Model Selection UI (A.5), Whisper Model Selection (A.6)
- Added to Phase C: Automatic Fallback (C.5), Retry Logic (C.6), System Tray Quick Actions (C.7), Recording Safety (C.8)
- Added to Phase D: Basic History Panel (D.4)
- Cleaned up Phase E (moved implemented items to earlier phases)
- Incorporated feasible features from DEFERRED_FEATURES.md

### 2026-01-17 (Initial)
- Created roadmap document
- Established stability-first approach
- Documented gemma3:4b as current stable model
- Defined testing infrastructure requirements
- Set clear phase progression

---

*This document is the single source of truth for development direction. Update it as phases complete.*
