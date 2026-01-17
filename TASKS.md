# MVP Task List

**Quick Reference:** Actionable checklist for MVP development. See `mvp_development_plan.md` (in artifacts) for full details.

---

## Phase 1: Python Backend Core (Days 1-5)

### ✅ Task 1.1: Environment Setup (2h)
- [ ] Create project structure (`python/`, `tests/`)
- [ ] Create Python venv
- [ ] Install dependencies (faster-whisper, pyaudio, requests, pynput)
- [ ] Verify CUDA availability
- [ ] Create `.gitignore`

### ✅ Task 1.2: Recorder Module (4h)
- [ ] Implement `Recorder` class (start/stop)
- [ ] Audio capture from default mic (16kHz mono)
- [ ] Save to temporary WAV file
- [ ] Add error handling

### ✅ Task 1.3: Transcriber Module (4h)
- [ ] Implement `Transcriber` class
- [ ] Load Whisper medium model on GPU
- [ ] Transcribe WAV → text
- [ ] Add model download on first run

### 🧪 TEST CHECKPOINT 1
- [ ] Integration test: Record 3 seconds → Transcribe → Verify output

### ✅ Task 1.4: Processor Module (4h)
- [ ] Implement `Processor` class (Ollama client)
- [ ] Create default cleanup prompt
- [ ] Handle API errors and timeouts
- [ ] Add retry logic

### ✅ Task 1.5: Injector Module (3h)
- [ ] Implement `Injector` class (pynput)
- [ ] Type text character by character
- [ ] Handle special characters
- [ ] Test in Notepad, VS Code, Chrome

### ✅ Task 1.6: Main Pipeline (4h)
- [ ] Create `main.py` with state machine
- [ ] Implement hotkey listener (Ctrl+Shift+Space)
- [ ] Orchestrate full pipeline
- [ ] Add error handling and logging

### 🧪 TEST CHECKPOINT 2
- [ ] E2E test: Hotkey → Speak → Text appears in Notepad

---

## Phase 2: Electron Shell (Days 6-8)

### ✅ Task 2.1: Electron Setup (3h)
- [ ] Initialize Node.js project
- [ ] Install Electron and dependencies
- [ ] Create basic project structure
- [ ] Configure `package.json` scripts

### ✅ Task 2.2: System Tray (4h)
- [ ] Create tray icon assets (idle/recording/processing)
- [ ] Implement tray icon creation
- [ ] Add tray menu (Quit)
- [ ] Hide main window, show only tray

### ✅ Task 2.3: Python Process Management (5h)
- [ ] Spawn Python subprocess
- [ ] Implement stdin/stdout communication (JSON)
- [ ] Add process lifecycle management
- [ ] Add error handling (crash, restart)

### ✅ Task 2.4: Global Hotkey (3h)
- [ ] Register Ctrl+Shift+Space
- [ ] Send start/stop commands to Python
- [ ] Update tray icon state
- [ ] Handle hotkey conflicts

### 🧪 TEST CHECKPOINT 3
- [ ] Integration test: Electron → Python → Text injection works

---

## Phase 3: Integration & Testing (Days 9-11)

### ✅ Task 3.1: Error Handling (4h)
- [ ] Add Python logging (file + console)
- [ ] Add Electron logging
- [ ] Implement error notifications (tray balloon)
- [ ] Add error recovery (retry logic)

### ✅ Task 3.2: Performance Optimization (6h)
- [ ] Profile pipeline latency
- [ ] Optimize Whisper model loading
- [ ] Optimize Ollama prompt
- [ ] Add performance metrics logging

### ✅ Task 3.3: Multi-App Testing (4h)
- [ ] Test in VS Code, Notepad, Chrome, Slack, Word
- [ ] Document any application-specific issues
- [ ] Verify no character loss

### 🧪 TEST CHECKPOINT 4
- [ ] Comprehensive test suite (functional, performance, reliability)

---

## Phase 4: Validation & Polish (Days 12-14)

