# Troubleshooting Guide

> **Purpose:** Self-service debugging for common diktate performance and configuration issues.

---

## 🐌 Slow Inference (>2000ms Processing Time)

### Symptoms
- Processing time >2000ms (should be <500ms for local models)
- Long delays between dictation and text appearing
- Logs show warnings about slow inference

### Root Cause: GPU Not Being Used

**Most common issue:** Ollama is using CPU instead of GPU for inference, causing 7-10x slowdown.

**Expected Performance:**
- **GPU Inference:** 300-500ms processing time (~50-100 tokens/sec)
- **CPU Inference:** 2500-3500ms processing time (~5-10 tokens/sec)

### Diagnosis Steps

#### Step 1: Check GPU Usage During Dictation

**Windows:**
```powershell
# Terminal 1: Monitor GPU in real-time
nvidia-smi dmon -s pucvmet -c 20

# Terminal 2: Run diktate and dictate something
```

**What to look for:**
- **GPU active (GOOD):**
  - GPU utilization jumps to 80-100%
  - Power draw rises to 80-120W
  - GPU clocks: 1500-2000 MHz
  - Temperature rises to 50-70°C

- **CPU fallback (BAD - Current Issue):**
  - GPU stays at 0-5% utilization
  - Power draw stays at ~10W
  - GPU clocks stay at ~200MHz
  - Temperature stays at ~30°C

#### Step 2: Check Startup Logs

```bash
# Check diktate logs for GPU health check
tail -f ~/.diktate/logs/diktate_*.log | grep -i "GPU"

# Look for:
# ✅ [STARTUP] GPU ACTIVE: 67.3 tok/s  <-- GOOD
# ⚠️ [STARTUP] GPU NOT DETECTED! Only 8.2 tok/s  <-- BAD
```

#### Step 3: Check Database Performance Metrics

```sql
sqlite3 ~/.diktate/history.db "SELECT datetime(timestamp), processing_time_ms, tokens_per_sec FROM history WHERE provider='local' ORDER BY timestamp DESC LIMIT 10;"

# Expected tokens_per_sec:
# GPU: >50 tok/s
# CPU: <10 tok/s
```

### Fix #1: Restart Ollama with GPU Environment

**Stop Ollama:**
```bash
# Windows
taskkill /F /IM ollama.exe

# Linux/Mac
pkill ollama
```

**Set GPU environment variables:**
```bash
# Windows (PowerShell)
$env:CUDA_VISIBLE_DEVICES="0"
$env:OLLAMA_GPU_OVERHEAD="0"

# Linux/Mac (Bash)
export CUDA_VISIBLE_DEVICES=0
export OLLAMA_GPU_OVERHEAD=0
```

**Start Ollama:**
```bash
ollama serve
```

**Test inference:**
```bash
ollama run gemma3:4b "This is a GPU test"
# Watch for tokens/sec output - should be >50 tok/s
```

### Fix #2: Verify CUDA Installation

**Check if NVIDIA GPU is detected:**
```bash
nvidia-smi
```

**Check if CUDA is installed:**
```bash
# Windows
nvcc --version

# Linux
ldconfig -p | grep cuda
```

**If CUDA is missing:**
- Download from: https://developer.nvidia.com/cuda-downloads
- Restart after installation
- Restart Ollama

### Fix #3: Re-pull Model (Nuclear Option)

If model was cached without GPU support:

```bash
# Remove model
ollama rm gemma3:4b

# Re-download with fresh GPU quantization
ollama pull gemma3:4b

# Verify
ollama run gemma3:4b "test" --verbose
```

### Fix #4: Check Ollama Logs

**Find Ollama logs (Windows):**
```powershell
# Common locations:
dir $env:LOCALAPPDATA\Ollama\logs\
dir $env:TEMP\ollama\
dir "C:\Program Files\Ollama\logs\"
```

**Linux/Mac:**
```bash
journalctl -u ollama -f  # If systemd service
cat ~/.ollama/logs/server.log
```

