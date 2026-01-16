# Phase 3 Testing Guide

**Purpose:** Validate dIKtate works correctly across multiple applications and verify all error handling and performance improvements.

**Date:** 2026-01-16
**Phase:** Phase 3 (Integration & Testing)

---

## Overview

This guide provides step-by-step instructions for testing the Phase 3 improvements:
- Error handling and logging
- Performance metrics tracking
- Multi-application compatibility

---

## Prerequisites

### System Requirements
- Windows 10/11
- Python 3.11+ with venv activated
- Node.js 18+
- Ollama installed and running (optional)

### Setup Verification

```bash
# 1. Verify Python backend
cd python && source venv/Scripts/activate
python verify_setup.py
# Expected: [SUCCESS] All checks passed!

# 2. Verify TypeScript compilation
cd /e/git/diktate
npx tsc
# Expected: No errors

# 3. Check Ollama (optional)
ollama list
# Expected: llama3:8b or similar model listed
```

---

## Test Checkpoint 3: Error Handling & Logging

### Test 3.1: Electron File Logging

**Objective:** Verify Electron logs to file correctly

**Steps:**
1. Run the application:
   ```bash
   npm run dev
   ```

2. Check log file creation:
   ```bash
   # Windows
   ls %APPDATA%/diktate/logs/
   # Expected: electron-*.log file exists
   ```

3. Trigger various events (start/stop recording, errors)

4. Verify log file contains entries:
   ```bash
   cat %APPDATA%/diktate/logs/electron-*.log
   # Expected: Timestamped log entries with [INFO], [WARN], [ERROR] levels
   ```

**Success Criteria:**
- ✅ Log file created in userData/logs/
- ✅ All events logged with timestamps
- ✅ Error messages include stack traces
- ✅ Log levels (DEBUG, INFO, WARN, ERROR) working correctly

---

### Test 3.2: Tray Notifications

**Objective:** Verify system notifications appear on errors and events

**Steps:**
1. Start the application
2. **Test: Startup notification**
   - Expected: "dIKtate Ready" notification appears

3. **Test: Error notification**
   - Stop Ollama server: `ollama stop` (if running)
   - Try to record and process
   - Expected: Error notification appears with descriptive message

4. **Test: Connection lost notification**
   - Kill Python process manually
   - Expected: "dIKtate - Connection Lost" notification

5. **Test: Hotkey conflict notification**
   - Register Ctrl+Shift+Space in another app
   - Start dIKtate
   - Expected: Hotkey registration failure notification

