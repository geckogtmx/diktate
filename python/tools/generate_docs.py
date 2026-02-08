"""Generate Python API documentation using pdoc.

Mocks hardware-dependent modules (pyaudio, faster_whisper, etc.) so docs
can be generated on any machine without GPU/audio hardware.

Usage: python python/tools/generate_docs.py
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock

# Mock hardware-dependent modules before any imports
sys.modules["pyaudio"] = MagicMock()
sys.modules["faster_whisper"] = MagicMock()
sys.modules["ctranslate2"] = MagicMock()
sys.modules["pycaw"] = MagicMock()
sys.modules["pycaw.pycaw"] = MagicMock()
sys.modules["comtypes"] = MagicMock()
sys.modules["pynput"] = MagicMock()
sys.modules["pynput.keyboard"] = MagicMock()

# Add python/ to path so pdoc can find modules
sys.path.insert(0, str(Path(__file__).parent.parent))

import pdoc  # noqa: E402

output_dir = Path(__file__).parent.parent.parent / "docs" / "api" / "python"
pdoc.pdoc("core", "utils", "config", "models", output_directory=output_dir)
print(f"Python API docs generated at: {output_dir}")
