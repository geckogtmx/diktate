"""
SPEC_020: Post-It Notes - Safe File Writer
Provides defensive file operations for note-taking.
"""

import logging
import threading
import time
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


class SafeNoteWriter:
    """
    Robust file writer for Post-It Notes.
    Handles encoding, directory creation, file locking, and fallback.
    """

    def __init__(self, config: dict):
        """
        Initialize with configuration.

        Args:
            config: Dict containing filePath, format, timestampFormat, etc.
        """
        self.raw_path = config.get("filePath", "~/.diktate/notes.md")
        self.file_path = Path(self.raw_path).expanduser().resolve()
        self.format = config.get("format", "md")
        self.timestamp_format = config.get("timestampFormat", "%Y-%m-%d %H:%M:%S")

        # Emergency path for fallback
        self.emergency_dir = Path.home() / ".diktate" / "emergency"
        self.emergency_path = self.emergency_dir / "emergency_notes.md"

        self._lock = threading.Lock()

        logger.info(f"[SafeNoteWriter] Initialized for: {self.file_path}")

    def _ensure_directory(self, path: Path) -> bool:
        """Ensure the parent directory exists."""
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            return True
        except Exception as e:
            logger.error(f"[SafeNoteWriter] Failed to create directory {path.parent}: {e}")
            return False

    def _get_encoding_info(self, path: Path) -> str:
        """
        Inspect file for UTF-8 BOM.
        Standardizes on UTF-8 without BOM for new writes,
        but maintains existing encoding if detected.
        """
        if not path.exists():
            return "utf-8"

        try:
            with open(path, "rb") as f:
                header = f.read(3)
                if header == b"\xef\xbb\xbf":
                    return "utf-8-sig"
        except Exception:
            pass

        return "utf-8"

    def append_note(self, text: str, context: str | None = None) -> dict:
        """
        Safely append a note to the file with timestamp and retry logic.

        Returns:
            Dict: {success: bool, charCount: int, filePath: str, error: Optional[str]}
        """
        if not text or not text.strip():
            return {"success": False, "charCount": 0, "error": "Empty transcription"}

        timestamp = datetime.now().strftime(self.timestamp_format)

        # Prepare content
        if self.format == "md":
            entry = f"---\n[{timestamp}]\n{text.strip()}\n"
            if context:
                entry += f"\n> {context.strip()}\n"
            entry += "---\n\n"
        else:
            entry = f"--- [{timestamp}] ---\n{text.strip()}\n"
            if context:
                entry += f"Context: {context.strip()}\n"
            entry += "------------------\n\n"

        # Write with retry logic (Phase 1 Requirement)
        success = self._write_to_path(self.file_path, entry)

        if success:
            return {
                "success": True,
                "charCount": len(text),
                "filePath": str(self.file_path),
                "error": None,
            }
        else:
            # Fallback to emergency storage
            logger.warning("[SafeNoteWriter] Primary write failed, attempting emergency fallback")
            self._ensure_directory(self.emergency_path)

            emergency_success = self._write_to_path(self.emergency_path, entry)

            if emergency_success:
                return {
                    "success": True,
                    "charCount": len(text),
                    "filePath": str(self.emergency_path),
                    "error": "Primary path failed, saved to emergency fallback",
                }
            else:
                return {
                    "success": False,
                    "charCount": 0,
                    "error": "Critical: Failed to write note even in emergency fallback",
                }

    def _write_to_path(self, path: Path, content: str, retries: int = 5) -> bool:
        """Perform recursive directory creation and write with retries."""
        if not self._ensure_directory(path):
            return False

        encoding = self._get_encoding_info(path)

        for i in range(retries):
            try:
                # Open with 'a' (append) mode
                # On Windows, we handle potential locks from OneDrive/Notepad
                with self._lock:
                    with open(path, "a", encoding=encoding) as f:
                        f.write(content)
                return True
            except (OSError, PermissionError) as e:
                wait_time = 0.5 * (2**i)  # Exponential backoff
                logger.warning(
                    f"[SafeNoteWriter] Write attempt {i + 1} failed: {e}. Retrying in {wait_time}s..."
                )
                time.sleep(wait_time)
            except Exception as e:
                logger.error(f"[SafeNoteWriter] Unexpected write error: {e}")
                break

        return False
