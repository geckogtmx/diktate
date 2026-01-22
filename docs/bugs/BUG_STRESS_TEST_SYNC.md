# BUG: Stress Test Synchronization Failure (TCP Control)

## Status
**Status:** OPEN
**Severity:** HIGH (Blocks automated stress testing)
**Last Updated:** 2026-01-21

## Description
The automated stress test suite (`audio_feeder.py`) uses a TCP command server on port 5005 to control the dIKtate app. While the initial `START` command works, the system frequently enters a desynchronized state where the app remains in the `RECORDING` state indefinitely.

### Symptoms
1.  dIKtate starts recording when the feeder sends the `START` command.
2.  The `STOP` command either:
    -   Is never sent by the feeder because it's hanging on audio playback.
    -   Is received by the Python backend but fails to transition the state back to `IDLE`.
3.  Subsequent dictation attempts (manual or automated) fail with: `Cannot start recording in recording state`.

## Technical Analysis

### 1. Playback Blocking
The `audio_feeder.py` used `pydub.play` which spawns an external process. If this process hangs or takes longer than expected, the Python script never reaches the `send_command("STOP")` line.
*   **Attempted Fix:** Switched to `simpleaudio` for strictly blocking memory-based playback.

### 2. TCP Server Reliability
The `ipc_server.py` TCP handler was basic and lacked robust error recovery.
*   **Attempted Fix:** Added forced state resets in `ipc_server.py` when a `START` command arrives while the app is already in `RECORDING` or `PROCESSING` mode.

### 3. State Machine Lock
The logs show that even with forced resets, the Electron Main process and the Python Backend can get out of sync regarding the "Icon State" and the "Internal State".

## Steps to Reproduce
1.  Start dIKtate.
2.  Run `npm run dev` in `tests/ui`.
3.  Start a "Smart Mode" test with a YouTube video.
4.  Observe that after 1-2 phrases, the app gets stuck in the "Recording" icon state and ignores further commands.

## Proposed Path Forward
-   **Hardware Handshake:** Implement a more robust handshake where the feeder waits for an `ACK` of the state change before playing audio.
-   **Timeout Guard:** Add a hard timeout to the `RECORDING` state in the Python backend (e.g., auto-stop after 30s if no command is received).
-   **IPC Synchronization**: Ensure the Electron Main process can force a "Global Reset" of the Python state if it detects a timeout.
