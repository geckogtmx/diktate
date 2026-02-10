"""
Quick test to monitor VRAM usage during Whisper transcription.
This will help determine if VRAM contention is causing CPU fallback.
"""

import logging
import subprocess
import sys
import time
from pathlib import Path

# Add core module to path
sys.path.insert(0, str(Path(__file__).parent))

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def get_vram_usage():
    """Get current VRAM usage in MB."""
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=2,
        )
        if result.returncode == 0:
            return int(result.stdout.strip())
        return None
    except Exception as e:
        logger.error(f"Failed to get VRAM: {e}")
        return None


def test_transcription_vram():
    """Test VRAM usage during transcription."""
    print("\n" + "=" * 80)
    print("WHISPER VRAM USAGE TEST")
    print("=" * 80)

    # Check initial VRAM
    initial_vram = get_vram_usage()
    print(f"\nInitial VRAM: {initial_vram} MB")

    try:
        from core.transcriber import Transcriber

        # Initialize transcriber
        print("\nInitializing Transcriber with device='auto'...")
        init_start = time.time()
        transcriber = Transcriber(model_size="medium", device="auto")
        init_time = (time.time() - init_start) * 1000

        post_init_vram = get_vram_usage()
        vram_increase = post_init_vram - initial_vram if post_init_vram and initial_vram else 0

        print(f"✓ Transcriber initialized in {init_time:.0f}ms")
        print(f"  VRAM after init: {post_init_vram} MB (+{vram_increase} MB)")

        # Check if we have a test audio file
        test_audio = Path("./temp_audio/recording.wav")
        if not test_audio.exists():
            print(f"\n⚠ No test audio file found at {test_audio}")
            print("  Skipping transcription test")
            print("  To test: Record a short dictation and run this script again")
            return

        # Transcribe
        print(f"\nTranscribing {test_audio}...")

        # Monitor VRAM during transcription
        vram_before = get_vram_usage()
        trans_start = time.time()

        result = transcriber.transcribe(str(test_audio))

        trans_time = (time.time() - trans_start) * 1000
        vram_after = get_vram_usage()
        vram_delta = vram_after - vram_before if vram_after and vram_before else 0

        print(f"✓ Transcription completed in {trans_time:.0f}ms")
        print(f"  Result: {result[:100]}...")
        print(f"  VRAM before: {vram_before} MB")
        print(f"  VRAM after: {vram_after} MB (delta: {vram_delta:+d} MB)")

        # Get audio duration for performance analysis
        try:
            import wave

            with wave.open(str(test_audio), "rb") as wav:
                frames = wav.getnframes()
                rate = wav.getframerate()
                duration = frames / float(rate)

                ratio = trans_time / duration if duration > 0 else 0
                print("\nPerformance Analysis:")
                print(f"  Audio duration: {duration:.2f}s")
                print(f"  Transcription time: {trans_time:.0f}ms")
                print(f"  Ratio: {ratio:.2f} ms/s")

                if ratio < 100:
                    print("  ✓ GOOD - GPU performance")
                elif ratio < 200:
                    print("  ? BORDERLINE - Possible GPU underutilization")
                else:
                    print("  ✗ POOR - Likely CPU fallback")
        except Exception as e:
            logger.error(f"Could not analyze audio file: {e}")

    except Exception as e:
        logger.error(f"Test failed: {e}")
        import traceback

        traceback.print_exc()

    print("\n" + "=" * 80)


def check_ollama_vram():
    """Check if Ollama is using VRAM."""
    print("\n" + "=" * 80)
    print("OLLAMA VRAM CHECK")
    print("=" * 80)

    try:
        import requests

        # Check if Ollama is running
        try:
            response = requests.get("http://localhost:11434/api/ps", timeout=2)
            if response.status_code == 200:
                models = response.json().get("models", [])
                if models:
                    print(f"\n✓ Ollama is running with {len(models)} model(s) loaded:")
                    for model in models:
                        name = model.get("name", "unknown")
                        size = model.get("size", 0) / (1024**3)  # Convert to GB
                        print(f"  - {name} (~{size:.2f} GB)")
                else:
                    print("\n✓ Ollama is running but no models loaded in VRAM")
            else:
                print(f"\n? Ollama API returned status {response.status_code}")
        except requests.ConnectionError:
            print("\n✓ Ollama is not running (no VRAM contention)")
        except Exception as e:
            print(f"\n? Could not check Ollama status: {e}")

    except Exception as e:
        print(f"\n✗ Ollama check failed: {e}")


if __name__ == "__main__":
    check_ollama_vram()
    test_transcription_vram()

    print("\n" + "=" * 80)
    print("RECOMMENDATIONS")
    print("=" * 80)
    print("""
If VRAM usage is high (>6GB) and performance is poor:
  1. Stop Ollama: Stop-Service Ollama (or close Ollama app)
  2. Re-run this test to see if performance improves
  3. Consider using a smaller Whisper model (small=2GB, base=1GB)

If VRAM usage is low but performance is still poor:
  1. Check if Whisper is actually using GPU (see logs)
  2. Try different compute_type settings
  3. Check for CUDA driver issues
    """)
