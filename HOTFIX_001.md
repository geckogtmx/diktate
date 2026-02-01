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

## HOTFIX_004: Persistent Speed Attempt
> **Status:** FAILED / REVERTED
> **Result:** Inference times remained >2500ms for 1s dictations despite 60m keep-alive and Int8 optimization.
> **Action:** Reverted `keep_alive` to 10m. Kept Int8 optimization as it provides 1.4GB headroom, though insufficient to solve the current latency anomaly.

### Changes Reverted
- **`python/core/processor.py`**: Reverted `keep_alive` to `10m`.
- **`python/ipc_server.py`**: Reverted `keep_alive` to `10m` in startup.

### Lessons
- Persistence alone does not solve the >2500ms latency.
- There is an underlying discrepancy between "Hot" model performance today vs. previous sessions that remains undocumented by metrics.
