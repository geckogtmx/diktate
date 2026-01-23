# Methodical UI/UX Validation Checklist

This document provides a step-by-step audit for the dIKtate desktop application to ensure all screens, windows, and state transitions are seamless for v1.0.

## 🎛️ 1. Control Panel (Status Window)

| Step | Action | Expected Result | Status |
| :--- | :--- | :--- | :--- |
| **1.1** | Launch App | Window appears in last known position. | [ ] |
| **1.2** | Start Recording | State changes to `LISTENING`. Pulse animation starts. | [ ] |
| **1.3** | Stop Recording | State changes to `TRANSCRIBING` then `THINKING`. | [ ] |
| **1.4** | Injection | State changes to `TYPING`. Text flows into target app. | [ ] |
| **1.5** | Mini Mode Toggle | Window collapses to 80px bar. Remains functional. | [ ] |
| **1.6** | Full Mode Toggle | Window restores to full dashboard with all tabs. | [ ] |
| **1.7** | Metrics Update | Efficiency savings ($) and char count update live. | [ ] |

## ⚙️ 2. Settings (Master-Detail)

### General Tab
- [ ] **Hotkeys**: Record a new hotkey. Verify it doesn't conflict.
- [ ] **Startup**: Toggle "Start at Login". Check Registry/Autostart entries.
- [ ] **Auto-Tiering**: Change hardware tier manually. Verify Whisper model changes.

### AI & Processing
- [ ] **Provider Switch**: Switch from Local (Ollama) to Cloud (Gemini). Verify badge updates.
- [ ] **Model Dropdown**: List models. Switch model. Verify no crash.
- [ ] **API Keys**: Masking works. Save key. Verify persistence.

### Personality Modes
- [ ] **Selection**: Click through Standard, Prompt, Professional, Raw.
- [ ] **Editing**: Edit a custom prompt. Save. Verify success toast.
- [ ] **Reset**: Reset to default. Verify prompt text clears/restores.
- [ ] **Raw Mode**: Verify model selector is hidden for Raw mode.

## 🕒 3. History & Recall

- [ ] **Flow**: Dictate 3 distinct phrases. Verify 3 entries in History list.
- [ ] **Persistence**: Restart app. Verify history is still present (if disk-cached).
- [ ] **Re-inject**: Click "Re-inject" on an old history item. Verify paste into Notepad.
- [ ] **Oops Hotkey**: Dictate into Notepad. Switch to Chrome. Press `Ctrl+Alt+V`. Verify re-paste.

## 🛳️ 4. System Integration

- [ ] **Tray Icon**: Right-click tray. Verify all menu items (Settings, Logs, Restart, Exit).
- [ ] **Always on Top**: Toggle Mini mode. Drag window. Verify it stays above Chrome/VS Code.
- [ ] **Monitor Switching**: Drag to secondary monitor. Restart app. Verify it opens on secondary monitor.
- [ ] **Mute Handling**: Mute system mic. Start recording. Verify "Mic Muted" warning appears.

## 🧪 5. Stress Test: The "YouTube Loop"
*The goal is variety. We leverage the diversity of content creators to verify robustness.*

1. **Load Test Suite**: Use `audio_feeder.py` with the `--youtube` flag.
2. **Diversity Check**: Ensure segments include:
   - High-speed tech talkers (e.g., Fireship).
   - Casual conversationalists with fillers (e.g., Vlogs).
   - Accented English (e.g., AI explainers).
3. **Metrics Audit**: After 60 mins, run `/test-diktate` to verify:
   - 0 pipeline stalls.
   - Avg latency remains stable (no memory creep).
   - Transcription accuracy matches expected content.
