#!/usr/bin/env python3
"""
Fetch Test Data from YouTube
Downloads audio (as WAV) and subtitles (as SRT) for use with audio_feeder.py.
"""

import os
import sys
import argparse
import shutil
from pathlib import Path
import yt_dlp

def fetch_data(url: str, output_dir: str):
    """Download audio and subtitles from YouTube URL."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    print(f"Downloading from: {url}")
    print(f"Output directory: {output_path}")

    # FFmpeg auto-detection (especially for WinGet)
    ffmpeg_loc = None
    if not shutil.which("ffmpeg"):
        # Check WinGet Links folder
        winget_links = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft/WinGet/Links/ffmpeg.exe"
        if winget_links.exists():
            ffmpeg_loc = str(winget_links.parent)
            print(f"[INFO] Auto-detected FFmpeg at: {ffmpeg_loc}")

    # yt-dlp options
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': str(output_path / '%(id)s.%(ext)s'),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
            'preferredquality': '192',
        }],
        'writesubtitles': True,
        'subtitleslangs': ['en'],
        'writeautomaticsub': True, # Fallback to auto-generated subs
        'subtitlesformat': 'srt',
        'quiet': False,
        'no_warnings': False,
    }

    if ffmpeg_loc:
        ydl_opts['ffmpeg_location'] = ffmpeg_loc

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # First, check availability of subtitles if possible
            info = ydl.extract_info(url, download=True)
            video_id = info['id']
            video_title = info.get('title', 'Unknown')
            
            # Check for subtitles in the metadata
            subs = info.get('subtitles', {})
            auto_subs = info.get('automatic_captions', {})
            has_subs = ('en' in subs) or ('en' in auto_subs)
            
            print(f"\nSuccess! Downloaded: {video_title} ({video_id})")
            
            # Verify files exist
            wav_file = output_path / f"{video_id}.wav"
            srt_files = list(output_path.glob(f"{video_id}*.srt"))
            
            if wav_file.exists():
                print(f"[OK] Audio: {wav_file}")
            else:
                print(f"[ERROR] Audio file not found at {wav_file}")

            if srt_files:
                print(f"[OK] Subtitles found and downloaded: {srt_files[0]}")
                print(f"[RESULT: SMART_MODE_READY]")
            else:
                if not has_subs:
                    print(f"[CRITICAL] No English subtitles available for this video (Human or Auto).")
                else:
                    print(f"[WARNING] Subtitles were expected but file not found on disk.")
                print(f"[RESULT: DUMB_MODE_ONLY]")
                
            return video_id

    except Exception as e:
        print(f"\n[ERROR] Download failed: {e}")
        return None

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch test data from YouTube for dIKtate stress testing.")
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
