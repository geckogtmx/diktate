"""Unit tests for utils.history_manager module (SPEC_040_GAPS.md Task 1.6).

Tests SQLite history logging with database mocking.
"""

import sqlite3
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import pytest

from utils.history_manager import get_ollama_status, HistoryManager


class TestGetOllamaStatus:
    """Test get_ollama_status() subprocess command parsing."""

    def test_get_ollama_status_model_loaded(self):
        """get_ollama_status should parse 'ollama ps' output correctly"""
        mock_output = """NAME         ID              SIZE      PROCESSOR    CONTEXT    UNTIL
gemma3:4b    a2af6cc3eb7f    4.3 GB    100% GPU     2048       9 minutes from now"""

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout=mock_output)

            result = get_ollama_status()

        assert result["model_name"] == "gemma3:4b"
        assert result["vram_gb"] == 4.3
        assert result["processor"] == "100% GPU"
        assert result["unload_minutes"] == 9

    def test_get_ollama_status_cpu_only(self):
        """get_ollama_status should handle CPU-only models"""
        # Note: Real ollama ps output has "about a minute" for CPU-only models
        mock_output = """NAME            ID              SIZE      PROCESSOR    CONTEXT    UNTIL
llama3.2:3b     xyz123          2.1 GB    100% CPU     4096       About a minute"""

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout=mock_output)

            result = get_ollama_status()

        assert result["model_name"] == "llama3.2:3b"
        assert result["vram_gb"] == 2.1
        assert result["processor"] == "100% CPU"
        assert result["unload_minutes"] == 1  # "About a minute" -> 1

    def test_get_ollama_status_no_model_loaded(self):
        """get_ollama_status should return empty dict if no model loaded"""
        mock_output = """NAME         ID              SIZE      PROCESSOR    CONTEXT    UNTIL"""

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout=mock_output)

            result = get_ollama_status()

        assert result == {}

    def test_get_ollama_status_command_not_found(self):
        """get_ollama_status should return empty dict if ollama not installed"""
        with patch("subprocess.run", side_effect=FileNotFoundError()):
            result = get_ollama_status()

        assert result == {}

    def test_get_ollama_status_timeout(self):
        """get_ollama_status should return empty dict on timeout"""
        import subprocess

        with patch("subprocess.run", side_effect=subprocess.TimeoutExpired("ollama", 2.0)):
            result = get_ollama_status()

        assert result == {}

    def test_get_ollama_status_command_error(self):
        """get_ollama_status should return empty dict on non-zero exit code"""
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=1, stdout="Error: connection refused")

            result = get_ollama_status()

        assert result == {}

    def test_get_ollama_status_malformed_output(self):
        """get_ollama_status should return empty dict if output is malformed"""
        mock_output = """NAME         ID
incomplete line"""

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout=mock_output)

            result = get_ollama_status()

        assert result == {}


class TestHistoryManagerInit:
    """Test HistoryManager initialization."""

    def test_init_default_path(self):
        """__init__ should use ~/.diktate/history.db by default"""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("pathlib.Path.home", return_value=Path(tmpdir)):
                manager = HistoryManager()

                expected_path = Path(tmpdir) / ".diktate" / "history.db"
                assert manager.db_path == str(expected_path)
                assert expected_path.exists()

                manager.shutdown()

    def test_init_custom_path(self):
        """__init__ should accept custom database path"""
        with tempfile.TemporaryDirectory() as tmpdir:
            custom_path = Path(tmpdir) / "custom.db"

            manager = HistoryManager(db_path=str(custom_path))

            assert manager.db_path == str(custom_path)
            assert custom_path.exists()

            manager.shutdown()

    def test_init_creates_schema(self):
        """__init__ should create history and system_metrics tables"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"

            manager = HistoryManager(db_path=str(db_path))

            # Verify tables exist
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()

            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = {row[0] for row in cursor.fetchall()}

            assert "history" in tables
            assert "system_metrics" in tables

            conn.close()
            manager.shutdown()

    def test_init_starts_write_thread(self):
        """__init__ should start background write thread"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"

            manager = HistoryManager(db_path=str(db_path))

            assert manager.write_thread is not None
            assert manager.write_thread.is_alive()

            manager.shutdown()

    def test_init_default_privacy_settings(self):
        """__init__ should set default privacy settings (Level 2, Scrubbing ON)"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"

            manager = HistoryManager(db_path=str(db_path))

            assert manager.logging_intensity == 2
            assert manager.pii_scrubber is True

            manager.shutdown()


class TestPrivacySettings:
    """Test privacy-related methods."""

    def test_set_privacy_settings(self):
        """set_privacy_settings should update intensity and scrubber flags"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            manager = HistoryManager(db_path=str(db_path))

            manager.set_privacy_settings(level=1, scrub=False)

            assert manager.logging_intensity == 1
            assert manager.pii_scrubber is False

            manager.shutdown()


