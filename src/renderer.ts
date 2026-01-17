/**
 * Renderer process for dIKtate Status Window
 */
export { };

declare global {
    interface Window {
        electronAPI: {
            onLog: (callback: (level: string, message: string, data?: any) => void) => void;
            onStatusChange: (callback: (status: string) => void) => void;
            getInitialState: () => Promise<any>;
            toggleRecording: () => Promise<any>;
        };
        api: {
            python: {
                startRecording: () => Promise<any>;
                stopRecording: () => Promise<any>;
            }
        };
    }
}

const statusPanel = document.getElementById('status-panel');
const statusIcon = document.getElementById('status-icon');
const statusText = document.getElementById('status-text');
const statusSubtext = document.getElementById('status-subtext');
const logContainer = document.getElementById('log-container');

let isRecording = false;
let isProcessing = false;

// DISABLED: Clicking the button steals focus from target app, breaking text injection.
// TODO: Fix by making the window non-focusable or using a different approach (e.g., tray click).
// if (statusIcon) {
//     statusIcon.addEventListener('click', async () => {
//         if (isProcessing) return; // Ignore while busy
//
//         if (isRecording) {
//             addLogEntry('INFO', 'Stopping recording via UI click...');
//             await window.api.python.stopRecording();
//         } else {
//             addLogEntry('INFO', 'Starting recording via UI click...');
//             await window.api.python.startRecording();
//         }
//     });
// }

function setStatus(state: string) {
    if (!statusPanel || !statusText || !statusIcon || !statusSubtext) return;

    // Normalize state
    const s = state.toLowerCase();

    // Default
    let className = 'state-idle';
    let icon = '⚪';
    let text = 'READY';
    let sub = 'Waiting for input...';

    if (s.includes('recording')) {
        className = 'state-recording';
        icon = '🔴';
        text = 'LISTENING';
        sub = 'Release hotkey to finish'; // Note: It's actually a toggle now, but user wants PTT feeling
        sub = 'Speak clearly...';
    } else if (s.includes('processing')) {
        className = 'state-processing';
        icon = '🔵';
        text = 'THINKING';
        sub = 'Transcribing & fixing text...';
    } else if (s.includes('error') || s.includes('disconnect')) {
        className = 'state-error';
        icon = '⚠️';
        text = 'ERROR';
        sub = state;
    }

    // Apply
    statusPanel.className = className;
    // statusIcon.textContent = icon; // No longer text
    statusText.textContent = text;
    statusSubtext.textContent = sub;

    // Sync local state
    isRecording = s.includes('recording');
    isProcessing = s.includes('processing');
}

function addLogEntry(level: string, message: string, data?: any) {
    if (!logContainer) return;

    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const timeStr = new Date().toLocaleTimeString().split(' ')[0];

    // Safe DOM manipulation (no innerHTML with user data)
    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = timeStr;

    const levelSpan = document.createElement('span');
    levelSpan.className = `log-level ${level}`;
    levelSpan.textContent = level;

    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;

    entry.appendChild(timeSpan);
    entry.appendChild(document.createTextNode(' '));
    entry.appendChild(levelSpan);
    entry.appendChild(document.createTextNode(' '));
    entry.appendChild(msgSpan);

    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Initialize
if (window.electronAPI) {
    window.electronAPI.onLog((level, message, data) => addLogEntry(level, message, data));

    window.electronAPI.onStatusChange((status) => setStatus(status));

    // Listen for mode updates (we'll add this event in main.ts)
    if ((window.electronAPI as any).onModeChange) {
        (window.electronAPI as any).onModeChange((mode: string) => setMode(mode));
    }

    window.electronAPI.getInitialState().then((state) => {
        if (state) {
            // Determine state from complicated object if needed, or just string
            if (state.isRecording) setStatus('recording');
            else setStatus(state.status || 'idle');

            // Initial set
            updateStatusText(state.mode, state.models);
        }
    }).catch(err => addLogEntry('ERROR', 'Init failed', err));
}

let currentMode = 'STANDARD';
let currentModels = { transcriber: 'TURBO', processor: 'LOCAL' };

function updateStatusText(mode?: string, models?: any) {
    if (mode) currentMode = mode.toUpperCase();
    if (models) {
        if (models.transcriber) currentModels.transcriber = models.transcriber;
        if (models.processor) currentModels.processor = models.processor;
    }

    const modeEl = document.getElementById('status-mode');
    if (modeEl) {
        // Format: T: TURBO | P: LOCAL (STANDARD)
        modeEl.textContent = `T: ${currentModels.transcriber} | P: ${currentModels.processor} (${currentMode})`;
    }
}

function setMode(mode: string) {
    updateStatusText(mode);
}
