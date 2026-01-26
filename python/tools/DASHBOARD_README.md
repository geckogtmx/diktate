# dIKtate History Dashboard

A real-time, dark-mode dashboard for monitoring your dIKtate history and performance metrics.

## Features

**Live Statistics**
- Total sessions logged
- Success rate tracking
- Failed session count
- Performance averages (transcription, processing, total time)

**Mode Breakdown**
- Sessions per recording mode (Dictate, Ask, Refine)
- Quick overview of what you've been using

**Performance Metrics**
- Avg transcription time (Whisper)
- Avg processing time (LLM)
- Avg total pipeline time
- Normalized efficiency ratios accounting for recording length
- Real-time updates every 5 seconds

**System Resources**
- Real-time CPU utilization
- System memory usage and availability
- GPU memory allocation (if CUDA available)
- Color-coded resource health indicators

**Design**
- Dark mode with glassmorphism effects
- Responsive layout (works on desktop and mobile)
- Smooth animations and transitions
- Gradient accents

## Quick Start

### Prerequisites
Flask must be installed:
```bash
pip install -r requirements.txt
```

Or install Flask directly:
```bash
pip install flask==3.0.0
```

### Running the Dashboard

1. **Start the app normally:**
   ```bash
   pnpm dev
   ```

2. **In a separate terminal, start the dashboard:**
   ```bash
   cd python
   python tools/history_dashboard.py
   ```

3. **Open your browser:**
   Navigate to `http://localhost:8765`

The dashboard will automatically refresh every 5 seconds to show the latest stats.

## Using the Dashboard

### Main View
The dashboard displays:
- **Total Sessions**: All-time count of recorded sessions
- **Success Rate**: Percentage of successful vs failed sessions
- **Avg Processing**: Average LLM processing time
- **Avg Total Time**: End-to-end pipeline time
- **Failures** (if any): Number and percentage of failed sessions

### Sessions by Mode
Shows a breakdown of how many times you've used each recording mode:
- Dictate (normal dictation)
- Ask (Q&A mode)
- Refine (text refinement)

### Performance Metrics
Detailed performance averages:
- Whisper transcription latency
- LLM processing latency
- Total end-to-end time

### System Resources (Current)
Real-time system resource monitoring:
- **CPU Usage**: Current processor utilization percentage
- **System Memory**: RAM usage in GB and percentage
- **GPU Memory** (if available): VRAM allocation with device name
- Color-coded bars: Green (<50%), Orange (50-80%), Red (>80%)

## API Endpoint

For integrations, a JSON API is available:

```bash
curl http://localhost:8765/api/stats
```

Returns:
```json
{
  "total_sessions": 8,
  "successful_sessions": 8,
  "failed_sessions": 0,
  "success_rate": 100.0,
  "avg_transcription_ms": 752.0,
  "avg_processing_ms": 3221.0,
  "avg_total_ms": 10836.0,
  "by_mode": {
    "dictate": 2,
    "ask": 2,
    "refine": 4
  }
}
```

## Stopping the Dashboard

Press `Ctrl+C` in the terminal where you started the dashboard.

## Understanding System Resources

### CPU Usage
- **0-50%**: Healthy, plenty of available CPU
- **50-80%**: Moderate usage, system responsive
- **80-100%**: High usage, may impact performance

### System Memory
- **0-50%**: Healthy, lots of available RAM
- **50-80%**: Moderate usage, system still responsive
- **80-100%**: Critical, system may slow down or use disk swap

### GPU Memory
- Only shown if CUDA/GPU is available
- Similar thresholds as system memory
- Important for ML inference performance

**Note:** If efficiency ratio is high and GPU memory is available but not being used, your system may not have GPU acceleration enabled for Whisper/LLM models.

## Troubleshooting

**"Address already in use"**
- Another app is using port 8765
- Change the port in the script: `app.run(host='127.0.0.1', port=8766, ...)`

**"No module named 'flask'"**
- Install dependencies: `pip install -r requirements.txt`

**"Database not found"**
- The database is created when you first run the app
- Do some dictations first, then check the dashboard

## Future Enhancements

Planned features:
- [ ] Charts and trend analysis
- [ ] Error log viewer
- [ ] Search history interface
- [ ] Export to CSV/JSON
- [ ] Performance threshold alerts
- [ ] Daily/weekly statistics

## Technical Details

- **Framework**: Flask 3.0.0
- **Database**: SQLite (via HistoryManager)
- **Frontend**: Vanilla HTML/CSS/JS
- **Port**: 8765 (localhost only)
- **Refresh Rate**: 5 seconds

## Notes

- The dashboard is read-only and doesn't modify the database
- Auto-refresh can be disabled by removing/commenting the `<script>` section in the HTML
- The dashboard connects to the same database as the main app (no conflicts)
