# dIKtate

> **"Ik"** *(Mayan)*: Wind, Breath, Life.

A high-performance, local-first voice dictation tool for Windows. Speak naturally, get polished text—instantly typed into any application.

---

## 🎯 Project Status: MVP Development

**Current Phase:** Phase 4 - Validation & Verification 🧪
**Progress:** 65% complete (Core pipeline done, Ask Mode in Beta)
**Target:** Working MVP in 1-2 weeks

### What the MVP Will Do
1. Press **Ctrl+Alt+D** (default hotkey) to start recording.
2. Speak your text.
3. Press **Ctrl+Alt+D** again to stop. 100% offline, 100% private.

**Example:**
- You say: "um, so like, I think we should maybe fix the bug"
- You get: "I think we should fix the bug."

---

## Why dIKtate?

Commercial voice tools send your audio to the cloud. dIKtate runs entirely on your hardware:

- **Fast** — 15-30 seconds (CPU) or **<5 seconds** (GPU) latency from speech to text
- **Private** — Audio never leaves your machine
- **Intelligent** — Not just transcription, but transformation (grammar fixes, filler removal, cleanup)
- **Offline** — 100% local operation, no internet required

---

## MVP Features (v0.1.0) - Implementation Status

✅ **Recording:** Toggle activation (`Ctrl+Alt+D` default, configurable) - **Complete**
✅ **Transcription:** Whisper V3 Turbo (CUDA) - **Complete**
✅ **Processing:** Ollama local LLM (gemma3:4b, Strict cleanup mode) - **Complete**
✅ **Injection:** Types into any application via pynput - **Complete**
✅ **UI:** Status Window + System tray icon - **Complete**
✅ **Settings:** Full settings window with audio, models, modes, API keys - **Complete**
✅ **Error Handling:** Comprehensive logging + native notifications - **Complete**
✅ **Performance Tracking:** Full pipeline metrics tracking - **Complete**
✅ **Offline:** 100% local operation - **Complete**
🚧 **Ask Mode:** Voice Q&A with LLM (`Ctrl+Alt+A`) - **Beta (Text response only, TTS coming soon)**

**Status:** Active Development

### Hotkeys

| Key | Action |
|-----|--------|
| `Ctrl+Alt+D` | Dictate - transcribe, clean, type |
| `Ctrl+Alt+A` | Ask - transcribe, ask LLM, reply to clipboard/notification |


**See:** `docs/L3_MEMORY/DEFERRED_FEATURES.md` for complete list

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI | Electron (system tray only for MVP) |
| Backend | Python 3.11 + FastAPI |
| Speech-to-Text | faster-whisper (CUDA) |
| Text Processing | Ollama (local) |

---

## Prerequisites

### System Requirements
- **Windows 10/11**
- **Microphone**
- **Ollama** (installed automatically)

### Hardware Acceleration (CUDA)
dIKtate automatically detects and uses your NVIDIA GPU if available.
- **Requirement:** NVIDIA GPU with 4GB+ VRAM
- **Driver:** Make sure you have the latest NVIDIA drivers installed.
- **Benefit:** 3-5x faster performance compared to CPU.


---

## Installation

```bash
# Coming soon — MVP in development
# See TASKS.md for development progress
```

---

## Documentation

### For Users (Coming Soon)
- **Installation Guide** — Setup instructions
- **User Guide** — How to use dIKtate
- **Troubleshooting** — Common issues and solutions

### For Developers
- **[TASKS.md](./TASKS.md)** — MVP task checklist (47 tasks, 6 phases)
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Current technical design
- **[DEV_HANDOFF.md](./DEV_HANDOFF.md)** — Development status and next steps

### Commercial Launch (V1.0)
- **[docs/internal/COMMERCIAL_LAUNCH_STRATEGY.md](./docs/internal/COMMERCIAL_LAUNCH_STRATEGY.md)** — Full commercial strategy
- **[docs/internal/V1_LAUNCH_SPRINT.md](./docs/internal/V1_LAUNCH_SPRINT.md)** — 4-week sprint plan

### Knowledge Base (L3 Memory)
- **[docs/internal/PHASE_ROADMAP.md](./docs/internal/L3_MEMORY/PHASE_ROADMAP.md)** — MVP → v1.0 evolution
- **[docs/internal/DEFERRED_FEATURES.md](./docs/internal/L3_MEMORY/DEFERRED_FEATURES.md)** — Features not in MVP
- **[docs/internal/FULL_VISION/](./docs/internal/L3_MEMORY/FULL_VISION/)** — Detailed specs for future phases

---

## Development Plan

**Total Effort:** 80-120 hours (2-3 weeks full-time)  
**Phases:** 6 phases, 47 tasks, 6 test checkpoints

| Phase | Duration | Focus |
|-------|----------|-------|
| 1: Python Backend | 5 days | Record → Transcribe → Process → Inject |
| 2: Electron Shell | 3 days | System tray, hotkey, Python integration |
| 3: Integration | 3 days | Error handling, performance, testing |
| 4: Validation | 3 days | UAT, bug fixes, prerequisites |
| 5: Documentation | 2 days | User guide, developer docs |
| 6: Release | 2 days | Packaging, installer, final validation |

**Detailed Plan:** See artifacts (`mvp_development_plan.md`)

---

## Success Criteria (MVP)

### Functional Criteria
- [x] Push-to-talk recording with global hotkey
- [x] Transcription accuracy > 90% (English) - Whisper medium capable
- [x] Works in 5+ applications (VS Code, Notepad, Chrome, Slack, Word) - Ready for testing
- [x] Runs 100% offline (no internet required)
- [x] Filler words removed ("um", "uh", "like")
- [x] Grammar and punctuation corrected
- [x] Comprehensive error handling and logging
- [x] Performance metrics tracking

### Performance Criteria (CPU Mode)
- [x] End-to-end latency < 30 seconds for 3-5 second utterance (target)
- [ ] Zero crashes in 30-minute session (requires UAT in Phase 4)
- [ ] Baseline performance metrics established (Phase 4)

### Implementation Status
- **Core Pipeline:** ✅ Complete
- **Error Handling:** ✅ Complete
- **Testing:** ⏳ Phase 4 (UAT)
- **Documentation:** ⏳ Phase 5
- **Packaging:** ⏳ Phase 6

**Note:** GPU acceleration deferred to Phase 2+

---

## Roadmap

### MVP (v0.1.0) - Weeks 1-3
Core functionality: dictation works, 100% offline

### Phase 2 (v0.2.0) - Weeks 4-6
Enhanced UX: context modes, hotkey config, settings window

### Phase 3 (v0.3.0) - Weeks 7-10
Advanced features: Gemini fallback, IPC validation, Zustand stores

### Phase 4 (v0.4.0) - Weeks 11-14
Premium UI: floating pill, design system, animations

### Phase 5 (v1.0.0) - Weeks 15+
Power features: custom prompts, model selection, history

### Phase 6 (v2.0) - Future
**Mobile Expansion:** iOS/Android companion app (Cloud-First strategy).
**Browser Agent:** Hands-free web navigation.

**See:** `docs/L3_MEMORY/PHASE_ROADMAP.md` for details

---

## Contributing

**Current Status:** MVP development in progress  
**Contributions:** Not accepting PRs until v0.1.0 release  
**Feedback:** GitHub issues welcome

---

## License

MIT

---

## Project Philosophy

> **Ship early, iterate fast, preserve vision.**

All detailed specifications are preserved in `docs/L3_MEMORY/FULL_VISION/`. The MVP proves the core concept; future phases implement the full vision incrementally.

**Nothing is lost—everything is phased.** 🎯
