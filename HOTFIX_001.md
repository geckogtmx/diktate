# HOTFIX_001: Inference Speed Restoration

> **Status:** COMPLETED (Corrected)
> **Goal:** Restore inference speed to < 500ms and reduce VRAM usage.

## Problem Analysis
- **Root Cause:** VRAM saturation due to `keep_alive` interactions between startup sequences and processor calls.
- **Specific Failure:** User observed persistent slowness.
- **Investigation:** Found that `ipc_server.py` startup warmup was hardcoded to `10m`, overriding the `processor.py` fix of `1m`.

## Changes Applied

### 1. IPC Server (`python/ipc_server.py`)
- [x] **Smart Cache Clearing**: Only clear `self.processors` on relevant config changes.
- [x] **Cloud Mode Isolation**: Skip local warmup if `PROCESSING_MODE` is cloud.
- [x] **Startup Warmup Fix**: Changed `keep_alive` from `10m` to `1m` in `_startup_warmup`.

### 2. Processor (`python/core/processor.py`)
- [x] **Runtime Cleanup**: Changed `keep_alive` from `10m` to `1m` for all inference calls.

## HOTFIX_002: Revert NVIDIA Path Injection
> **Status:** APPLIED
> **Goal:** Prove/Disprove "Ghost Variable" hypothesis by disabling the explicit NVIDIA DLL path injection.
> **Theory:** Prior to this injection, Whisper likely failed to find CUDA and defaulted to CPU, leaving VRAM for the LLM. Reverting this should restore that state.

### Changes Applied
- **`python/ipc_server.py`**: Disabled `_add_nvidia_paths()` (Lines 27-54).

## Verification Checklist
1.  **Restart App**: Ensure new code loads.
2.  **VRAM Check**:
    -   Launch App.
    -   Wait 1 minute.
    -   Confirm VRAM drops (Ollama unloads).
3.  **Latency Check**:
    -   Dictate.
    -   Confirm < 500ms response.

## HOTFIX_003: Force Whisper to CPU
> **Status:** FAILED (Reverted)
> **Result:** Transcription time spiked to ~6000ms (unacceptable).
> **Lesson:** CPU is too slow for `large-v3-turbo`. We must use GPU, but VRAM is insufficient.

### Changes Reverted
- **`python/ipc_server.py`**: Reverted `device="cpu"` back to `auto`.

## HOTFIX_004: Persistence Revert & VRAM Optimization
> **Status:** PARTIAL REVERT (Optimized)
> **Result:** Persistence (60m) did not solve the >2500ms latency on 1s sessions. Reverted to 10m.
> **Action:** Kept Int8 optimization as it provides **1.4 GB VRAM headroom**, though latency remains high.
>
> **CRITICAL DISCOVERY:**
> The 1.4 GB space was successfully created (VRAM dropped from 7.4GB to 6.2GB), but it **solved nothing**. This proves that **VRAM saturation is NOT the core problem**. Even with 2 GB of headroom, local inference today is slower than Friday. Future investigation must look beyond memory limits (e.g., driver overhead, Ollama processing logic, or hardware-specific delays).

### Changes Reverted
- **`keep_alive`**: Back to `10m` (Original behavior).

### Changes Kept
- **Whisper Compute**: `int8_float16` (Active). Reclaims 1.4 GB VRAM.

### Lessons
- Persistence alone does not solve the >2500ms latency.
- VRAM saturation is not the bottleneck; performance remains poor even with ample headroom.