### ✅ Task 4.1: User Acceptance Testing (6h)
- [x] Create user test script
- [x] Recruit 3-5 beta testers (Department of One - This is you!)
- [x] Conduct supervised testing
- [x] Collect feedback

### ✅ Task 4.2: Bug Fixes (8h)
- [x] Fix critical bugs from UAT
- [ ] Improve error messages
- [x] Add tooltips to tray menu
- [ ] Improve transcription accuracy

### ✅ Task 4.3: Prerequisites Validation (4h)
- [ ] Create startup validation script
- [ ] Add friendly error messages
- [ ] Create setup guide (README)

---

## Phase 5: Documentation (Days 15-16)

### ✅ Task 5.1: User Documentation (6h)
- [ ] Create `README.md` (installation, usage)
- [ ] Create `INSTALLATION.md`
- [ ] Create `TROUBLESHOOTING.md`
- [ ] Add screenshots/GIFs

### ✅ Task 5.2: Developer Documentation (4h)
- [ ] Update `ARCHITECTURE.md` (MVP version)
- [ ] Create `CONTRIBUTING.md`
- [ ] Document code structure
### ✅ Task 4.2: Bug Fixes (8h)
- [x] Fix critical bugs from UAT
- [x] Improve error messages
- [x] Add tooltips to tray menu
- [x] Improve transcription accuracy (Tuned prompt, side-by-side logging)

### ✅ Task 4.3: Prerequisites Validation (4h)
- [ ] Create startup validation script
- [ ] Add friendly error messages
- [ ] Create setup guide (README)

---

## Phase 5: Documentation (Days 15-16)

### ✅ Task 5.1: User Documentation (6h)
- [ ] Create `README.md` (installation, usage)
- [ ] Create `INSTALLATION.md`
- [ ] Create `TROUBLESHOOTING.md`
- [ ] Add screenshots/GIFs

### ✅ Task 5.2: Developer Documentation (4h)
- [ ] Update `ARCHITECTURE.md` (MVP version)
- [ ] Create `CONTRIBUTING.md`
- [ ] Document code structure
- [/] Create `DEV_HANDOFF.md` for Phase 2

---

## Phase 6: Release Preparation (Days 17-18)

### ✅ Task 6.1: Packaging (6h)
- [x] Configure electron-builder
- [x] Create Windows installer (.exe)
- [x] Bundle Python environment (PyInstaller + extraResources)
- [/] Test installer on clean machine

### ✅ Task 6.2: Final Validation (4h)
- [ ] Test installer on 3 different machines
- [ ] Verify all success criteria met
- [ ] Run full test suite
- [ ] Create release notes
- [ ] Tag release (v0.1.0-mvp)

### 🧪 TEST CHECKPOINT 6 (Final)
- [ ] All MVP features working
- [ ] No critical bugs
- [ ] Documentation complete
- [ ] Installer tested
- [ ] Performance targets met

---

## MVP Success Criteria

- [ ] End-to-end latency < 15 seconds for 5-second utterance
- [ ] Transcription accuracy > 90% (English)
- [ ] Works in 5+ applications
- [ ] Runs 100% offline
- [ ] Zero crashes in 30-minute session
- [ ] Filler words removed
- [ ] Grammar and punctuation corrected
- [ ] End-to-end latency < 15 seconds for 5-second utterance
- [ ] Transcription accuracy > 90% (English)
- [ ] Works in 5+ applications
- [x] Runs 100% offline
- [ ] Zero crashes in 30-minute session
- [x] Filler words removed
- [x] Grammar and punctuation corrected
- [x] CUDA/GPU acceleration working (or quantized CPU)

---

## Quick Start Commands

```bash
# Setup
cd python
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Test Python backend
python main.py

# Setup Electron
npm install

# Run Electron
npm start

# Build installer
npm run build
```

---

**Total:** 47 tasks, 6 test checkpoints, 18 days  
**Detailed Plan:** See `mvp_development_plan.md` in artifacts  
**Deferred Features:** See `docs/L3_MEMORY/DEFERRED_FEATURES.md`  
**Phase Roadmap:** See `docs/L3_MEMORY/PHASE_ROADMAP.md`
