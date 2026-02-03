"""
SQLite-based history logging for dIKtate.
Provides persistent storage of dictation sessions with structured metadata.
Replaces volatile session-based log files with a queryable database.
"""

import logging
import os
import re
import sqlite3
import subprocess
import threading
from datetime import datetime, timedelta
from pathlib import Path
from queue import Queue
from typing import Any

logger = logging.getLogger(__name__)


def get_ollama_status() -> dict[str, Any]:
    """
    Get Ollama model status from 'ollama ps' command.

    Returns:
        Dictionary with loaded model info or empty dict if not loaded/failed
        Keys: model_name, vram_gb, processor, unload_minutes
    """
    try:
        result = subprocess.run(["ollama", "ps"], capture_output=True, text=True, timeout=2.0)

        if result.returncode != 0:
            return {}

        lines = result.stdout.strip().split("\n")
        if len(lines) < 2:  # No model loaded (only header)
            return {}

        # Parse the second line (first model entry)
        # Format: NAME         ID              SIZE      PROCESSOR    CONTEXT    UNTIL
        # Example: gemma3:4b    a2af6cc3eb7f    4.3 GB    100% GPU     2048       9 minutes from now
        data_line = lines[1]
        parts = data_line.split()

        if len(parts) < 6:
            return {}

        model_name = parts[0]
        size_str = parts[2] + " " + parts[3]  # "4.3 GB"
        processor = " ".join(parts[4:6])  # "100% GPU" or "CPU"
        until_str = " ".join(parts[7:])  # "9 minutes from now" or similar

        # Parse VRAM size (e.g., "4.3 GB" -> 4.3)
        vram_match = re.search(r"([\d.]+)\s*GB", size_str)
        vram_gb = float(vram_match.group(1)) if vram_match else None

        # Parse unload time (e.g., "9 minutes from now" -> 9, "About a minute" -> 1)
        unload_match = re.search(r"(\d+)\s*minutes?", until_str)
        if unload_match:
            unload_minutes = int(unload_match.group(1))
        elif "about a minute" in until_str.lower():
            unload_minutes = 1
        else:
            unload_minutes = None

        return {
            "model_name": model_name,
            "vram_gb": vram_gb,
            "processor": processor,
            "unload_minutes": unload_minutes,
        }

    except (subprocess.TimeoutExpired, FileNotFoundError, Exception) as e:
        logger.debug(f"Failed to get Ollama status: {e}")
        return {}


