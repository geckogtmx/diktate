#!/usr/bin/env python3
"""
Fetch Test Data from YouTube
Downloads audio (as WAV) and subtitles (as SRT) for use with audio_feeder.py.
"""

import argparse
import os
import shutil
from pathlib import Path

import yt_dlp


def fetch_data(url: str, output_dir: str):  # noqa: C901
    """Download audio and subtitles from YouTube URL."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print(f"Downloading from: {url}")
    print(f"Output directory: {output_path}")

    # FFmpeg auto-detection (especially for WinGet)
    ffmpeg_loc = None
    if not shutil.which("ffmpeg"):
        # Check WinGet Links folder
        winget_links = (
            Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft/WinGet/Links/ffmpeg.exe"
        )
        if winget_links.exists():
            ffmpeg_loc = str(winget_links.parent)
            print(f"[INFO] Auto-detected FFmpeg at: {ffmpeg_loc}")

    # yt-dlp options
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": str(output_path / "%(id)s.%(ext)s"),
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "wav",
                "preferredquality": "192",
            }
        ],
        "writesubtitles": True,
        "subtitleslangs": ["en"],
        "writeautomaticsub": True,  # Fallback to auto-generated subs
        "subtitlesformat": "srt",
        "quiet": False,
        "no_warnings": False,
    }

    if ffmpeg_loc:
        ydl_opts["ffmpeg_location"] = ffmpeg_loc

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # First, check availability of subtitles if possible
            info = ydl.extract_info(url, download=True)
            video_id = info["id"]
            video_title = info.get("title", "Unknown")

            # Check for subtitles in the metadata
            subs = info.get("subtitles", {})
            auto_subs = info.get("automatic_captions", {})
            has_subs = ("en" in subs) or ("en" in auto_subs)

            print(f"\nSuccess! Downloaded: {video_title} ({video_id})")

            # Verify files exist
            wav_file = output_path / f"{video_id}.wav"
            srt_files = list(output_path.glob(f"{video_id}*.srt"))

            if wav_file.exists():
                print(f"[OK] Audio: {wav_file}")

                # Extract Metadata via FFprobe
                print("\n[METADATA] Audio Analysis:")
                import json
                import subprocess

                ffprobe_cmd = [
                    "ffprobe" if not ffmpeg_loc else os.path.join(ffmpeg_loc, "ffprobe.exe"),
                    "-v",
                    "quiet",
                    "-print_format",
                    "json",
                    "-show_format",
                    "-show_streams",
                    str(wav_file),
                ]

                try:
                    res = subprocess.run(ffprobe_cmd, capture_output=True, text=True)
                    if res.returncode == 0:
                        meta = json.loads(res.stdout)
                        if "streams" in meta and len(meta["streams"]) > 0:
                            stream = meta["streams"][0]
                            duration = float(meta["format"].get("duration", 0))
                            print(f"  - Duration: {duration:.2f}s")
                            print(f"  - Sample Rate: {stream.get('sample_rate')}Hz")
                            print(f"  - Channels: {stream.get('channels')}")
                            print(f"  - Bit Depth: {stream.get('bits_per_sample', 'unknown')} bits")
                    else:
                        print("  - Could not extract metadata via ffprobe")
                except Exception as e:
                    print(f"  - Metadata extraction error: {e}")
            else:
                print(f"[ERROR] Audio file not found at {wav_file}")

            if srt_files:
                print(f"[OK] Subtitles found and downloaded: {srt_files[0]}")
                print("[RESULT: SMART_MODE_READY]")
            else:
                if not has_subs:
                    print(
                        "[CRITICAL] No English subtitles available for this video (Human or Auto)."
                    )
                else:
                    print("[WARNING] Subtitles were expected but file not found on disk.")
                print("[RESULT: DUMB_MODE_ONLY]")

            return video_id

    except Exception as e:
        print(f"\n[ERROR] Download failed: {e}")
        return None


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Fetch test data from YouTube for dIKtate stress testing."
    )
    parser.add_argument("url", help="YouTube Video URL")
    parser.add_argument("--output", default="tests/fixtures/downloads", help="Output directory")

    args = parser.parse_args()

    # Root relative path fix
    if not os.path.isabs(args.output):
        # Assuming script is in python/tools/, go up to root
        root_dir = Path(__file__).resolve().parent.parent.parent
        output_dir = root_dir / args.output
    else:
        output_dir = Path(args.output)

    fetch_data(args.url, str(output_dir))
