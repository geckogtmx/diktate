# Mute Detection Strategy: Two-Phase Approach

## Problem Statement
Users experience **silence hallucinations** when recording with muted microphones. Whisper transcribes silence as noise artifacts (`[Music]`, `[Thank You]`, etc.). This wastes processing time and frustrates users.

## Solution: Split Detection into Two Phases

### Phase 1: Pre-Recording Detection (Preventive)
**Goal:** Detect hardware mute *before* recording starts. Fail fast, don't waste time/resources.

**Implementation:**
- Use `pycaw` (Python Core Audio Windows library) to query microphone mute state
- Check happens in `recorder.py` at the start of `record()` method
- If muted: emit `mic-muted` event, show user notification immediately ("Microphone is muted. Please unmute and try again.")
- If not muted: proceed to recording normally

**Benefit:**
- Zero wasted recording time
- Instant user feedback
- Addresses the root cause (hardware mute)

**Files to modify:**
- `python/core/recorder.py`: Add pre-recording mute check

**Questions to resolve:**
- [ ] Is `pycaw` already in `requirements.txt`?
- [ ] How do we handle multiple audio devices? (Use default input device, or let user select?)

---

### Phase 2: Post-Recording Detection (Catch-All)
**Goal:** Detect other audio quality issues that cause hallucinations: bad microphone, noisy room, music playing, very low volume, etc.

**Implementation:**
- After recording completes, in `recorder.py` `save_to_file()` method:
  - Calculate **RMS amplitude** of recorded audio (using stdlib `audioop`)
  - If RMS is suspiciously low/high, log warning and return quality flag
- In `ipc_server.py` `_process_recording()`:
  - Check audio quality flag before transcription
  - If audio is bad quality, optionally skip Whisper or add low-confidence warning
  - Keep existing `[Music]` filter as final failsafe

**Benefit:**
- Catches issues Phase 1 didn't (bad mic quality, interference, etc.)
- Runs post-recording (cost is minimal: RMS calc ~1ms vs transcription ~2-5s)
- Helps diagnose real audio issues

**Files to modify:**
- `python/core/recorder.py`: Add post-recording RMS detection
- `python/ipc_server.py`: Add quality flag handling in `_process_recording()`

**Threshold tuning:**
- RMS < 50: Likely silence or very quiet recording
- RMS > 32000: Likely clipping/distortion
- (These are starting points; tune based on testing)

---

## Implementation Order

1. **Phase 1 (Pre-recording)** ← Do this first
   - Add pycaw dependency check
   - Implement mute detection in `recorder.py`
   - Test: Mute mic → See notification immediately

2. **Phase 2 (Post-recording)** ← Do this second
   - Add RMS calculation in `recorder.py`
   - Add quality flag handling in `ipc_server.py`
   - Test: Record with various audio quality issues → Verify warnings logged

---

## Success Criteria

- [ ] Pre-recording: User never records when mic is muted
- [ ] Post-recording: User gets warnings for suspicious audio quality
- [ ] No additional execution time on happy path (non-muted, good audio)
- [ ] `npm test` and `pytest` pass
