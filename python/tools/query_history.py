#!/usr/bin/env python3
"""
Diagnostic utility for querying the dIKtate history database.
Provides command-line tools for searching, analyzing, and debugging history logs.

Usage:
  python query_history.py --stats
  python query_history.py --search "hallucination phrase"
  python query_history.py --errors
  python query_history.py --mode dictate
  python query_history.py --recent 10
"""

import argparse
import sys
from pathlib import Path
from datetime import datetime

# Try to import tabulate, fall back to simple formatting
try:
    from tabulate import tabulate
    HAS_TABULATE = True
except ImportError:
    HAS_TABULATE = False
    def tabulate(rows, headers=None, tablefmt=None):
        """Simple fallback table formatter"""
        if not rows:
            return ""
        output = []
        if headers:
            output.append(" | ".join(str(h) for h in headers))
            output.append("-" * (sum(len(str(h)) for h in headers) + len(headers) * 3))
        for row in rows:
            output.append(" | ".join(str(cell) for cell in row))
        return "\n".join(output)

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.history_manager import HistoryManager


def format_timestamp(iso_string):
    """Convert ISO timestamp to readable format"""
    if not iso_string:
        return "N/A"
    try:
        dt = datetime.fromisoformat(iso_string)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return iso_string


def truncate_text(text, max_length=50):
    """Truncate long text for display"""
    if not text:
        return "(empty)"
    if len(text) > max_length:
        return text[:max_length] + "..."
    return text


def show_statistics(manager):
    """Display overall history statistics"""
    print("\n" + "=" * 70)
    print("HISTORY STATISTICS")
    print("=" * 70)

    stats = manager.get_statistics()

    print(f"\nTotal Sessions:      {stats['total_sessions']}")
    print(f"Successful:          {stats['successful_sessions']}")
    print(f"Failed:              {stats['failed_sessions']}")
    print(f"Success Rate:        {stats['success_rate']:.1f}%")

    print("\nPerformance (avg for successful sessions):")
    print(f"  Transcription:     {stats['avg_transcription_ms']:.0f}ms")
    print(f"  Processing:        {stats['avg_processing_ms']:.0f}ms")
    print(f"  Total:             {stats['avg_total_ms']:.0f}ms")

    if stats['by_mode']:
        print("\nSessions by mode:")
        for mode, count in stats['by_mode'].items():
            print(f"  {mode.capitalize():12} {count:3} sessions")

    print()


def show_search_results(results, max_rows=20):
    """Display search results in table format"""
    if not results:
        print("\nNo results found.")
        return

    print(f"\nFound {len(results)} result(s):\n")

    # Prepare table data
    rows = []
    for row in results[:max_rows]:
        rows.append([
            format_timestamp(row.get('timestamp', 'N/A')),
            row.get('mode', 'N/A').capitalize(),
            "✓" if row.get('success') else "✗",
            truncate_text(row.get('raw_text', ''), 40),
            truncate_text(row.get('processed_text', ''), 40),
        ])

    headers = ["Timestamp", "Mode", "OK", "Raw Text", "Processed Text"]
    print(tabulate(rows, headers=headers, tablefmt="grid"))

    if len(results) > max_rows:
        print(f"\n(Showing {max_rows} of {len(results)} results)")


def show_errors(manager, limit=20):
    """Display error sessions"""
    print("\n" + "=" * 70)
    print("ERROR SESSIONS")
    print("=" * 70)

    errors = manager.get_error_sessions(limit=limit)

    if not errors:
        print("\nNo error sessions found. Great!")
        return

    print(f"\nFound {len(errors)} error(s):\n")

    rows = []
    for error in errors:
        rows.append([
            format_timestamp(error.get('timestamp', 'N/A')),
            error.get('mode', 'N/A').capitalize(),
            truncate_text(error.get('error_message', ''), 50),
        ])

    headers = ["Timestamp", "Mode", "Error"]
    print(tabulate(rows, headers=headers, tablefmt="grid"))
    print()


def show_mode_sessions(manager, mode, limit=20):
    """Display sessions for a specific mode"""
    print("\n" + "=" * 70)
    print(f"{mode.upper()} MODE SESSIONS")
    print("=" * 70)

    sessions = manager.get_sessions_by_mode(mode, limit=limit)

    if not sessions:
        print(f"\nNo {mode} sessions found.")
        return

    print(f"\nFound {len(sessions)} session(s):\n")

    rows = []
    for session in sessions:
        rows.append([
            format_timestamp(session.get('timestamp', 'N/A')),
            f"{session.get('total_time_ms', 0):.0f}ms",
            "✓" if session.get('success') else "✗",
            truncate_text(session.get('raw_text', ''), 40),
            truncate_text(session.get('processed_text', ''), 40),
        ])

    headers = ["Timestamp", "Total Time", "OK", "Raw Text", "Processed Text"]
    print(tabulate(rows, headers=headers, tablefmt="grid"))
    print()


def show_recent_sessions(manager, limit=10):
    """Display the most recent sessions"""
    print("\n" + "=" * 70)
    print(f"RECENT {limit} SESSIONS")
    print("=" * 70)

    # Get recent from all modes
    all_sessions = []
    for mode in ['dictate', 'ask', 'refine', 'translate']:
        sessions = manager.get_sessions_by_mode(mode, limit=100)
        all_sessions.extend(sessions)

    # Sort by timestamp descending and take first N
    all_sessions.sort(
        key=lambda x: x.get('timestamp', ''),
        reverse=True
    )
    recent = all_sessions[:limit]

    if not recent:
        print("\nNo sessions found.")
        return

    print()
    rows = []
    for session in recent:
        rows.append([
            format_timestamp(session.get('timestamp', 'N/A')),
            session.get('mode', 'N/A').capitalize(),
            f"{session.get('total_time_ms', 0):.0f}ms",
            "✓" if session.get('success') else "✗",
            truncate_text(session.get('raw_text', ''), 35),
        ])

    headers = ["Timestamp", "Mode", "Total Time", "OK", "Text"]
    print(tabulate(rows, headers=headers, tablefmt="grid"))
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Query dIKtate history database"
    )

    parser.add_argument(
        '--stats',
        action='store_true',
        help='Show overall statistics'
    )
    parser.add_argument(
        '--search',
        type=str,
        help='Search for phrase in history'
    )
    parser.add_argument(
        '--errors',
        action='store_true',
        help='Show error sessions'
    )
    parser.add_argument(
        '--mode',
        type=str,
        choices=['dictate', 'ask', 'refine', 'translate'],
        help='Filter by recording mode'
    )
    parser.add_argument(
        '--recent',
        type=int,
        metavar='N',
        help='Show N most recent sessions'
    )
    parser.add_argument(
        '--db',
        type=str,
        help='Custom database path (default: ~/.diktate/history.db)'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=50,
        help='Limit results (default: 50)'
    )

    args = parser.parse_args()

    # Initialize manager
    try:
        manager = HistoryManager(db_path=args.db)
    except Exception as e:
        print(f"Error initializing history manager: {e}")
        sys.exit(1)

    try:
        # Execute requested command
        if args.stats:
            show_statistics(manager)
        elif args.search:
            results = manager.search_by_phrase(args.search, limit=args.limit)
            show_search_results(results, max_rows=args.limit)
        elif args.errors:
            show_errors(manager, limit=args.limit)
        elif args.mode:
            show_mode_sessions(manager, args.mode, limit=args.limit)
        elif args.recent:
            show_recent_sessions(manager, limit=args.recent)
        else:
            # Default: show stats
            show_statistics(manager)

    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)
    finally:
        manager.shutdown()


if __name__ == '__main__':
    main()
