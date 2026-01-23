# Development Roadmap

> **Status:** ACTIVE - Feature Locked for v1.0
> **Last Updated:** 2026-01-22
> **Current Phase:** Lubricant & Distribution (Locking)
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

### v1.0 (Feature Locked 🔒)
| Phase | Focus | Status |
|-------|-------|--------|
| **A: Stability** | Model monitoring, model selection, error recovery | ✅ |
| **B: Testing** | Automated + manual test suites | NEXT |
| **C: Hardening** | Fallback, retry logic, tray actions, safety | PENDING |
| **D: Distribution** | **Ollama Sidecar**, **Auto-Tiering**, **Web Assistant (CRM)** | PENDING |
| **E: Polish** | **Mini Mode**, snippets, final QA | PENDING |
| **F: Validation** | **Methodical UI Audit**, **YouTube Stress Loop**, **Edge Cases** | PENDING |

| **v1.1 (Premium Expansion)**
| Phase | Focus | Status |
|-------|-------|--------|
| **F: Cloud Wallet** | **The Fuel**: Stripe + 20% Margin API Proxy | **DIAMOND** |
| **1.1-A: Premium UI** | **The Pill UI (The Cherry)**, Design System, Waveform | PLANNED |
| **1.1-B: Smart Assistant** | **TTS**, Advanced Audio, Extended History | PLANNED |
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
- [x] Create simple metrics viewer in status window
- [ ] Log transcription confidence scores (if available from Whisper)
- [x] **Log audio duration** (correlate processing time with input length)
- [x] **Log audio file size** (detect recording issues)
- [x] **Log model version/name** (track exactly which model was used)
- [x] **Session summary at shutdown** (total dictations, avg times, errors)

### A.3 Error Recovery
- [x] Verify Ollama reconnection after timeout
- [x] Test behavior when Ollama is restarted mid-session
- [x] Ensure graceful fallback to raw transcription works
- [x] Add retry logic with exponential backoff

### A.4 Gemma 3 Baseline
- [ ] Run standard test (`docs/qa/MANUAL_TEST_SCRIPT.txt`)
- [ ] Use `/test-diktate` workflow to analyze results
- [ ] Establish baseline metrics (10+ samples)
- [ ] Test with various input lengths (1s, 5s, 10s, 30s utterances)
- [ ] Compare output quality: raw vs processed

### A.5 Model Selection UI
- [x] Add Ollama model dropdown to Settings window
- [x] Query Ollama API for installed models (`ollama list`)
- [x] Display model metadata (size, parameter count)
- [x] Hot-swap model without app restart
- [x] Persist selected model to settings

### A.6 Whisper Model Selection
- [x] Add Whisper model size selector (tiny/base/small/medium/large)
- [x] Show speed vs accuracy tradeoff info
- [x] Persist selected Whisper model to settings
- [x] Apply on next recording (no restart needed)

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
- [x] Detect Ollama failure/timeout
- [x] Fall back to raw transcription (skip LLM processing)
- [x] Notify user when fallback is active
- [x] Auto-retry Ollama on next recording
- [ ] Option to prefer raw mode when Ollama unavailable

### C.6 Retry Logic (NEW)
- [x] Implement exponential backoff for Ollama calls
- [x] Max 3 retries with 1s, 2s, 4s delays
- [x] Log retry attempts for debugging
- [x] Fail gracefully after max retries

### C.7 System Tray Quick Actions (NEW)
- [x] Add "Show Logs" menu item (opens log folder)
- [x] Add "Restart Python" menu item
- [x] Add "Open Settings" menu item
- [x] Add "Check for Updates" menu item
- [x] Show current model in tooltip

### C.8 Recording Safety (NEW)
- [x] Add max recording duration limit (default: 60s)
- [x] Configurable in settings (30s, 60s, 120s, unlimited)
- [x] Auto-stop with notification when limit reached
- [x] Prevent runaway recordings

**Exit Criteria:** 1-hour stability session, all target apps tested, fallback working, no critical bugs.

---

## Phase D: Distribution

**Goal:** Package for clean Windows install.

### D.1 Packaging & Portable Engine
- [ ] Configure electron-builder for Windows NSIS installer
- [ ] Bundle standalone Python engine with PyInstaller/Nuitka
- [ ] Create signed single installer (.exe)
- [ ] **Distribution Test**: Run installer on a "Virgin" machine (no previous Python/Ollama)
- [ ] **Sidecar Validation**: Verify Ollama is spawned and models pulled automatically

### D.2 App Protection & Licensing (Lemon Squeezy) ✅ UPDATED
> **Goal**: Secure the app with hardware-locked licensing and handle logic for multiple devices.

- [ ] **Lemon Squeezy Integration**:
  - [ ] **App Integration**: Implement startup license verification via LS API.
  - [ ] **Website Flow**:
    - [ ] Integrate **Lemon Squeezy Checkout** (Overlay/Link) on `dikta.me`.
    - [ ] Implement post-purchase **Redirection & Key Delivery** logic.
    - [ ] Set up **Webhooks** for license deactivation/refund handling.
  - [ ] Store encrypted activation token locally for offline grace periods.
- [ ] **Hardware Fingerprinting ("PC Image")**:
  - [ ] Use `node-machine-id` or custom HWID script (CPU + Disk + Motherboard).
  - [ ] Record device ID on first activation.
- [ ] **Multi-Device Logic**:
  - [ ] Implement **3-Device Limit** per license key.
  - [ ] Allow users to manage/deactivate devices (via LS portal or custom API).
- [ ] **Security & Trust**:
  - [ ] **Code Signing**: Azure Trusted Signing to clear SmartScreen warnings.
  - [ ] **Source Available License**: draft for transparency without unauthorized redistribution.

