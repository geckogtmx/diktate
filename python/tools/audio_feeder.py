#!/usr/bin/env python3
"""
dIKtate Audio Feeder ("Couch Potato Test")
feeds external audio into dIKtate by playing it through system speakers
and synchronizing recording state via global hotkeys.
"""
from __future__ import annotations

import argparse
import os
import signal
import sys
import threading
import time
from pathlib import Path

# Optional dependencies check
try:
    import shutil
    import pysrt  # noqa: F401
    import simpleaudio  # noqa: F401
    from pydub import AudioSegment
    from pynput.keyboard import Controller, Key  # noqa: F401

    if not shutil.which("ffmpeg"):
        winget_links = (
            Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft/WinGet/Links/ffmpeg.exe"
        )
        if winget_links.exists():
            AudioSegment.converter = str(winget_links)

except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Please run: pip install pydub simpleaudio pysrt pynput")
    sys.exit(1)

import socket

# Configuration
IPC_HOST = "127.0.0.1"
IPC_PORT = 5005
USE_SIMPLEAUDIO = True  # Can be overridden by --no-simpleaudio flag


class TestStats:
    """Track test execution statistics."""

    def __init__(self):
        self.total = 0
        self.success = 0
        self.failed = 0
        self.skipped = 0
        self.start_time = time.time()

    def record_success(self):
        """Record a successful phrase."""
        self.total += 1
        self.success += 1

    def record_failure(self):
        """Record a failed phrase."""
        self.total += 1
        self.failed += 1

    def record_skip(self):
        """Record a skipped phrase."""
        self.skipped += 1

    def print_summary(self):
        """Print test execution summary."""
        duration = time.time() - self.start_time
        print(f"\n{'=' * 60}")
        print("TEST SUMMARY")
        print(f"{'=' * 60}")
        print(f"Total Phrases: {self.total}")
        print(f"[OK] Success:  {self.success}")
        print(f"[X] Failed:    {self.failed}")
        print(f"[-] Skipped:   {self.skipped}")
        print(f"Duration:      {duration / 60:.1f} minutes ({duration:.1f}s)")
        if self.total > 0:
            print(f"Avg per phrase: {duration / self.total:.1f}s")
            print(f"Success rate:   {(self.success / self.total) * 100:.1f}%")
        print(f"{'=' * 60}\n")


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


def check_connection(retries: int = 3) -> bool:
    """Verify dIKtate TCP server is responsive.

    Args:
        retries: Number of connection attempts

    Returns:
        bool: True if connection successful, False otherwise
    """
    for i in range(retries):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(2.0)
                s.connect((IPC_HOST, IPC_PORT))
                s.sendall(b"PING")
                response = s.recv(1024).decode().strip()
                if response == "PONG":
                    return True
        except Exception:
            if i < retries - 1:
                time.sleep(1)
            continue
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


def preflight_checks():
    """Run pre-flight environment checks before starting test.

    Returns:
        bool: True if all checks passed, False if critical failure
    """
    print(f"\n{'=' * 60}")
    print("PRE-FLIGHT CHECKS")
    print(f"{'=' * 60}")

    checks = []
    critical_failure = False

    # 1. Check simpleaudio
    try:
        import simpleaudio

        checks.append(("[OK]", "simpleaudio installed"))
    except ImportError:
        checks.append(("[FAIL]", "simpleaudio NOT installed (pip install simpleaudio)"))
        critical_failure = True

    # 2. Check dIKtate connection
    print("  Checking dIKtate connection...", end=" ")
    if check_connection(retries=3):
        checks.append(("[OK]", "dIKtate server responding"))
    else:
        checks.append(("[FAIL]", "dIKtate NOT responding (is app running?)"))
        critical_failure = True

    # 3. Check initial state
    state = send_command("STATUS")
    if state == "idle":
        checks.append(("[OK]", f"App ready (state: {state})"))
    elif state:
        checks.append(("[WARN]", f"App busy (state: {state}) - will wait for IDLE"))
    else:
        checks.append(("[FAIL]", "Cannot retrieve app status"))
        critical_failure = True

    # Print all checks
    for status, msg in checks:
        print(f"  {status} {msg}")

    print(f"{'=' * 60}\n")

    if critical_failure:
        print("[ERROR] Pre-flight checks failed. Fix issues and try again.\n")
        return False

    return True