class TestLogSession:
    """Test log_session() queueing and privacy levels."""

    def test_log_session_ghost_mode_logs_nothing(self):
        """log_session should skip logging in Ghost Mode (Level 0)"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            manager = HistoryManager(db_path=str(db_path))
            manager.set_privacy_settings(level=0, scrub=True)

            data = {"mode": "dictate", "raw_text": "test"}
            manager.log_session(data)

            # Flush queue
            manager.write_queue.join()

            # Verify nothing was written
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM history")
            count = cursor.fetchone()[0]
            conn.close()

            assert count == 0

            manager.shutdown()

    def test_log_session_stats_only_removes_text(self):
        """log_session should remove all text in Stats Only mode (Level 1)"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            manager = HistoryManager(db_path=str(db_path))
            manager.set_privacy_settings(level=1, scrub=False)

            data = {
                "mode": "dictate",
                "raw_text": "sensitive raw text",
                "processed_text": "sensitive processed text",
                "success": True,
            }
            manager.log_session(data)

            # Flush queue
            manager.write_queue.join()

            # Verify text was removed
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute("SELECT raw_text, processed_text FROM history")
            row = cursor.fetchone()
            conn.close()

            assert row[0] is None  # raw_text should be None
            assert row[1] is None  # processed_text should be None

            manager.shutdown()

    def test_log_session_balanced_hides_raw_text(self):
        """log_session should hide raw text in Balanced mode (Level 2)"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            manager = HistoryManager(db_path=str(db_path))
            manager.set_privacy_settings(level=2, scrub=False)

            data = {
                "mode": "dictate",
                "raw_text": "raw transcription",
                "processed_text": "processed result",
                "success": True,
            }
            manager.log_session(data)

            manager.write_queue.join()

            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute("SELECT raw_text, processed_text FROM history")
            row = cursor.fetchone()
            conn.close()

            assert row[0] == "[HIDDEN (Level 2)]"
            assert row[1] == "processed result"  # Processed text kept (scrubbing off)

            manager.shutdown()

    def test_log_session_balanced_scrubs_pii_when_enabled(self):
        """log_session should scrub PII in processed text when enabled (Level 2)"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            manager = HistoryManager(db_path=str(db_path))
            manager.set_privacy_settings(level=2, scrub=True)

            data = {
                "mode": "dictate",
                "raw_text": "raw text",
                "processed_text": "Contact john@example.com at +1-555-1234",
                "success": True,
            }
            manager.log_session(data)

            manager.write_queue.join()

            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute("SELECT processed_text FROM history")
            row = cursor.fetchone()
            conn.close()

            assert "[EMAIL]" in row[0]
            assert "[PHONE]" in row[0]
            assert "john@example.com" not in row[0]

            manager.shutdown()

    def test_log_session_full_mode_keeps_everything_no_scrub(self):
        """log_session should keep all text in Full mode (Level 3) when scrubbing off"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            manager = HistoryManager(db_path=str(db_path))
            manager.set_privacy_settings(level=3, scrub=False)

            data = {
                "mode": "dictate",
                "raw_text": "raw transcription",
                "processed_text": "processed result",
                "success": True,
            }
            manager.log_session(data)

            manager.write_queue.join()

            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute("SELECT raw_text, processed_text FROM history")
            row = cursor.fetchone()
            conn.close()

            assert row[0] == "raw transcription"
            assert row[1] == "processed result"

            manager.shutdown()

    def test_log_session_full_mode_scrubs_when_enabled(self):
        """log_session should scrub both texts in Full mode (Level 3) when enabled"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            manager = HistoryManager(db_path=str(db_path))
            manager.set_privacy_settings(level=3, scrub=True)

            data = {
                "mode": "dictate",
                "raw_text": "Call me at +1-555-9876",
                "processed_text": "Email alice@test.com",
                "success": True,
            }
            manager.log_session(data)

            manager.write_queue.join()

            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute("SELECT raw_text, processed_text FROM history")
            row = cursor.fetchone()
            conn.close()

            assert "[PHONE]" in row[0]
            assert "[EMAIL]" in row[1]

            manager.shutdown()


