/**
 * Renderer process for dIKtate Status Dashboard
 * Tracks session statistics and handles live status updates
 */
export { };

declare global {
    interface Window {
        electronAPI: {
            onLog: (callback: (level: string, message: string, data?: any) => void) => void;
            onStatusChange: (callback: (status: string) => void) => void;
            onPerformanceMetrics: (callback: (metrics: PerformanceMetrics) => void) => void;
            getInitialState: () => Promise<any>;
            setSetting: (key: string, value: any) => Promise<void>;
        };
    }
}

interface PerformanceMetrics {
    recording?: number;
    transcription?: number;
    processing?: number;
    injection?: number;
    total?: number;
    charCount?: number;
}

// DOM Elements
const statusPanel = document.getElementById('status-panel');
const statusText = document.getElementById('status-text');
const liveMessage = document.getElementById('live-message');
const logContainer = document.getElementById('log-container');

// Stats elements
const statSessions = document.getElementById('stat-sessions');
const statChars = document.getElementById('stat-chars');
const statSpeed = document.getElementById('stat-speed');
const statLast = document.getElementById('stat-last');
const statTokens = document.getElementById('stat-tokens');
const statCost = document.getElementById('stat-cost');

// Badge elements
const badgeTranscriber = document.getElementById('badge-transcriber');
const badgeProcessor = document.getElementById('badge-processor');

// Perf timeline elements
const perfRec = document.getElementById('perf-rec');
const perfTrans = document.getElementById('perf-trans');
const perfProc = document.getElementById('perf-proc');
const perfInject = document.getElementById('perf-inject');

// Toggle elements
const toggleSound = document.getElementById('toggle-sound') as HTMLInputElement | null;
const toggleCloud = document.getElementById('toggle-cloud') as HTMLInputElement | null;

// Session statistics
let sessionCount = 0;
let totalChars = 0;
let totalTime = 0;
let totalTokensSaved = 0;

// Rough token estimation: ~4 chars per token (like OpenAI's tokenizer)
// Cost estimate: ~$0.002 per 1K tokens (GPT-4o-mini pricing)
const CHARS_PER_TOKEN = 4;
const COST_PER_1K_TOKENS = 0.002;

// Live status messages for each state
const STATUS_MESSAGES: Record<string, { text: string; message: string; typing?: boolean }> = {
    idle: { text: 'READY', message: 'Waiting for input...' },
    recording: { text: 'LISTENING', message: 'Speak clearly', typing: true },
    transcribing: { text: 'TRANSCRIBING', message: 'Converting speech to text', typing: true },
    processing: { text: 'THINKING', message: 'Polishing your text', typing: true },
    injecting: { text: 'TYPING', message: 'Inserting text', typing: true },
    error: { text: 'ERROR', message: 'Something went wrong' }
};

function setStatus(state: string) {
    if (!statusPanel || !statusText || !liveMessage) return;

    const s = state.toLowerCase();
    let stateKey = 'idle';

    if (s.includes('recording')) stateKey = 'recording';
    else if (s.includes('transcrib')) stateKey = 'transcribing';
    else if (s.includes('processing') || s.includes('thinking')) stateKey = 'processing';
    else if (s.includes('inject') || s.includes('typing')) stateKey = 'injecting';
    else if (s.includes('error')) stateKey = 'error';

    const statusInfo = STATUS_MESSAGES[stateKey] || STATUS_MESSAGES.idle;

    // Update panel class
    statusPanel.className = `state-${stateKey}`;

    // Update text
    statusText.textContent = statusInfo.text;

    // Update live message (with typing dots effect)
    liveMessage.textContent = statusInfo.message;
    liveMessage.className = statusInfo.typing ? 'typing-dots' : '';

    // Highlight active step in timeline
    updateTimelineActive(stateKey);
}

function updateTimelineActive(stateKey: string) {
    perfRec?.classList.toggle('active', stateKey === 'recording');
    perfTrans?.classList.toggle('active', stateKey === 'transcribing');
    perfProc?.classList.toggle('active', stateKey === 'processing');
    perfInject?.classList.toggle('active', stateKey === 'injecting');
}

function updatePerformanceMetrics(metrics: PerformanceMetrics) {
    // Update timeline display
    if (metrics.recording !== undefined && perfRec) {
        perfRec.textContent = `Rec: ${(metrics.recording / 1000).toFixed(1)}s`;
    }
    if (metrics.transcription !== undefined && perfTrans) {
        perfTrans.textContent = `Trans: ${Math.round(metrics.transcription)}ms`;
    }
    if (metrics.processing !== undefined && perfProc) {
        perfProc.textContent = `Proc: ${Math.round(metrics.processing)}ms`;
    }
    if (metrics.injection !== undefined && perfInject) {
        perfInject.textContent = `Inject: ${Math.round(metrics.injection)}ms`;
    }

    // Update session stats
    if (metrics.total !== undefined) {
        sessionCount++;
        totalTime += metrics.total;

        if (statSessions) statSessions.textContent = String(sessionCount);
        if (statLast) statLast.textContent = `${(metrics.total / 1000).toFixed(1)}s`;

        // Calculate speed (chars per second) - need charCount from this session
        if (metrics.charCount && metrics.total > 0) {
            const charsPerSec = metrics.charCount / (metrics.total / 1000);
            if (statSpeed) statSpeed.textContent = `${charsPerSec.toFixed(0)}/s`;
        }
    }

    // Update char count and token savings
    if (metrics.charCount !== undefined) {
        totalChars += metrics.charCount;
        if (statChars) statChars.textContent = totalChars.toLocaleString();

        // Calculate tokens saved (only counts when on Local mode)
        const tokensThisSession = Math.ceil(metrics.charCount / CHARS_PER_TOKEN);
        totalTokensSaved += tokensThisSession;

        if (statTokens) statTokens.textContent = totalTokensSaved.toLocaleString();

        // Calculate estimated cost savings
        const costSaved = (totalTokensSaved / 1000) * COST_PER_1K_TOKENS;
        if (statCost) statCost.textContent = `$${costSaved.toFixed(3)}`;
    }
}

