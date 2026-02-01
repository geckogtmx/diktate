# HOTFIX_002: Context Length Mismatch Causing 2.6s Model Reload

> **Status:** FIX APPLIED - AWAITING TEST
> **Root Cause:** Removing `num_ctx: 2048` from processing requests created a mismatch with warmup's `num_ctx: 2048`, forcing Ollama to reload the model on every request
> **Fix:** Restore `num_ctx: 2048` in processing request to match warmup context
> **Date:** 2026-02-01

---

## The Problem

Processing times regressed from **300-500ms** to **2500-3800ms** (5-7x slower).

### Timeline
```
Jan 29:  3866ms avg (35/42 slow) - intermittent issue existed
Jan 30:  985ms avg  (40/81 fast) - "golden day" with consistent <500ms
Jan 31:  2173ms avg (mixed)
Feb 01:  2674ms avg, morning had 4 fast sessions (344-422ms)
```

---

## Root Cause: Context Length Mismatch

### How Ollama Model Loading Works

Ollama keeps models loaded in VRAM with a specific **context window size**. If a request comes in with a **different** `num_ctx` than what's currently loaded, Ollama must **unload and reload** the entire model with the new context size. This takes ~2.6-3.1 seconds even though the model data is already in VRAM.

### The Mismatch

**Startup warmup** ([ipc_server.py:561](./python/ipc_server.py#L561)):
```python
"options": {"num_ctx": 2048, "num_predict": 1}  # Loads model at context=2048
```

**Processing request** ([processor.py:192](./python/core/processor.py#L192)):
```python
# After incorrect HOTFIX_002 "fix" - REMOVED num_ctx
"options": {"temperature": 0.1}  # No num_ctx → uses Ollama default (4096)
```

**Result:** Warmup loads at 2048. First request defaults to 4096. **2048 != 4096 = RELOAD.**

### Proof (Direct curl tests)

**Mismatched (broken):**
```
Step 1: warmup num_ctx=2048  → load: 3114ms (cold)  → context: 2048
Step 2: request no num_ctx   → load: 3079ms (RELOAD) → context: 4096  ← MISMATCH!
Step 3: request no num_ctx   → load:  233ms (warm)   → context: 4096  ← matches now
```

**Consistent (fixed):**
```
Step 1: warmup num_ctx=2048  → load: 3113ms (cold)  → context: 2048
Step 2: request num_ctx=2048 → load:  229ms (warm)   → total: 391ms  ← MATCH!
Step 3: request num_ctx=2048 → load:  227ms (warm)   → total: 314ms  ← MATCH!
Step 4: request num_ctx=2048 → load:  226ms (warm)   → total: 379ms  ← MATCH!
```

**314-391ms total matches Jan 30 "fast" baseline exactly.**

### Why ALL 20 Test Requests Were Slow

My first "fix" (removing `num_ctx`) should have only caused ONE slow request (the first after warmup). But ALL requests were slow because:

1. The Ollama server has `OLLAMA_CONTEXT_LENGTH=65536` configured
2. Without explicit `num_ctx`, Ollama defaults to its server-configured value
3. Each request triggered: warmup context (2048) → default context (varies) → reload

The exact default context Ollama picks without `num_ctx` may vary based on server config, model defaults, and available VRAM, but the key is: **it didn't match the warmup's 2048.**

---

## The Fix

**Restore `num_ctx: 2048` in the processing request to match warmup.**

### Code Change
**File:** [python/core/processor.py:192-194](./python/core/processor.py#L192-L194)

```python
# BEFORE (my incorrect "fix" that created the mismatch):
"options": {
    "temperature": 0.1
    # num_ctx removed - defaults to 4096+ → MISMATCH with warmup's 2048
}

# AFTER (correct fix - consistent with warmup):
"options": {
    "temperature": 0.1,
    "num_ctx": 2048  # MUST match warmup's num_ctx to avoid 2.6s model reload
}
```

### Critical Rule

**All Ollama `/api/generate` calls must use the same `num_ctx` value.** Currently 2048 in:
- [ipc_server.py:561](./python/ipc_server.py#L561) - Startup warmup
- [processor.py:97](./python/core/processor.py#L97) - `set_model()` warmup
- [processor.py:193](./python/core/processor.py#L193) - Processing request (THIS FIX)

If any one of these differs, Ollama reloads the model (~2.6s penalty).

---

## Eliminated Hypotheses

| Hypothesis | Status | Evidence |
|------------|--------|----------|
| GPU CPU fallback | **DISPROVEN** | tokens/sec = 43-82 (GPU active) |
| VRAM saturation | **DISPROVEN** | HOTFIX_004 freed 1.4GB, no improvement |
| Resource contention | **DISPROVEN** | Fast speeds with Chrome/YT/3 monitors |
| Ollama daemon cruft | **DISPROVEN** | Happens on fresh reboot |
| Whisper VRAM conflict | **UNLIKELY** | Same Whisper on fast Jan 30 sessions |
| Context mismatch (remove num_ctx) | **WRONG FIX** | Made it worse, not better |
| Context mismatch (restore num_ctx) | **CONFIRMED** | 314-391ms in curl tests |

---

## Open Question: Intermittent Pre-Existing Slowdowns

The data shows Jan 29 was also slow (35/42 sessions >2000ms) with the OLD code that had consistent `num_ctx: 2048` everywhere. This suggests an additional factor beyond the context mismatch:

- **Whisper GPU contention**: Whisper transcription may occasionally cause Ollama's model to be evicted from VRAM, forcing a full reload. This would explain intermittent slow sessions even with matched `num_ctx`.
- **Ollama process restart**: Any Ollama restart requires a cold model load (~3s) on the first request, which is expected.
- **System-level GPU state**: Power management, driver resets, or other GPU consumers could force reloads.

These are separate from the guaranteed mismatch introduced by removing `num_ctx`, which caused 100% of requests to be slow.

---

## Additional Changes (This Session)

### GPU Health Check ([ipc_server.py:580](./python/ipc_server.py#L580))
- Added `_check_gpu_availability()` method
- Logs tokens/sec at startup to detect CPU fallback
- Warns if <20 tok/s (expected >50 for GPU)

### Performance Monitoring ([processor.py:207-221](./python/core/processor.py#L207-L221))
- Logs tokens/sec for every inference
- Stores `last_tokens_per_sec` for database logging
- Warns on suspiciously slow inference (<20 tok/s)

### Database Migration ([history_manager.py](./python/utils/history_manager.py))
- Added `tokens_per_sec REAL` column to history table
- Auto-migrates existing databases

### Troubleshooting Guide ([docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md))
- GPU debugging steps
- nvidia-smi monitoring commands
- Ollama restart procedures

---

## Verification Steps

1. Restart diktate app
2. Run 10-20 dictations
3. Check database:
   ```sql
   sqlite3 ~/.diktate/history.db "SELECT datetime(timestamp), processing_time_ms, tokens_per_sec FROM history WHERE provider='local' ORDER BY timestamp DESC LIMIT 20;"
   ```
4. **Expected:** processing_time_ms < 500ms, tokens_per_sec > 50

---

## Change Log

**2026-02-01 14:00** - Investigation started
- Discovered 3-hour regression window
- Initial GPU fallback hypothesis

**2026-02-01 15:00** - GPU fallback disproven
- tokens/sec confirmed GPU active (43-82 tok/s)
- Discovered `load_duration: 2589ms` in Ollama responses
- Found `OLLAMA_CONTEXT_LENGTH=65536` in server config

**2026-02-01 15:30** - Incorrect fix applied
- Removed `num_ctx: 2048` from processing (WRONG)
- Created mismatch between warmup (2048) and processing (default)
- 20 test dictations showed NO improvement

**2026-02-01 16:00** - Correct root cause found
- Direct curl tests proved context mismatch causes reload
- Consistent `num_ctx: 2048` produces 314-391ms total (matches Jan 30)
- Restored `num_ctx: 2048` in processing request
