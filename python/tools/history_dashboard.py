#!/usr/bin/env python3
"""
Real-time history dashboard for dIKtate.
Displays key metrics from the SQLite history database.
Runs on http://localhost:8765

Usage:
  python history_dashboard.py
"""

import sys
import json
import logging
import sqlite3
from pathlib import Path
from datetime import datetime, timedelta
from flask import Flask, render_template_string
import threading
import time

logger = logging.getLogger(__name__)

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.history_manager import HistoryManager

app = Flask(__name__)
manager = None
system_monitor = None
DASHBOARD_STARTUP_TIME = datetime.now()

# HTML Template - Dark Mode Dashboard
DASHBOARD_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>dIKtate History Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
            color: #e0e0e0;
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid rgba(255, 255, 255, 0.1);
        }

        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .header p {
            color: #999;
            font-size: 0.95em;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 25px;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
        }

        .card:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.2);
            transform: translateY(-4px);
        }

        .card-label {
            font-size: 0.85em;
            color: #999;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
        }

        .card-value {
            font-size: 2.5em;
            font-weight: 600;
            color: #fff;
            margin-bottom: 5px;
        }

        .card-meta {
            font-size: 0.8em;
            color: #666;
        }

        .card.success {
            border-color: rgba(76, 175, 80, 0.3);
        }

        .card.warning {
            border-color: rgba(255, 193, 7, 0.3);
        }

        .card.error {
            border-color: rgba(244, 67, 54, 0.3);
        }

        .modes-section {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 25px;
            backdrop-filter: blur(10px);
            margin-bottom: 30px;
        }

        .modes-section h2 {
            font-size: 1.3em;
            margin-bottom: 20px;
            color: #fff;
        }

        .mode-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .mode-item:last-child {
            border-bottom: none;
        }

        .mode-name {
            font-weight: 500;
            color: #e0e0e0;
        }

        .mode-count {
            font-size: 1.5em;
            font-weight: 600;
            color: #667eea;
        }

        .performance-section {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 25px;
            backdrop-filter: blur(10px);
        }

        .performance-section h2 {
            font-size: 1.3em;
            margin-bottom: 20px;
            color: #fff;
        }

        .perf-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .perf-row:last-child {
            border-bottom: none;
        }

        .perf-label {
            color: #999;
        }

        .perf-value {
            color: #667eea;
            font-weight: 600;
            font-family: 'Courier New', monospace;
        }

        .metric-bar {
            display: flex;
            align-items: center;
            gap: 15px;
            margin: 10px 0;
        }

        .metric-bar-label {
            flex: 0 0 120px;
            color: #999;
            font-size: 0.9em;
        }

        .metric-bar-container {
            flex: 1;
            height: 20px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .metric-bar-fill {
            height: 100%;
            transition: width 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: 8px;
            font-size: 0.75em;
            font-weight: 600;
            color: white;
        }

        .metric-bar-fill.good {
            background: linear-gradient(90deg, #4caf50, #45a049);
        }

        .metric-bar-fill.warning {
            background: linear-gradient(90deg, #ff9800, #e68900);
        }

        .metric-bar-fill.critical {
            background: linear-gradient(90deg, #f44336, #da190b);
        }

        .metric-value {
            flex: 0 0 60px;
            text-align: right;
            color: #e0e0e0;
            font-weight: 600;
            font-family: 'Courier New', monospace;
        }

        .system-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 15px;
            margin-bottom: 15px;
        }

        .system-card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            padding: 15px;
        }

        .system-card-title {
            font-size: 0.85em;
            color: #999;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
        }

        .system-card-value {
            font-size: 1.8em;
            font-weight: 600;
            color: #fff;
            margin-bottom: 3px;
        }

        .system-card-unit {
            font-size: 0.8em;
            color: #666;
        }

        .refresh-info {
            text-align: center;
            margin-top: 40px;
            color: #666;
            font-size: 0.9em;
        }

        .status-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 8px;
            background: #4caf50;
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 1.8em;
            }

            .card-value {
                font-size: 2em;
            }

            .grid {
                grid-template-columns: 1fr;
            }
        }

        /* Animations */
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }

        .updating {
            animation: pulse 1s ease-in-out;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>dIKtate History</h1>
            <p><span class="status-indicator"></span>Live Statistics Dashboard</p>
        </div>

        <div class="grid">
            <div class="card success">
                <div class="card-label">Total Sessions</div>
                <div class="card-value">{{ stats.total_sessions }}</div>
                <div class="card-meta">all time</div>
            </div>

            <div class="card success">
                <div class="card-label">Success Rate</div>
                <div class="card-value">{{ stats.success_rate }}%</div>
                <div class="card-meta">{{ stats.successful_sessions }}/{{ stats.total_sessions }} successful</div>
            </div>

            <div class="card">
                <div class="card-label">Avg Processing</div>
                <div class="card-value">{{ stats.avg_processing_ms }}ms</div>
                <div class="card-meta">LLM time</div>
            </div>

            <div class="card">
                <div class="card-label">Avg Total Time</div>
                <div class="card-value">{{ (stats.avg_total_ms / 1000)|round(1) }}s</div>
                <div class="card-meta">end-to-end</div>
            </div>

            {% if stats.failed_sessions > 0 %}
            <div class="card warning">
                <div class="card-label">Failures</div>
                <div class="card-value">{{ stats.failed_sessions }}</div>
                <div class="card-meta">{{ (stats.failed_sessions / stats.total_sessions * 100)|round(1) }}% failure rate</div>
            </div>
            {% endif %}
        </div>

        <div class="modes-section">
            <h2>Sessions by Mode</h2>
            {% for mode, count in stats.by_mode.items() %}
            <div class="mode-item">
                <span class="mode-name">{{ mode|capitalize }}</span>
                <span class="mode-count">{{ count }}</span>
            </div>
            {% endfor %}
            {% if not stats.by_mode %}
            <div class="mode-item">
                <span class="mode-name" style="color: #666;">No sessions yet</span>
            </div>
            {% endif %}
        </div>

        <div class="performance-section">
            <h2>Performance Metrics (Averages)</h2>
            <div class="perf-row">
                <span class="perf-label">Transcription (Whisper)</span>
                <span class="perf-value">{{ stats.avg_transcription_ms }}ms</span>
            </div>
            <div class="perf-row">
                <span class="perf-label">Processing (LLM)</span>
                <span class="perf-value">{{ stats.avg_processing_ms }}ms</span>
            </div>
            <div class="perf-row">
                <span class="perf-label">Total Pipeline</span>
                <span class="perf-value">{{ (stats.avg_total_ms / 1000)|round(2) }}s</span>
            </div>
        </div>

        {% if system_resources %}
        <div class="performance-section">
            <h2>System Resources (Current)</h2>
            <div class="system-grid">
                <div class="system-card">
                    <div class="system-card-title">CPU Usage</div>
                    <div class="system-card-value">{{ system_resources.cpu_percent }}%</div>
                    <div class="system-card-unit">of available processors</div>
                    <div class="metric-bar">
                        <div class="metric-bar-container" style="flex: 1;">
                            <div class="metric-bar-fill {% if system_resources.cpu_percent <= 50 %}good{% elif system_resources.cpu_percent <= 80 %}warning{% else %}critical{% endif %}"
                                 style="width: {{ system_resources.cpu_percent }}%;">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="system-card">
                    <div class="system-card-title">System Memory</div>
                    <div class="system-card-value">{{ system_resources.memory_used_gb }}GB / {{ system_resources.memory_total_gb }}GB</div>
                    <div class="system-card-unit">{{ system_resources.memory_percent }}% utilized</div>
                    <div class="metric-bar">
                        <div class="metric-bar-container" style="flex: 1;">
                            <div class="metric-bar-fill {% if system_resources.memory_percent <= 50 %}good{% elif system_resources.memory_percent <= 80 %}warning{% else %}critical{% endif %}"
                                 style="width: {{ system_resources.memory_percent }}%;">
                            </div>
                        </div>
                    </div>
                </div>

                {% if system_resources.gpu_available %}
                <div class="system-card">
                    <div class="system-card-title">GPU Memory ({{ system_resources.gpu_device_name }})</div>
                    <div class="system-card-value">{{ system_resources.gpu_memory_used_gb }}GB / {{ system_resources.gpu_memory_total_gb }}GB</div>
                    <div class="system-card-unit">{{ system_resources.gpu_memory_percent }}% allocated</div>
                    <div class="metric-bar">
                        <div class="metric-bar-container" style="flex: 1;">
                            <div class="metric-bar-fill {% if system_resources.gpu_memory_percent <= 50 %}good{% elif system_resources.gpu_memory_percent <= 80 %}warning{% else %}critical{% endif %}"
                                 style="width: {{ system_resources.gpu_memory_percent }}%;">
                            </div>
                        </div>
                    </div>
                </div>
                {% else %}
                <div class="system-card">
                    <div class="system-card-title">GPU Status</div>
                    <div class="system-card-value" style="color: #999;">Not Available</div>
                    <div class="system-card-unit">CUDA/GPU not detected</div>
                </div>
                {% endif %}
            </div>
        </div>
        {% endif %}

        {% if app_health %}
        <div class="performance-section" style="margin-top: 30px;">
            <h2>App Health (Current Session)</h2>

            <div class="system-grid">
                <div class="system-card">
                    <div class="system-card-title">Uptime</div>
                    <div class="system-card-value">{{ app_health.uptime_str }}</div>
                    <div class="system-card-unit">since last start</div>
                </div>

                <div class="system-card">
                    <div class="system-card-title">Recordings This Run</div>
                    <div class="system-card-value">{{ app_health.recordings_this_run }}</div>
                    <div class="system-card-unit">completed</div>
                </div>

                <div class="system-card">
                    <div class="system-card-title">Last Started</div>
                    <div class="system-card-value">{{ app_health.last_started_str }}</div>
                    <div class="system-card-unit">today</div>
                </div>
            </div>

            <div class="perf-row" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                <span class="perf-label">Component Status</span>
            </div>

            <div class="system-grid" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;">
                <div class="system-card" style="text-align: center; padding: 12px;">
                    <div class="system-card-title" style="margin-bottom: 8px;">Whisper</div>
                    <div style="font-size: 2em; color: {{ '#4caf50' if app_health.whisper_healthy else '#f44336' }};">
                        {{ 'OK' if app_health.whisper_healthy else 'FAIL' }}
                    </div>
                </div>
                <div class="system-card" style="text-align: center; padding: 12px;">
                    <div class="system-card-title" style="margin-bottom: 8px;">Ollama</div>
                    <div style="font-size: 2em; color: {{ '#4caf50' if app_health.ollama_healthy else '#f44336' }};">
                        {{ 'OK' if app_health.ollama_healthy else 'FAIL' }}
                    </div>
                </div>
                <div class="system-card" style="text-align: center; padding: 12px;">
                    <div class="system-card-title" style="margin-bottom: 8px;">GPU</div>
                    <div style="font-size: 2em; color: {{ '#4caf50' if app_health.gpu_available else '#999' }};">
                        {{ 'OK' if app_health.gpu_available else 'NONE' }}
                    </div>
                </div>
                <div class="system-card" style="text-align: center; padding: 12px;">
                    <div class="system-card-title" style="margin-bottom: 8px;">Mute Detect</div>
                    <div style="font-size: 2em; color: {{ '#4caf50' if app_health.mute_detector_healthy else '#999' }};">
                        {{ 'OK' if app_health.mute_detector_healthy else 'NONE' }}
                    </div>
                </div>
            </div>
        </div>
        {% endif %}

        {% if advanced %}
        <div class="performance-section">
            <h2>Content Metrics (All Sessions)</h2>
            <div class="perf-row">
                <span class="perf-label">Total Characters Transcribed</span>
                <span class="perf-value">{{ advanced.total_raw_chars }}</span>
            </div>
            <div class="perf-row">
                <span class="perf-label">Total Words Transcribed</span>
                <span class="perf-value">{{ advanced.total_raw_words }}</span>
            </div>
            <div class="perf-row">
                <span class="perf-label">Avg Characters per Session</span>
                <span class="perf-value">{{ advanced.avg_raw_chars }}</span>
            </div>
            <div class="perf-row">
                <span class="perf-label">Avg Words per Session</span>
                <span class="perf-value">{{ advanced.avg_raw_words }}</span>
            </div>
            <div class="perf-row">
                <span class="perf-label">Words Per Second (Whisper)</span>
                <span class="perf-value" style="color: #4caf50;">{{ advanced.words_per_second }} wps</span>
            </div>
        </div>

        <div class="performance-section">
            <h2>Quality Metrics</h2>
            <div class="perf-row">
                <span class="perf-label">Transcription Accuracy</span>
                <span class="perf-value" style="color: #667eea;">{{ advanced.accuracy_percent }}%</span>
            </div>
            <div class="perf-row">
                <span class="perf-label">Text Change Rate</span>
                <span class="perf-value">{{ advanced.char_change_percent }}%</span>
            </div>
            <div class="perf-row" style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 15px; margin-top: 10px;">
                <span class="perf-label" style="font-size: 0.8em; color: #666;">
                    <em>Accuracy = how much text stays same after LLM processing<br/>
                    Change Rate = percentage of characters modified</em>
                </span>
            </div>
        </div>

        <div class="performance-section">
            <h2>Normalized Performance (Accounting for Recording Length)</h2>
            <div class="perf-row">
                <span class="perf-label">Avg Recording Duration</span>
                <span class="perf-value">{{ advanced.avg_audio_duration_s }}s</span>
            </div>
            <div class="perf-row">
                <span class="perf-label">Pipeline Efficiency Ratio</span>
                <span class="perf-value" style="color: {{ advanced.efficiency_color }};">
                    {{ advanced.efficiency_ratio }}x ({{ advanced.efficiency_rating }})
                </span>
            </div>
            <div class="perf-row">
                <span class="perf-label">Characters Per Second (Audio)</span>
                <span class="perf-value">{{ advanced.chars_per_second_recorded }} chars/s</span>
            </div>
            <div class="perf-row">
                <span class="perf-label">Processing Time Per Word</span>
                <span class="perf-value">{{ advanced.processing_ms_per_word }}ms/word</span>
            </div>
            <div class="perf-row" style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 15px; margin-top: 10px;">
                <span class="perf-label" style="font-size: 0.8em; color: #666;">
                    <em><strong>Efficiency Ratio</strong> = Total pipeline time ÷ Recording duration<br/>
                    <strong>1.0x</strong> = Real-time (processes as fast as you speak)<br/>
                    <strong>3.0x</strong> = Excellent (3 seconds to process 1 second of audio)<br/>
                    <strong>5.0x</strong> = Good (5 seconds to process 1 second)<br/>
                    <strong>10.0x+</strong> = Slow (system is struggling)
                </span>
            </div>
        </div>
        {% endif %}

        <div class="refresh-info">
            <p>Dashboard updates automatically every 5 seconds • Database: {{ db_location }}</p>
        </div>
    </div>

    <script>
        // Auto-refresh every 5 seconds
        setInterval(function() {
            location.reload();
        }, 5000);
    </script>
</body>
</html>
"""


def get_system_resources(monitor):
    """Fetch current system resource metrics"""
    try:
        if not monitor:
            return None

        snapshot = monitor.get_snapshot()

        return {
            'cpu_percent': round(snapshot.get('cpu_percent', 0), 1),
            'memory_percent': round(snapshot.get('memory_percent', 0), 1),
            'memory_used_gb': round(snapshot.get('memory_used_gb', 0), 2),
            'memory_total_gb': round(snapshot.get('memory_total_gb', 0), 2),
            'gpu_available': snapshot.get('gpu_available', False),
            'gpu_device_name': snapshot.get('gpu_device_name', 'Unknown'),
            'gpu_memory_used_gb': round(snapshot.get('gpu_memory_used_gb', 0), 2),
            'gpu_memory_total_gb': round(snapshot.get('gpu_memory_total_gb', 0), 2),
            'gpu_memory_percent': round(snapshot.get('gpu_memory_percent', 0), 1),
        }
    except Exception as e:
        logger.warning(f"Error fetching system resources: {e}")
        return None


def get_app_startup_time(manager):
    """Infer app startup from first recording today, fallback to dashboard startup."""
    try:
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        conn = sqlite3.connect(manager.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("""
            SELECT timestamp FROM history
            WHERE timestamp >= ?
            ORDER BY timestamp ASC
            LIMIT 1
        """, (today_start.isoformat(),))

        result = cursor.fetchone()
        conn.close()

        if result:
            first_recording = datetime.fromisoformat(result['timestamp'])
            # App likely started a minute before first recording
            return first_recording - timedelta(minutes=1)

        return DASHBOARD_STARTUP_TIME
    except Exception as e:
        logger.warning(f"Could not infer app startup: {e}")
        return DASHBOARD_STARTUP_TIME


def get_app_health_metrics(manager, system_monitor):
    """Calculate app health metrics for dashboard."""
    try:
        # Startup time
        startup_time = get_app_startup_time(manager)

        # Uptime calculation
        uptime_delta = datetime.now() - startup_time
        total_minutes = int(uptime_delta.total_seconds() / 60)
        hours = total_minutes // 60
        minutes = total_minutes % 60
        uptime_str = f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m"

        # Recordings since startup
        conn = sqlite3.connect(manager.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) FROM history
            WHERE timestamp >= ?
        """, (startup_time.isoformat(),))
        recordings_count = cursor.fetchone()[0]
        conn.close()

        # Last started (human readable)
        last_started_str = startup_time.strftime("%I:%M %p").lstrip("0")

        # Component health checks
        whisper_healthy = True  # Assumed if dashboard running
        mute_detector_healthy = True  # Assumed if no errors

        # GPU from SystemMonitor
        gpu_available = False
        if system_monitor:
            snapshot = system_monitor.get_snapshot()
            gpu_available = snapshot.get('gpu_available', False)

        # Ollama health check (lightweight ping)
        ollama_healthy = False
        try:
            import requests
            response = requests.get("http://localhost:11434/api/tags", timeout=1)
            ollama_healthy = response.status_code == 200
        except:
            pass

        return {
            'uptime_str': uptime_str,
            'recordings_this_run': recordings_count,
            'last_started_str': last_started_str,
            'whisper_healthy': whisper_healthy,
            'ollama_healthy': ollama_healthy,
            'gpu_available': gpu_available,
            'mute_detector_healthy': mute_detector_healthy,
        }
    except Exception as e:
        logger.error(f"Error calculating app health metrics: {e}")
        return {
            'uptime_str': 'Unknown',
            'recordings_this_run': 0,
            'last_started_str': 'Unknown',
            'whisper_healthy': False,
            'ollama_healthy': False,
            'gpu_available': False,
            'mute_detector_healthy': False,
        }


