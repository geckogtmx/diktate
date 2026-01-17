# Manual Testing Procedure

> **Goal:** Verify end-to-end performance and accuracy of dIKtate.
> **Frequency:** Required before every commit that touches `processor.py`, `transcriber.py`, or `prompts.py`.

## 1. Setup
1.  Ensure `dIKtate` is running (`pnpm dev` or installed exec).
2.  Open **Notepad** (or any text field).
3.  Have `docs/qa/MANUAL_TEST_SCRIPT.txt` visible.

## 2. Execution
1.  Press **Global Hotkey** (`Ctrl+Alt+D`) to start recording.
2.  Read the **Standard Script** aloud, including the filler words and corrections.
    *   *Natural Pace* - don't rush, don't drag.
3.  Press **Global Hotkey** (`Ctrl+Alt+D`) to stop.

## 3. Verification Criteria
1.  **Latency:** Observe the time from "Stop" to "Text Injection".
    *   **Pass:** < 7 seconds.
    *   **Fail:** > 10 seconds.
2.  **Accuracy (Standard Mode):**
    *   **Fillers Removed:** `(uhmm)`, `(ahhhh)` should be gone.
    *   **Corrections Applied:** "pineapples" should be replaced by "apples".
    *   **Profanity Kept:** `(fucking)` should be preserved.
    *   **Capitalization:** "This Time It's a Clean..." should be title-cased or sentence-cased appropriately.

## 4. Log Analysis (Mandatory)
1.  Run the `/test-diktate` workflow to have the AI analyze the logs.
2.  OR manually check `%APPDATA%/diktate/logs/electron-LATEST.log`.
3.  Look for `[PERF] total: Xms`.

## 5. Reporting
*   If **PASS**: Commit with metrics in message.
*   If **FAIL**: Do NOT commit. Revert or debug.
