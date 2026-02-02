# INFERENCE_BUG: Ollama Startup and Warmup Investigation

> **Session Date:** 2026-02-02
> **Status:** ACTIVE INVESTIGATION
> **Goal:** Identify root cause of >2500ms inference times and achieve <500ms consistently

---

## Problem Statement

**Symptom:** Ollama inference is taking >2500ms despite model being loaded in VRAM. Opening Ollama desktop app and saying "Hi" immediately fixes the issue, dropping times to <400ms.

**Current Understanding:**
- `ollama ps` shows model loaded in VRAM with 100% GPU
- Model context (num_ctx) is consistent at 2048 across warmup and requests
- Direct curl tests bypass dIKtate app show fast inference (~300-400ms)
- Live app shows slow inference (~2500-2800ms)

**Critical Observation:** The gap between curl tests and live app suggests Whisper GPU contention OR Ollama API not being properly initialized by our warmup code.

---

## Session History

### Previous Investigation (2026-02-01 - HOTFIX_002)

**Attempted Fixes:**
1. Context length mismatch (num_ctx) - FIXED but insufficient
2. GPU fallback hypothesis - DISPROVEN (tokens/sec confirms GPU active)
3. VRAM saturation - DISPROVEN (HOTFIX_004 freed 1.4GB, no improvement)
4. Whisper GPU contention - LEADING HYPOTHESIS but untested

**Key Discovery:** Context mismatch fix (restored num_ctx: 2048) improved curl tests to 314-391ms but live app stayed at 2500-2800ms.

### Yesterday's Implementation (2026-02-02 - SPEC_038)

**Changes Made:**
- Implemented single-model constraint for local (VRAM optimization)
- Removed `set_model()` method from processor.py
- Changed cache key from `local:{model}` to `local:global`
- Added "Always warm API" logic in `_ensure_ollama_ready()`
- Disabled processor warmup at startup (lazy creation on first request)

**Status After Changes:** Untested in production. Pending commits contain these changes.

---

## Today's Investigation Plan (2026-02-02)

### Phase 1: Code Review & Commit Safety ✅ (Current)
- Review pending changes for safety
- Verify no breaking changes or data loss risks
- Document current state before new changes

### Phase 2: Hypothesis Refinement
We need to investigate multiple competing theories:

#### Theory A: Ollama API Initialization Gap
- **Evidence:** Opening Ollama UI instantly fixes performance
- **Hypothesis:** Our warmup sends test inference but doesn't fully initialize the API endpoint
- **Test:** Add more comprehensive warmup sequence (multiple test inferences, different contexts)

#### Theory B: Whisper GPU Memory Eviction
- **Evidence:** Curl tests (no Whisper) are fast, live app (with Whisper) is slow
- **Hypothesis:** Whisper transcription evicts Ollama model from VRAM despite `keep_alive: "10m"`
- **Test:** Monitor VRAM usage during: Whisper transcription → Ollama inference transition

#### Theory C: Model Context State Corruption
- **Evidence:** Model loads fast in curl, slow in app (even with matching num_ctx)
- **Hypothesis:** Something in our request pipeline corrupts Ollama's context state
- **Test:** Compare exact request payloads between curl and live app

#### Theory D: Process/Thread Contention
- **Evidence:** Multiple warmup attempts, async loading, cache key changes
- **Hypothesis:** Race conditions or multiple processor instances competing
- **Test:** Add comprehensive logging around processor creation/reuse

### Phase 3: Diagnostic Enhancement
Add instrumentation to capture:
1. **Ollama API state** before and after Whisper transcription
2. **VRAM allocation** during the full pipeline (Whisper → Ollama)
3. **Request timing breakdown**: Whisper end → Ollama start → Ollama inference complete
4. **Ollama server logs** to see if model is being evicted/reloaded

### Phase 4: Experimental Fixes
Based on Phase 2 findings, test:
1. **Enhanced Warmup:** Multiple test inferences with varying contexts
2. **VRAM Pinning:** Explore Ollama's `keep_alive` duration and memory management
3. **Sequential GPU Locking:** Ensure Whisper fully releases before Ollama starts
4. **Cloud STT Test (SPEC_037 prototype):** Remove Whisper from GPU entirely

