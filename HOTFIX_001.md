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

## Verification Checklist
1.  **Restart App**: Ensure new code loads.
2.  **VRAM Check**:
    -   Launch App.
    -   Wait 1 minute.
    -   Confirm VRAM drops (Ollama unloads).
3.  **Latency Check**:
    -   Dictate.
    -   Confirm < 500ms response.
