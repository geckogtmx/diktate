import sys
from pathlib import Path

# Add python directory to sys.path for imports
python_root = Path(__file__).parent.parent / "python"
sys.path.insert(0, str(python_root))


# Register pytest markers (for Task 2.2 - CI/CD)
def pytest_configure(config):
    config.addinivalue_line("markers", "requires_gpu: test needs CUDA GPU")
    config.addinivalue_line("markers", "requires_audio: test needs microphone")
    config.addinivalue_line("markers", "requires_ollama: test needs running Ollama")
