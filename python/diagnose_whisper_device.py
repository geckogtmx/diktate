"""
Diagnostic script to check which device Whisper is actually using.
This will help determine if Whisper is running on CPU or GPU.
"""

import logging
import sys
from pathlib import Path

# Add core module to path
sys.path.insert(0, str(Path(__file__).parent))

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def check_cuda_availability():
    """Check if CUDA is available via different methods."""
    print("\n" + "=" * 80)
    print("CUDA AVAILABILITY CHECK")
    print("=" * 80)

    # Method 1: ctranslate2
    try:
        import ctranslate2

        cuda_count = ctranslate2.get_cuda_device_count()
        print(f"✓ ctranslate2.get_cuda_device_count(): {cuda_count}")
        if cuda_count > 0:
            print(f"  → CUDA devices detected: {cuda_count}")
        else:
            print("  → WARNING: No CUDA devices detected by ctranslate2!")
    except Exception as e:
        print(f"✗ ctranslate2 check failed: {e}")

    # Method 2: PyTorch
    try:
        import torch

        cuda_available = torch.cuda.is_available()
        print(f"✓ torch.cuda.is_available(): {cuda_available}")
        if cuda_available:
            device_count = torch.cuda.device_count()
            device_name = torch.cuda.get_device_name(0)
            print(f"  → GPU: {device_name}")
            print(f"  → Device count: {device_count}")
        else:
            print("  → WARNING: PyTorch cannot see CUDA!")
    except Exception as e:
        print(f"✗ PyTorch check failed: {e}")

    # Method 3: nvidia-smi
    try:
        import subprocess

        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            print("✓ nvidia-smi output:")
            for line in result.stdout.strip().split("\n"):
                print(f"  → {line}")
        else:
            print(f"✗ nvidia-smi failed with code {result.returncode}")
    except Exception as e:
        print(f"✗ nvidia-smi check failed: {e}")


def test_whisper_device():
    """Test which device Whisper actually uses."""
    print("\n" + "=" * 80)
    print("WHISPER DEVICE TEST")
    print("=" * 80)

    try:
        from core.transcriber import Transcriber

        # Test with device="auto"
        print("\n--- Testing with device='auto' ---")
        transcriber = Transcriber(model_size="medium", device="auto")

        # Check internal state
        print(f"Transcriber.device: {transcriber.device}")

        # Check the actual WhisperModel device
        if transcriber.model:
            # Try to access internal model properties
            try:
                # faster-whisper stores device in model.device
                model_device = getattr(transcriber.model, "device", "unknown")
                print(f"WhisperModel.device: {model_device}")
            except Exception as e:
                print(f"Could not access model.device: {e}")

            # Check model properties
            try:
                model_dir = getattr(transcriber.model, "model_dir", "unknown")
                print(f"Model directory: {model_dir}")
            except Exception as e:
                print(f"Could not access model_dir: {e}")

        print("\n✓ Transcriber initialized successfully")

    except Exception as e:
        print(f"✗ Transcriber initialization failed: {e}")
        import traceback

        traceback.print_exc()


def check_environment():
    """Check relevant environment variables."""
    print("\n" + "=" * 80)
    print("ENVIRONMENT VARIABLES")
    print("=" * 80)

    import os

    env_vars = [
        "CUDA_VISIBLE_DEVICES",
        "CUDA_PATH",
        "WHISPER_MODEL",
        "KMP_DUPLICATE_LIB_OK",
    ]

    for var in env_vars:
        value = os.environ.get(var, "<not set>")
        print(f"{var}: {value}")


def analyze_performance_data():
    """Analyze recent performance data from the database."""
    print("\n" + "=" * 80)
    print("PERFORMANCE ANALYSIS")
    print("=" * 80)

    try:
        import sqlite3
        from pathlib import Path

        db_path = Path.home() / ".diktate" / "history.db"
        if not db_path.exists():
            print(f"✗ Database not found at {db_path}")
            return

        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Get recent transcription performance
        cursor.execute("""
            SELECT
                audio_duration_s,
                transcription_time_ms,
                transcription_time_ms / audio_duration_s as ratio
            FROM history
            WHERE audio_duration_s > 0
            ORDER BY timestamp DESC
            LIMIT 10
        """)

        results = cursor.fetchall()

        if results:
            print("\nRecent transcription performance (last 10):")
            print(f"{'Audio (s)':<12} {'Trans (ms)':<15} {'Ratio (ms/s)':<15} {'Assessment'}")
            print("-" * 70)

            for audio_dur, trans_time, ratio in results:
                # GPU typically: < 100ms per second of audio
                # CPU typically: > 200ms per second of audio
                if ratio < 100:
                    assessment = "✓ LIKELY GPU"
                elif ratio < 200:
                    assessment = "? BORDERLINE"
                else:
                    assessment = "✗ LIKELY CPU"

                print(f"{audio_dur:<12.2f} {trans_time:<15.2f} {ratio:<15.2f} {assessment}")

            # Calculate average
            avg_ratio = sum(r[2] for r in results) / len(results)
            print(f"\nAverage ratio: {avg_ratio:.2f} ms/s")

            if avg_ratio < 100:
                print("✓ Performance suggests GPU acceleration is working")
            elif avg_ratio < 200:
                print("? Performance is borderline - GPU may not be fully utilized")
            else:
                print("✗ Performance suggests CPU-only execution!")
                print("  Expected GPU: < 100 ms/s")
                print(f"  Your average: {avg_ratio:.2f} ms/s")

        conn.close()

    except Exception as e:
        print(f"✗ Performance analysis failed: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("WHISPER GPU DIAGNOSTIC TOOL")
    print("=" * 80)

    check_environment()
    check_cuda_availability()
    test_whisper_device()
    analyze_performance_data()

    print("\n" + "=" * 80)
    print("DIAGNOSTIC COMPLETE")
    print("=" * 80)
