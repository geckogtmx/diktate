# Architecture

Technical design document for dIKtate (MVP Implementation).

> **Note**: This document reflects the **actual MVP implementation** (Phases 1-3 complete).

## System Overview

dIKtate uses a hybrid architecture: an Electron frontend for UI and system integration, communicating with a Python backend for audio processing and AI inference via JSON IPC.

```
┌─────────────────────────────────────────────────────────────────┐
│                         User                                     │
│                    (presses hotkey)                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Electron (Main Process)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Shortcut   │  │    Tray     │  │   Python Process        │  │
│  │  Handler    │  │    Icon     │  │   Manager               │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Logger    │  │Performance  │  │   Notification          │  │
│  │   System    │  │   Metrics   │  │   System                │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │ JSON IPC (stdin/stdout)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Python Backend (IPC Server)                   │
│  ┌──────────┐  ┌─────────────┐  ┌───────────┐  ┌──────────┐    │
│  │ Recorder │─▶│ Transcriber │─▶│ Processor │─▶│ Injector │    │
│  │ (PyAudio)│  │  (Whisper)  │  │  (Ollama) │  │ (pynput) │    │
│  └──────────┘  └─────────────┘  └───────────┘  └──────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Performance Metrics                        │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### Frontend (Electron)

| Component | Responsibility | Status |
|-----------|----------------|--------|
| **Main Process** | Global shortcut detection, tray menu, Python process lifecycle | ✅ Complete |
| **Logger System** | File-based logging with 4 levels (DEBUG, INFO, WARN, ERROR) | ✅ Complete |
| **Performance Metrics** | Tracks and averages pipeline performance (last 100 sessions) | ✅ Complete |
| **Notification System** | Native Windows notifications for errors and status | ✅ Complete |
| **Python Manager** | Spawns Python process, handles stdin/stdout JSON IPC | ✅ Complete |
| **Renderer Process** | React UI (deferred to Phase 2+) | ⏳ Future |
| **Preload Scripts** | Minimal IPC bridge | ✅ Complete |

### Backend (Python)

| Component | Responsibility | Status |
|-----------|----------------|--------|
| **Recorder** | Captures audio from microphone via PyAudio | ✅ Complete |
| **Transcriber** | Converts audio to text using faster-whisper (CPU mode) | ✅ Complete |
| **Processor** | Transforms raw text via Ollama (llama3:8b) | ✅ Complete |
| **Injector** | Simulates keyboard input to type into active application | ✅ Complete |
| **IPC Server** | Orchestrates pipeline, communicates via JSON stdin/stdout | ✅ Complete |
| **Performance Metrics** | Tracks 5 metrics (recording, transcription, processing, injection, total) | ✅ Complete |

## Data Flow (MVP Implementation)

1. **User** presses global hotkey (`Ctrl+Shift+Space`)
2. **Electron** detects keydown → updates tray icon to "recording"
3. **Electron** sends JSON command via stdin: `{"command": "start_recording"}`
4. **Python IPC Server** receives command → emits `state-change` event: `"recording"`
5. **Recorder** begins capturing audio stream from default microphone
6. **User** releases hotkey (push-to-talk)
7. **Electron** detects keyup → updates tray icon to "processing"
8. **Electron** sends JSON command: `{"command": "stop_recording"}`
9. **Backend** executes pipeline:
   - Recorder saves buffer to temporary WAV file
   - Transcriber generates raw text via faster-whisper (CPU mode)
   - Processor applies text cleanup via Ollama (llama3:8b)
   - Injector types final text into active window via pynput
   - Performance metrics tracked at each stage
10. **Python** emits events via stdout:
    - `state-change`: "processing" → "idle"
    - `performance-metrics`: timing data for all stages
11. **Electron** receives events:
    - Updates tray icon to "idle"
    - Logs performance metrics
    - Shows notification if errors occur
12. **Logger** records all events to disk:
    - Electron: `%APPDATA%/diktate/logs/electron-*.log`
    - Python: `~/.diktate/logs/diktate.log`

## Context Modes

### MVP Implementation (Phase 1-3)
| Mode | Behavior | Status |
|------|----------|--------|
| **Standard** | Fix grammar, remove filler words, proper punctuation | ✅ Complete |

### Future Phases (Deferred)
| Mode | Behavior | Status |
|------|----------|--------|
| **Developer** | Format as code comments, variable names, or documentation | ⏳ Phase 2+ |
| **Email** | Expand brief notes into professional prose | ⏳ Phase 2+ |
| **Raw** | No transformation, literal transcription only | ⏳ Phase 2+ |

## UI States

### MVP Implementation (System Tray Only)
| State | Visual | Status |
|-------|--------|--------|
| **Idle** | Gray tray icon | ✅ Complete |
| **Recording** | Red tray icon | ✅ Complete |
| **Processing** | Blue tray icon | ✅ Complete |
| **Notifications** | Native Windows toast notifications for errors/status | ✅ Complete |

### Future Phases (Floating UI)
| State | Visual | Status |
|-------|--------|--------|
| **Idle** | Hidden or minimal dot | ⏳ Phase 4+ |
| **Listening** | Expanded with pulsing indicator | ⏳ Phase 4+ |
| **Processing** | Loading spinner | ⏳ Phase 4+ |
| **Success** | Green flash with text preview, then fade | ⏳ Phase 4+ |

## Technology Rationale

| Choice | Why | MVP Status |
|--------|-----|------------|
| **Electron** | Required for global shortcuts and system tray on Windows | ✅ Implemented |
| **Python** | Best ecosystem for AI/ML (faster-whisper, torch, ollama bindings) | ✅ Implemented |
| **JSON IPC (stdin/stdout)** | Simpler than WebSocket, more reliable, no port conflicts | ✅ Implemented |
| **faster-whisper** | CTranslate2 backend, 4x faster than original Whisper, works on CPU | ✅ Implemented (CPU mode) |
| **Ollama** | Simple local LLM serving, easy model switching, no API keys needed | ✅ Implemented (llama3:8b) |
| **pynput** | Cross-platform keyboard simulation, works in all applications | ✅ Implemented |
| **PyAudio** | Mature, stable audio capture library | ✅ Implemented |

## Hardware Requirements

### MVP Implementation (CPU Mode)
**Minimum**:
- Windows 10/11
- Modern multi-core CPU (Intel i5/AMD Ryzen 5 or better)
- 8GB RAM
- Ollama installed and running locally

| Component | Resource Usage (CPU Mode) |
|-----------|---------------------------|
| faster-whisper (medium, CPU) | ~2-4 GB RAM |
| Llama 3 8B via Ollama | ~6-8 GB RAM |
| Electron + Python | ~200-500 MB RAM |
| **Total** | ~8-12 GB RAM |

### Performance Expectations
- **E2E Latency (CPU)**: 15-30 seconds for 3-5 second utterance
- **Transcription**: 2-10 seconds (CPU mode)
- **Processing**: 1-5 seconds (Ollama)

### Future GPU Support (Phase 2+)
**Minimum**: NVIDIA GPU with 6GB+ VRAM
- faster-whisper (medium, GPU): ~1.5 GB VRAM
- Ollama (GPU acceleration): ~5-6 GB VRAM
- **Expected latency improvement**: 3-5x faster

## Project Structure (MVP Implementation)

```
diktate/
├── package.json
├── tsconfig.json
├── src/
│   ├── main.ts              # Main process entry (371 lines)
│   ├── preload.ts           # Minimal IPC bridge (30 lines)
│   ├── services/
│   │   └── pythonManager.ts # Python process management (284 lines)
│   └── utils/               # New in Phase 3
│       ├── logger.ts        # File-based logging system (139 lines)
│       └── performanceMetrics.ts # Performance tracking (176 lines)
├── dist/                    # Compiled JavaScript output
├── assets/                  # Tray icons (idle, recording, processing)
├── python/
│   ├── ipc_server.py        # JSON IPC server + pipeline (331 lines)
│   ├── main.py              # Original CLI version (263 lines)
│   ├── requirements.txt
│   ├── verify_setup.py      # Setup validation script
│   ├── venv/                # Python virtual environment
│   └── core/
│       ├── recorder.py      # Audio capture (116 lines)
│       ├── transcriber.py   # Whisper wrapper (78 lines)
│       ├── processor.py     # Ollama wrapper (105 lines)
│       └── injector.py      # Keyboard simulation (61 lines)
├── tests/
│   └── test_integration_cp1.py
├── docs/
│   └── L3_MEMORY/           # Deferred features & full vision
└── Documentation (Phases 1-3):
    ├── PHASE_1_COMPLETE.md
    ├── PHASE_2_COMPLETE.md
    ├── PHASE_3_COMPLETE.md
    ├── PHASE_3_TESTING_GUIDE.md
    ├── PHASE_3_HANDOFF_SUMMARY.md
    └── PHASE_3_QA_REPORT.md
```

## Configuration

### MVP Implementation (Hardcoded)
The MVP uses **hardcoded settings** for simplicity:

| Setting | Value | Configurable |
|---------|-------|--------------|
| **Hotkey** | `Ctrl+Shift+Space` | ❌ Hardcoded |
| **Mode** | Push-to-talk | ❌ Hardcoded |
| **Context Mode** | Standard (grammar/filler removal) | ❌ Hardcoded |
| **Provider** | Ollama | ❌ Hardcoded |
| **Model** | llama3:8b | ❌ Hardcoded |
| **Audio Device** | System default microphone | ❌ Hardcoded |

### Future Configuration (Phase 2+)
```json
{
  "hotkey": "Ctrl+Shift+Space",
  "mode": "push-to-talk",
  "contextMode": "standard",
  "provider": "ollama",
  "ollamaModel": "llama3",
  "geminiApiKey": null,
  "audioDevice": null,
  "customPrompts": {}
}
```

Configuration UI and settings persistence will be added in Phase 2+.
