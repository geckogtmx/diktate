# DEV_HANDOFF.md

> **Last Updated:** 2026-01-17
> **Last Model:** Gemini
> **Session Focus:** Status Window Models, GPU Fixes, Performance Investigation

---

## ✅ Completed This Session

-   **Status Window UI:** Now displays active Transcriber and Processor models (e.g., `T: TURBO | P: LLAMA3`).
    -   Files: `src/main.ts` (state handling), `src/renderer.ts` (UI update), `python/ipc_server.py` (status command).
-   **Whisper GPU Fix:** Fixed `cublas64_12.dll` error by injecting NVIDIA DLL paths in `ipc_server.py`.
    -   Files: `python/ipc_server.py`, `python/requirements.txt` (added `nvidia-cublas-cu12`, `nvidia-cudnn-cu12`).
-   **Configurable Processor:** Backend now supports switching processor model via `ipc_server.py` configuration.
    -   Files: `python/core/processor.py` (`set_model`), `python/ipc_server.py`.
-   **Crash Fix:** Resolved `ImportError` by aliasing `DEFAULT_CLEANUP_PROMPT` in `python/config/prompts.py`.

## ⚠️ Known Issues / Broken

-   **Performance/VRAM Contention:** Transcription + Processing takes ~40s when using `llama3:latest` (4.7GB) + Whisper Large (2GB) on an 8GB VRAM GPU (system swaps to RAM).
    -   User declined switching to a smaller model (e.g., `qwen2.5:1.5b`) for now.
    -   **Performance is fast** if VRAM isn't exceeded (e.g. if one component is on CPU or smaller model).
-   **Missing Audio Devices:** Settings dropdown for audio devices is empty (mocked or unimplemented).

## 🔄 In Progress / Pending

-   [ ] **Audio Device Enumeration** (Next Priority)
-   [ ] **Performance Tuning:** Re-evaluating model choices or quantization vs speed trade-offs.

## 📋 Instructions for Next Model

1.  **Audio Device Enumeration (P1):**
    -   Implement `navigator.mediaDevices.enumerateDevices()` in Electron.
    -   Send list to settings UI.
    -   Pass selected device ID to Python `Recorder`.
2.  **Respect User Preference:** Do **NOT** change the model from Llama3 without explicit permission.
3.  **Performance:** If user complains about speed again, explain the VRAM limit clearly or suggest **Quantized** versions of Llama3 (e.g., `llama3:q4_0`) instead of a different model family.

### Context Needed
-   `python/ipc_server.py`: Note the DLL injection block.
-   `src/main.ts`: Note the `models` object extraction in `get-initial-state`.

---

## Session Log (Last 3 Sessions)

### 2026-01-17 - Gemini
-   Implemented Status Window Model Display.
-   Fixed critical Whisper GPU crash (missing DLLs).
-   Diagnosed VRAM contention causing 40s slowdown.

### 2026-01-17 - Gemini
-   Fixed blank Settings window (build process).
-   Updated launch strategy.

### 2026-01-17 - Gemini
-   Implemented Mode Prompts (Standard/Pro/Literal).
-   Fixed `transcriber.py` CPU/GPU detection.
