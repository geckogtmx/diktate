# Development Tasks

Implementation checklist for dIKtate, organized by phase.

## Phase 1: Core Engine (Python)

Build a headless pipeline: record → transcribe → process → type.

- [ ] **Environment setup** — Python venv, install dependencies (faster-whisper, pyaudio, fastapi, uvicorn, pynput, requests)
- [ ] **Recorder module** — Audio capture from microphone with start/stop control
- [ ] **Transcriber module** — Whisper model loading on GPU, audio-to-text inference
- [ ] **Processor module** — Ollama API client with prompt templates for each context mode
- [ ] **Injector module** — Keyboard simulation via pynput, clipboard fallback
- [ ] **FastAPI server** — WebSocket endpoint for start/stop commands, orchestrate pipeline
- [ ] **Headless test** — Verify full pipeline works from command line trigger

## Phase 2: Electron UI

Visual feedback and system integration.

- [ ] **Project setup** — Initialize Electron + React + Vite (electron-vite recommended)
- [ ] **Build configuration** — Configure electron-builder for Windows packaging
- [ ] **Floating window** — Transparent, frameless, always-on-top, draggable pill
- [ ] **UI states** — React components for idle/listening/processing/success
- [ ] **Global shortcut** — Register configurable hotkey in main process
- [ ] **Backend integration** — Spawn Python process, WebSocket communication

## Phase 3: Configuration

User settings and customization.

- [ ] **Tray menu** — System tray icon with quick actions
- [ ] **Settings window** — UI for all configuration options
- [ ] **Config persistence** — Read/write settings.json
- [ ] **Provider switching** — Toggle between Ollama and Gemini at runtime
- [ ] **Custom prompts** — Editor for user-defined context mode prompts

## Phase 4: Polish

Performance optimization and distribution.

- [ ] **Model preloading** — Keep Whisper and LLM warm in VRAM to reduce first-request latency
- [ ] **Voice activity detection** — Auto-stop recording on silence (optional enhancement)
- [ ] **Installer** — Package as .exe installer with electron-builder