### Phase 5: Validation
- Test with 20+ dictations
- Verify <500ms inference consistently
- Document the fix for future reference

---

## Pending Commits Analysis

### Safety Assessment: ✅ SAFE TO COMMIT

**Changed Files:**
- `python/ipc_server.py` - Routing logic, warmup, cache keys
- `python/core/processor.py` - Removed set_model() method
- `src/main.ts` - Config sync, hotkey validation
- `src/settings/*.ts` - UI changes for single-model selection
- `docs/*.md` - Documentation updates

**Risk Level:** LOW
- No data loss risks (settings schema expanded, not replaced)
- Backward compatible (checks for both `localModel` and `defaultOllamaModel`)
- No breaking changes to Whisper or transcription pipeline
- Warmup logic enhanced (not removed)

**Rationale to Commit:**
1. SPEC_038 implementation is architecturally correct (single model prevents VRAM thrashing)
2. Changes document the investigation progress (cache logging, warmup timing)
3. Current performance issue exists in BOTH old and new code
4. Committing creates a clean baseline for today's investigation
5. Rollback is straightforward if needed

---

## Current Code State

### Warmup Logic (ipc_server.py:562-595)

```python
# CRITICAL (SPEC_038): Always send warmup inference request
logger.info(f"[STARTUP] Warming up Ollama API endpoint for {default_model}...")

warmup_start = time.time()
warmup_response = requests.post(
    "http://localhost:11434/api/generate",
    json={
        "model": default_model,
        "prompt": "Test",
        "stream": False,
        "options": {"num_ctx": 128, "num_predict": 1},
        "keep_alive": "10m"
    },
    timeout=30
)
warmup_time = (time.time() - warmup_start) * 1000
```

**Observations:**
- Uses minimal context (128) instead of production context (2048)
- Single test inference
- Minimal prompt ("Test")
- May not be sufficient to fully initialize API endpoint

### Processor Cache (ipc_server.py:1966-1994)

```python
# SPEC_038: For local, use "local:global" cache key
if provider == "local":
    cache_key = "local:global"
else:
    cache_key = f"{provider}:{model or 'default'}"

logger.info(f"[CACHE] Key: {cache_key}, Exists: {cache_exists}, All keys: {all_keys}")

if cache_key not in self.processors:
    self.processors[cache_key] = create_processor(provider, model=model)
    logger.info(f"[ROUTING] Created processor: {cache_key}")

p = self.processors[cache_key]
logger.info(f"[CACHE] Retrieved processor: {cache_key} -> model={processor_model}, id={id(p)}")
```

**Observations:**
- Good: Single cache key prevents multiple processors
- Good: Debug logging added to track cache hits/misses
- Concern: Processor created with model=None at startup (race condition documented)

---

## Questions to Answer Today

1. **Does our warmup actually warm the Ollama API endpoint fully?**
   - Test: Add multiple warmup inferences with production-like context
   - Test: Monitor Ollama server logs during warmup

2. **Is Whisper evicting Ollama from VRAM?**
   - Test: Check VRAM before/after Whisper transcription
   - Test: Run dictation, check `ollama ps` immediately after Whisper completes

3. **Why does opening Ollama UI fix the issue?**
   - Investigate: What does Ollama desktop app do differently than our API calls?
   - Compare: Ollama server logs when app opens vs our warmup

4. **Is there a timing issue between Whisper and Ollama?**
   - Test: Add delay between Whisper completion and Ollama inference
   - Monitor: GPU memory transitions

---

## Success Criteria

- [ ] Identify root cause with reproducible evidence
- [ ] Implement fix that achieves <500ms inference consistently
- [ ] Verify fix works across 20+ test dictations
- [ ] Document the solution for future reference
- [ ] No manual Ollama UI intervention required

---

## Investigation Log

### 2026-02-02 Morning
- Created investigation document
- Reviewed pending commits (SAFE to commit)
- Documented current code state
- Planning exploration phase

---

*This document will be updated throughout the investigation session.*