class HistoryManager:
    """
    Manages SQLite history database for dIKtate sessions.

    Features:
    - Thread-safe non-blocking writes using a queue
    - Structured storage of dictations, transcriptions, and model interactions
    - Privacy-respecting redaction based on DIKTATE_DEBUG_UNSAFE flag
    - Automatic cleanup of old records (30-90 day retention)
    """

    def __init__(self, db_path: str | None = None):
        """
        Initialize the HistoryManager.

        Args:
            db_path: Optional custom database path. Defaults to ~/.diktate/history.db
        """
        if db_path is None:
            db_dir = Path.home() / ".diktate"
            db_dir.mkdir(parents=True, exist_ok=True)
            db_path = str(db_dir / "history.db")

        self.db_path = db_path
        self.write_queue: Queue = Queue()
        self.write_thread: threading.Thread | None = None
        self.should_stop = False

        # Privacy settings (SPEC_030)
        self.logging_intensity = 2  # Default: Balanced
        self.pii_scrubber = True

        # Initialize database and start write thread
        self._initialize_db()
        self._start_write_thread()

        logger.info(f"HistoryManager initialized with database at: {self.db_path}")

    def _initialize_db(self) -> None:
        """Initialize the SQLite database and create schema if needed."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Create history table with exact schema from SPEC_029
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    mode TEXT,
                    transcriber_model TEXT,
                    processor_model TEXT,
                    provider TEXT,
                    raw_text TEXT,
                    processed_text TEXT,
                    audio_duration_s REAL,
                    transcription_time_ms REAL,
                    processing_time_ms REAL,
                    total_time_ms REAL,
                    success BOOLEAN,
                    error_message TEXT
                )
            """)

            # Create index for common queries (timestamp, mode, success)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_history_timestamp
                ON history(timestamp)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_history_mode
                ON history(mode)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_history_success
                ON history(success)
            """)

            # Migration: Add provider column if it doesn't exist
            cursor.execute("PRAGMA table_info(history)")
            columns = [info[1] for info in cursor.fetchall()]
            if "provider" not in columns:
                logger.info("Migrating history table: adding 'provider' column")
                cursor.execute("ALTER TABLE history ADD COLUMN provider TEXT")

            # HOTFIX_002 Migration: Add tokens_per_sec for GPU health monitoring
            if "tokens_per_sec" not in columns:
                logger.info("Migrating history table: adding 'tokens_per_sec' column (HOTFIX_002)")
                cursor.execute("ALTER TABLE history ADD COLUMN tokens_per_sec REAL")

            # Create system_metrics table for Phase 2 monitoring
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS system_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    history_id INTEGER,
                    sample_type TEXT,
                    cpu_percent REAL,
                    memory_percent REAL,
                    memory_used_gb REAL,
                    gpu_memory_used_gb REAL,
                    gpu_memory_percent REAL,
                    ollama_model_loaded TEXT,
                    ollama_vram_gb REAL,
                    ollama_processor TEXT,
                    ollama_unload_minutes INTEGER,
                    FOREIGN KEY (history_id) REFERENCES history(id)
                )
            """)

            # Create index for metrics queries
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_metrics_timestamp
                ON system_metrics(timestamp)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_metrics_type
                ON system_metrics(sample_type)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_metrics_history
                ON system_metrics(history_id)
            """)

            conn.commit()
            conn.close()

            logger.info("Database schema initialized successfully")
        except sqlite3.Error as e:
            logger.error(f"Failed to initialize database: {e}")
            raise

    def _start_write_thread(self) -> None:
        """Start the background thread for non-blocking database writes."""
        self.should_stop = False
        self.write_thread = threading.Thread(
            target=self._write_worker, daemon=True, name="HistoryWriteThread"
        )
        self.write_thread.start()

    def _write_worker(self) -> None:
        """Worker thread that processes write queue asynchronously."""
        from queue import Empty

        while not self.should_stop:
            try:
                # Block with timeout to allow graceful shutdown
                item = self.write_queue.get(timeout=1.0)

                if item is None:  # Sentinel value for shutdown
                    break

                # Write the item to database
                # Check if it's a metrics tuple or regular history dict
                if isinstance(item, tuple) and item[0] == "metrics":
                    self._write_metrics_to_db(item[1])
                else:
                    self._write_to_db(item)
                self.write_queue.task_done()

            except Empty:
                # Timeout is expected when queue is empty - this is normal
                continue
            except Exception as e:
                # Log unexpected errors only
                logger.warning(f"Error in write worker: {e}")

    def _write_to_db(self, data: dict[str, Any]) -> None:
        """
        Write a single record to the database.

        Args:
            data: Dictionary with keys matching history table columns
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Insert the record (HOTFIX_002: Added tokens_per_sec)
            cursor.execute(
                """
                INSERT INTO history (
                    timestamp, mode, transcriber_model, processor_model, provider,
                    raw_text, processed_text, audio_duration_s,
                    transcription_time_ms, processing_time_ms, total_time_ms,
                    success, error_message, tokens_per_sec
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    data.get("timestamp", datetime.now().isoformat()),
                    data.get("mode"),
                    data.get("transcriber_model"),
                    data.get("processor_model"),
                    data.get("provider"),
                    data.get("raw_text"),
                    data.get("processed_text"),
                    data.get("audio_duration_s"),
                    data.get("transcription_time_ms"),
                    data.get("processing_time_ms"),
                    data.get("total_time_ms"),
                    data.get("success", True),
                    data.get("error_message"),
                    data.get("tokens_per_sec"),  # HOTFIX_002: GPU performance indicator
                ),
            )

            conn.commit()
            conn.close()
        except sqlite3.Error as e:
            logger.warning(f"Failed to write history record: {e}")

    def wipe_all_data(self) -> bool:
        """
        Permanently delete all data from history and metrics tables AND file-based logs.
        Used for the 'Wipe All Local Data' privacy action.
        """
        try:
            # 1. Clear SQLite tables
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM system_metrics")
            cursor.execute("DELETE FROM history")
            conn.commit()

            # VACUUM cannot run within a transaction
            old_isolation = conn.isolation_level
            conn.isolation_level = None
            cursor.execute("VACUUM")
            conn.isolation_level = old_isolation

            conn.close()

            # 2. Clear Log Files
            log_dir = Path.home() / ".diktate" / "logs"
            if log_dir.exists():
                for log_file in log_dir.glob("*.log"):
                    try:
                        # Don't try to delete the CURRENT active log file if possible,
                        # but clearing it is fine.
                        with open(log_file, "w") as f:
                            f.truncate(0)
                        # Try to delete if it's not the active one
                        os.remove(log_file)
                    except Exception:
                        pass  # Active log might be locked by handler

            logger.info("[HISTORY] All local history data and log files have been wiped")
            return True
        except sqlite3.Error as e:
            logger.error(f"Failed to wipe history data: {e}")
            return False

    def set_privacy_settings(self, level: int, scrub: bool) -> None:
        """Update runtime privacy settings"""
        self.logging_intensity = level
        self.pii_scrubber = scrub
        logger.info(f"[HISTORY] Privacy settings updated: Intensity={level}, Scrub={scrub}")

    def log_session(self, data: dict[str, Any]) -> None:
        """
        Queue a session for logging. Non-blocking.

        Args:
            data: Dictionary with session details (timestamp, mode, models, texts, timings, etc.)
        """
        # GHOST MODE (Level 0): Do not log anything
        if self.logging_intensity == 0:
            return

        # Prepare data based on intensity
        processed_data = data.copy()

        # STATS ONLY (Level 1): Remove all text
        if self.logging_intensity == 1:
            processed_data["raw_text"] = None
            processed_data["processed_text"] = None

        # BALANCED (Level 2): Mask Raw Text, Scrub PII if enabled
        elif self.logging_intensity == 2:
            # Mask raw text to save space/privacy in balanced mode
            processed_data["raw_text"] = "[HIDDEN (Level 2)]"

            if self.pii_scrubber:
                from utils.security import scrub_pii

                processed_data["processed_text"] = scrub_pii(
                    processed_data.get("processed_text", "")
                )

        # FULL (Level 3): Experimental - Scrub PII only if enabled, keep everything else
        elif self.logging_intensity == 3:
            if self.pii_scrubber:
                from utils.security import scrub_pii

                processed_data["raw_text"] = scrub_pii(processed_data.get("raw_text", ""))
                processed_data["processed_text"] = scrub_pii(
                    processed_data.get("processed_text", "")
                )

        # Queue the write asynchronously
        self.write_queue.put(processed_data)

    def log_system_metrics(self, metrics_data: dict[str, Any]) -> None:
        """
        Queue system metrics for logging. Non-blocking.

        Args:
            metrics_data: Dictionary with system metrics (CPU, Memory, GPU, Ollama status)
                Required keys: sample_type ('post_recording' or 'background_probe')
                Optional keys: history_id, cpu_percent, memory_percent, etc.
        """
        # Queue the write asynchronously (same queue as history)
        self.write_queue.put(("metrics", metrics_data))

    def _write_metrics_to_db(self, data: dict[str, Any]) -> None:
        """
        Write a single metrics record to the database.

        Args:
            data: Dictionary with keys matching system_metrics table columns
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Insert the metrics record
            cursor.execute(
                """
                INSERT INTO system_metrics (
                    timestamp, history_id, sample_type,
                    cpu_percent, memory_percent, memory_used_gb,
                    gpu_memory_used_gb, gpu_memory_percent,
                    ollama_model_loaded, ollama_vram_gb,
                    ollama_processor, ollama_unload_minutes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    data.get("timestamp", datetime.now().isoformat()),
                    data.get("history_id"),
                    data.get("sample_type"),
                    data.get("cpu_percent"),
                    data.get("memory_percent"),
                    data.get("memory_used_gb"),
                    data.get("gpu_memory_used_gb"),
                    data.get("gpu_memory_percent"),
                    data.get("ollama_model_loaded"),
                    data.get("ollama_vram_gb"),
                    data.get("ollama_processor"),
                    data.get("ollama_unload_minutes"),
                ),
            )

            conn.commit()
            conn.close()

            logger.debug(f"Recorded {data.get('sample_type', 'unknown')} system metrics")

        except sqlite3.Error as e:
            logger.error(f"Database metrics write error: {e}")

    def search_by_phrase(self, phrase: str, limit: int = 50) -> list:
        """
        Search history for sessions containing a specific phrase.

        Args:
            phrase: Text to search for in raw_text or processed_text
            limit: Maximum number of results

        Returns:
            List of matching records
        """
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT * FROM history
                WHERE raw_text LIKE ? OR processed_text LIKE ?
                ORDER BY timestamp DESC
                LIMIT ?
            """,
                (f"%{phrase}%", f"%{phrase}%", limit),
            )

            results = [dict(row) for row in cursor.fetchall()]
            conn.close()

            return results
        except sqlite3.Error as e:
            logger.error(f"Search query error: {e}")
            return []

    def get_sessions_by_mode(self, mode: str, limit: int = 50) -> list:
        """
        Get sessions filtered by mode (dictate, ask, refine, translate).

        Args:
            mode: Recording mode
            limit: Maximum number of results

        Returns:
            List of matching records
        """
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT * FROM history
                WHERE mode = ?
                ORDER BY timestamp DESC
                LIMIT ?
            """,
                (mode, limit),
            )

            results = [dict(row) for row in cursor.fetchall()]
            conn.close()

            return results
        except sqlite3.Error as e:
            logger.error(f"Mode query error: {e}")
            return []

    def get_error_sessions(self, limit: int = 50) -> list:
        """
        Get all failed sessions (success=0).

        Args:
            limit: Maximum number of results

        Returns:
            List of failed session records
        """
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT * FROM history
                WHERE success = 0
                ORDER BY timestamp DESC
                LIMIT ?
            """,
                (limit,),
            )

            results = [dict(row) for row in cursor.fetchall()]
            conn.close()

            return results
        except sqlite3.Error as e:
            logger.error(f"Error query: {e}")
            return []

    def get_statistics(self) -> dict[str, Any]:
        """
        Get overall statistics from history database.

        Returns:
            Dictionary with stats (total sessions, success rate, etc.)
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Total sessions
            cursor.execute("SELECT COUNT(*) as count FROM history")
            total = cursor.fetchone()[0]

            # Successful sessions
            cursor.execute("SELECT COUNT(*) as count FROM history WHERE success = 1")
            successful = cursor.fetchone()[0]

            # Average times
            cursor.execute("""
                SELECT
                    AVG(transcription_time_ms) as avg_trans,
                    AVG(processing_time_ms) as avg_proc,
                    AVG(total_time_ms) as avg_total,
                    AVG(audio_duration_s) as avg_audio
                FROM history WHERE success = 1
            """)
            row = cursor.fetchone()
            avg_trans, avg_proc, avg_total, avg_audio = row if row else (None, None, None, None)

            # By mode
            cursor.execute("""
                SELECT mode, COUNT(*) as count FROM history
                GROUP BY mode
            """)
            by_mode = {row[0]: row[1] for row in cursor.fetchall()}

            conn.close()

            success_rate = (successful / total * 100) if total > 0 else 0

            return {
                "total_sessions": total,
                "successful_sessions": successful,
                "failed_sessions": total - successful,
                "success_rate": round(success_rate, 2),
                "avg_transcription_ms": round(avg_trans, 2) if avg_trans else 0,
                "avg_processing_ms": round(avg_proc, 2) if avg_proc else 0,
                "avg_total_ms": round(avg_total, 2) if avg_total else 0,
                "avg_audio_duration_s": round(avg_audio, 2) if avg_audio else 0,
                "by_mode": by_mode,
            }
        except sqlite3.Error as e:
            logger.error(f"Statistics query error: {e}")
            return {}

    def prune_history(self, days: int = 90) -> int:
        """
        Delete records older than specified number of days.

        Args:
            days: Number of days to keep (default 90)

        Returns:
            Number of records deleted
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()

            cursor.execute(
                """
                DELETE FROM history
                WHERE timestamp < ?
            """,
                (cutoff_date,),
            )

            deleted_count = cursor.rowcount
            conn.commit()

            # Optimize database file ONLY if we actually removed data (SPEC_035)
            if deleted_count > 0:
                logger.info(
                    f"Pruned {deleted_count} records older than {days} days. Running VACUUM..."
                )
                cursor.execute("VACUUM")
            else:
                logger.debug(f"No records older than {days} days found, skipping VACUUM")

            conn.close()
            return deleted_count
        except sqlite3.Error as e:
            logger.error(f"Prune error: {e}")
            return 0

    def shutdown(self) -> None:
        """
        Gracefully shutdown the history manager.
        Waits for pending writes to complete before closing.
        """
        logger.info("Shutting down HistoryManager...")

        # Wait for queue to be empty
        self.write_queue.join()

        # Signal write thread to stop
        self.should_stop = True
        self.write_queue.put(None)  # Sentinel value

        if self.write_thread:
            self.write_thread.join(timeout=5.0)

        logger.info("HistoryManager shutdown complete")
