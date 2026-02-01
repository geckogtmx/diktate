# HOTFIX_001: Restore <500ms Inference Speed

## Status: Proposed
**Target**: Current repository (Master)
**Goal**: Restore the <500ms inference speeds observed on Jan 30th.

## 🔍 Diagnosis
- **VRAM Saturation (95.5%)**: On 8GB cards (like 4060 Ti), the app is accidentally loading multiple models (Gemma + Llama) or keeping them loaded too long.
- **Cache Clearing Bug**: `python/ipc_server.py` wipes the processor cache on every settings sync, forcing a 3-second disk-to-VRAM reload penalty on every dictation.

## 🛠️ Surgical Fixes

### 1. Fix Cache Wiping (`python/ipc_server.py`)
- **Action**: Stop `self.processors.clear()` from running on every `configure` call.
- **Implementation**: Only clear the cache if the `localProfiles`, `cloudProfiles`, or `defaultModel` keys actually changed compared to the previous config.

### 2. VRAM Relief (`python/core/processor.py`)
- **Action**: Change `keep_alive` from `10m` to `1m`.
- **Reason**: This ensures that if a model swap occurs, the "Zombie" model is evicted within 60 seconds, freeing 3-5GB of VRAM instantly.

### 3. Cloud Isolation (`python/ipc_server.py`)
- **Action**: If `PROCESSING_MODE == 'cloud'`, disable the background local engine warmup.
- **Reason**: Frees up the GPU for Electron UI rendering, eliminating lag when displaying Cloud results.

## ✅ Verification
1. Run `ollama unload --all` manually once.
2. Update code.
3. Verify VRAM stays ~40% (3.2GB) for Gemma sessions.
4. Measure dictation latency (Target: < 500ms).