function updateBadges(models?: { transcriber?: string; processor?: string }) {
    if (models?.transcriber && badgeTranscriber) {
        badgeTranscriber.textContent = models.transcriber;
    }
    if (models?.processor && badgeProcessor) {
        badgeProcessor.textContent = models.processor;
    }
}

function addLogEntry(level: string, message: string, _data?: any) {
    if (!logContainer) return;

    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const timeStr = new Date().toLocaleTimeString().split(' ')[0];

    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = timeStr;

    const levelSpan = document.createElement('span');
    levelSpan.className = `log-level ${level}`;
    levelSpan.textContent = level;

    const msgSpan = document.createElement('span');
    // Truncate long messages for cleaner logs
    msgSpan.textContent = message.length > 80 ? message.substring(0, 77) + '...' : message;

    entry.appendChild(timeSpan);
    entry.appendChild(document.createTextNode(' '));
    entry.appendChild(levelSpan);
    entry.appendChild(document.createTextNode(' '));
    entry.appendChild(msgSpan);

    logContainer.appendChild(entry);

    // Keep only last 50 entries
    while (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.children[0]);
    }

    logContainer.scrollTop = logContainer.scrollHeight;
}

// Setup toggle handlers
function setupToggles() {
    if (toggleSound) {
        toggleSound.addEventListener('change', () => {
            window.electronAPI?.setSetting?.('soundFeedback', toggleSound.checked);
            addLogEntry('INFO', `Sound feedback: ${toggleSound.checked ? 'ON' : 'OFF'}`);
        });
    }

    if (toggleCloud) {
        toggleCloud.addEventListener('change', () => {
            const mode = toggleCloud.checked ? 'cloud' : 'local';
            window.electronAPI?.setSetting?.('processingMode', mode);
            addLogEntry('INFO', `Processing mode: ${mode.toUpperCase()}`);
        });
    }
}

// Update metrics panel with recent data (A.2 observability)
async function updateMetricsPanel() {
    const metricsChart = document.getElementById('metrics-chart');
    const metricsSummary = document.getElementById('metrics-summary');

    if (!metricsChart || !metricsSummary) return;

    try {
        // For now, we'll track metrics locally until we have file system access
        // This would ideally read from metrics.json
        const recentMetrics: number[] = [];

        // Store metrics locally on performance events
        if ((window as any)._recentMetrics) {
            const metrics = (window as any)._recentMetrics.slice(-10);

            if (metrics.length === 0) {
                metricsChart.textContent = 'No metrics yet. Run a dictation to see data here.';
                metricsSummary.textContent = '';
                return;
            }

            // Create ASCII bar chart
            const maxTime = Math.max(...metrics);
            const chart = metrics.map((time: number) => {
                const bars = Math.ceil((time / maxTime) * 20);
                const bar = '▓'.repeat(bars) + '░'.repeat(20 - bars);
                return `${bar} ${(time / 1000).toFixed(1)}s`;
            }).join('\n');

            metricsChart.textContent = `Last ${metrics.length} dictations:\n${chart}`;

            // Calculate summary stats
            const avg = metrics.reduce((a: number, b: number) => a + b, 0) / metrics.length;
            const min = Math.min(...metrics);
            const max = Math.max(...metrics);

            metricsSummary.innerHTML = `
                <span>Avg: ${(avg / 1000).toFixed(1)}s</span>
                <span>Min: ${(min / 1000).toFixed(1)}s</span>
                <span>Max: ${(max / 1000).toFixed(1)}s</span>
            `;
        } else {
            metricsChart.textContent = 'No metrics yet. Run a dictation to see data here.';
            metricsSummary.textContent = '';
        }
    } catch (e) {
        metricsChart.textContent = 'Error loading metrics';
        metricsSummary.textContent = '';
    }
}

// Initialize
if (window.electronAPI) {
    window.electronAPI.onLog((level, message, data) => addLogEntry(level, message, data));
    window.electronAPI.onStatusChange((status) => setStatus(status));

    // Performance metrics handler
    if (window.electronAPI.onPerformanceMetrics) {
        window.electronAPI.onPerformanceMetrics((metrics) => {
            updatePerformanceMetrics(metrics);

            // Store for metrics panel
            if (!((window as any)._recentMetrics)) {
                (window as any)._recentMetrics = [];
            }
            if (metrics.total) {
                (window as any)._recentMetrics.push(metrics.total);
                if ((window as any)._recentMetrics.length > 20) {
                    (window as any)._recentMetrics.shift();
                }
                updateMetricsPanel();
            }
        });
    }

    // Badge update handler (for provider switches)
    if ((window.electronAPI as any).onBadgeUpdate) {
        (window.electronAPI as any).onBadgeUpdate((badges: { processor?: string }) => {
            updateBadges(badges);
        });
    }

    // Get initial state
    window.electronAPI.getInitialState().then((state) => {
        if (state) {
            setStatus(state.status || 'idle');
            updateBadges(state.models);

            // Restore toggle states
            if (toggleSound && state.soundFeedback !== undefined) {
                toggleSound.checked = state.soundFeedback;
            }
            if (toggleCloud && state.processingMode) {
                toggleCloud.checked = state.processingMode === 'cloud';
            }

            // Load metrics panel
            updateMetricsPanel();
        }
    }).catch(err => addLogEntry('ERROR', 'Init failed'));

    setupToggles();
}

addLogEntry('INFO', 'Dashboard initialized');
