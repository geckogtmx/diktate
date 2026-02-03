import os

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
import time

from core.transcriber import Transcriber


def test():
    print("Loading Transcriber (turbo, auto)...")
    start = time.time()
    t = Transcriber(model_size="turbo", device="cuda")  # Force cuda for test
    print(f"Loaded in {time.time() - start:.2f}s")

    # Test file if exists, otherwise skip
    audio_path = "temp_audio/test_recording.wav"
    if os.path.exists(audio_path):
        print(f"Transcribing {audio_path}...")
        start = time.time()
        text = t.transcribe(audio_path)
        end = time.time()
        print(f"Result: {text}")
        print(f"Time: {(end - start) * 1000:.0f}ms")
    else:
        print("No test audio found, but load was successful.")


if __name__ == "__main__":
    test()
