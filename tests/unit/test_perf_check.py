"""Tests for python/tools/perf_check.py performance regression guard."""

import json
import sys
from pathlib import Path

# Add tools directory to path so we can import perf_check
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python" / "tools"))

from perf_check import (  # noqa: E402
    check_inference_times,
    check_pipeline_times,
    load_json_array,
    main,
)


class TestLoadJsonArray:
    def test_missing_file(self, tmp_path):
        result = load_json_array(tmp_path / "nonexistent.json")
        assert result == []

    def test_empty_file(self, tmp_path):
        f = tmp_path / "empty.json"
        f.write_text("")
        assert load_json_array(f) == []

    def test_non_array_json(self, tmp_path):
        f = tmp_path / "obj.json"
        f.write_text('{"key": "value"}')
        assert load_json_array(f) == []

    def test_valid_array(self, tmp_path):
        data = [{"a": 1}, {"b": 2}]
        f = tmp_path / "valid.json"
        f.write_text(json.dumps(data))
        assert load_json_array(f) == data

    def test_invalid_json(self, tmp_path):
        f = tmp_path / "bad.json"
        f.write_text("{invalid json")
        assert load_json_array(f) == []


class TestCheckInferenceTimes:
    def test_no_data(self, tmp_path):
        issues = check_inference_times(tmp_path)
        assert len(issues) == 1
        assert "INFO:" in issues[0]

    def test_all_under_threshold(self, tmp_path):
        data = [{"duration_ms": 500, "model": "test"} for _ in range(10)]
        (tmp_path / "inference_times.json").write_text(json.dumps(data))
        issues = check_inference_times(tmp_path)
        assert not any(i.startswith("FAIL:") for i in issues)

    def test_average_over_2s(self, tmp_path):
        data = [{"duration_ms": 2500, "model": "test"} for _ in range(10)]
        (tmp_path / "inference_times.json").write_text(json.dumps(data))
        issues = check_inference_times(tmp_path)
        fails = [i for i in issues if i.startswith("FAIL:")]
        assert len(fails) >= 1
        assert "Average inference time" in fails[0]

    def test_single_run_over_5s(self, tmp_path):
        data = [{"duration_ms": 500, "model": "fast"} for _ in range(9)]
        data.append({"duration_ms": 6000, "model": "slow-model"})
        (tmp_path / "inference_times.json").write_text(json.dumps(data))
        issues = check_inference_times(tmp_path)
        fails = [i for i in issues if "Single inference > 5s" in i]
        assert len(fails) == 1
        assert "slow-model" in fails[0]

    def test_mixed_results(self, tmp_path):
        # Average under 2s but one spike over 5s
        data = [{"duration_ms": 1000, "model": "normal"} for _ in range(9)]
        data.append({"duration_ms": 7000, "model": "spike"})
        (tmp_path / "inference_times.json").write_text(json.dumps(data))
        issues = check_inference_times(tmp_path)
        # Average is (9*1000 + 7000)/10 = 1600ms < 2000 → no avg fail
        avg_fails = [i for i in issues if "Average" in i]
        assert len(avg_fails) == 0
        # But single spike > 5s → 1 fail
        spike_fails = [i for i in issues if "Single inference" in i]
        assert len(spike_fails) == 1


class TestCheckPipelineTimes:
    def test_no_data(self, tmp_path):
        issues = check_pipeline_times(tmp_path)
        assert len(issues) == 1
        assert "INFO:" in issues[0]

    def test_all_under_30s(self, tmp_path):
        data = [{"total": 5000, "session_id": f"s{i}"} for i in range(10)]
        (tmp_path / "metrics.json").write_text(json.dumps(data))
        issues = check_pipeline_times(tmp_path)
        assert not any(i.startswith("FAIL:") for i in issues)

    def test_over_30s(self, tmp_path):
        data = [{"total": 5000, "session_id": "fast"}]
        data.append({"total": 35000, "session_id": "slow_session"})
        (tmp_path / "metrics.json").write_text(json.dumps(data))
        issues = check_pipeline_times(tmp_path)
        fails = [i for i in issues if i.startswith("FAIL:")]
        assert len(fails) == 1
        assert "slow_session" in fails[0]


class TestMain:
    def test_pass_no_data(self, tmp_path):
        result = main(tmp_path)
        assert result == 0

    def test_fail_on_regression(self, tmp_path):
        data = [{"duration_ms": 3000, "model": "slow"} for _ in range(10)]
        (tmp_path / "inference_times.json").write_text(json.dumps(data))
        result = main(tmp_path)
        assert result == 1

    def test_pass_good_data(self, tmp_path):
        inference = [{"duration_ms": 800, "model": "fast"} for _ in range(10)]
        metrics = [{"total": 3000, "session_id": "ok"} for _ in range(10)]
        (tmp_path / "inference_times.json").write_text(json.dumps(inference))
        (tmp_path / "metrics.json").write_text(json.dumps(metrics))
        result = main(tmp_path)
        assert result == 0
