# DEV_HANDOFF.md

> **Last Updated:** 2026-01-15
> **Last Model:** Claude Opus 4.5
> **Session Focus:** Initial project documentation and handoff setup

---

## Project Status

**Phase:** Planning - No code has been written yet.

This is a greenfield project. All architecture decisions are documented, but implementation has not started. The project structure exists only in documentation.

---

## Completed This Session

- Created initial DEV_HANDOFF.md (this file)
- Created docs/BUSINESS_CONTEXT.md with market analysis and positioning
- Reviewed and understood project architecture and task breakdown

## Known Issues / Broken

None - project has no code yet.

## In Progress / Pending

- [ ] Phase 1: Core Engine (Python) - Not started
- [ ] Phase 2: Electron UI - Not started
- [ ] Phase 3: Configuration - Not started
- [ ] Phase 4: Polish - Not started

---

## Instructions for Next Model

You are starting a greenfield project. There is no existing code to fix or continue. Your job is to **build the foundation**.

### Priority Order (Phase 1 Tasks)

Execute these in exact order. Each depends on the previous:

1. **Environment setup** (30 min)
   - Create `python/` directory structure as specified in ARCHITECTURE.md
   - Create Python virtual environment
   - Create `requirements.txt` with: `faster-whisper`, `pyaudio`, `fastapi`, `uvicorn`, `pynput`, `requests`, `websockets`
   - Verify CUDA availability for faster-whisper

2. **Recorder module** (1-2 hours)
   - File: `python/core/recorder.py`
   - Implement audio capture from microphone using PyAudio
   - Must support start/stop control (not continuous)
   - Save to temporary WAV file
   - Handle device selection

3. **Transcriber module** (1-2 hours)
   - File: `python/core/transcriber.py`
   - Load faster-whisper model (start with "base" for testing, "medium" for production)
   - GPU inference via CUDA
   - Accept WAV file path, return transcribed text

4. **Processor module** (1-2 hours)
   - File: `python/core/processor.py`
   - Ollama API client (HTTP to localhost:11434)
   - Implement prompt templates for context modes:
     - Standard: grammar/punctuation cleanup
     - Developer: code comments/docs format
     - Email: professional expansion
     - Raw: passthrough (no LLM call)

5. **Injector module** (1 hour)
   - File: `python/core/injector.py`
   - Use pynput to simulate keyboard input
   - Implement clipboard fallback for special characters
   - Handle typing speed (not too fast for target apps)

6. **FastAPI server** (2-3 hours)
   - File: `python/main.py`
   - WebSocket endpoint at `/ws`
   - Commands: `START_RECORDING`, `STOP_RECORDING`
   - Events: `RECORDING`, `PROCESSING`, `COMPLETED`, `ERROR`
   - Orchestrate the full pipeline

7. **Headless test** (30 min)
   - Verify full pipeline works from command line
   - Test: start recording -> speak -> stop -> see text typed

### Context Needed

Read these files before starting:

1. `ARCHITECTURE.md` - Full technical design, data flow, project structure
2. `TASKS.md` - Complete task checklist for all phases
3. `README.md` - Project overview and tech stack

### Do NOT

- **Do NOT start with Electron/UI** - The Python backend must work first
- **Do NOT use cloud APIs initially** - Build for Ollama first, Gemini is fallback
- **Do NOT optimize prematurely** - Get it working, then make it fast
- **Do NOT change the architecture** - The design is intentional; follow it
- **Do NOT create additional documentation files** - Focus on code
- **Do NOT skip the headless test** - The backend must work standalone before UI integration

### Technical Notes

- **Ollama must be running** - The processor depends on it (default: http://localhost:11434)
- **CUDA is required** - faster-whisper needs GPU; verify with `torch.cuda.is_available()`
- **Windows-specific** - pynput keyboard simulation is OS-dependent; test on Windows
- **WebSocket, not HTTP** - Real-time state updates require WebSocket, not polling

### Success Criteria for Phase 1

You can consider Phase 1 complete when:

1. Running `python main.py` starts the FastAPI server
2. Connecting to WebSocket at `ws://localhost:8000/ws` works
3. Sending `START_RECORDING` begins audio capture
4. Sending `STOP_RECORDING` triggers the full pipeline
5. Text appears (typed) in the active application
6. The pipeline completes in under 5 seconds for short utterances

---

## Session Log (Last 3 Sessions)

### 2026-01-15 - Claude Opus 4.5
- Initial project setup
- Created DEV_HANDOFF.md with Phase 1 implementation guide
- Created docs/BUSINESS_CONTEXT.md with market positioning
- No code written - project is in planning phase
