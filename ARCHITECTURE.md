# Architecture

Technical design document for dIKtate (V1.0 Implementation).

> **Note**: This document reflects the **actual V1.0 implementation**.

## System Overview

dIKtate uses a hybrid architecture: an Electron frontend for UI, system tray, and global shortcuts, communicating with a Python backend for audio processing, AI inference, and system-level interactions via JSON IPC.

```
┌─────────────────────────────────────────────────────────────────┐
│                         User                                     │
│     (Hotkeys: Dictate, Ask, Translate, Refine, Oops)             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Electron (Main Process)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Shortcut   │  │    Tray     │  │   Python Process        │  │
│  │  Handler    │  │    Icon     │  │   Manager               │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Settings   │  │ Control     │  │   Notification          │  │
│  │  UI         │  │ Panel       │  │   System                │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │ JSON IPC (stdin/stdout)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Python Backend (IPC Server)                   │
│  ┌──────────┐  ┌─────────────┐  ┌───────────┐  ┌──────────┐    │
│  │ Recorder │─▶│ Transcriber │─▶│ Processor │─▶│ Injector │    │
│  │ (PyAudio)│  │ (Whisper)   │  │ (LLM)     │  │ (pynput) │    │
│  └──────────┘  └─────────────┘  └───────────┘  └──────────┘    │
│  ┌──────────────┐  ┌────────────────────────────────────────┐    │
│  │ Mute Detector│  │           Performance Metrics          │    │
│  └──────────────┘  └────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### Frontend (Electron)

| Component | Responsibility | Status |
|-----------|----------------|--------|
| **Main Process** | Global shortcut detection, tray menu, Python process lifecycle | ✅ Complete |
| **Settings UI** | React-based configuration window for models, hotkeys, and behavior | ✅ Complete |
| **Control Panel** | Debug dashboard showing real-time status and logs | ✅ Complete |
| **Python Manager** | Spawns Python process, handles stdin/stdout JSON IPC, config sync | ✅ Complete |
| **Notification System** | Native Windows notifications for status and errors | ✅ Complete |
| **Performance Metrics** | Tracks and averages pipeline performance | ✅ Complete |

### Backend (Python)

| Component | Responsibility | Status |
|-----------|----------------|--------|
| **Recorder** | Captures audio via PyAudio; handles auto-stop and temp files | ✅ Complete |
| **Transcriber** | Converts audio to text using `faster-whisper` (Turbo V3 model) | ✅ Complete |
| **Processor** | text cleanup/generation via multiple providers (Ollama, Gemini, Anthropic, OpenAI) | ✅ Complete |
| **Injector** | Simulates keyboard input/output and clipboard operations (pynput) | ✅ Complete |
| **Mute Detector** | Background thread monitoring system hardware mute state | ✅ Complete |
| **IPC Server** | Orchestrates pipeline, handles JSON commands, emits events | ✅ Complete |

## Data Flows

### 1. Dictation Flow (Standard)
1.  **User** presses Dictate hotkey (`Ctrl+Alt+D`).
2.  **Electron** signals Python to start recording.
3.  **Python** records audio until hotkey release or max duration.
4.  **Python** pipeline executes:
    *   **Transcriber**: Audio → Raw Text.
    *   **Processor**: Raw Text → Cleaned Text (using selected LLM and Prompt).
    *   **Injector**: Cleaned Text → Active Window (simulated typing).
5.  **Electron** receives status updates and performance metrics.

### 2. Refine Mode Flow
1.  **User** selects text in any application.
2.  **User** presses Refine hotkey (`Ctrl+Alt+R`).
3.  **Electron** signals Python to execute `refine_selection`.
4.  **Python** pipeline executes:
    *   **Injector**: Sends `Ctrl+C` to capture selection to clipboard.
    *   **Processor**: Process clipboard text with "Refine" system prompt.
    *   **Injector**: Pastes refined text back (`Ctrl+V`) replacing selection.

### 3. Ask Mode Flow
1.  **User** presses Ask hotkey (`Ctrl+Alt+A`).
2.  **Python** records audio (question).
3.  **Processor**: Transcribes question, then asks LLM (System Prompt: "You are a helpful assistant...").
4.  **Electron**: Receives answer and outputs via Clipboard, Typing, or Notification (configurable).

## Configuration

Configuration is dynamic and persisted via `electron-store`. Changes in the Electron Settings UI are immediately synced to the Python backend via the `configure` IPC command.

| Setting | Description |
|---------|-------------|
| **Processing Mode** | Local (Ollama), Cloud (Gemini), Anthropic, OpenAI |
| **Context Modes** | Standard, Professional, Prompt, Raw (Bypass LLM) |
| **Custom Prompts** | User-defined system prompts for each mode |
| **Model Selection** | Hot-swappable models for all providers |
| **Hotkeys** | Fully configurable global shortcuts |

## Project Structure

```
diktate/
├── src/
│   ├── main.ts              # Electron Main Process (Tray, Shortcuts, IPC)
│   ├── settings.ts          # Settings Window Logic
│   ├── services/
│   │   └── pythonManager.ts # Python Lifecycle & IPC Bridge
│   └── utils/               # Logging, Metrics, Schemas
├── python/
│   ├── ipc_server.py        # Main Python Entrypoint (IPC Server)
│   ├── core/
│   │   ├── recorder.py      # Audio Capture
│   │   ├── transcriber.py   # faster-whisper wrapper
│   │   ├── processor.py     # Multi-provider LLM wrapper (Ollama/Cloud)
│   │   ├── injector.py      # Keyboard/Clipboard automation
│   │   └── mute_detector.py # Hardware mute monitoring
│   └── config/
│       └── prompts.py       # System prompts repository
└── docs/                    # Documentation
```

## Technology Stack

*   **Frontend**: Electron, TypeScript, HTML/CSS (No framework for minimal footprint).
*   **Backend**: Python 3.10+.
*   **AI (Local)**: Ollama (Llama 3, Gemma 2), faster-whisper (Turbo).
*   **AI (Cloud)**: Google Gemini 1.5 Flash, Anthropic Claude 3.5 Haiku, OpenAI GPT-4o-mini.
*   **Audio**: PyAudio (PortAudio).
*   **Input**: pynput (Keyboard control).
