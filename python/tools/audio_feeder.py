#!/usr/bin/env python3
"""
dIKtate Audio Feeder ("Couch Potato Test")
feeds external audio into dIKtate by playing it through system speakers
and synchronizing recording state via global hotkeys.
"""

import os
import sys
import time
import argparse
import random
from pathlib import Path
import threading

try:
    from pydub import AudioSegment
    from pydub.playback import play
    import simpleaudio as sa
    import pysrt
    from pynput.keyboard import Key, Controller
    
    # FFmpeg auto-detection (especially for WinGet)
    import shutil
    if not shutil.which("ffmpeg"):
        winget_links = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft/WinGet/Links/ffmpeg.exe"
        if winget_links.exists():
            AudioSegment.converter = str(winget_links)
            
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Please run: pip install pydub simpleaudio pysrt pynput")
    sys.exit(1)

import socket

# Configuration
IPC_HOST = '127.0.0.1'
IPC_PORT = 5005
PROCESS_TIME = 7.0 # Time (seconds) to wait for dIKtate processing

def send_command(cmd: str):
    """Send a command to the dIKtate IPC server via TCP.

    Returns:
        For STATUS: the state string
        For START/STOP: True if "OK", False otherwise
    """
    print(f"  [CMD] Sending {cmd}...", end="")
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(2.0)
            s.connect((IPC_HOST, IPC_PORT))
            s.sendall(cmd.encode())
            response = s.recv(1024).decode().strip()
            print(f" -> {response}")

            # For STATUS, return the state string
            if cmd == "STATUS":
                return response

            # For START/STOP, check for OK (success) or other responses (failure/busy)
            return response == "OK"
    except Exception as e:
        print(f" -> ERROR: {e}")
        return False

def wait_for_idle(timeout: float = 30.0, poll_interval: float = 0.5):
    """Poll the dIKtate state until it returns to IDLE or timeout.

    Args:
        timeout: Maximum time to wait (seconds)
        poll_interval: Time between polls (seconds)

    Returns:
        bool: True if IDLE reached, False if timeout
    """
    start_time = time.time()
    last_state = None

    while (time.time() - start_time) < timeout:
        state = send_command("STATUS")

        # Only print state changes to reduce noise
        if state != last_state:
            print(f"  [STATE] {state}")
            last_state = state

        if state == "idle":
            return True

        time.sleep(poll_interval)

    print(f"  [TIMEOUT] State did not return to IDLE within {timeout}s (last state: {last_state})")
    return False

def play_audio_segment(segment):
    """Play using simpleaudio for precise blocking."""
    try:
        # Simpleaudio is much faster for blocking playback than pydub.play
        sample_rate = segment.frame_rate
        channels = segment.channels
        sample_width = segment.sample_width
        data = segment.raw_data
        
        play_obj = sa.play_buffer(data, channels, sample_width, sample_rate)
        play_obj.wait_done()
    except Exception as e:
        print(f"  [WARN] simpleaudio failed, falling back to pydub.play: {e}")
        from pydub.playback import play
        play(segment)
    return None 

def smart_feed(audio_path: Path, srt_path: Path, loop: bool = False, count: int = 0, start_at: int = 0):
    """
    Smart Mode: Use subtitles to slice and feed audio.
    """
    print(f"Loading audio: {audio_path}")
    audio = AudioSegment.from_file(str(audio_path))
    
    print(f"Loading subtitles: {srt_path}")
    subs = pysrt.open(str(srt_path))
    
    total_subs = len(subs)
    print(f"Found {total_subs} subtitle lines.")
    print("="*60)
    print(f"STARTING TEST at index {start_at}")
    print(f"Sync: Connecting to dIKtate on port {IPC_PORT}...")
    
    # Initial Connection Check
    status = send_command("STATUS")
    if not status:
        print("[ERROR] Could not connect to dIKtate. Is the app running?")
        sys.exit(1)
        
    print(f"App Status: {status}")
    print("3 seconds to ready...")
    time.sleep(3)
    
    iteration = 0
    
    while True:
        iteration += 1
        print(f"\n=== Loop Iteration {iteration} ===")
        
        for i in range(start_at, total_subs):
            if count > 0 and (i - start_at) >= count: break
            
            sub = subs[i]
            
            # 1. Get Timestamps 
            start_ms = (sub.start.hours * 3600 + sub.start.minutes * 60 + sub.start.seconds) * 1000 + sub.start.milliseconds
            end_ms = (sub.end.hours * 3600 + sub.end.minutes * 60 + sub.end.seconds) * 1000 + sub.end.milliseconds
            
            # Subtitle cleanup/buffer
            start_ms = max(0, start_ms - 100) 
            end_ms = end_ms + 100
            
            duration_ms = end_ms - start_ms
            if duration_ms < 300: continue 
            
            # 2. Extract Text
            expected_text = sub.text.replace('\n', ' ')
            print(f"\n[{i+1}/{total_subs}] Case {i}:")
            print(f"  [EXPECTED] \"{expected_text}\"")
            print(f"  [TIMING] {start_ms/1000:.2f}s -> {end_ms/1000:.2f}s (Dur: {duration_ms/1000:.2f}s)")
            
            # 3. Slice Audio
            chunk = audio[start_ms:end_ms]
            
            # 4. Ensure IDLE before starting
            print(f"  [SYNC] Waiting for IDLE state...")
            if not wait_for_idle(timeout=30.0):
                print("  [ERROR] App not ready (stuck in non-IDLE state), skipping phrase")
                continue

            # 5. Start Recording
            # We send START, wait briefly for dIKtate to initialize hardware, then play
            if not send_command("START"):
                print("  [ERROR] Failed to start recording")
                continue

            # 6. Play Audio (BLOCKING)
            time.sleep(0.3)
            play_audio_segment(chunk)

            # 7. Stop Recording
            # Wait a tiny bit for the trailing audio to be captured by hardware
            time.sleep(0.5)
            if not send_command("STOP"):
                print("  [ERROR] Failed to stop recording")

            # 8. Wait for Processing to Complete (poll for IDLE)
            print(f"  [PROCESSING] Waiting for completion...")
            if not wait_for_idle(timeout=30.0):
                print("  [WARNING] Processing did not complete within timeout, continuing anyway...")
            
        if not loop:
            break
        start_at = 0 
            
    print("\nTest Complete.")

