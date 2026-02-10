"""
Quick VRAM check after restart.
Run this BEFORE starting the app to see baseline VRAM.
Then run AFTER app starts to see if it's clean.
"""

import subprocess


def check_vram():
    """Check current VRAM usage."""
    result = subprocess.run(
        ["nvidia-smi", "--query-gpu=memory.used,memory.total", "--format=csv,noheader,nounits"],
        capture_output=True,
        text=True,
    )

    if result.returncode == 0:
        used, total = result.stdout.strip().split(", ")
        used_mb = int(used)
        total_mb = int(total)
        percent = (used_mb / total_mb) * 100

        print("\n" + "=" * 60)
        print("VRAM STATUS")
        print("=" * 60)
        print(f"Used:  {used_mb:,} MB")
        print(f"Total: {total_mb:,} MB")
        print(f"Usage: {percent:.1f}%")
        print("=" * 60)

        # Expected values
        print("\nEXPECTED AFTER APP START:")
        print("  Ollama (gemma3:1b):  ~1,200 MB")
        print("  Whisper (medium):    ~1,100 MB")
        print("  System overhead:       ~500 MB")
        print("  ─────────────────────────────────")
        print("  Total expected:      ~2,800 MB")
        print()

        if used_mb < 2000:
            print("✓ CLEAN - App not started yet or minimal usage")
        elif 2500 <= used_mb <= 3500:
            print("✓ GOOD - Normal usage (one Whisper + Ollama)")
        elif 3500 < used_mb <= 4500:
            print("⚠ BORDERLINE - Slightly high, but might be OK")
        elif used_mb > 4500:
            print("✗ HIGH - Likely ghost model still present!")
            print(f"  Excess VRAM: ~{used_mb - 3000:,} MB")
            print("  → Full restart recommended")

        return used_mb
    else:
        print("✗ Failed to query GPU")
        return None


if __name__ == "__main__":
    check_vram()
