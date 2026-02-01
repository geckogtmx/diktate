# HOTFIX_002: Inference Performance Investigation

> **Status:** UNRESOLVED - Context mismatch fix applied but did NOT resolve live app slowdown
> **Summary:** Direct Ollama curl tests achieve 314-391ms, but diktate app consistently hits 2500-2800ms with identical config. The ~1900ms gap is caused by something in the diktate pipeline, most likely Whisper GPU contention evicting Ollama from VRAM.
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

## Investigation Results

### Finding 1: Context Length Mismatch (CONFIRMED but INSUFFICIENT)

#### How Ollama Model Loading Works

Ollama keeps models loaded in VRAM with a specific **context window size**. If a request comes in with a **different** `num_ctx` than what's currently loaded, Ollama must **unload and reload** the entire model with the new context size. This takes ~2.6-3.1 seconds even though the model data is already in VRAM.

#### The Mismatch Created by First Fix Attempt

**Startup warmup** ([ipc_server.py:561](./python/ipc_server.py#L561)):
```python
"options": {"num_ctx": 2048, "num_predict": 1}  # Loads model at context=2048
```

**Processing request** ([processor.py:192](./python/core/processor.py#L192)):
```python
# After incorrect fix - REMOVED num_ctx
"options": {"temperature": 0.1}  # No num_ctx -> uses Ollama default (4096)
```

**Result:** Warmup loads at 2048. First request defaults to 4096. **2048 != 4096 = RELOAD on every request.**

#### Proof (Direct curl tests - bypassing diktate)

**Mismatched (broken):**
```
Step 1: warmup num_ctx=2048  -> load: 3114ms (cold)  -> context: 2048
Step 2: request no num_ctx   -> load: 3079ms (RELOAD) -> context: 4096  <- MISMATCH!
Step 3: request no num_ctx   -> load:  233ms (warm)   -> context: 4096  <- matches now
```

**Consistent (fixed):**
```
Step 1: warmup num_ctx=2048  -> load: 3113ms (cold)  -> context: 2048
Step 2: request num_ctx=2048 -> load:  229ms (warm)   -> total: 391ms  <- MATCH!
Step 3: request num_ctx=2048 -> load:  227ms (warm)   -> total: 314ms  <- MATCH!
Step 4: request num_ctx=2048 -> load:  226ms (warm)   -> total: 379ms  <- MATCH!
```

**314-391ms via curl matches Jan 30 "fast" baseline exactly.**

#### Fix Applied

Restored `num_ctx: 2048` in processing request to match warmup. Committed as `622e10d`.

#### Fix Result: DID NOT RESOLVE LIVE APP SLOWDOWN

After restoring `num_ctx: 2048` and restarting both diktate and Ollama:
- **23 test dictations:** Still 2500-2800ms processing time
- **Direct curl test (same config):** 723ms
- **Difference:** ~1900ms overhead exists in the diktate pipeline
- `ollama ps` confirmed: model loaded, context 2048, 100% GPU
- Logs confirmed: "Model gemma3:4b already loaded in VRAM, skipping warmup"

**The context mismatch fix was correct (prevents a known reload penalty) but it was NOT the primary cause of the live app slowdown.**

---

### Finding 2: Whisper GPU Contention (LEADING HYPOTHESIS - UNTESTED)

#### The Smoking Gun

| Test Method | Processing Time | Notes |
|-------------|----------------|-------|
| Direct curl to Ollama | 314-723ms | No Whisper involved |
| Diktate app (full pipeline) | 2500-2800ms | Whisper runs before Ollama |
| Difference | ~1900ms | Pipeline overhead |

#### Theory

The diktate pipeline runs: **Recording -> Whisper (GPU) -> Ollama (GPU) -> Injection**

Both Whisper and Ollama share the same RTX 4060 Ti (8GB VRAM):
- Whisper (int8_float16): ~1.5-2GB VRAM
- gemma3:4b: ~4.3GB VRAM
- Total: ~6GB of 8GB available

**Hypothesis:** After Whisper finishes transcription on the GPU, Ollama's model may have been partially or fully evicted from VRAM. This forces a model reload (~2.6s) on every inference request, regardless of `num_ctx` matching.

This would explain:
- Why curl tests (no Whisper) are fast but live app is slow
- Why the issue is consistent (Whisper runs before EVERY Ollama call)
- Why VRAM optimization (HOTFIX_004) didn't help (both still share GPU)
- Why Jan 30 "fast" sessions existed (possibly different VRAM layout or Whisper timing)

#### Why This Remains Untested

- **Whisper on CPU:** Previously tested, adds +6500ms to transcription. Not viable.
- **Smaller Whisper models:** User estimates only ~100-200ms savings, wouldn't close the 1900ms gap.
- **Separate GPU:** Would require hardware changes (second GPU).

---

### Critical Rule (Still Valid)

**All Ollama `/api/generate` calls must use the same `num_ctx` value.** Currently 2048 in:
- [ipc_server.py:561](./python/ipc_server.py#L561) - Startup warmup
- [processor.py:97](./python/core/processor.py#L97) - `set_model()` warmup
- [processor.py:193](./python/core/processor.py#L193) - Processing request

If any one of these differs, Ollama reloads the model (~2.6s penalty). This is a necessary condition for fast inference but not sufficient when Whisper contention is present.

---

## Eliminated Hypotheses

| Hypothesis | Status | Evidence |
|------------|--------|----------|
| GPU CPU fallback | **DISPROVEN** | tokens/sec = 43-82 (GPU active), `ollama ps` = 100% GPU |
| VRAM saturation | **DISPROVEN** | HOTFIX_004 freed 1.4GB, no improvement |
| Resource contention | **DISPROVEN** | Fast speeds with Chrome/YT/3 monitors |
| Ollama daemon cruft | **DISPROVEN** | Happens on fresh reboot |
| Context mismatch (remove num_ctx) | **WRONG FIX** | Made it worse, not better |
| Context mismatch (restore num_ctx) | **CORRECT but INSUFFICIENT** | 314-391ms in curl, still 2600ms in app |
| Whisper on CPU | **NOT VIABLE** | +6500ms to transcription time |
| Whisper GPU contention | **LEADING HYPOTHESIS** | Explains curl vs app gap, untested fix |

---

## Potential Future Approaches

### 1. Sequential GPU Locking
Ensure Whisper fully releases GPU memory before Ollama inference starts. Would require profiling the exact VRAM handoff between the two models.

### 2. Pin Ollama Model in VRAM
Investigate Ollama's `keep_alive` and VRAM pinning behavior. If Ollama can be told to never evict the model, Whisper would need to work with remaining VRAM or fall back to CPU for transcription only.

### 3. Smaller Whisper Model
Switch from `base` to `tiny` Whisper model to reduce VRAM footprint. User estimates minor improvement (~100-200ms), but combined with other optimizations might help.

### 4. Ollama `--no-mmap` or VRAM Reservation
Some Ollama flags may prevent model eviction. Worth investigating Ollama documentation for VRAM reservation options.

### 5. Profile the Exact Bottleneck
Add timing instrumentation around each step in the pipeline:
- Time from Whisper completion to Ollama request start
- Ollama `load_duration` in the live app (already logged)
- Compare `load_duration` between curl and live app to confirm eviction theory

### 6. Cloud STT Isolation Test (RECOMMENDED NEXT STEP)

**Purpose:** Definitively confirm or disprove Whisper GPU contention by removing Whisper from the GPU entirely.

**How it works:** Add a `TRANSCRIPTION_MODE=cloud` option that uses Gemini's multimodal API (already integrated for text processing) to transcribe audio instead of local Whisper. When cloud STT is active, Whisper never loads, Ollama has 100% of VRAM.

**Expected result:** If Ollama processing drops to 300-500ms with cloud STT, Whisper VRAM eviction is confirmed as the root cause.

**Implementation (minimal, ~40 lines):**

1. Create `python/core/cloud_transcriber.py`:
```python
import requests
import base64
import logging

logger = logging.getLogger("diktate.cloud_transcriber")

class CloudTranscriber:
    """Cloud-based transcription using Gemini multimodal API."""

    def __init__(self, api_key: str, model: str = "gemini-2.0-flash"):
        self.api_key = api_key
        self.model = model
        self.api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    def transcribe(self, audio_path: str, language: str = None) -> str:
        with open(audio_path, "rb") as f:
            audio_data = base64.b64encode(f.read()).decode("utf-8")

        lang_hint = f" The audio is in {language}." if language else ""
        payload = {
            "contents": [{
                "parts": [
                    {"text": f"Transcribe this audio exactly as spoken. Return ONLY the transcription, nothing else.{lang_hint}"},
                    {"inline_data": {"mime_type": "audio/wav", "data": audio_data}}
                ]
            }]
        }

        response = requests.post(
            f"{self.api_url}?key={self.api_key}",
            json=payload,
            timeout=15
        )

        if response.status_code == 200:
            result = response.json()
            text = result["candidates"][0]["content"]["parts"][0]["text"]
            logger.info(f"Cloud transcription complete: {len(text)} chars")
            return text.strip()
        else:
            raise RuntimeError(f"Cloud STT failed: {response.status_code} {response.text}")
```

2. Update `ipc_server.py` transcriber initialization (~line 414):
```python
# Replace:
self.transcriber = Transcriber(model_size="turbo", device="auto")
# With:
if os.getenv("TRANSCRIPTION_MODE", "local") == "cloud":
    from core.cloud_transcriber import CloudTranscriber
    self.transcriber = CloudTranscriber(api_key=os.getenv("GEMINI_API_KEY"))
    logger.info("Using CLOUD transcription (Gemini) - Whisper NOT loaded")
else:
    self.transcriber = Transcriber(model_size="turbo", device="auto")
```

3. Add to `.env`:
```
TRANSCRIPTION_MODE=cloud  # Use "local" for Whisper, "cloud" for Gemini STT
```

**Requirements:** Existing `GEMINI_API_KEY` (already configured). Gemini free tier is sufficient for testing. No new dependencies.

**Test procedure:**
1. Set `TRANSCRIPTION_MODE=cloud` in `.env`
2. Restart diktate (Whisper will NOT load)
3. Run 10-20 dictations
4. Check `processing_time_ms` in database
5. If <500ms: Whisper contention CONFIRMED. SPEC_037 modular split is the permanent fix.
6. If still 2500ms: Whisper contention DISPROVEN. Root cause is elsewhere.

**This also serves as a prototype for SPEC_037's cloud-only mode.**

---

## Code Changes Made (This Session)

### Context Mismatch Fix ([processor.py:193](./python/core/processor.py#L193))
- Restored `num_ctx: 2048` in processing request to match warmup
- Prevents the guaranteed reload penalty from mismatched context

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

## Change Log

**2026-02-01 14:00** - Investigation started
- Discovered 3-hour regression window (fast at 10:56 AM, slow by 1:51 PM)
- Initial GPU fallback hypothesis

**2026-02-01 15:00** - GPU fallback disproven
- tokens/sec confirmed GPU active (43-82 tok/s)
- Discovered `load_duration: 2589ms` in Ollama responses
- Found `OLLAMA_CONTEXT_LENGTH=65536` in server config

**2026-02-01 15:30** - Incorrect fix applied
- Removed `num_ctx: 2048` from processing (WRONG)
- Created mismatch between warmup (2048) and processing (default 4096)
- 20 test dictations showed NO improvement (made it worse)

**2026-02-01 16:00** - Context mismatch root cause confirmed
- Direct curl tests proved context mismatch causes reload
- Consistent `num_ctx: 2048` produces 314-391ms total via curl
- Restored `num_ctx: 2048` in processing request

**2026-02-01 ~17:00** - Fix tested in live app: NO IMPROVEMENT
- 23 test dictations still 2500-2800ms
- Direct curl: 723ms vs diktate app: 2600ms (same config)
- `ollama ps` confirms model loaded, 100% GPU, context 2048
- Restarted Ollama, retested: same results
- Concluded: ~1900ms overhead exists in diktate pipeline, not in Ollama config

**2026-02-01 ~17:30** - Investigation paused
- Leading hypothesis: Whisper GPU contention evicts Ollama model from VRAM
- Whisper on CPU not viable (+6500ms)
- Smaller Whisper models unlikely to close the gap
- Documented findings for future investigation
