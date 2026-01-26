# App Health Dashboard Card

## Overview

New dashboard section showing app startup and health status. Distinguishes between **app sessions** (app startup-to-shutdown) and **recordings** (individual dictate/ask/refine actions).

## What's Displayed

### Metrics Cards
1. **Uptime** - Time since app started (inferred from first recording today)
   - Format: "2h 15m" or "45m"

2. **Recordings This Run** - Count of dictations/ask/refine actions since startup
   - Clarifies we're counting individual recording actions, not app sessions
   - Format: "42 completed"

3. **Last Started** - When the app was started
   - Format: "3:29 PM"

### Component Status Indicators
Shows health of four key components:

| Component | Status | Meaning |
|-----------|--------|---------|
| **Whisper** | OK (green) / FAIL (red) | Transcription engine |
| **Ollama** | OK (green) / FAIL (red) | LLM backend (via HTTP ping) |
| **GPU** | OK (green) / NONE (gray) | GPU acceleration availability |
| **Mute Detect** | OK (green) / NONE (gray) | Mute detection system |

## How It Works

### Data Sources

**Startup Time Inference:**
- Queries history table for first recording of the day
- Assumes app started ~1 minute before first recording
- Falls back to dashboard startup time if no recordings today

**Recording Count:**
- Simple SQL: `COUNT(*) FROM history WHERE timestamp >= startup_time`
- Only counts successful recordings
- Resets each app startup (new session)

**Component Health:**
- **Whisper**: Assumed healthy (if dashboard running, Whisper initialized)
- **Ollama**: HTTP GET to `localhost:11434/api/tags` with 1-second timeout
- **GPU**: From SystemMonitor.get_snapshot()['gpu_available']
- **Mute Detector**: Assumed healthy (no error-checking mechanism)

### Terminology

**Important distinction:**
- **Session** = One complete app startup-to-shutdown cycle
- **Recording** = Individual dictate/ask/refine action
- Dashboard shows "Recordings This Run" = recordings since this session started

## Code Changes

File modified: `python/tools/history_dashboard.py`

**New Functions:**
- `get_app_startup_time(manager)` - Infer app startup from first recording
- `get_app_health_metrics(manager, system_monitor)` - Calculate all health metrics

**Updated Functions:**
- `dashboard()` route - Now calls `get_app_health_metrics()` and passes to template

**HTML/CSS:**
- New `App Health (Current Session)` section with glassmorphism cards
- Component status indicators with color coding (green/red/gray)
- Matches existing dashboard styling

## Testing

### Test 1: Dashboard Starts
```bash
cd python
python tools/history_dashboard.py
# Open http://localhost:8765
# Verify "App Health" card appears below System Resources
```

### Test 2: Metrics Display
- Uptime shows correct format (e.g., "1h 23m" or "47m")
- Recordings count is 0 if fresh start, increments with each recording
- Last Started shows current time on fresh start

### Test 3: Component Health
- All components show "OK" when system is healthy
- Stop Ollama service → refresh dashboard → Ollama shows "FAIL"
- Restart Ollama → refresh dashboard → Ollama shows "OK"
- GPU shows "OK" if CUDA available, "NONE" otherwise

### Test 4: Uptime Format
- Runs for 90+ minutes → should show "1h 30m+" format
- Less than 1 hour → shows "45m" format

## Limitations

1. **Uptime tracks dashboard uptime** not app uptime
   - Dashboard may restart independently from app
   - Acceptable: Dashboard typically runs alongside app
   - Mitigation: Startup time inferred from first recording

2. **Ollama check adds ~100ms per refresh**
   - Acceptable: 5-second refresh interval masks this
   - No noticeable impact to dashboard responsiveness

3. **Mute Detector status is assumed**
   - Always shows "OK" - no error-checking mechanism
   - Could be improved with IPC integration (future)

## Future Enhancements

- Persist startup data to SQLite `app_sessions` table
- Track actual app startup latency (time to ready)
- Cache Ollama health check (every 30s instead of 5s)
- Add error categorization (network vs model vs mute)
- Historical app session tracking

## Files Modified

- `python/tools/history_dashboard.py` - Added 3 functions + HTML section
- No database schema changes
- No changes to core app
