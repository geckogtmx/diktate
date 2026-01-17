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
        };
    }
}

const statusPanel = document.getElementById('status-panel');
const statusIcon = document.getElementById('status-icon');
const statusText = document.getElementById('status-text');
const statusSubtext = document.getElementById('status-subtext');
const logContainer = document.getElementById('log-container');

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
    statusIcon.textContent = icon;
    statusText.textContent = text;
    statusSubtext.textContent = sub;
}

function addLogEntry(level: string, message: string, data?: any) {
    if (!logContainer) return;

    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const timeStr = new Date().toLocaleTimeString().split(' ')[0];

    // Minimal log format
    entry.innerHTML = `
        <span class="log-time">${timeStr}</span>
        <span class="log-level ${level}">${level}</span>
        <span>${message}</span>
    `;

    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Initialize
if (window.electronAPI) {
    window.electronAPI.onLog((level, message, data) => addLogEntry(level, message, data));

    window.electronAPI.onStatusChange((status) => setStatus(status));

    window.electronAPI.getInitialState().then((state) => {
        if (state) {
            // Determine state from complicated object if needed, or just string
            if (state.isRecording) setStatus('recording');
            else setStatus(state.status || 'idle');
        }
    }).catch(err => addLogEntry('ERROR', 'Init failed', err));
}
