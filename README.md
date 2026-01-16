# dIKtate

> **"Ik"** *(Mayan)*: Wind, Breath, Life.

A high-performance, local-first voice dictation tool for Windows. Speak naturally, get polished text—instantly typed into any application.

## Why dIKtate?

Commercial voice tools send your audio to the cloud. dIKtate runs entirely on your hardware:

- **Fast** — Sub-500ms latency from speech to text
- **Private** — Audio never leaves your machine
- **Intelligent** — Not just transcription, but transformation (grammar fixes, formatting, context-aware rewrites)

## Features

- **Global hotkey activation** — Trigger from any application
- **Push-to-talk or toggle mode** — Hold to record, or tap to start/stop
- **Floating UI indicator** — Minimal visual feedback for recording/processing states
- **Context modes** — Standard cleanup, developer mode, email mode, or raw transcription
- **Smart injection** — Types directly into the active application via simulated keystrokes

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI | Electron + React + Vite |
| Backend | Python 3.11 + FastAPI |
| Speech-to-Text | faster-whisper (CUDA) |
| Text Processing | Ollama (local) or Gemini (optional cloud fallback) |

## Prerequisites

- Windows 10/11
- Python 3.11+
- Node.js 18+
- NVIDIA GPU with CUDA support
- [Ollama](https://ollama.com/) installed and running

## Installation

```bash
# Coming soon — see TASKS.md for development progress
```

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Technical design, data flow, and project structure
- **[TASKS.md](./TASKS.md)** — Development phases and implementation checklist

## License

MIT
