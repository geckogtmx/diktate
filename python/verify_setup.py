"""Quick verification script to check if all components are properly installed."""

import sys
import os

# Add core module to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def verify_imports():
    """Verify all required packages are installed."""
    print("Verifying imports...")
    errors = []

    packages = [
        ("faster_whisper", "faster-whisper"),
        ("torch", "torch"),
        ("pyaudio", "pyaudio"),
        ("requests", "requests"),
        ("pynput", "pynput"),
        ("fastapi", "fastapi"),
        ("uvicorn", "uvicorn"),
        ("pyperclip", "pyperclip"),
    ]

    for module_name, package_name in packages:
        try:
            __import__(module_name)
            print(f"  [OK] {package_name}")
        except ImportError as e:
            print(f"  [FAIL] {package_name}")
            errors.append((package_name, str(e)))

    return errors


def verify_core_modules():
    """Verify core modules can be imported."""
    print("\nVerifying core modules...")
    errors = []

    modules = ["Recorder", "Transcriber", "Processor", "Injector"]

    try:
        from core import Recorder, Transcriber, Processor, Injector
        for module in modules:
            print(f"  [OK] {module}")
    except ImportError as e:
        print(f"  [FAIL] Core modules: {e}")
        errors.append(("core modules", str(e)))

    return errors


def verify_hardware():
    """Verify hardware capabilities."""
    print("\nVerifying hardware...")
    errors = []

    try:
        import torch
        print(f"  [OK] PyTorch version: {torch.__version__}")

        cuda_available = torch.cuda.is_available()
        if cuda_available:
            print(f"  [OK] CUDA available: Yes")
            device = torch.cuda.get_device_name(0)
            print(f"       GPU: {device}")
        else:
            print(f"  [WARN] CUDA available: No (CPU mode)")
    except Exception as e:
        print(f"  [FAIL] Hardware check failed: {e}")
        errors.append(("hardware", str(e)))

    return errors


def verify_dependencies():
    """Verify Ollama is available."""
    print("\nVerifying external dependencies...")
    errors = []

    try:
        import requests
        response = requests.get("http://localhost:11434/api/tags", timeout=2)
        if response.status_code == 200:
            print(f"  [OK] Ollama server is running")
        else:
            print(f"  [WARN] Ollama returned status {response.status_code}")
    except requests.ConnectionError:
        print(f"  [WARN] Ollama server not found at localhost:11434")
        print(f"        Install Ollama from https://ollama.ai")
    except Exception as e:
        print(f"  [FAIL] Ollama check failed: {e}")
        errors.append(("ollama", str(e)))

    return errors


def main():
    """Run all verification checks."""
    print("=" * 60)
    print("dIKtate Setup Verification")
    print("=" * 60)

    all_errors = []
    all_errors.extend(verify_imports())
    all_errors.extend(verify_core_modules())
    all_errors.extend(verify_hardware())
    all_errors.extend(verify_dependencies())

    print("\n" + "=" * 60)
    if all_errors:
        print(f"[WARN] {len(all_errors)} issue(s) found:")
        for package, error in all_errors:
            if "not found" not in error.lower() and "not running" not in error.lower():
                print(f"  - {package}: {error}")
        print("\nNote: Ollama not running is OK for now, but required for full pipeline")
    else:
        print("[SUCCESS] All checks passed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
