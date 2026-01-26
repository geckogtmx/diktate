# Performance Metrics Guide

Understanding the normalized performance metrics in the dIKtate dashboard.

## The Problem

Raw performance metrics are hard to interpret:
- "10 seconds total time" - is that good or bad?
- Depends on recording length!
- A 30-second dictation will always take longer than a 2-second one

## The Solution: Normalized Metrics

We calculate efficiency ratios that **account for recording length**.

---

## Key Metric: Efficiency Ratio

**Formula:** `Total Pipeline Time ÷ Recording Duration`

### What It Means

The ratio tells you how many seconds of processing it takes per second of audio.

| Ratio | Meaning | Example |
|-------|---------|---------|
| **1.0x** | Real-time processing | 1 sec audio → 1 sec to process |
| **2.0x** | 2x slower than real-time | 1 sec audio → 2 secs to process |
| **3.0x** | 3x slower | 1 sec audio → 3 secs to process |
| **5.0x** | 5x slower | 1 sec audio → 5 secs to process |
| **10.0x+** | Very slow | System struggling |

### Rating Scale

| Ratio | Rating | Status |
|-------|--------|--------|
| ≤ 3.0x | **Excellent** | 🟢 Green |
| 3.0 - 5.0x | **Good** | 🟢 Light Green |
| 5.0 - 10.0x | **Average** | 🟠 Orange |
| > 10.0x | **Slow** | 🔴 Red |

### Real-World Examples

**Example 1: Fast System**
```
Recording Duration: 5 seconds
Total Pipeline Time: 12 seconds
Efficiency Ratio: 12 ÷ 5 = 2.4x (EXCELLENT)
```
EXCELLENT: This is great! Processing is quick relative to recording length.

**Example 2: Typical System**
```
Recording Duration: 10 seconds
Total Pipeline Time: 35 seconds
Efficiency Ratio: 35 ÷ 10 = 3.5x (GOOD)
```
GOOD: This is normal and acceptable. Standard system performance.

**Example 3: Slow System**
```
Recording Duration: 5 seconds
Total Pipeline Time: 60 seconds
Efficiency Ratio: 60 ÷ 5 = 12.0x (SLOW)
```
WARNING: System is struggling - might be low on resources or model is too heavy.

---

## Other Normalized Metrics

### Characters Per Second (Audio)
Shows the transcription density - how much text per second of audio.

```
If you speak: "The quick brown fox"
In: 2 seconds of audio
Characters: 20
Result: 10 chars/sec
```

**Interpretation:**
- 5-10 chars/sec = Normal speaking pace
- 10-15 chars/sec = Fast speaker
- <5 chars/sec = Slow speaker or lots of pauses

### Processing Time Per Word
How long LLM takes to process each word.

```
Processing Time: 500ms
Words in session: 20
Result: 25ms per word
```

**Interpretation:**
- 10-30ms/word = Good (fast LLM)
- 30-50ms/word = Acceptable
- 50ms+/word = Slow (consider lighter model)

---

## Interpreting Your Dashboard

### Example Dashboard Reading

```
Content Metrics:
- Total Characters: 1,234
- Total Words: 156
- Avg Words/Session: 19.5

Normalized Performance:
- Avg Recording Duration: 8.5 seconds
- Efficiency Ratio: 3.2x (GOOD)
- Chars Per Second: 15.2
- Processing Time Per Word: 22ms
```

**What this tells you:**
1. You're recording about 8-9 seconds at a time [OK]
2. Processing takes about 3.2x the recording time (GOOD for gemma3:4b) [OK]
3. You speak at ~15 chars/second (normal pace) [OK]
4. LLM processes at ~22ms per word (acceptable) [OK]

**Overall Assessment:** System is performing well!

---

## Troubleshooting with Metrics

### "My efficiency ratio is 15x - what's wrong?"

Possible causes:
1. **Heavy model** - You're using llama3:8b (too heavy)
   - Solution: Switch to gemma3:4b
2. **Low VRAM** - System is struggling, swapping to disk
   - Solution: Close other apps, or get more VRAM
3. **CPU bottleneck** - Whisper or LLM can't access GPU
   - Solution: Check NVIDIA driver, reinstall torch
4. **Ollama overloaded** - Multiple models or requests
   - Solution: Restart Ollama, free up resources

### "My efficiency ratio is 1.5x - am I getting too fast?"

That's actually **excellent** performance! Could mean:
- GPU is well-utilized
- Model is optimized (turbo version?)
- System has good resources

No action needed - enjoy the speed!

---

## Benchmarks for Different Models

### gemma3:4b (Current)
- **Expected Ratio:** 3-4x
- **Processing/word:** 20-30ms
- **Status:** Good balance

### llama3:8b
- **Expected Ratio:** 5-7x (slower)
- **Processing/word:** 40-60ms
- **Status:** Higher quality, slower

### mistral:7b
- **Expected Ratio:** 5-8x
- **Processing/word:** 45-65ms
- **Status:** Quality alternative

### phi3:3.8b
- **Expected Ratio:** 2-3x (faster!)
- **Processing/word:** 15-25ms
- **Status:** Lighter, good for weak systems

---

## Tips for Optimization

### If Efficiency Ratio > 5x

1. **Check System Resources**
   ```bash
   nvidia-smi  # GPU usage
   tasklist    # Running processes
   ```

2. **Try Lighter Model**
   - Switch from llama3:8b to gemma3:4b
   - Or try phi3:3.8b for even faster

3. **Restart Ollama**
   - Sometimes the service accumulates memory
   - Restart to clear it

### If Characters/Second is Very Low

1. You might be recording slowly (that's fine!)
2. Or lots of silence in recordings
3. Nothing wrong - just natural variation

---

## Summary

| Metric | What It Shows | Target | Unit |
|--------|---------------|--------|------|
| **Efficiency Ratio** | Overall speed | 3-5x | seconds |
| **Avg Recording Duration** | Your speech length | N/A | seconds |
| **Chars Per Second** | Speaking pace | 5-15 | chars |
| **Processing/Word** | LLM speed | 20-40 | milliseconds |

**Green means good!** 🟢 The dashboard colors change based on performance.
