# Architecture

Technical design document for dIKtate.

## System Overview

dIKtate uses a hybrid architecture: an Electron frontend for UI and system integration, communicating with a Python backend for audio processing and AI inference.

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
│  │  Handler    │  │    Menu     │  │   Manager               │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │ WebSocket
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Python Backend (FastAPI)                      │
│  ┌──────────┐  ┌─────────────┐  ┌───────────┐  ┌──────────┐    │
│  │ Recorder │─▶│ Transcriber │─▶│ Processor │─▶│ Injector │    │
│  │ (PyAudio)│  │  (Whisper)  │  │  (Ollama) │  │ (pynput) │    │
│  └──────────┘  └─────────────┘  └───────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### Frontend (Electron)

| Component | Responsibility |
|-----------|----------------|
| **Main Process** | Global shortcut detection, tray menu, Python process lifecycle |
| **Renderer Process** | React UI for floating indicator and settings window |
| **Preload Scripts** | Secure IPC bridge between main and renderer |

### Backend (Python)

| Component | Responsibility |
|-----------|----------------|
| **Recorder** | Captures audio from microphone via PyAudio |
| **Transcriber** | Converts audio to text using faster-whisper on GPU |
| **Processor** | Transforms raw text via Ollama or Gemini API |
| **Injector** | Simulates keyboard input to type into active application |
| **FastAPI Server** | Orchestrates pipeline, exposes WebSocket for UI communication |

## Data Flow

1. **User** presses configured hotkey
2. **Electron** detects keydown → sends `START_RECORDING` via WebSocket
3. **Recorder** begins capturing audio stream
4. **User** releases hotkey (push-to-talk) or presses again (toggle)
5. **Electron** sends `STOP_RECORDING` → UI shows processing state
6. **Backend** executes pipeline:
   - Recorder saves buffer to temporary WAV
   - Transcriber generates raw text via faster-whisper
   - Processor applies context mode transformation via LLM
   - Injector types final text into active window
   - Server sends `COMPLETED` with text preview
7. **Electron** shows success state, returns to idle

## Context Modes

| Mode | Behavior |
|------|----------|
| **Standard** | Fix grammar, remove filler words, proper punctuation |
| **Developer** | Format as code comments, variable names, or documentation |
| **Email** | Expand brief notes into professional prose |
| **Raw** | No transformation, literal transcription only |

## UI States

| State | Visual |
|-------|--------|
| **Idle** | Hidden or minimal dot |
| **Listening** | Expanded with pulsing indicator |
| **Processing** | Loading spinner |
| **Success** | Green flash with text preview, then fade |

## Technology Rationale

| Choice | Why |
|--------|-----|
| **Electron** | Required for frameless transparent windows and global shortcuts on Windows |
| **Python** | Best ecosystem for AI/ML (faster-whisper, torch, ollama bindings) |
| **FastAPI + WebSocket** | HTTP for config, WebSocket for real-time state updates |
| **faster-whisper** | CTranslate2 backend, 4x faster than original Whisper, lower VRAM |
| **Ollama** | Simple local LLM serving, easy model switching, no API keys needed |

## Hardware Requirements

**Minimum**: NVIDIA GPU with 8GB VRAM

| Component | VRAM |
|-----------|------|
| faster-whisper (medium) | ~1.5 GB |
| Llama 3 8B (Q4_K_M) | ~5.7 GB |
| **Total** | ~7.2 GB |

**Reduced VRAM Options**:
- Use Gemini API instead of local LLM (0 GB)
- Use Phi-3 Mini (~2 GB) or smaller quantization
- Use whisper-small instead of medium (~0.5 GB)

## Project Structure

```
diktate/
├── package.json
├── electron/
│   ├── main.ts              # Main process entry
│   └── preload.ts           # IPC bridge
├── src/
│   ├── App.tsx              # React root
│   └── components/
│       ├── FloatingPill.tsx # Recording indicator
│       └── Settings.tsx     # Configuration UI
├── python/
│   ├── main.py              # FastAPI server
│   ├── requirements.txt
│   └── core/
│       ├── recorder.py      # Audio capture
│       ├── transcriber.py   # Whisper wrapper
│       ├── processor.py     # LLM wrapper
│       └── injector.py      # Keyboard simulation
└── settings.json            # User configuration
```

## Configuration Schema

```json
{
  "hotkey": null,
  "mode": "push-to-talk",
  "contextMode": "standard",
  "provider": "ollama",
  "ollamaModel": "llama3",
  "geminiApiKey": null,
  "audioDevice": null,
  "customPrompts": {}
}
```

The hotkey must be configured by the user on first run.
