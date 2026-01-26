# dIKtate History Tools Guide

Complete guide to using the history logging, query, and dashboard tools.

## Overview

Three complementary tools for working with dIKtate history:

| Tool | Purpose | Use Case |
|------|---------|----------|
| **history_manager.py** | Core database engine | Auto-integrated with app |
| **query_history.py** | CLI query tool | Quick stats, searching |
| **history_dashboard.py** | Web dashboard | Real-time monitoring |

---

## 1. Core Database (HistoryManager)

**Location:** `python/utils/history_manager.py`

### What It Does
- Automatically logs every recording to SQLite database
- Stores: timestamp, mode, models, raw/processed text, performance metrics, errors
- Non-blocking async writes (doesn't slow down the app)
- Auto-pruning (keeps 90 days of history)

### Automatic Integration
The history manager is **built into the app** - it starts automatically when you run `pnpm dev`.

### Database Location
```
C:\Users\{username}\.diktate\history.db
```

### No Configuration Needed
Just run the app and history is logged automatically!

---

## 2. CLI Query Tool (query_history.py)

**Location:** `python/tools/query_history.py`

### Purpose
Quick command-line access to history data without opening a browser.

### Quick Start

```bash
cd python
python tools/query_history.py --stats
```

### Commands

#### Show Overall Statistics
```bash
python tools/query_history.py --stats
```

**Output:**
```
Total Sessions:      8
Successful:          8
Failed:              0
Success Rate:        100.0%

Performance (avg for successful sessions):
  Transcription:     752ms
  Processing:        3221ms
  Total:             10836ms

Sessions by mode:
  Dictate            2 sessions
  Ask                2 sessions
  Refine             4 sessions
```

#### Search for Specific Phrase
```bash
python tools/query_history.py --search "python code"
```

Shows all sessions containing "python code" in the raw or processed text.

#### Show Error Sessions
```bash
python tools/query_history.py --errors
```

Lists all failed sessions with error messages.

#### Filter by Mode
```bash
python tools/query_history.py --mode dictate
python tools/query_history.py --mode ask
python tools/query_history.py --mode refine
```

#### Show Recent Sessions
```bash
python tools/query_history.py --recent 10
```

Shows the 10 most recent sessions across all modes.

#### Limit Results
All commands support `--limit`:
```bash
python tools/query_history.py --search "word" --limit 20
```

#### Custom Database Path
```bash
python tools/query_history.py --db /custom/path/history.db --stats
```

---

## 3. Web Dashboard (history_dashboard.py)

**Location:** `python/tools/history_dashboard.py`

### Purpose
Beautiful, real-time web dashboard for monitoring history.

### Quick Start

**Terminal 1 (Main App):**
```bash
pnpm dev
```

**Terminal 2 (Dashboard):**
```bash
cd python
python tools/history_dashboard.py
```

**Browser:**
Open http://localhost:8765

### Features

**Live Statistics**
- Total sessions counter
- Success rate (with visual indicator)
- Failure count (if any)
- Performance averages

**Mode Breakdown**
- Visual breakdown of Dictate/Ask/Refine sessions
- Quick reference for usage patterns

**Performance Metrics**
- Transcription time (Whisper)
- Processing time (LLM)
- Total pipeline time

**Beautiful Dark UI**
- Glassmorphism design
- Auto-refreshes every 5 seconds
- Responsive (works on phone/tablet)
- Smooth animations

### Using the Dashboard

1. Open http://localhost:8765 in your browser
2. View live statistics
3. Dashboard auto-refreshes every 5 seconds
4. No manual refresh needed

### API Endpoint

For external tools or integrations:

```bash
curl http://localhost:8765/api/stats
```

Returns JSON with all statistics.

### Customization

**Change Refresh Rate:**
Edit line in `history_dashboard.py`:
```python
setInterval(function() {
    location.reload();
}, 5000);  # Change 5000 to milliseconds you want
```

**Change Port:**
Edit bottom of `history_dashboard.py`:
```python
app.run(host='127.0.0.1', port=8765, debug=False)  # Change 8765
```

---

## Workflow Examples

### Example 1: Quick Session Check

After running the app for a while:

```bash
cd python
python tools/query_history.py --stats
```

Instantly see how many sessions you've done, success rate, and performance.

### Example 2: Debugging a Problem

Something went wrong. Find all errors:

```bash
python tools/query_history.py --errors
```

See exact error messages and when they occurred.

### Example 3: Searching for Specific Content

Need to find a particular dictation you did earlier:

```bash
python tools/query_history.py --search "the exact phrase you remember"
```

### Example 4: Performance Monitoring

Running the app throughout the day and want to monitor performance:

1. Start dashboard in a separate terminal
2. Open http://localhost:8765
3. Keep it in a browser tab
4. Watch performance metrics update in real-time

### Example 5: Finding Ask Mode Sessions

Want to see only your Q&A mode usage:

```bash
python tools/query_history.py --mode ask --limit 20
```

---

## Data Stored Per Session

Each session logs:

| Field | Example |
|-------|---------|
| timestamp | 2026-01-26T14:54:38.398Z |
| mode | dictate, ask, refine |
| transcriber_model | whisper-base |
| processor_model | gemma-2b |
| raw_text | literal whisper output |
| processed_text | cleaned/processed output |
| audio_duration_s | 2.5 |
| transcription_time_ms | 752 |
| processing_time_ms | 3221 |
| total_time_ms | 10836 |
| success | 1 (true) or 0 (false) |
| error_message | null or error details |

---

## Retention & Cleanup

**Auto-Pruning:**
- Runs on app startup
- Deletes records older than 90 days
- Prevents unlimited database growth

**Manual Pruning:**
From Python REPL:
```python
from utils.history_manager import HistoryManager
mgr = HistoryManager()
deleted = mgr.prune_history(days=30)  # Keep only 30 days
print(f"Deleted {deleted} records")
mgr.shutdown()
```

---

## Troubleshooting

### Dashboard won't start
```
Error: Address already in use
```
**Solution:** Port 8765 is in use. Either:
- Close other apps using that port
- Edit `history_dashboard.py` to use a different port (e.g., 8766)

### "No module named 'flask'"
**Solution:**
```bash
pip install flask==3.0.0
```

Or install all requirements:
```bash
pip install -r requirements.txt
```

### Dashboard shows "No data yet"
**Solution:**
- Run the main app first (`pnpm dev`)
- Do at least one dictation
- Then check the dashboard

### Can't find query_history.py
**Solution:**
Make sure you're in the correct directory:
```bash
cd python
python tools/query_history.py --stats
```

### Database "locked" error
**Solution:**
- Only one app instance can write at a time
- Make sure you don't have multiple copies of the app running
- Close both and restart

---

## Performance Notes

**Database Size:**
- Each session: ~200-500 bytes
- 90 days of 50 sessions/day = ~1MB

**Query Performance:**
- Stats query: <50ms
- Search query: <100ms for 1000 records
- API endpoint: <200ms including render

**No Performance Impact:**
- Async writes use background thread
- Doesn't block the main dictation pipeline
- Target: <10ms added latency (actual: ~2-3ms)

---

## Privacy & Security

**Default Behavior:**
- Raw transcriptions are stored in the local SQLite database
- No data is sent anywhere
- No cloud sync

**Privacy Flag:**
If you set `DIKTATE_DEBUG_UNSAFE` environment variable to anything other than "1", text might be redacted (controlled by app security settings).

**Database Location:**
All data is in `~/.diktate/history.db` - completely local and under your control.

---

## Tips & Tricks

### Tip 1: Monitor Performance Over Time
Run the dashboard while you work to see performance trends:
```
Morning:  processing = 2800ms
Afternoon: processing = 3200ms (Ollama getting slower)
```

### Tip 2: Quick Error Check
```bash
python tools/query_history.py --errors --limit 5
```
See your 5 most recent errors.

### Tip 3: Usage Patterns
```bash
python tools/query_history.py --mode ask
python tools/query_history.py --mode dictate
python tools/query_history.py --mode refine
```
Compare which modes you use most.

### Tip 4: Batch Searching
```bash
python tools/query_history.py --search "error message" --limit 100
```
Find all sessions that contain specific error text.

---

## Advanced: Custom Queries

If you want to do custom SQL queries on the database:

```bash
sqlite3 C:\Users\{username}\.diktate\history.db
```

Then run SQL:
```sql
SELECT COUNT(*) FROM history WHERE success = 1;
SELECT AVG(total_time_ms) FROM history WHERE mode = 'ask';
SELECT * FROM history WHERE error_message IS NOT NULL LIMIT 5;
```

---

## Summary

- **history_manager.py**: Runs automatically, logs everything
- **query_history.py**: Quick CLI queries
- **history_dashboard.py**: Beautiful real-time web dashboard

Pick whichever tool fits your workflow best!
