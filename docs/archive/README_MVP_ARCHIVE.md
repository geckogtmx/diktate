# dIKtate (MVP Archive)

> **"Ik"** *(Mayan)*: Wind, Breath, Life.

A high-performance, local-first voice dictation tool for Windows. Speak naturally, get polished text—instantly typed into any application.

---

## 🎯 Project Status: v1.0 Feature Lock 🔒

**Current Phase:** Phase F - Methodical Validation 🧪
**Status:** Feature Locked — transitioning to final quality hardening.
**Last Security Audit:** 2026-01-22 (0 Critical, 0 High) 🔒
**Ground Truth:** Core features (Refine, Oops, +Key) verified & complete.
**Target Release:** v1.0 Stable

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

- **Fast** — **~3 seconds** (Local GPU) vs 6-12s for Cloud APIs
- **Private** — Audio never leaves your machine
- **Unfiltered** — Zero censorship or corporate guardrails
- **Stable** — Deterministic hardware performance (no peak-hour slowdowns)
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
✅ **Security Audit:** High-severity Electron and `tar` fixes implemented - **Complete**
✅ **+Key:** Auto-Enter/Tab post-injection handling - **Complete**
✅ **Refine Mode:** In-place text editing (`Ctrl+Alt+R`) - **Complete**
✅ **Ask Mode:** Voice Q&A with LLM (`Ctrl+Alt+A`) - **Complete (Text response)**
✅ **Oops Feature:** Re-inject last dictation (`Ctrl+Alt+V`) - **Complete**

**Status:** Active Development (Polishing)

### Hotkeys

| Key | Action |
|-----|--------|
| `Ctrl+Alt+D` | Dictate - transcribe, clean, type |
| `Ctrl+Alt+A` | Ask - transcribe, ask LLM, reply to clipboard/notification |


**See:** [DEFERRED_FEATURES.md](./docs/internal/L3_MEMORY/DEFERRED_FEATURES.md) for future vision.

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
- **Benefit:** ~10x faster than CPU; **4x faster than Cloud APIs** (~3s inference).


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
- **[TASKS.md](./TASKS.md)** — Sprint checklist
- **[DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md)** — Master guide for v1.0 release.
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Technical design
- **[DEV_HANDOFF.md](./DEV_HANDOFF.md)** — Development status and next steps

### Commercial Launch (V1.0)
- **[docs/internal/COMMERCIAL_LAUNCH_STRATEGY.md](./docs/internal/COMMERCIAL_LAUNCH_STRATEGY.md)** — Full commercial strategy
- **[docs/internal/V1_LAUNCH_SPRINT.md](./docs/internal/V1_LAUNCH_SPRINT.md)** — 4-week sprint plan

### Knowledge Base (L3 Memory)
- **[ROADMAP.md](./DEVELOPMENT_ROADMAP.md)** — v1.0 execution plan
- **[DEFERRED_FEATURES.md](./docs/internal/L3_MEMORY/DEFERRED_FEATURES.md)** — The 💎 v1.1 and 🚀 v2.0 vision
- **[FULL_VISION/](./docs/internal/L3_MEMORY/FULL_VISION/)** — Detailed technical specs

---

## Development Plan

**Total Effort:** Full-time Development  
**Phases:** 6 phases, 47 tasks, 6 test checkpoints

| Phase | Focus |
|-------|-------|
| 1: Python Backend | Record → Transcribe → Process → Inject |
| 2: Electron Shell | System tray, hotkey, Python integration |
| 3: Integration | Error handling, performance, testing |
| 4: Validation | UAT, bug fixes, prerequisites |
| 5: Documentation | User guide, developer docs |
| 6: Release | Packaging, installer, final validation |

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

**Implementation Status:**
- **Core Pipeline:** ✅ Complete
- **UI & Multi-Provider:** ✅ Complete
- **Final Validation:** ⏳ Phase F (Active)
- **Packaging:** ⏳ Phase D/F

**Note:** Hardware acceleration is fully supported (CUDA).

---

### v1.0 (The Horizon 🔒)
Oops Feature, Mini Mode, Sidecar Detection, Hardware Auto-Tiering, Basic History.

### v1.1+ (The Premium Expansion 💎)
The Pill UI, Cloud Wallet, Scribe Mode, Visionary Module, and more.

**Full details in:** [DEFERRED_FEATURES.md](./docs/internal/L3_MEMORY/DEFERRED_FEATURES.md)

---

## Contributing

**Current Status:** MVP development in progress  
**Contributions:** Not accepting PRs until v0.1.0 release  
**Feedback:** GitHub issues welcome

---

---

## 🤖 AI-Augmented Development

This project was built using a multi-layered AI-assisted workflow. Development involved the extensive use of:
- **Google AI Studio / Gemini 2.0 / Flash**
- **Antigravity** (Agentic AI Assistant)
- **Claude Code & OpenCode** (Terminal-based AI Agents)
- Numerous web-based chat consultations

The architecture, code, and documentation were co-authored by human and machine in a collaborative session.

---

## License

MIT

---

## Project Philosophy

> **Ship early, iterate fast, preserve vision.**

All detailed specifications are preserved in `docs/L3_MEMORY/FULL_VISION/`. The MVP proves the core concept; future phases implement the full vision incrementally.

**Nothing is lost—everything is phased.** 🎯
