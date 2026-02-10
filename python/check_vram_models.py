"""
Check what models are actually loaded in VRAM.
This will help identify if multiple Whisper models are loaded.
"""

import subprocess
import sys
from pathlib import Path

# Add core module to path
sys.path.insert(0, str(Path(__file__).parent))


def check_vram_breakdown():
    """Check detailed VRAM usage."""
    print("\n" + "=" * 80)
    print("VRAM BREAKDOWN CHECK")
    print("=" * 80)

    # Get total VRAM usage
    result = subprocess.run(
        ["nvidia-smi", "--query-gpu=memory.used,memory.total", "--format=csv,noheader,nounits"],
        capture_output=True,
        text=True,
    )

    if result.returncode == 0:
        used, total = result.stdout.strip().split(", ")
        print(f"\nTotal VRAM: {used} MB / {total} MB ({int(used) / int(total) * 100:.1f}%)")

        # Known allocations
        print("\nKnown allocations:")
        print("  Ollama (gemma3:1b): ~1,200 MB")
        print("  Whisper (medium):   ~1,100 MB (expected)")
        print("  System overhead:    ~500-1,000 MB")
        print("  Expected total:     ~2,800-3,300 MB")
        print(f"  Actual total:       {used} MB")

        unaccounted = int(used) - 3300
        if unaccounted > 1000:
            print(f"\n⚠ WARNING: {unaccounted} MB unaccounted for!")
            print("  This suggests additional models may be loaded")
            print("  Possible causes:")
            print("    - Multiple Whisper models in memory")
            print("    - Old model not garbage collected")
            print("    - Memory fragmentation")
        else:
            print(f"\n✓ VRAM usage looks normal ({unaccounted:+d} MB variance)")

    # Check Python process memory
    print("\n" + "=" * 80)
    print("PYTHON PROCESS CHECK")
    print("=" * 80)

    try:
        import os

        import psutil

        current_process = psutil.Process(os.getpid())
        mem_info = current_process.memory_info()

        print("\nPython process memory:")
        print(f"  RSS (Resident Set Size): {mem_info.rss / (1024**3):.2f} GB")
        print(f"  VMS (Virtual Memory Size): {mem_info.vms / (1024**3):.2f} GB")

        # Check if transcriber is loaded
        if "core.transcriber" in sys.modules:
            print("\n✓ Transcriber module is loaded")
        else:
            print("\n✗ Transcriber module not loaded")

    except ImportError:
        print("\npsutil not available - skipping Python process check")


def check_faster_whisper_cache():
    """Check if faster-whisper has multiple models cached."""
    print("\n" + "=" * 80)
    print("FASTER-WHISPER CACHE CHECK")
    print("=" * 80)

    # Check HuggingFace cache
    cache_dir = Path.home() / ".cache" / "huggingface" / "hub"
    if cache_dir.exists():
        print(f"\nHuggingFace cache directory: {cache_dir}")

        # Look for Whisper models
        whisper_models = list(cache_dir.glob("models--*whisper*"))
        if whisper_models:
            print(f"\nFound {len(whisper_models)} Whisper model(s) in cache:")
            for model in whisper_models:
                # Get size
                total_size = sum(f.stat().st_size for f in model.rglob("*") if f.is_file())
                print(f"  - {model.name}: {total_size / (1024**3):.2f} GB")
        else:
            print("\n✓ No Whisper models found in HuggingFace cache")
    else:
        print(f"\nHuggingFace cache not found at {cache_dir}")


def check_model_instances():
    """Check if there are multiple model instances in memory."""
    print("\n" + "=" * 80)
    print("MODEL INSTANCE CHECK")
    print("=" * 80)

    try:
        import gc

        # Force garbage collection
        gc.collect()

        # Look for WhisperModel instances
        whisper_instances = []
        for obj in gc.get_objects():
            if hasattr(obj, "__class__"):
                class_name = obj.__class__.__name__
                if "Whisper" in class_name or "whisper" in class_name.lower():
                    whisper_instances.append(f"{class_name} at {hex(id(obj))}")

        if whisper_instances:
            print(f"\nFound {len(whisper_instances)} Whisper-related object(s) in memory:")
            for instance in whisper_instances[:10]:  # Limit to first 10
                print(f"  - {instance}")

            if len(whisper_instances) > 1:
                print("\n⚠ WARNING: Multiple Whisper objects detected!")
                print("  This could indicate model duplication in memory")
        else:
            print("\n✓ No Whisper objects found (or not yet loaded)")

    except Exception as e:
        print(f"\n✗ Instance check failed: {e}")


if __name__ == "__main__":
    check_vram_breakdown()
    check_faster_whisper_cache()
    check_model_instances()

    print("\n" + "=" * 80)
    print("DIAGNOSIS COMPLETE")
    print("=" * 80)
    print("""
If VRAM usage is significantly higher than expected:
  1. Multiple models may be loaded simultaneously
  2. Old models may not be garbage collected
  3. Try restarting the app to clear VRAM

To force garbage collection:
  import gc; gc.collect()
    """)
