# dIKtate Performance Benchmarks

> **Last Updated:** 2026-01-16
> **Test Environment:** Windows, CPU-only, Whisper V3 Turbo

---

## Pipeline Overview

```
Recording → Transcription → Processing → Injection → Done
   ~2-8s       ~5.6s         0.7-7s       ~0.5-1s
```

**Total Pipeline:** 9-17 seconds depending on utterance length and processing mode.

---

## Transcription (Whisper V3 Turbo)

| Audio Duration | Transcription Time | Notes |
|----------------|-------------------|-------|
| ~2s | ~5.6s | Short phrase |
| ~5s | ~5.7s | Medium phrase |
| ~8s | ~5.8s | Long phrase |
| ~41s | ~16s | Long-form (6 phrases) |

**Key Finding:** Transcription is the **primary bottleneck** (~70% of total time).

---

## LLM Processing Comparison

### Local Models (Ollama)

| Model | Size | Avg Time | Accuracy | Verdict |
|-------|------|----------|----------|---------|
| **Llama3** | 4.7 GB | ~7s | ✅ Good | **Recommended** |
| Mistral | 4.4 GB | ~9s | ✅ Good | Slower |
| Gemma3:4b | 3.3 GB | ~7s | ⚠️ Lower | Fast but less accurate |
| Qwen3:30b | 18 GB | ~60s+ | ✅ High | Too slow |
| Qwen2.5:7b | 4.7 GB | Not tested | — | Similar size to Llama3 |

### Cloud APIs

| Provider | Model | Avg Time | Accuracy | Issues |
|----------|-------|----------|----------|--------|
| **Anthropic** | Claude 3 Haiku | ~0.8s | ✅ Good | Censors profanity |
| Google | Gemini 3 Flash Preview | ~2.5s | ✅ Good | Corrections handled well |
| OpenAI | GPT-4o-mini | Not tested | — | Available |

---

## Cost Comparison (Per 1M Tokens)

| Provider | Model | Input | Output |
|----------|-------|-------|--------|
| Anthropic | Claude 3 Haiku | $0.25 | $1.25 |
| Google | Gemini 2.0 Flash | $0.075 | $0.30 |
| OpenAI | GPT-4o-mini | $0.15 | $0.60 |
| **Local** | Llama3/Ollama | **Free** | **Free** |

---

## Quality Notes

### Profanity Handling
| Provider | Behavior |
|----------|----------|
| Llama3 | ✅ Preserves profanity |
| Gemini 3 Flash | ⚠️ Whisper censors (f***), Gemini preserves |
| Claude 3 Haiku | ❌ Sanitizes (fucking → freaking) |

### Correction Handling ("pineapples, no, apples")
| Provider | Behavior |
|----------|----------|
| Llama3 | Preserves both (literal) |
| Gemini 3 Flash | ✅ Removes correction ("apples") |
| Claude 3 Haiku | Partial removal |

---

## Perceived Speed Analysis

Despite Claude Haiku being ~7x faster than Llama3 for processing, users **do not perceive** a significant difference because:

| Stage | Time | % of Total |
|-------|------|------------|
| **Transcription** | ~5.6s | **~60-70%** |
| Processing | 0.7-7s | ~20-30% |
| Injection | ~0.5-1s | ~10% |

**Conclusion:** Optimizing transcription and injection yields more perceived speed than LLM choice.

---

## Optimization Roadmap

### Quick Wins (Low Effort)

1. **Clipboard Paste Injection**
   - Current: Character-by-character (~10ms/char)
   - Proposed: Ctrl+V paste (instant)
   - **Estimated Savings: ~500-1000ms**

2. **Distil-Whisper Model**
   - Current: Whisper V3 Turbo
   - Proposed: distil-whisper-large-v3
   - **Estimated Savings: ~2-3s transcription**

### Medium Effort

3. **GPU Acceleration**
   - Current: CPU inference
   - Proposed: CUDA/cuDNN
   - **Estimated Savings: ~50% on transcription**

4. **Streaming Transcription**
   - Current: Batch after recording stops
   - Proposed: Real-time during recording
   - **Estimated Savings: ~3-4s perceived wait**

### High Effort

5. **Custom Fine-Tuned Model**
   - Distilled model trained for dictation cleanup
   - Edge deployment for minimal latency

---

## Configuration Reference

### Environment Variables (.env)

```env
# Processing Mode: "local", "gemini", "anthropic", or "openai"
PROCESSING_MODE=local

# API Keys (only needed for cloud modes)
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Debug logging
DEBUG=0
```

### Model Defaults

| Mode | Model |
|------|-------|
| local | llama3:latest |
| gemini | gemini-3-flash-preview |
| anthropic | claude-3-haiku-20240307 |
| openai | gpt-4o-mini |

---

## Files Modified

- `python/core/processor.py` — Multi-provider support (4 processors)
- `.env` / `.env.example` — Configuration templates
- `python/ipc_server.py` — Factory function integration
