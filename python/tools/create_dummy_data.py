import os
import subprocess
from pathlib import Path

def create_dummy_data():
    fixtures_dir = Path("tests/fixtures/downloads")
    fixtures_dir.mkdir(parents=True, exist_ok=True)
    
    wav_path = fixtures_dir / "setup_test.wav"
    srt_path = fixtures_dir / "setup_test.srt"
    
    print(f"Generating dummy test data in {fixtures_dir}...")
    
    # 1. Create Audio (WAV)
    text = "Welcome to dIKtate. This is a system check. One, two, three."
    ps_script = f'''
Add-Type -AssemblyName System.Speech
$synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synthesizer.SetOutputToWaveFile("{str(wav_path.absolute())}")
$synthesizer.Speak("{text}")
$synthesizer.Dispose()
'''
    subprocess.run(["powershell", "-c", ps_script], check=True)
    print(f"[OK] Created audio: {wav_path}")
    
    # 2. Create Subtitles (SRT)
    # Estimate timing roughly
    srt_content = """1
00:00:00,500 --> 00:00:02,500
Welcome to dIKtate.

2
00:00:03,000 --> 00:00:05,000
This is a system check.

3
00:00:05,500 --> 00:00:08,000
One, two, three.
"""
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(srt_content)
    print(f"[OK] Created subtitles: {srt_path}")

if __name__ == "__main__":
    create_dummy_data()