def calculate_advanced_stats(manager):
    """Calculate advanced metrics like character counts, WPS, accuracy"""
    try:
        # Get all successful sessions
        all_sessions = []
        for mode in ['dictate', 'ask', 'refine']:
            sessions = manager.get_sessions_by_mode(mode, limit=1000)
            all_sessions.extend(sessions)

        if not all_sessions:
            return {}

        # Filter successful sessions only
        successful = [s for s in all_sessions if s.get('success')]

        if not successful:
            return {}

        total_raw_chars = 0
        total_processed_chars = 0
        total_raw_words = 0
        total_processed_words = 0
        total_time_ms = 0
        total_sessions = len(successful)

        for session in successful:
            raw = session.get('raw_text') or ''
            processed = session.get('processed_text') or ''

            total_raw_chars += len(raw)
            total_processed_chars += len(processed)
            total_raw_words += len(raw.split())
            total_processed_words += len(processed.split())
            total_time_ms += session.get('total_time_ms') or 0

        # Calculate averages
        avg_raw_chars = total_raw_chars / total_sessions if total_sessions > 0 else 0
        avg_processed_chars = total_processed_chars / total_sessions if total_sessions > 0 else 0
        avg_raw_words = total_raw_words / total_sessions if total_sessions > 0 else 0
        avg_processed_words = total_processed_words / total_sessions if total_sessions > 0 else 0

        # Calculate words per second (transcription only - faster metric)
        avg_transcription_ms = sum(s.get('transcription_time_ms') or 0 for s in successful) / total_sessions if total_sessions > 0 else 0
        wps = (total_raw_words / (avg_transcription_ms / 1000)) if avg_transcription_ms > 0 else 0

        # Calculate accuracy: how much text changes after processing
        # Lower change % = more accurate transcription
        if total_raw_chars > 0:
            char_change_percent = abs(total_processed_chars - total_raw_chars) / total_raw_chars * 100
            # Invert to get "accuracy" (100% = no change, 0% = complete change)
            accuracy_percent = max(0, 100 - char_change_percent)
        else:
            accuracy_percent = 100

        # Calculate throughput metrics (normalize by recording length)
        # This shows how efficiently the pipeline processes content
        avg_total_time_s = total_time_ms / 1000 / total_sessions if total_sessions > 0 else 0
        avg_audio_duration_s = sum(s.get('audio_duration_s') or 0 for s in successful) / total_sessions if total_sessions > 0 else 0

        # Efficiency ratio: how much slower is processing vs actual recording
        # 1.0 = real-time (processes as fast as audio length)
        # 2.0 = 2x slower than real-time
        # 0.5 = faster than real-time (unlikely)
        if avg_audio_duration_s > 0:
            efficiency_ratio = avg_total_time_s / avg_audio_duration_s
        else:
            efficiency_ratio = 0

        # Characters per second of recording (throughput metric)
        chars_per_second_recorded = (total_raw_chars / sum(s.get('audio_duration_s') or 1 for s in successful)) if successful else 0

        # Processing time per word (how long to process one word)
        avg_processing_time_s = sum(s.get('processing_time_ms') or 0 for s in successful) / 1000 / total_sessions if total_sessions > 0 else 0
        processing_ms_per_word = (avg_processing_time_s * 1000 / avg_raw_words) if avg_raw_words > 0 else 0

        # Determine quality ratings based on efficiency
        # Good: <= 3x (processing takes 3 seconds for 1 second of audio)
        # Average: 3-5x
        # Slow: > 5x
        if efficiency_ratio <= 3:
            efficiency_rating = "Excellent"
            efficiency_color = "#4caf50"  # Green
        elif efficiency_ratio <= 5:
            efficiency_rating = "Good"
            efficiency_color = "#8bc34a"  # Light green
        elif efficiency_ratio <= 10:
            efficiency_rating = "Average"
            efficiency_color = "#ff9800"  # Orange
        else:
            efficiency_rating = "Slow"
            efficiency_color = "#f44336"  # Red

        return {
            'total_raw_chars': int(total_raw_chars),
            'total_processed_chars': int(total_processed_chars),
            'total_raw_words': int(total_raw_words),
            'total_processed_words': int(total_processed_words),
            'avg_raw_chars': round(avg_raw_chars, 1),
            'avg_processed_chars': round(avg_processed_chars, 1),
            'avg_raw_words': round(avg_raw_words, 1),
            'avg_processed_words': round(avg_processed_words, 1),
            'words_per_second': round(wps, 1),
            'accuracy_percent': round(accuracy_percent, 1),
            'char_change_percent': round(char_change_percent, 1),
            'avg_audio_duration_s': round(avg_audio_duration_s, 2),
            'efficiency_ratio': round(efficiency_ratio, 2),
            'efficiency_rating': efficiency_rating,
            'efficiency_color': efficiency_color,
            'chars_per_second_recorded': round(chars_per_second_recorded, 1),
            'processing_ms_per_word': round(processing_ms_per_word, 2),
        }
    except Exception as e:
        logger.error(f"Error calculating advanced stats: {e}")
        return {}


