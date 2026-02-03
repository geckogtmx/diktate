import sqlite3
from pathlib import Path


def estimate_cost():
    db_path = Path.home() / ".diktate" / "history.db"

    if not db_path.exists():
        print(f"Database not found at {db_path}")
        return

    print(f"Reading database: {db_path}")

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT raw_text, processed_text, audio_duration_s, mode FROM history")
        rows = cursor.fetchall()

        total_input_chars = 0
        total_output_chars = 0
        total_audio_seconds = 0
        session_count = len(rows)

        masked_input_count = 0
        masked_output_count = 0

        for row in rows:
            # INPUT
            raw = row["raw_text"]
            audio = row["audio_duration_s"] or 0
            total_audio_seconds += audio

            if raw and not raw.startswith("[HIDDEN"):
                total_input_chars += len(raw)
            else:
                masked_input_count += 1
                # Estimate from audio if text hidden: 3 words/sec * 5 chars/word = 15 chars/sec
                total_input_chars += audio * 15

            # OUTPUT
            processed = row["processed_text"]
            if processed and not processed.startswith("[HIDDEN"):
                total_output_chars += len(processed)
            else:
                masked_output_count += 1
                # Estimate output based on input (heuristics)
                # Refine: 1x input
                # Ask: 2x input (verbose)
                # Dictate: 1x input
                mode = row["mode"]
                est_input = len(raw) if raw and not raw.startswith("[HIDDEN") else (audio * 15)

                if mode == "ask":
                    total_output_chars += est_input * 2
                else:
                    total_output_chars += est_input

        conn.close()

        # Pricing Gemini 1.5 Flash (Approx)
        # Input: $0.10 / 1M tokens
        # Output: $0.40 / 1M tokens
        # 1 Token ~= 4 Chars

        input_tokens = total_input_chars / 4
        output_tokens = total_output_chars / 4

        cost_input = (input_tokens / 1_000_000) * 0.10
        cost_output = (output_tokens / 1_000_000) * 0.40
        total_cost = cost_input + cost_output

        print(f"\n--- COST ANALYSIS ({session_count} Sessions) ---")
        print(f"Total Audio: {total_audio_seconds / 60:.2f} minutes")
        print(f"Est. Input Tokens: {int(input_tokens):,} (${cost_input:.5f})")
        print(f"Est. Output Tokens: {int(output_tokens):,} (${cost_output:.5f})")
        print("-------------------------------------------")
        print(f"TOTAL ESTIMATED COST: ${total_cost:.5f}")
        print("-------------------------------------------")
        print(f"Avg Cost per Session: ${(total_cost / session_count if session_count else 0):.5f}")

    except sqlite3.Error as e:
        print(f"Database error: {e}")


if __name__ == "__main__":
    estimate_cost()
