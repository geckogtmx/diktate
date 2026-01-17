---
description: Verify the results of a manual dIKtate dictation test by analyzing the latest logs.
---

# Test Diktate Workflow

This workflow is used to verify the "Standard Manual Test" described in `docs/qa/TEST_PROCEDURE.md`.

## 1. Prerequisites Check
Ask the user: "Have you performed the manual dictation test using the script in `docs/qa/MANUAL_TEST_SCRIPT.txt`? If not, please do so now."
**Wait for user confirmation.**

## 2. Locate Logs
1. Find the `logs/` directory in `%APPDATA%/diktate/logs`.
2. Sort by date and identify the **LATEST** log file.
3. Read the content of the latest log file.

## 3. Analyze Metrics
Look for the `[PERF]` tags in the log, specifically the final summary line:
`[PERF] Session complete - Total: Xms`

Extract:
- **Total Duration:** (ms)
- **Transcription:** (ms)
- **Processing:** (ms)
- **Injection:** (ms)

## 4. Evaluate Success
Compare against baselines:
- **Total:** < 7000ms (7s) = PASS
- **Total:** > 10000ms (10s) = FAIL

## 5. Report
Output a summary table to the user:

| Metric | Measured | Target | Status |
|--------|----------|--------|--------|
| Total  | X ms     | < 7000 | ✅/❌  |
| ...    | ...      | ...    | ...    |

If **FAIL**, recommend reverting recent changes or optimizing `prompts.py`.