def play_audio_with_timeout(segment, timeout_multiplier=1.5):
    """Wrapper that plays audio with a timeout to prevent hanging.

    Args:
        segment: AudioSegment to play
        timeout_multiplier: Multiply audio duration by this for timeout (default 1.5x)

    Returns:
        bool: True if playback completed, False if timeout/error
    """
    duration_seconds = len(segment) / 1000.0
    timeout = duration_seconds * timeout_multiplier

    print(f"  [AUDIO] Playing {duration_seconds:.1f}s audio (timeout: {timeout:.1f}s)...")

    # Use threading to play with timeout
    playback_result = {"success": False, "error": None}

    def playback_thread():
        try:
            result = play_audio_segment(segment)
            playback_result["success"] = result
        except Exception as e:
            playback_result["error"] = str(e)

    thread = threading.Thread(target=playback_thread, daemon=True)
    thread.start()
    thread.join(timeout=timeout)

    if thread.is_alive():
        print(
            f"  [ERROR] Playback timeout after {timeout:.1f}s - audio may still be playing in background"
        )
        print("  [INFO] Simulating playback completion...")
        return False

    if playback_result.get("error"):
        print(f"  [ERROR] Playback error: {playback_result['error']}")
        return False

    return playback_result.get("success", False)


def play_audio_segment(segment):
    """Play using simpleaudio for precise blocking.

    Falls back to PyAudio if simpleaudio fails or is disabled.
    PyAudio is more reliable than pydub.playback on Windows.
    """
    global USE_SIMPLEAUDIO

    # Try simpleaudio first (if enabled)
    if USE_SIMPLEAUDIO:
        try:
            # Simpleaudio is much faster for blocking playback than pydub.play
            sample_rate = segment.frame_rate
            channels = segment.channels
            sample_width = segment.sample_width
            data = segment.raw_data

            # Simpleaudio can crash on some systems - wrap in try/except
            import simpleaudio as sa
            play_obj = sa.play_buffer(data, channels, sample_width, sample_rate)
            if play_obj is None:
                raise RuntimeError("play_buffer returned None")
            play_obj.wait_done()
            return True
        except Exception as e:
            print(f"  [WARN] simpleaudio failed: {e}")
            print("  [INFO] Disabling simpleaudio for remaining phrases...")
            USE_SIMPLEAUDIO = False  # Disable for rest of session

    # Fallback to PyAudio (more reliable on Windows than pydub.playback)
    try:
        import pyaudio

        print("  [DEBUG] Starting PyAudio playback...")

        # Get audio properties
        sample_rate = segment.frame_rate
        channels = segment.channels
        sample_width = segment.sample_width
        data = segment.raw_data

        # Initialize PyAudio
        p = pyaudio.PyAudio()

        # Open stream
        stream = p.open(
            format=p.get_format_from_width(sample_width),
            channels=channels,
            rate=sample_rate,
            output=True,
        )

        # Play audio in chunks to avoid blocking indefinitely
        chunk_size = 1024
        for i in range(0, len(data), chunk_size):
            stream.write(data[i : i + chunk_size])

        # Cleanup
        stream.stop_stream()
        stream.close()
        p.terminate()

        print("  [DEBUG] PyAudio playback completed")
        return True

    except ImportError:
        print("  [ERROR] PyAudio not installed, falling back to pydub.playback...")
        # Last resort: pydub.playback (can hang on Windows)
        try:
            from pydub.playback import play

            print("  [DEBUG] Starting pydub.playback.play()...")
            play(segment)
            print("  [DEBUG] pydub.playback.play() completed")
            return True
        except Exception as e3:
            print(f"  [ERROR] pydub.playback.play failed: {e3}")
            print("  [ERROR] Skipping audio playback for this phrase")
            # Sleep for duration to simulate playback
        duration_seconds = len(segment) / 1000.0
        print(f"  [INFO] Sleeping for {duration_seconds:.1f}s instead...")
        time.sleep(duration_seconds)
        return False


