# Ollama Auto-Start & Restart Implementation

> **Implemented:** 2026-01-19 19:07
> **Status:** ✅ Complete

## Changes Made

### 1. Auto-Start & Warmup (Python Backend)
**File:** `python/ipc_server.py` (after line 109)

**Function:** `_ensure_ollama_ready()`
- Checks if Ollama is running on startup
- Attempts to start Ollama if not running
- Warms up the default model (gemma3:4b) to prevent cold-start delays
- **Fallback:** Non-blocking, logs warnings if fails, continues with cloud mode

**Behavior:**
```
App Start → Check Ollama → Start if needed → Warm up model → Ready
```

---

### 2. Restart Button (Settings UI)
**File:** `src/settings.html` (after line 414)

**Added Section:** "Service Control"
- Button: "🔄 Restart Ollama" - Kills and restarts the service
- Button: "🔥 Warm Up Current Model" - Loads model into memory
- Status display for user feedback

---

### 3. Frontend Logic (Settings JS)
**File:** `src/settings.ts` (end of file)

**Functions Added:**
- `restartOllama()` - Calls IPC to restart service, shows status
- `warmupModel()` - Calls IPC to warm up model, shows status
- Both exposed to global scope for onclick handlers

---

### 4. IPC Bridge (Preload)
**File:** `src/preloadSettings.ts` (line 52-53)

**Methods Added:**
- `restartOllama()` → `ipcRenderer.invoke('ollama:restart')`
- `warmupOllamaModel()` → `ipcRenderer.invoke('ollama:warmup')`

---

### 5. Backend Handlers (Main Process)
**File:** `src/main.ts` (after line 900)

**IPC Handlers Added:**

#### `ollama:restart`
1. Kills existing `ollama.exe` process
2. Waits 2 seconds
3. Starts new Ollama service
4. Waits 3 seconds for startup
5. Verifies it's running
6. Returns success/failure

#### `ollama:warmup`
1. Gets default model from settings
2. Sends empty prompt to load model
3. Sets `keep_alive: 10m` to keep in memory
4. Returns success with model name

---

## Fallback Strategy

**All operations are fail-safe:**
- Auto-start fails → Logs warning, continues (cloud mode works)
- Restart fails → Shows error in UI, user can manually restart
- Warmup fails → Logs warning, will retry on first dictation
- Ollama not in PATH → Error message, user must install

---

## User Experience

### On App Start:
```
[STARTUP] Ollama is already running
[STARTUP] Warming up gemma3:4b...
[STARTUP] Model gemma3:4b ready and cached
```

### In Settings (Ollama Tab):
```
Service Control
├── 🔄 Restart Ollama
└── 🔥 Warm Up Current Model
    └── Status: ✓ Model gemma3:4b is ready
```

---

## Testing

**To test:**
1. Close Ollama manually
2. Start dIKtate → Check logs for auto-start
3. Open Settings → Ollama tab
4. Click "Warm Up" → Should show success
5. Click "Restart" → Should kill and restart service

**Expected behavior:**
- First dictation after warmup: ~450ms processing
- Without warmup: 15-30s cold start (one time)
- After restart: Model reloads, fast again

---

## Files Modified

| File | Lines Changed | Purpose |
|------|---------------|---------|
| `python/ipc_server.py` | +66 | Auto-start & warmup on app launch |
| `src/settings.html` | +11 | UI buttons for restart/warmup |
| `src/settings.ts` | +61 | Frontend logic for buttons |
| `src/preloadSettings.ts` | +4 | IPC bridge methods |
| `src/main.ts` | +82 | Backend IPC handlers |

**Total:** ~224 lines added

---

## Next Steps

1. ✅ Compile TypeScript
2. ✅ Test auto-start (close Ollama, start app)
3. ✅ Test restart button
4. ✅ Test warmup button
5. ✅ Verify logs show correct behavior
