"""
Data models and enums for dIKtate IPC Server.
Extracted from ipc_server.py as part of GAP 6 (ipc_server.py Reorganization).
"""

from __future__ import annotations

import json
import logging
import time
from enum import Enum
from pathlib import Path

logger = logging.getLogger(__name__)


class State(Enum):
    """Pipeline states"""

    IDLE = "idle"
    RECORDING = "recording"
    PROCESSING = "processing"
    INJECTING = "injecting"
    WARMUP = "warmup"
    ERROR = "error"
    NOTE = "note"  # SPEC_020 Note-taking mode


class SessionStats:
    """Track session-level statistics for observability (A.2)"""

    def __init__(self):
        self.dictation_count: int = 0
        self.success_count: int = 0
        self.error_count: int = 0
        self.total_words: int = 0
        self.total_time_ms: float = 0.0
        self.session_start: float = time.time()

    def record_success(self, words: int, time_ms: float) -> None:
        """Record a successful dictation"""
        self.dictation_count += 1
        self.success_count += 1
        self.total_words += words
        self.total_time_ms += time_ms

    def record_error(self) -> None:
        """Record a failed dictation"""
        self.dictation_count += 1
        self.error_count += 1

    def get_summary(self) -> dict:
        """Get session summary statistics"""
        session_duration = time.time() - self.session_start
        avg_time = self.total_time_ms / self.success_count if self.success_count > 0 else 0
        return {
            "dictations": self.dictation_count,
            "successes": self.success_count,
            "errors": self.error_count,
            "total_words": self.total_words,
            "avg_time_ms": round(avg_time, 0),
            "session_duration_s": round(session_duration, 1),
        }


class PerformanceMetrics:
    """Track performance metrics for the pipeline"""

    def __init__(self):
        self.metrics: dict[str, float] = {}
        self.start_times: dict[str, float] = {}

    def start(self, metric_name: str) -> None:
        """Start timing a metric"""
        self.start_times[metric_name] = time.time()

    def end(self, metric_name: str) -> float:
        """End timing a metric and return duration"""
        if metric_name not in self.start_times:
            logger.warning(f"Attempted to end non-existent metric: {metric_name}")
            return 0.0

        duration = (time.time() - self.start_times[metric_name]) * 1000  # Convert to ms
        self.metrics[metric_name] = duration
        del self.start_times[metric_name]

        logger.info(f"[PERF] {metric_name}: {duration:.0f}ms")
        return duration

    def get_metrics(self) -> dict[str, float]:
        """Get all recorded metrics"""
        return self.metrics.copy()

    def reset(self) -> None:
        """Reset all metrics"""
        self.metrics.clear()
        self.start_times.clear()

    def save_to_json(self, session_id: str, log_dir: Path) -> None:
        """Append metrics to a JSON file (A.2)"""
        try:
            metrics_file = log_dir / "metrics.json"
            entry = {"timestamp": time.time(), "session_id": session_id, **self.metrics}

            # Read existing or create new
            data = []
            if metrics_file.exists():
                try:
                    with open(metrics_file) as f:
                        data = json.load(f)
                        if not isinstance(data, list):
                            data = []
                except Exception:
                    data = []

            data.append(entry)

            # Keep only last 1000 entries
            if len(data) > 1000:
                data = data[-1000:]

            with open(metrics_file, "w") as f:
                json.dump(data, f, indent=2)

        except Exception as e:
            logger.warning(f"Failed to save metrics to JSON: {e}")

    def log_inference_time(self, model: str, duration_ms: float, log_dir: Path) -> None:
        """Log inference time to JSON file and alert on 2s+ threshold (A.1)"""
        try:
            # Alert if processing exceeds 2-second threshold
            if duration_ms > 2000:
                logger.warning(
                    f"[SLOW INFERENCE] {model} took {duration_ms:.0f}ms (> 2000ms threshold)"
                )

            # Log to inference_times.json
            inference_file = log_dir / "inference_times.json"
            entry = {
                "timestamp": time.time(),
                "model": model,
                "duration_ms": round(duration_ms, 2),
                "threshold_exceeded": duration_ms > 2000,
            }

            # Read existing or create new
            data = []
            if inference_file.exists():
                try:
                    with open(inference_file) as f:
                        data = json.load(f)
                        if not isinstance(data, list):
                            data = []
                except Exception:
                    data = []

            data.append(entry)

            # Keep only last 500 entries
            if len(data) > 500:
                data = data[-500:]

            with open(inference_file, "w") as f:
                json.dump(data, f, indent=2)

        except Exception as e:
            logger.warning(f"Failed to log inference time: {e}")