**Success Criteria:**
- ✅ Startup notification shows
- ✅ Error notifications show with clear messages
- ✅ Notifications are non-intrusive (don't block workflow)
- ✅ Critical errors marked as urgent

---

### Test 3.3: Python Reconnection

**Objective:** Verify automatic reconnection works

**Steps:**
1. Start application normally
2. Kill Python process:
   ```bash
   # Find Python process
   tasklist | findstr python
   # Kill it
   taskkill /PID <pid> /F
   ```

3. Observe logs:
   - Expected: "Attempting to reconnect (attempt 1/5)" messages
   - Expected: Tray state shows "Reconnecting..."

4. Verify reconnection succeeds within 10 seconds

5. Test recording after reconnection

**Success Criteria:**
- ✅ Reconnection attempts logged (up to 5)
- ✅ Successful reconnection within 10 seconds
- ✅ Recording works after reconnection
- ✅ Fatal error notification if max attempts reached

---

## Test Checkpoint 4: Performance Metrics

### Test 4.1: Performance Logging

**Objective:** Verify performance metrics are tracked and logged

**Steps:**
1. Start application with logging enabled
2. Record a 3-5 second utterance
3. Check Python log for performance metrics:
   ```bash
   cat ~/.diktate/logs/diktate.log | grep PERF
   ```

4. Expected metrics:
   ```
   [PERF] recording: 3000-5000ms
   [PERF] transcription: 2000-10000ms (CPU) or 500-2000ms (GPU)
   [PERF] processing: 1000-5000ms
   [PERF] injection: 1000-3000ms
   [PERF] Session complete - Total: 7000-20000ms
   ```

5. Check Electron log for metrics reception:
   ```bash
   cat %APPDATA%/diktate/logs/electron-*.log | grep "Performance metrics"
   ```

**Success Criteria:**
- ✅ All 5 metrics logged (recording, transcription, processing, injection, total)
- ✅ Metrics are in milliseconds
- ✅ Total time matches sum of stages (±200ms)
- ✅ Electron receives and logs Python metrics

---

### Test 4.2: Performance Baselines

**Objective:** Establish performance baselines

**Test Cases:**

| Scenario | Expected E2E Latency | Notes |
|----------|---------------------|-------|
| 3-second utterance (CPU) | 10-20 seconds | Acceptable for MVP |
| 3-second utterance (GPU) | 5-10 seconds | Ideal target |
| 10-second utterance (CPU) | 30-60 seconds | Still usable |
| Simple phrase | 8-15 seconds | Minimal processing |

**Steps:**
1. Record 5 samples for each scenario
2. Calculate average total time
3. Compare against expected latency
4. Document any outliers

**Success Criteria:**
- ✅ 90% of tests within expected latency range
- ✅ No crashes during performance testing
- ✅ Consistent performance across runs (±20%)

---

## Test Checkpoint 5: Multi-Application Testing

### Test 5.1: VS Code

**Objective:** Verify text injection in VS Code editor

**Steps:**
1. Open VS Code
2. Create new file or open existing one
3. Click in the editor
4. Press Ctrl+Shift+Space and speak: "Hello world this is a test"
5. Release hotkey
6. Verify text appears in editor

**Test Cases:**
- [ ] New file
- [ ] Existing file with content
- [ ] Different file types (.txt, .js, .py, .md)
- [ ] Multiple VS Code windows
- [ ] Special characters: "Use quotes, commas, and punctuation."

**Success Criteria:**
- ✅ Text appears in correct cursor position
- ✅ No character loss
- ✅ Punctuation and capitalization preserved
- ✅ Cursor positioned at end of inserted text

---

### Test 5.2: Notepad

**Objective:** Verify text injection in Windows Notepad

**Steps:**
1. Open Notepad
2. Activate recording and speak
3. Verify text appears

**Test Cases:**
- [ ] Empty Notepad window
- [ ] Notepad with existing text
- [ ] Multi-line dictation
- [ ] Special characters and numbers

**Success Criteria:**
- ✅ All text appears correctly
- ✅ Works with Notepad and Notepad++
- ✅ No formatting issues

---

### Test 5.3: Google Chrome

**Objective:** Verify text injection in web forms

**Steps:**
1. Open Chrome
2. Navigate to various websites:
   - Gmail (compose email)
   - Google Docs
   - Text input fields (search bars, forms)
3. Test recording in each

**Test Cases:**
- [ ] Gmail compose window
- [ ] Google Docs
- [ ] Reddit comment box
- [ ] GitHub issue/PR description
- [ ] Search bars (Google, Bing)

**Success Criteria:**
- ✅ Text appears in focused input field
- ✅ Works in rich text editors (Google Docs)
- ✅ Works in plain text inputs (forms)
- ✅ No conflicts with browser shortcuts

---

### Test 5.4: Slack

**Objective:** Verify text injection in Slack desktop app

**Steps:**
1. Open Slack desktop app
2. Click in message input field
3. Record and speak
4. Verify text appears

**Test Cases:**
- [ ] Channel message
- [ ] Direct message
- [ ] Thread reply
- [ ] Search bar
- [ ] Message editing

**Success Criteria:**
- ✅ Text appears in correct input field
- ✅ Works in all message contexts
- ✅ No interference with Slack shortcuts

---

### Test 5.5: Microsoft Word

**Objective:** Verify text injection in Word

**Steps:**
1. Open Microsoft Word
2. Create new document
3. Test recording

**Test Cases:**
- [ ] New document
- [ ] Existing document
- [ ] Different cursor positions (start, middle, end)
- [ ] With formatting applied (bold, italic)

**Success Criteria:**
- ✅ Text appears at cursor position
- ✅ Preserves existing formatting
- ✅ No document corruption
- ✅ Works with Word 2016, 2019, Office 365

---

## Test Checkpoint 6: Edge Cases & Error Scenarios

### Test 6.1: Recording Errors

**Test Cases:**

1. **No microphone available**
   - Disable microphone in Windows
   - Try to record
   - Expected: Error notification, graceful failure

2. **Microphone permission denied**
   - Revoke microphone permission
   - Expected: Clear error message with instructions

3. **Recording too long**
   - Record continuously for 60+ seconds
   - Expected: Should work (no max limit yet)

4. **Multiple rapid recordings**
   - Start/stop recording 10 times quickly
   - Expected: No crashes, all recordings processed

---

### Test 6.2: Processing Errors

**Test Cases:**

1. **Ollama server offline**
   - Stop Ollama: `ollama stop`
   - Record and speak
   - Expected: Raw text injected (no processing), warning logged

2. **Whisper model missing**
   - Delete Whisper model cache
   - Record
   - Expected: Model auto-downloads on first run

3. **Empty recording**
   - Record silence (3 seconds)
   - Expected: Empty or "[No audio detected]" message

4. **Audio file corruption**
   - Simulate by deleting temp file mid-processing
   - Expected: Error logged, graceful recovery

---

### Test 6.3: System Integration

**Test Cases:**

1. **Application in background**
   - Minimize all windows
   - Press hotkey
   - Expected: Still works, tray icon updates

2. **Hotkey while another app has focus**
   - Focus on any application
   - Press Ctrl+Shift+Space
   - Expected: Recording starts, text injects to focused app

3. **Rapid application switching**
   - Start recording in App A
   - Switch to App B before releasing
   - Expected: Text injects to App B (current focus)

4. **Application restart**
   - Close and restart dIKtate
   - Expected: Reconnects, ready within 10 seconds

---

## Test Summary Template

Use this template to document test results:

```markdown
## Test Run Summary

**Date:** YYYY-MM-DD
**Tester:** [Name]
**Environment:**
- OS: Windows 10/11
- Python: 3.x
- Node: 18.x
- GPU: Yes/No

### Results

| Test | Status | Notes |
|------|--------|-------|
| 3.1: Electron Logging | ✅/❌ | |
| 3.2: Tray Notifications | ✅/❌ | |
| 3.3: Python Reconnection | ✅/❌ | |
| 4.1: Performance Logging | ✅/❌ | |
| 4.2: Performance Baselines | ✅/❌ | |
| 5.1: VS Code | ✅/❌ | |
| 5.2: Notepad | ✅/❌ | |
| 5.3: Chrome | ✅/❌ | |
| 5.4: Slack | ✅/❌ | |
| 5.5: Word | ✅/❌ | |
| 6.1: Recording Errors | ✅/❌ | |
| 6.2: Processing Errors | ✅/❌ | |
| 6.3: System Integration | ✅/❌ | |

### Issues Found

1. [Issue description]
   - **Severity:** Critical/Major/Minor
   - **Steps to reproduce:**
   - **Expected:**
   - **Actual:**

### Performance Metrics

Average E2E Latency: ___ms
- Recording: ___ms
- Transcription: ___ms
- Processing: ___ms
- Injection: ___ms

### Recommendations

[Any recommendations for improvements]
```

---

## Success Criteria for Phase 3 Completion

Phase 3 is complete when:

- ✅ All error handling tests pass
- ✅ Logging works correctly in both Electron and Python
- ✅ Tray notifications appear for all error scenarios
- ✅ Performance metrics tracked and logged
- ✅ Works in 5+ applications (VS Code, Notepad, Chrome, Slack, Word)
- ✅ No critical bugs found
- ✅ Average E2E latency < 30 seconds (CPU mode)
- ✅ Automatic reconnection works reliably
- ✅ No character loss in text injection
- ✅ Graceful error handling (no crashes)

---

## Troubleshooting

### Common Issues

**Issue:** Notifications don't appear
- **Solution:** Check Windows notification settings, ensure notifications enabled for dIKtate

**Issue:** Performance metrics not logged
- **Solution:** Check log level is set to INFO or DEBUG, verify log files exist

**Issue:** Text injection fails
- **Solution:** Verify pynput installed correctly, run as administrator

**Issue:** Hotkey doesn't work
- **Solution:** Check for conflicts with other apps, try different hotkey

**Issue:** Python reconnection fails
- **Solution:** Check Python path, verify venv activated, check logs for errors

---

**Phase 3 Status:** Ready for Testing ✅

---

*Created: 2026-01-16*
*For: Phase 3 Integration & Testing*