### D.3 First-Run Experience (Embedded Sidecar Strategy) ✅ DECIDED
- [ ] **Bundle `ollama.exe`** inside Electron app resources (~300MB)
- [ ] **Detection Logic:**
  - [ ] Check if user has Ollama running (port 11434) → Use it
  - [ ] If not, spawn bundled `ollama.exe serve` in background
- [ ] **Model Initialization:**
  - [ ] Show "Initializing AI Engine..." progress bar on first launch
  - [ ] Auto-pull `gemma3:4b` using the active Ollama instance
  - [ ] Verify model checksum matches expected

### D.4 Update Mechanism
- [ ] Plan for auto-updates (or manual download)
- [ ] Version checking
- [ ] Changelog display

### D.5 Basic History Panel (NEW)
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

### D.6 Web Infrastructure (NEW)
- [ ] **Marketing Site Split:** Extract `sitex/` into a dedicated repository (`diktate-web`)
- [ ] **Vercel Deployment:** Configure automated CI/CD for `dikta.me` via Vercel
- [ ] **Domain Setup:** Point `dikta.me` production traffic to Vercel
- [ ] **A/B Testing Strategy**: 
  - Leverage `site/` and `sitex/` directories for differential content testing.
  - Implement simple conversion tracking models to measure landing page effectiveness.
  - Use short-to-mid term data to fine-tune marketing messaging and onboarding flow.

### D.7 Simplified Web Assistant (CRM) ✅ NEW
> **Goal:** Deploy a v1.0 lead-capture and FAQ support bot on `dikta.me`.

- [ ] **Technical Implementation:**
  - [ ] Deploy Vercel Edge Function with `google-generative-ai` SDK.
  - [ ] Configure System Instructions with full product/FAQ context (~20k tokens).
  - [ ] Implement Function Calling for `log_interest` to capture lead data.
- [ ] **CRM Bridge:**
  - [ ] Set up Google Apps Script/Sheets to receive lead data via POST.
- [ ] **Frontend:**
  - [ ] Standard Tailwind floating chat bubble in `sitex/`.
  - [ ] Navigation Link handing (Direct users to `/docs.html`).

**Exit Criteria:** Fresh Windows install can run diktate with guided setup, hardware detected, appropriate models recommended, and marketing site is live/independent.

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

### E.3 Mobile Optimization (Parallel Sandbox)
**Strategy**: Developed in `mobile_site/` to verify responsive changes without breaking the main desktop site.
- [x] **Sandbox Setup**: Duplicate `site/` to `mobile_site/`.
- [ ] **Mobile Navigation**: Hamburger menu + glassmorphic overlay.
- [ ] **Responsive Spacing**: Reduce `py-32` to `py-16` on mobile.
- [ ] **Typography**: Scale down `text-5xl` headings to `text-3xl`.
- [ ] **Merge Back**: Once verified, merge `mobile_site/index.html` back to `site/`.

### E.4 Documentation & Onboarding Materials

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

## Phase F: Methodical Validation (The "Final Stretch")

**Goal:** Exhaustive manual and automated validation to ensure dIKtate is "bulletproof" for public release.

### F.1 UI/UX "Surface" Audit
- **Checklist**: See [METHODICAL_UI_CHECKLIST.md](./docs/internal/qa/METHODICAL_UI_CHECKLIST.md)
- **Focus**: Every button, every toggle, every state transition (Mini/Full).
- **Goal**: 100% functional coverage of the Electron interface.

### F.2 The "YouTube Content Creator" Stress Test
- **The Story**: We bypassed the need for expensive human testers by using automated loops of high-diversity YouTube content. 
- **Method**: Using `audio_feeder.py` to pipe 60+ minutes of varied speech (tech vlogs, fast talkers, interviews) directly into the engine.
- **Goal**: Verify endurance, ensure no memory leaks, and validate Whisper accuracy across 50+ different voices/accents.

### F.3 Human Edge-Case ("Weird Dictation")
- **Protocol**: Manual runs specifically designed to break the model:
  - Long silences (10s+) in the middle of a sentence.
  - Whispering then shouting.
  - Intentional "hallucination bait" (speaking nonsense or contradictory commands).
- **Goal**: Confirm fallback safety and internal consistency.

---

---

## Future Vision & Deferred Features

All features planned for **v1.1**, **v2.0**, and beyond are documented in [DEFERRED_FEATURES.md](./docs/internal/L3_MEMORY/DEFERRED_FEATURES.md). This includes:

- **The Floating Pill UI** (Premium Animation)
- **Cloud Wallet** (Pay-as-you-go proxy)
- **Scribe Mode** (Meeting Intelligence)
- **Visionary Module** (Multimodal Screenshot Q&A)
- **Mobile Companion** (iOS/Android Dictation)

---

## Version Reference

| Version | Focus | Status |
|---------|-------|--------|
| **v1.0** | Stability, Local-First, Hardening | **ACTIVE** |
| **v1.1+** | Premium UX, Cloud Services | Planned |

---

## Version Reference

| Version | Phases | Focus |
|---------|--------|-------|
| **v1.0** | A → E | Stability, Testing, Hardening, Distribution, Polish |
| **v1.1** | 1.1-A → 1.1-E | Premium UI, Power Features, **Docs Chatbot**, Architecture |
| **v2.0** | TBD | **Scribe (Granola)**, Mobile (Cloud), Browser Agent |

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

## 🤖 AI-Augmented Development
This project was co-authored by human and machine. It was developed using a multi-layered AI workflow including **Google AI Studio**, **Antigravity**, **Claude Code**, and **OpenCode**.

---

*This document is the single source of truth for development direction. Update it as phases complete.*