def dumb_feed(audio_path: Path, chunk_len_sec: int = 10, loop: bool = False):
    """
    Dumb Mode: Slice audio into fixed-length chunks.
    """
    print(f"Loading audio: {audio_path}")
    audio = AudioSegment.from_file(str(audio_path))
    chunk_len_ms = chunk_len_sec * 1000
    
    print(f"Slicing into {chunk_len_sec}s chunks...")
    chunks = []
    for i in range(0, len(audio), chunk_len_ms):
        chunks.append(audio[i:i+chunk_len_ms])
        
    print(f"Created {len(chunks)} chunks.")
    print("="*60)
    print("STARTING TEST...")
    time.sleep(2)
    
    while True:
        for i, chunk in enumerate(chunks):
            print(f"\nChunk #{i+1}:")

            # Ensure IDLE before starting
            print(f"  [SYNC] Waiting for IDLE state...")
            if not wait_for_idle(timeout=30.0):
                print("  [ERROR] App not ready, skipping chunk")
                continue

            send_command("START")
            time.sleep(0.5)

            play_audio_segment(chunk)

            time.sleep(1.0)
            send_command("STOP")

            print(f"  [PROCESSING] Waiting for completion...")
            if not wait_for_idle(timeout=30.0):
                print("  [WARNING] Processing did not complete within timeout, continuing anyway...")

        if not loop: break

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="dIKtate Audio Feeder")
    parser.add_argument("--file", help="Path to audio file (wav/mp3)")
    parser.add_argument("--subs", help="Path to subtitle file (srt)")
    parser.add_argument("--last-download", action="store_true", help="Use the most recent download from fixtures")
    parser.add_argument("--loop", action="store_true", help="Loop infinitely")
    parser.add_argument("--count", type=int, default=0, help="Number of lines to test (0=all)")
    parser.add_argument("--start-at", type=int, default=0, help="Subtitle index to start from (0-indexed)")
    parser.add_argument("--chunk-size", type=int, default=10, help="Chunk size for dumb mode (seconds)")
    
    args = parser.parse_args()
    
    # Resolve paths
    root_dir = Path(__file__).resolve().parent.parent.parent
    fixtures_dir = root_dir / "tests/fixtures/downloads"
    
    audio_path = None
    srt_path = None
    
    if args.last_download:
        # Find most recent wav in fixtures
        wavs = list(fixtures_dir.glob("*.wav"))
        if not wavs:
            print("No downloads found in tests/fixtures/downloads!")
            sys.exit(1)
        # Sort by mtime
        audio_path = sorted(wavs, key=os.path.getmtime, reverse=True)[0]
        print(f"Auto-selected audio: {audio_path.name}")
        
        # Look for matching srt
        possible_srt = audio_path.with_suffix(".en.srt")
        # yt-dlp might name it video.en.srt or video.srt
        if not possible_srt.exists():
             possible_srt = audio_path.with_suffix(".srt")
        
        if possible_srt.exists():
            srt_path = possible_srt
            print(f"Auto-selected subs:  {srt_path.name}")
    
    elif args.file:
        audio_path = Path(args.file)
        if args.subs:
            srt_path = Path(args.subs)
            
    if not audio_path or not audio_path.exists():
        print("Error: Invalid audio path. Use --file or --last-download.")
        sys.exit(1)
        
    # Execute
    if srt_path and srt_path.exists():
        smart_feed(audio_path, srt_path, args.loop, args.count, args.start_at)
    else:
        print("No subtitles provided. Running in Fixed-Chunk Mode.")
        dumb_feed(audio_path, args.chunk_size, args.loop)
