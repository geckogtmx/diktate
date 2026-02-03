import sys
from pathlib import Path

# Add the project root (python directory) to sys.path
# This simulates the environment setup done in ipc_server.py
python_root = Path(__file__).parent.resolve()
sys.path.insert(0, str(python_root))
