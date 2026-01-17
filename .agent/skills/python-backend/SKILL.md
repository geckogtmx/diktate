---
name: python-backend
description: Core guidelines for the dIKtate (Waal) Python engine. Use this skill when working on audio recording (PyAudio), transcription (Faster-Whisper), text processing (Ollama/LLM), or the IPC bridge.
---

# Python Backend Specialist

This skill defines the standards for the local Python engine capability.

## 🐍 Architecture

The backend consists of 4 isolated modules in `python/core/`:
1.  **Recorder**: Handles raw audio capture via PyAudio.
2.  **Transcriber**: Faster-Whisper (CPU-optimized int8).
3.  **Processor**: text cleanup via Ollama (llama3:8b).
4.  **Injector**: `pynput` keyboard simulation.

## ⚡ IPC Protocol (JSON-over-Stdio)

Communication with Electron happens via standard input/output.

**Format:**
```json
// Input (Electron -> Python)
{"id": "uuid", "command": "start_recording", "payload": {}}

// Output (Python -> Electron)
{"id": "uuid", "success": true, "state": "recording"}
```
**Mandates:**
- Never `print()` debug info to stdout. Use `sys.stderr` or the file logger.
- `stdout` is RESERVED for JSON IPC messages.
- Handlers must be non-blocking where possible.

## 🎙️ Audio Standards

- **Sample Rate**: 16,000 Hz (Whisper Native)
- **Channels**: 1 (Mono)
- **Format**: Int16
- **Chunk Size**: 1024 frames

## 🧪 Testing Guidelines (pytest)

- **Framework**: `pytest`
- **Location**: `tests/` directory (not adjacent to code)
- **Coverage**: Core logic must have integration tests.
- **Mocks**: Mock `pyaudio` and `keyboard` for CI environments.

**Example Test:**
```python
def test_recorder_initialization():
    recorder = AudioRecorder()
    assert recorder.CHUNK == 1024
    assert recorder.FORMAT == pyaudio.paInt16
```
