# DEV_HANDOFF.md

> **Last Updated:** 2026-01-18
> **Last Model:** Claude Opus 4.5
> **Session Focus:** Ollama Performance Optimization

---

## ✅ Session Complete: Ollama Performance Fix

**Problem:** Local LLM processing (Ollama) was stalling intermittently, causing 60s+ timeouts and failed dictations.

**Root Cause:** GPU VRAM contention between Whisper (large-v3-turbo) and llama3:8B. With only 8GB VRAM on RTX 4060 Ti:
- Whisper: ~1.5GB
- llama3 + 64K context: ~6GB
- Free: <700MB (insufficient buffer)

When Whisper finished transcription, CUDA didn't immediately free memory, causing Ollama to stall waiting for VRAM.

### Changes Made (`python/core/processor.py`)

1. **Switched default model**: `llama3:latest` → `gemma3:4b`
   - 4B params vs 8B = faster inference
   - ~3.3GB vs ~6GB base size

2. **Reduced context window**: 64K → 2K tokens
   - Saves ~1.4GB VRAM
   - Sufficient for text cleanup tasks

3. **Added keep_alive**: `"keep_alive": "10m"`
   - Prevents model unloading between requests
   - Eliminates cold start delays

4. **Reduced timeout**: 60s → 20s
   - Fail fast on stalls
   - Falls back to raw transcription gracefully

5. **Added model warmup on startup**
   - Sends empty prompt with `num_predict: 1` during init
   - Ensures model is loaded before first dictation
   - Eliminates "first request eaten" issue

### Performance Comparison

| Model | Context | Processing Time | Stability |
|-------|---------|-----------------|-----------|
| llama3:8B | 64K | 2-5s (stalls often) | Poor |
| llama3:8B | 2K | 1.9-2.9s | OK |
| **gemma3:4b** | **2K** | **350-750ms** | **Stable** |

---

## 🔄 Pending

- [ ] **Snippets Feature**: Needs re-implementation (was reverted in prior session)
- [ ] **Custom Dictionary**: Deferred
- [ ] **Configurable Model Selection**: User should be able to choose Ollama model in settings
- [ ] **Auto-select Model**: Detect available VRAM and pick optimal model

---

## 📋 Notes for Next Session

- Environment issue from previous session is **RESOLVED** (was transient pnpm issue)
- `pnpm dev` works correctly
- Local processing is stable with gemma3:4b
- Consider adding model selection UI in Settings

---

## Session Log (Last 3 Sessions)

### 2026-01-18 - Claude Opus 4.5 (Current)
- Diagnosed Ollama stalls as VRAM contention issue
- Benchmarked llama3 vs gemma3 performance
- Implemented model warmup on startup
- Optimized context size and timeouts
- **Result:** Processing time reduced from 2-5s to 350-750ms, no more stalls

### 2026-01-17 - Gemini
- Attempted Snippets implementation (reverted due to env issue)
- Environment issue was transient, now resolved

### 2026-01-17 - Gemini
- Built dikta.me marketing site (Hero, Features, Pricing)
- Strategic pricing update (Lifetime = 1 yr updates)
