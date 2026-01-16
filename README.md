# dIKtate

> **"Ik"** *(Mayan)*: Wind, Breath, Life.

A high-performance, local-first voice dictation tool for Windows. Speak naturally, get polished text—instantly typed into any application.

---

## 🎯 Project Status: MVP Development

**Current Phase:** Planning Complete  
**Next Step:** Begin Phase 1 (Python Backend Core)  
**Target:** Working MVP in 2-3 weeks

### What the MVP Will Do

Press `Ctrl+Shift+Space`, speak naturally, release—clean text appears in any application. 100% offline, 100% private.

**Example:**
- You say: "um, so like, I think we should maybe fix the bug"
- You get: "I think we should fix the bug."

---

## Why dIKtate?

Commercial voice tools send your audio to the cloud. dIKtate runs entirely on your hardware:

- **Fast** — Sub-15 second latency from speech to text (MVP target)
- **Private** — Audio never leaves your machine
- **Intelligent** — Not just transcription, but transformation (grammar fixes, formatting, cleanup)

---

## MVP Features (v0.1.0)

✅ **Recording:** Push-to-talk activation (hardcoded `Ctrl+Shift+Space`)  
✅ **Transcription:** Whisper medium model (GPU-accelerated)  
✅ **Processing:** Ollama local LLM (Standard cleanup mode)  
✅ **Injection:** Types into any application  
✅ **UI:** System tray icon with basic states  
✅ **Offline:** 100% local operation

### Deferred to Future Phases

❌ Context modes (Developer, Email, Raw) → Phase 2  
❌ Hotkey configuration → Phase 2  
❌ Settings window → Phase 2  
❌ Gemini cloud fallback → Phase 3  
❌ Floating pill UI → Phase 4  
❌ Design system → Phase 4  

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

- Windows 10/11
- Python 3.11+
- Node.js 18+
- NVIDIA GPU with CUDA support
- [Ollama](https://ollama.com/) installed and running

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

### Knowledge Base (L3 Memory)
- **[docs/L3_MEMORY/PHASE_ROADMAP.md](./docs/L3_MEMORY/PHASE_ROADMAP.md)** — MVP → v1.0 evolution
- **[docs/L3_MEMORY/DEFERRED_FEATURES.md](./docs/L3_MEMORY/DEFERRED_FEATURES.md)** — Features not in MVP
- **[docs/L3_MEMORY/FULL_VISION/](./docs/L3_MEMORY/FULL_VISION/)** — Detailed specs for future phases

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

- [ ] End-to-end latency < 15 seconds for 5-second utterance
- [ ] Transcription accuracy > 90% (English)
- [ ] Works in 5+ applications (VS Code, Notepad, Chrome, Slack, Word)
- [ ] Runs 100% offline (no internet required)
- [ ] Zero crashes in 30-minute session
- [ ] Filler words removed ("um", "uh", "like")
- [ ] Grammar and punctuation corrected
- [ ] CUDA/GPU acceleration working

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