@app.route('/')
def dashboard():
    """Render the main dashboard"""
    try:
        stats = manager.get_statistics()
        advanced = calculate_advanced_stats(manager)
        system_resources = get_system_resources(system_monitor)
        app_health = get_app_health_metrics(manager, system_monitor)
        db_location = manager.db_path
        return render_template_string(
            DASHBOARD_HTML,
            stats=stats,
            advanced=advanced,
            system_resources=system_resources,
            app_health=app_health,
            db_location=db_location
        )
    except Exception as e:
        return f"<h1>Error loading dashboard: {e}</h1>", 500


@app.route('/api/stats')
def api_stats():
    """JSON endpoint for stats (useful for external integrations)"""
    try:
        stats = manager.get_statistics()
        return json.dumps(stats, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}), 500


def run_server():
    """Run the Flask server"""
    print("\n" + "="*70)
    print("dIKtate History Dashboard")
    print("="*70)
    print("\n[*] Dashboard running at: http://localhost:8765")
    print("[*] API endpoint at:      http://localhost:8765/api/stats")
    print("\n[*] Auto-refreshes every 5 seconds")
    print("[*] Press Ctrl+C to stop\n")
    print("="*70 + "\n")

    app.run(host='127.0.0.1', port=8765, debug=False, use_reloader=False)


if __name__ == '__main__':
    try:
        # Initialize history manager
        manager = HistoryManager()

        # Initialize system monitor (lazy import to avoid heavy dependencies)
        try:
            from core.system_monitor import SystemMonitor
            system_monitor = SystemMonitor()
        except ImportError:
            logger.warning("SystemMonitor not available (missing dependencies)")
            system_monitor = None
        except Exception as e:
            logger.warning(f"Could not initialize system monitor: {e}")
            system_monitor = None

        # Run the server
        run_server()
    except KeyboardInterrupt:
        print("\n\nShutting down dashboard...")
        if manager:
            manager.shutdown()
        print("Done!")
    except Exception as e:
        print(f"Error: {e}")
        if manager:
            manager.shutdown()
        sys.exit(1)
