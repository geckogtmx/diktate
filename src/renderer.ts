/**
 * Renderer process for dIKtate Debug Window
 */
export { };

// Define type for window.electronAPI
declare global {
    interface Window {
        electronAPI: {
            onLog: (callback: (level: string, message: string, data?: any) => void) => void;
            onStatusChange: (callback: (status: string) => void) => void;
            getInitialState: () => Promise<any>;
            clearLogs: () => void;
            testNotification: () => void;
        };
    }
}

const logContainer = document.getElementById('log-container');
const statusBadge = document.getElementById('connection-status');
const clearBtn = document.getElementById('clear-logs');
const testNotifyBtn = document.getElementById('test-notification');

function addLogEntry(level: string, message: string, data?: any) {
    if (!logContainer) return;

    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const now = new Date();
    const timeStr = now.toLocaleTimeString(); // HH:MM:SS

    const levelSpan = document.createElement('span');
    levelSpan.className = `log-level ${level}`;
    levelSpan.textContent = level;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = timeStr;

    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;

    entry.appendChild(timeSpan);
    entry.appendChild(levelSpan);
    entry.appendChild(msgSpan);

    if (data) {
        const dataDiv = document.createElement('div');
        dataDiv.style.fontSize = '0.85em';
        dataDiv.style.color = '#aaa';
        dataDiv.style.marginLeft = '60px'; // Indent
        dataDiv.style.whiteSpace = 'pre-wrap';
        try {
            dataDiv.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        } catch (e) {
            dataDiv.textContent = String(data);
        }
        entry.appendChild(dataDiv);
    }

    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight; // Auto-scroll
}

function updateStatus(status: string) {
    if (!statusBadge) return;
    statusBadge.textContent = `Python: ${status}`;

    // reset classes
    statusBadge.className = 'status-badge';

    if (status.toLowerCase().includes('ready') || status.toLowerCase().includes('recording')) {
        statusBadge.classList.add('connected');
    } else {
        statusBadge.classList.add('disconnected');
    }
}

// Event Listeners
if (clearBtn) {
    clearBtn.addEventListener('click', () => {
        if (logContainer) logContainer.innerHTML = '';
    });
}

if (testNotifyBtn) {
    testNotifyBtn.addEventListener('click', () => {
        // Ideally trigger an IPC call here, for now just log
        addLogEntry('INFO', 'Test notification button clicked');
    });
}

// Initialize
if (window.electronAPI) {
    window.electronAPI.onLog((level: string, message: string, data: any) => {
        addLogEntry(level, message, data);
    });

    window.electronAPI.onStatusChange((status: string) => {
        updateStatus(status);
    });

    // Get initial state
    window.electronAPI.getInitialState().then((state: any) => {
        if (state && state.status) {
            updateStatus(state.status);
        }
    }).catch((err: any) => {
        addLogEntry('ERROR', 'Failed to get initial state', err);
    });
} else {
    addLogEntry('WARN', 'Electron API not found (Preload handling missing?)');
}
