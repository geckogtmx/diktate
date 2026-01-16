# Quick Start - Phase 1 Testing

## Prerequisites

✅ Already done:
- Python 3.12 installed
- Virtual environment created at `python/venv/`
- All dependencies installed
- Whisper model will download on first run (~3.1 GB)

## Setup Verification (5 minutes)

Run this to verify everything is installed:

```bash
cd python
source venv/Scripts/activate  # On Windows: venv\Scripts\activate
python verify_setup.py
```

Expected output: `[SUCCESS] All checks passed!`

---

## Test Checkpoint 1: Record → Transcribe (10-15 minutes)

### Option A: Run Integration Tests

```bash
cd python
source venv/Scripts/activate
pip install -r requirements.txt  # Add pytest if not included
pytest ../tests/test_integration_cp1.py -v -s
```

This tests:
- Recorder initialization
- Transcriber model loading
- Audio file saving
- Basic transcription

### Option B: Manual Recording Test

```bash
cd python
source venv/Scripts/activate

# This will download Whisper model on first run (3.1 GB)
python -c "
from core import Recorder, Transcriber
import time

# Create recorder
recorder = Recorder()
recorder.start()
print('Recording for 5 seconds...')
time.sleep(5)
recorder.stop()

# Save recording
recorder.save_to_file('test_recording.wav')

# Transcribe
print('Transcribing...')
transcriber = Transcriber(model_size='medium', device='auto')
text = transcriber.transcribe('test_recording.wav')
print(f'Result: {text}')
"
```

---

## Test Checkpoint 2: Full End-to-End (5-10 minutes)

### Prerequisites for Checkpoint 2

1. **Install Ollama** (recommended but optional):
   ```bash
   # Download from https://ollama.ai
   # Then in a separate terminal:
   ollama pull llama3:8b
   ollama serve
   ```

2. **Verify Ollama is running:**
   ```bash
   # In another terminal:
   curl http://localhost:11434/api/tags
   ```

### Run Main Pipeline

```bash
cd python
source venv/Scripts/activate

# Start recording/processing service
python main.py
```

The output should show:
```
============================================================
dIKtate is running
Press Ctrl+Shift+Space to start recording
Release to stop and process
============================================================
```

### Test the Hotkey

1. Open **Notepad** (or VS Code, Word, etc.)
2. Click in the text editor to focus it
3. **Press and hold Ctrl+Shift+Space**
4. **Speak clearly** (e.g., "Hello, this is a test")
5. **Release** Ctrl+Shift+Space

Expected behavior:
- Console shows `🎤 Recording started - speak now`
- Say something clear (5-10 seconds)
- Release the hotkey
- Console shows transcription: `Transcribed: ...`
- If Ollama is running: Shows processed text with cleanup
- Text appears in Notepad automatically

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "Ollama not found" warning | Install Ollama or run with text processing skipped |
| No text appears | Check microphone is selected and working |
| Slow transcription (30+ seconds) | Expected on CPU; GPU needed for <5 second latency |
| Whisper model not found | First run downloads 3.1 GB; wait for completion |
| Hotkey not working | Try focus app first, may need admin privileges |

---

## File Locations

### Core modules (fully implemented):
- `python/core/recorder.py` - Microphone recording
- `python/core/transcriber.py` - Whisper transcription
- `python/core/processor.py` - Ollama text cleanup
- `python/core/injector.py` - Keyboard text injection
- `python/main.py` - Pipeline orchestration

### Logs:
- `logs/diktate.log` - Full execution log (check here for errors)

### Tests:
- `tests/test_integration_cp1.py` - Integration test suite

---

## Expected Performance

### CPU Mode (Current)
- **Whisper transcription:** 30-60 seconds for 5 seconds of audio
- **Text processing:** 5-10 seconds (if Ollama running)
- **Total E2E time:** 40-80 seconds

### With GPU (Optional)
- **Whisper transcription:** 2-3 seconds
- **Text processing:** 2-3 seconds
- **Total E2E time:** ~5-10 seconds (target: <15 seconds)

See `CUDA_SETUP.md` for GPU installation.

---

## Success Criteria Checklist

- [ ] Setup verification passes
- [ ] Checkpoint 1: Recorder → Transcriber works
- [ ] Checkpoint 1: Audio file saved correctly
- [ ] Checkpoint 2: Hotkey listener activates
- [ ] Checkpoint 2: Recording captures audio
- [ ] Checkpoint 2: Text appears in application
- [ ] Checkpoint 2: No crashes during 5-minute test
- [ ] Optional: Ollama text processing works

---

## Next Steps After Testing

If all tests pass:
1. Proceed to **Phase 2: Electron Shell**
2. Set up Node.js project
3. Implement system tray icon
4. Connect Electron to Python backend

---

## Support

For issues:
1. Check `logs/diktate.log` for error messages
2. Run `python verify_setup.py` to verify installation
3. See `CUDA_SETUP.md` for GPU issues
4. See `ARCHITECTURE.md` for system design

---

**Status:** Phase 1 complete, ready for testing ✅