**What to look for:**
- "CUDA initialization failed"
- "Falling back to CPU"
- "No GPU devices found"

---

## 🎤 Microphone Issues

### Symptoms
- "Microphone is muted" error on startup
- No audio captured
- Wrong device being used

### Fix: Check Device Selection

**View available devices:**
```bash
# Check environment variable
echo $AUDIO_DEVICE_LABEL

# List devices (requires PyAudio)
python -c "import pyaudio; p=pyaudio.PyAudio(); [print(f'{i}: {p.get_device_info_by_index(i)[\"name\"]}') for i in range(p.get_device_count())]"
```

**Set device:**
```bash
# .env file
AUDIO_DEVICE_LABEL="Your Microphone Name"
```

### Fix: Unmute Microphone

**Windows:**
1. Right-click speaker icon → Sound Settings
2. Input → Select your microphone
3. Ensure not muted
4. Restart diktate

**Check mute detection:**
```bash
# Logs will show mute status
tail -f ~/.diktate/logs/diktate_*.log | grep -i "mute"
```

---

## 📊 Performance Monitoring

### Check Historical Performance

**Query database for trends:**
```sql
sqlite3 ~/.diktate/history.db

-- Daily average processing times
SELECT
    date(timestamp) as day,
    provider,
    COUNT(*) as sessions,
    AVG(processing_time_ms) as avg_ms,
    MIN(processing_time_ms) as min_ms,
    MAX(processing_time_ms) as max_ms,
    AVG(tokens_per_sec) as avg_tok_s
FROM history
WHERE provider='local'
GROUP BY day, provider
ORDER BY day DESC
LIMIT 7;
```

**Check for GPU fallback sessions:**
```sql
-- Find sessions with suspiciously slow GPU performance
SELECT
    datetime(timestamp),
    processing_time_ms,
    tokens_per_sec
FROM history
WHERE provider='local'
    AND tokens_per_sec < 20  -- Likely CPU fallback
ORDER BY timestamp DESC
LIMIT 20;
```

### Real-time Performance Monitoring

**Watch inference logs:**
```bash
tail -f ~/.diktate/logs/diktate_*.log | grep -E "tok/s|SLOW INFERENCE|GPU"
```

**Monitor GPU while dictating:**
```bash
# Continuous monitoring
nvidia-smi dmon -s pucvmet

# Single snapshot
nvidia-smi
```

---

## 🔧 Advanced Diagnostics

### Collect System State for Bug Reports

**Capture full diagnostic snapshot:**
```bash
# GPU state
nvidia-smi --query-gpu=name,driver_version,memory.total,memory.used,temperature.gpu,power.draw --format=csv > gpu_state.txt

# Ollama models
ollama ps >> gpu_state.txt

# Ollama model details
ollama show gemma3:4b --modelfile >> gpu_state.txt

# Recent inference performance
sqlite3 ~/.diktate/history.db "SELECT datetime(timestamp), processing_time_ms, tokens_per_sec FROM history WHERE provider='local' ORDER BY timestamp DESC LIMIT 20;" >> gpu_state.txt

# diktate logs (last 100 lines)
tail -100 ~/.diktate/logs/diktate_*.log >> diktate_recent.log
```

**Include in bug report:**
- `gpu_state.txt`
- `diktate_recent.log`
- Description of when issue started
- Steps to reproduce

---

## 📚 Related Documentation

- [HOTFIX_002.md](../HOTFIX_002.md) - GPU Fallback Investigation
- [BENCHMARKS.md](./internal/benchmarks/BENCHMARKS.md) - Expected Performance Baselines
- [DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md) - Feature Status

---

## 🆘 Getting Help

If these fixes don't resolve your issue:

1. **Check GitHub Issues:** https://github.com/your-repo/diktate/issues
2. **Create a new issue with:**
   - Output from diagnostic snapshot above
   - Operating system and GPU model
   - Exact error messages from logs
3. **Include `HOTFIX_002` in title if performance-related**

---

*Last Updated: 2026-02-01 (HOTFIX_002: GPU Fallback Detection)*
