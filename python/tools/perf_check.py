#!/usr/bin/env python3
"""Performance regression guard for dIKtate.

Reads inference_times.json and metrics.json from the log directory,
checks performance thresholds, and reports any regressions.

Thresholds:
- Average inference time > 2s over last 10 runs → FAIL
- Any single inference run > 5s → FAIL
- Total pipeline time > 30s for any run → FAIL

Exit codes: 0 = pass, 1 = fail

Usage:
    python python/tools/perf_check.py                    # Uses default ~/.diktate/logs
    python python/tools/perf_check.py /path/to/logs      # Custom log directory
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


def load_json_array(filepath: Path) -> list[dict]:
    """Load a JSON file expected to contain an array of objects."""
    if not filepath.exists():
        return []
    try:
        with open(filepath) as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def check_inference_times(log_dir: Path) -> list[str]:
    """Check inference_times.json for performance regressions."""
    issues: list[str] = []
    filepath = log_dir / "inference_times.json"
    data = load_json_array(filepath)

    if not data:
        issues.append("INFO: No inference time data found.")
        return issues

    # Check average of last 10 runs > 2000ms
    last_10 = data[-10:]
    durations = [e["duration_ms"] for e in last_10 if "duration_ms" in e]
    if durations:
        avg = sum(durations) / len(durations)
        if avg > 2000:
            issues.append(
                f"FAIL: Average inference time over last {len(durations)} runs: "
                f"{avg:.0f}ms (threshold: 2000ms)"
            )

    # Check any single run > 5000ms in last 50 entries
    for entry in data[-50:]:
        dur = entry.get("duration_ms", 0)
        if dur > 5000:
            model = entry.get("model", "unknown")
            issues.append(f"FAIL: Single inference > 5s: {model} took {dur:.0f}ms")

    return issues


def check_pipeline_times(log_dir: Path) -> list[str]:
    """Check metrics.json for total pipeline time > 30s."""
    issues: list[str] = []
    filepath = log_dir / "metrics.json"
    data = load_json_array(filepath)

    if not data:
        issues.append("INFO: No pipeline metrics data found.")
        return issues

    # Check last 50 entries for total > 30000ms
    for entry in data[-50:]:
        total = entry.get("total", 0)
        if total > 30000:
            sid = entry.get("session_id", "?")
            issues.append(f"FAIL: Pipeline total > 30s: session {sid} took {total:.0f}ms")

    return issues


def main(log_dir: Path | None = None) -> int:
    """Run all performance checks. Returns 0 for pass, 1 for fail."""
    if log_dir is None:
        log_dir = Path.home() / ".diktate" / "logs"

    print(f"Checking performance data in: {log_dir}")

    all_issues: list[str] = []
    all_issues.extend(check_inference_times(log_dir))
    all_issues.extend(check_pipeline_times(log_dir))

    has_failures = any(issue.startswith("FAIL:") for issue in all_issues)

    for issue in all_issues:
        print(issue)

    if has_failures:
        print("\n--- PERFORMANCE CHECK FAILED ---")
        return 1
    else:
        print("\n--- PERFORMANCE CHECK PASSED ---")
        return 0


if __name__ == "__main__":
    override_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    sys.exit(main(override_dir))
