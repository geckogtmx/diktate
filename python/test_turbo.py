# Test Script: Verify V3 Turbo and Switching
# Run this: python python/test_turbo.py

import json
import sys
import time
from pathlib import Path

# Add current directory to path so we can import python.ipc_server
sys.path.append(str(Path.cwd()))

from python.ipc_server import IpcServer


def run_server():
    server = IpcServer()
    server.run()


# Mock stdin for testing
class MockStdin:
    def __init__(self):
        self.commands = [
            json.dumps({"command": "status", "id": "1"}),
            json.dumps({"command": "configure", "config": {"model": "medium"}, "id": "2"}),
            json.dumps({"command": "configure", "config": {"model": "turbo"}, "id": "3"}),
            json.dumps({"command": "shutdown", "id": "4"}),
        ]
        self.index = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self.index < len(self.commands):
            cmd = self.commands[self.index]
            self.index += 1
            time.sleep(2)  # Wait for processing
            return cmd
        raise StopIteration


if __name__ == "__main__":
    # monkey patch sys.stdin
    sys.stdin = MockStdin()

    # Run server
    print("Starting Test...")
    server = IpcServer()

    # Check default model (should be turbo)
    assert server.transcriber.model_size == "turbo", "Default model is not turbo!"
    print(f"Initial model: {server.transcriber.model_size} [PASS]")

    # Run test loop manually to avoid threading complexity with mocking
    # 1. Status
    res = server.handle_command({"command": "status"})
    print(f"Status: {res}")

    # 2. Switch to Medium
    print("Switching to Medium...")
    res = server.handle_command({"command": "configure", "config": {"model": "medium"}})
    print(f"Result: {res}")
    assert server.transcriber.model_size == "medium", "Failed to switch to medium!"
    print("Model is now Medium [PASS]")

    # 3. Switch to Turbo
    print("Switching back to Turbo...")
    res = server.handle_command({"command": "configure", "config": {"model": "turbo"}})
    print(f"Result: {res}")
    assert server.transcriber.model_size == "turbo", "Failed to switch to turbo!"
    print("Model is now Turbo [PASS]")

    print("ALL TESTS PASSED")