class TestQueryMethods:
    """Test search and query methods."""

    def test_search_by_phrase(self):
        """search_by_phrase should find matching sessions"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            manager = HistoryManager(db_path=str(db_path))

            # Insert test data directly
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO history (mode, raw_text, processed_text) VALUES (?, ?, ?)",
                ("dictate", "hello world", "Hello, world!"),
            )
            cursor.execute(
                "INSERT INTO history (mode, raw_text, processed_text) VALUES (?, ?, ?)",
                ("ask", "goodbye moon", "Goodbye, moon."),
            )
            conn.commit()
            conn.close()

            # Search for "world"
            results = manager.search_by_phrase("world")

            assert len(results) == 1
            assert results[0]["raw_text"] == "hello world"

            manager.shutdown()

    def test_get_sessions_by_mode(self):
        """get_sessions_by_mode should filter by mode"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            manager = HistoryManager(db_path=str(db_path))

            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute("INSERT INTO history (mode, success) VALUES (?, ?)", ("dictate", 1))
            cursor.execute("INSERT INTO history (mode, success) VALUES (?, ?)", ("ask", 1))
            cursor.execute("INSERT INTO history (mode, success) VALUES (?, ?)", ("dictate", 1))
            conn.commit()
            conn.close()

            results = manager.get_sessions_by_mode("dictate")

            assert len(results) == 2
            assert all(r["mode"] == "dictate" for r in results)

            manager.shutdown()

    def test_get_error_sessions(self):
        """get_error_sessions should return only failed sessions"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            manager = HistoryManager(db_path=str(db_path))

            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO history (mode, success, error_message) VALUES (?, ?, ?)",
                ("dictate", 1, None),
            )
            cursor.execute(
                "INSERT INTO history (mode, success, error_message) VALUES (?, ?, ?)",
                ("ask", 0, "API error"),
            )
            conn.commit()
            conn.close()

            results = manager.get_error_sessions()

            assert len(results) == 1
            assert results[0]["success"] == 0
            assert results[0]["error_message"] == "API error"

            manager.shutdown()

    def test_get_statistics(self):
        """get_statistics should compute aggregate stats"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            manager = HistoryManager(db_path=str(db_path))

            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO history (mode, success, total_time_ms) VALUES (?, ?, ?)",
                ("dictate", 1, 1000.0),
            )
            cursor.execute(
                "INSERT INTO history (mode, success, total_time_ms) VALUES (?, ?, ?)",
                ("ask", 0, 500.0),
            )
            cursor.execute(
                "INSERT INTO history (mode, success, total_time_ms) VALUES (?, ?, ?)",
                ("dictate", 1, 2000.0),
            )
            conn.commit()
            conn.close()

            stats = manager.get_statistics()

            assert stats["total_sessions"] == 3
            assert stats["successful_sessions"] == 2
            assert stats["failed_sessions"] == 1
            assert stats["success_rate"] == 66.67
            assert stats["avg_total_ms"] == 1500.0  # (1000 + 2000) / 2

            manager.shutdown()


class TestDataManagement:
    """Test prune_history and wipe_all_data methods."""

    def test_prune_history_removes_old_records(self):
        """prune_history should delete records older than threshold"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            manager = HistoryManager(db_path=str(db_path))

            # Insert old and recent records
            from datetime import datetime, timedelta

            old_timestamp = (datetime.now() - timedelta(days=100)).isoformat()
            recent_timestamp = datetime.now().isoformat()

            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO history (timestamp, mode) VALUES (?, ?)", (old_timestamp, "dictate")
            )
            cursor.execute(
                "INSERT INTO history (timestamp, mode) VALUES (?, ?)", (recent_timestamp, "ask")
            )
            conn.commit()
            conn.close()

            # Prune records older than 90 days
            deleted = manager.prune_history(days=90)

            assert deleted == 1

            # Verify only recent record remains
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM history")
            count = cursor.fetchone()[0]
            conn.close()

            assert count == 1

            manager.shutdown()

    def test_wipe_all_data_clears_tables(self):
        """wipe_all_data should delete all records from history and metrics"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            manager = HistoryManager(db_path=str(db_path))

            # Insert test data
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute("INSERT INTO history (mode) VALUES (?)", ("dictate",))
            cursor.execute("INSERT INTO system_metrics (sample_type) VALUES (?)", ("background_probe",))
            conn.commit()
            conn.close()

            # Wipe all data
            success = manager.wipe_all_data()

            assert success is True

            # Verify tables are empty
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM history")
            history_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM system_metrics")
            metrics_count = cursor.fetchone()[0]
            conn.close()

            assert history_count == 0
            assert metrics_count == 0

            manager.shutdown()


class TestShutdown:
    """Test graceful shutdown."""

    def test_shutdown_waits_for_queue(self):
        """shutdown should wait for pending writes to complete"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            manager = HistoryManager(db_path=str(db_path))

            # Queue some writes
            manager.log_session({"mode": "dictate", "success": True})

            # Shutdown (should wait for queue)
            manager.shutdown()

            # Verify write completed
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM history")
            count = cursor.fetchone()[0]
            conn.close()

            assert count == 1

    def test_shutdown_stops_write_thread(self):
        """shutdown should stop the background write thread"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            manager = HistoryManager(db_path=str(db_path))

            thread = manager.write_thread

            manager.shutdown()

            assert manager.should_stop is True
            assert not thread.is_alive()
