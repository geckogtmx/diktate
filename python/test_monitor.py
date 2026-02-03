import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import json

from core.system_monitor import SystemMonitor


def test():
    monitor = SystemMonitor()
    print("Initial state:")
    print(json.dumps(monitor.get_snapshot(), indent=2))

    print("\nAfter 1s:")
    import time

    time.sleep(1)
    print(json.dumps(monitor.get_snapshot(), indent=2))


if __name__ == "__main__":
    test()
