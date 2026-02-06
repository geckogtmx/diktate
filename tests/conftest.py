import sys
from pathlib import Path
from unittest.mock import MagicMock

# Add python directory to sys.path for imports
python_root = Path(__file__).parent.parent / "python"
sys.path.insert(0, str(python_root))

# Mock hardware-dependent modules globally for CI
# These modules require GPU/audio hardware not available in GitHub Actions
sys.modules["pyaudio"] = MagicMock()
sys.modules["faster_whisper"] = MagicMock()
sys.modules["ctranslate2"] = MagicMock()
sys.modules["pycaw"] = MagicMock()
sys.modules["pycaw.pycaw"] = MagicMock()
sys.modules["comtypes"] = MagicMock()


# Register pytest markers (for Task 2.2 - CI/CD)
def pytest_configure(config):
    config.addinivalue_line("markers", "requires_gpu: test needs CUDA GPU")
    config.addinivalue_line("markers", "requires_audio: test needs microphone")
    config.addinivalue_line("markers", "requires_ollama: test needs running Ollama")