def smart_feed(  # noqa: C901
    audio_path: Path, srt_path: Path, loop: bool = False, count: int = 0, start_at: int = 0
):
    """
    Smart Mode: Use subtitles to slice and feed audio.
    """
    # Pre-flight checks
    if not preflight_checks():
        sys.exit(1)

    # Initialize test statistics
    stats = TestStats()

    # Graceful shutdown handler
    def signal_handler(sig, frame):
        print("\n\n[INTERRUPT] Test interrupted by user")
        stats.print_summary()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)

    print(f"Loading audio: {audio_path}")
    audio = AudioSegment.from_file(str(audio_path))

    # Audio quality validation
    try:
        duration_ms = len(audio)
        if duration_ms < 1000:
            print(f"[ERROR] Audio file too short ({duration_ms}ms). Possibly corrupt?")
            sys.exit(1)

        _ = audio.max
        print(f"[OK] Audio validated: {duration_ms / 1000:.1f}s, max amplitude: {audio.max}")

        if audio.max < 100:
            print(f"[WARNING] Audio appears very quiet (max amplitude: {audio.max})")
            print(
                "This may affect transcription quality. Press Enter to continue or Ctrl+C to abort..."
            )
            input()
    except Exception as e:
        print(f"[ERROR] Failed to validate audio: {e}")
        sys.exit(1)

    print(f"Loading subtitles: {srt_path}")
    subs = pysrt.open(str(srt_path))
    print(f"Found {len(subs)} subtitle lines.")

    # Merge consecutive short subtitles into longer phrases (min 8-10 seconds)
    # This creates more realistic dictation test cases
    print("Merging short subtitles into longer phrases (min 8s)...")
    merged_subs = []
    current_group = None
    min_phrase_duration_ms = 8000  # 8 seconds minimum

    for sub in subs:
        duration_ms = (
            sub.end.hours * 3600 + sub.end.minutes * 60 + sub.end.seconds
        ) * 1000 + sub.end.milliseconds
        duration_ms -= (
            sub.start.hours * 3600 + sub.start.minutes * 60 + sub.start.seconds
        ) * 1000 + sub.start.milliseconds

        # If no current group, start a new one
        if current_group is None:
            current_group = {
                "start": sub.start,
                "end": sub.end,
                "text": sub.text,
                "duration_ms": duration_ms,
            }
        # If current group is too short (< 8 seconds), merge this subtitle into it
        elif current_group["duration_ms"] < min_phrase_duration_ms:
            current_group["end"] = sub.end
            current_group["text"] += " " + sub.text
            current_group["duration_ms"] = (
                current_group["end"].hours * 3600
                + current_group["end"].minutes * 60
                + current_group["end"].seconds
            ) * 1000 + current_group["end"].milliseconds
            current_group["duration_ms"] -= (
                current_group["start"].hours * 3600
                + current_group["start"].minutes * 60
                + current_group["start"].seconds
            ) * 1000 + current_group["start"].milliseconds
        # Otherwise, save current group and start a new one
        else:
            merged_sub = pysrt.SubRipItem()
            merged_sub.start = current_group["start"]
            merged_sub.end = current_group["end"]
            merged_sub.text = current_group["text"]
            merged_subs.append(merged_sub)

            current_group = {
                "start": sub.start,
                "end": sub.end,
                "text": sub.text,
                "duration_ms": duration_ms,
            }

    # Don't forget the last group
    if current_group is not None:
        merged_sub = pysrt.SubRipItem()
        merged_sub.start = current_group["start"]
        merged_sub.end = current_group["end"]
        merged_sub.text = current_group["text"]
        merged_subs.append(merged_sub)

    subs = merged_subs
    total_subs = len(subs)
    print(f"Merged into {total_subs} longer phrases.")
    print("=" * 60)

    # Calculate actual work to be done
    total_to_process = total_subs - start_at if count == 0 else min(count, total_subs - start_at)
    print(f"Will process {total_to_process} phrases starting at index {start_at}")
    print("=" * 60)

    iteration = 0
    last_end_ms = 0  # Track end of previous segment to detect overlaps

    while True:
        iteration += 1
        print(f"\n{'=' * 60}")
        print(f"Loop Iteration {iteration}")
        print(f"{'=' * 60}")

        loop_start_time = time.time()

        for i in range(start_at, total_subs):
            if count > 0 and (i - start_at) >= count:
                break

            sub = subs[i]

            # Calculate progress
            completed = i - start_at
            percent = (completed / total_to_process) * 100 if total_to_process > 0 else 0
            elapsed = time.time() - loop_start_time
            avg_per_phrase = elapsed / completed if completed > 0 else 0
            remaining = (total_to_process - completed) * avg_per_phrase

            # 1. Get Timestamps
            start_ms = (
                sub.start.hours * 3600 + sub.start.minutes * 60 + sub.start.seconds
            ) * 1000 + sub.start.milliseconds
            end_ms = (
                sub.end.hours * 3600 + sub.end.minutes * 60 + sub.end.seconds
            ) * 1000 + sub.end.milliseconds

            # Detect overlap with previous segment
            if start_ms < last_end_ms:
                overlap_ms = last_end_ms - start_ms
                print(
                    f"  [SKIP] Overlaps with previous segment by {overlap_ms}ms - adjusting start time"
                )
                start_ms = last_end_ms + 50  # Start 50ms after previous segment ends

            # Update last_end_ms for next iteration
            last_end_ms = end_ms

            # Subtitle cleanup/buffer (only add buffer at end now, not start)
            end_ms = end_ms + 100

            duration_ms = end_ms - start_ms
            if duration_ms < 300:
                print(f"  [SKIP] Segment too short ({duration_ms}ms)")
                stats.record_skip()
                continue

            # 2. Extract Text
            expected_text = sub.text.replace("\n", " ")
            print(f"\n{'=' * 60}")
            print(
                f"[{i + 1}/{total_subs}] Phrase {completed + 1}/{total_to_process} ({percent:.1f}%)"
            )
            if completed > 0:
                print(
                    f"Elapsed: {elapsed / 60:.1f}m | ETA: {remaining / 60:.1f}m | Avg: {avg_per_phrase:.1f}s/phrase"
                )
            print(f"{'=' * 60}")
            print(f'  [EXPECTED] "{expected_text[:80]}{"..." if len(expected_text) > 80 else ""}"')
            print(
                f"  [TIMING] {start_ms / 1000:.2f}s -> {end_ms / 1000:.2f}s (Duration: {duration_ms / 1000:.2f}s)"
            )

            # 3. Slice Audio
            chunk = audio[start_ms:end_ms]

            # 4. Ensure IDLE before starting
            print("  [SYNC] Waiting for IDLE state...")
            if not wait_for_idle(timeout=30.0):
                print("  [ERROR] App not ready (stuck in non-IDLE state), skipping phrase")
                stats.record_skip()
                continue

            # 5. Start Recording
            if not send_command("START"):
                print("  [ERROR] Failed to start recording")
                stats.record_failure()
                continue

            # 6. Play Audio (BLOCKING) - use try/finally to ensure STOP is always sent
            playback_success = False
            try:
                # Give recorder a moment to stabilize before playing audio
                time.sleep(0.5)
                playback_success = play_audio_with_timeout(chunk)
            except Exception as e:
                print(f"  [ERROR] Audio playback crashed: {e}")
                print("  [INFO] Will still send STOP command...")
            finally:
                # 7. Stop Recording - ALWAYS send this, even if playback failed
                time.sleep(0.5)
                if not send_command("STOP"):
                    print("  [ERROR] Failed to stop recording")
                    stats.record_failure()
                    continue

            # If playback failed completely, mark as failure
            if not playback_success:
                print("  [ERROR] Playback failed, marking as failure")
                stats.record_failure()
                continue

            # 8. Wait for Processing to Complete (poll for IDLE)
            print("  [PROCESSING] Waiting for completion...")
            if not wait_for_idle(timeout=30.0):
                print("  [WARNING] Processing did not complete within timeout")
                stats.record_failure()
            else:
                stats.record_success()
                # Give the app a moment to fully settle before next phrase
                print("  [PAUSE] Waiting 1.0s before next phrase...")
                time.sleep(1.0)

        if not loop:
            break
        start_at = 0

    print("\nTest Complete.")
    stats.print_summary()


def dumb_feed(audio_path: Path, chunk_len_sec: int = 10, loop: bool = False):  # noqa: C901
    """
    Dumb Mode: Slice audio into fixed-length chunks.
    """
    # Pre-flight checks
    if not preflight_checks():
        sys.exit(1)

    # Initialize test statistics
    stats = TestStats()

    # Graceful shutdown handler
    def signal_handler(sig, frame):
        print("\n\n[INTERRUPT] Test interrupted by user")
        stats.print_summary()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)

    print(f"Loading audio: {audio_path}")
    audio = AudioSegment.from_file(str(audio_path))

    # Audio quality validation
    try:
        duration_ms = len(audio)
        if duration_ms < 1000:
            print(f"[ERROR] Audio file too short ({duration_ms}ms). Possibly corrupt?")
            sys.exit(1)

        _ = audio.max
        print(f"[OK] Audio validated: {duration_ms / 1000:.1f}s, max amplitude: {audio.max}")
    except Exception as e:
        print(f"[ERROR] Failed to validate audio: {e}")
        sys.exit(1)

    chunk_len_ms = chunk_len_sec * 1000

    print(f"Slicing into {chunk_len_sec}s chunks...")
    chunks = []
    for i in range(0, len(audio), chunk_len_ms):
        chunks.append(audio[i : i + chunk_len_ms])

    total_chunks = len(chunks)
    print(f"Created {total_chunks} chunks.")
    print("=" * 60)
    print("STARTING TEST...")
    print("=" * 60)
    time.sleep(2)

    iteration = 0

    while True:
        iteration += 1
        print(f"\n{'=' * 60}")
        print(f"Loop Iteration {iteration}")
        print(f"{'=' * 60}")

        loop_start_time = time.time()

        for i, chunk in enumerate(chunks):
            # Calculate progress
            percent = ((i + 1) / total_chunks) * 100
            elapsed = time.time() - loop_start_time
            avg_per_chunk = elapsed / (i + 1)
            remaining = (total_chunks - (i + 1)) * avg_per_chunk

            print(f"\n{'=' * 60}")
            print(f"Chunk {i + 1}/{total_chunks} ({percent:.1f}%)")
            if i > 0:
                print(
                    f"Elapsed: {elapsed / 60:.1f}m | ETA: {remaining / 60:.1f}m | Avg: {avg_per_chunk:.1f}s/chunk"
                )
            print(f"{'=' * 60}")

            # Ensure IDLE before starting
            print("  [SYNC] Waiting for IDLE state...")
            if not wait_for_idle(timeout=30.0):
                print("  [ERROR] App not ready, skipping chunk")
                stats.record_skip()
                continue

            if not send_command("START"):
                print("  [ERROR] Failed to start recording")
                stats.record_failure()
                continue

            # Play audio with error protection
            playback_success = False
            try:
                time.sleep(0.5)
                playback_success = play_audio_with_timeout(chunk)
                time.sleep(1.0)
            except Exception as e:
                print(f"  [ERROR] Audio playback crashed: {e}")
                print("  [INFO] Will still send STOP command...")
            finally:
                # Always send STOP, even if playback failed
                if not send_command("STOP"):
                    print("  [ERROR] Failed to stop recording")
                    stats.record_failure()
                    continue

            if not playback_success:
                print("  [ERROR] Playback failed, marking as failure")
                stats.record_failure()
                continue

            print("  [PROCESSING] Waiting for completion...")
            if not wait_for_idle(timeout=30.0):
                print("  [WARNING] Processing did not complete within timeout")
                stats.record_failure()
            else:
                stats.record_success()

        if not loop:
            break

    print("\nTest Complete.")
    stats.print_summary()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="dIKtate Audio Feeder")
    parser.add_argument("--file", help="Path to audio file (wav/mp3)")
    parser.add_argument("--subs", help="Path to subtitle file (srt)")
    parser.add_argument(
        "--last-download", action="store_true", help="Use the most recent download from fixtures"
    )
    parser.add_argument("--loop", action="store_true", help="Loop infinitely")
    parser.add_argument("--count", type=int, default=0, help="Number of lines to test (0=all)")
    parser.add_argument(
        "--start-at", type=int, default=0, help="Subtitle index to start from (0-indexed)"
    )
    parser.add_argument(
        "--chunk-size", type=int, default=10, help="Chunk size for dumb mode (seconds)"
    )
    parser.add_argument(
        "--no-simpleaudio",
        action="store_true",
        help="Force use of pydub.playback.play (slower but more stable)",
    )

    args = parser.parse_args()

    # Override simpleaudio if requested
    if args.no_simpleaudio:
        USE_SIMPLEAUDIO = False
        print("[INFO] simpleaudio disabled, using pydub.playback.play")

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
