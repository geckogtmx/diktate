/**
 * Renderer process for dIKtate Status Dashboard
 * Tracks session statistics and handles live status updates
 */
// No export needed, loaded as a script in index.html

interface InitialState {
  status: string;
  isRecording: boolean;
  mode: string;
  defaultMode: string;
  models: { transcriber: string; processor: string };
  soundFeedback: boolean;
  processingMode: string;
  recordingMode: string;
  refineMode: string;
  authType: string;
  additionalKeyEnabled: boolean;
  additionalKey: string;
  trailingSpaceEnabled: boolean;
}

interface Window {
  electronAPI: {
    onLog: (
      callback: (level: string, message: string, data?: Record<string, unknown>) => void
    ) => void;
    onStatusChange: (callback: (status: string) => void) => void;
    onPerformanceMetrics: (callback: (metrics: PerformanceMetrics) => void) => void;
    getInitialState: () => Promise<InitialState>;
    setSetting: (key: string, value: unknown) => Promise<void>;
    onPlaySound: (callback: (soundName: string) => void) => void;
    onBadgeUpdate: (callback: (badges: { processor?: string; authType?: string }) => void) => void;
    onModeChange: (callback: (mode: string) => void) => void;
    onSettingChange: (callback: (key: string, value: unknown) => void) => void;
  };
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

// Stats elements
const statSessions = document.getElementById('stat-sessions');
const statChars = document.getElementById('stat-chars');
const statSpeed = document.getElementById('stat-speed');
const statLast = document.getElementById('stat-last');

// Badge elements
const badgeTranscriber = document.getElementById('badge-transcriber');
const badgeProcessor = document.getElementById('badge-processor');
const badgeAuth = document.getElementById('badge-auth');

// Perf grid elements
const perfRec = document.getElementById('perf-rec');
const perfTrans = document.getElementById('perf-trans');
const perfProc = document.getElementById('perf-proc');
const perfInject = document.getElementById('perf-inject');

const perfRecCell = document.getElementById('perf-rec-cell');
const perfTransCell = document.getElementById('perf-trans-cell');
const perfProcCell = document.getElementById('perf-proc-cell');
const perfInjectCell = document.getElementById('perf-inject-cell');

// Toggle elements
const toggleSound = document.getElementById('toggle-sound') as HTMLInputElement | null;
const toggleCloud = document.getElementById('toggle-cloud') as HTMLInputElement | null;
const toggleAdditionalKey = document.getElementById(
  'toggle-additional-key'
) as HTMLInputElement | null;
const toggleRefineMode = document.getElementById('toggle-refine-mode') as HTMLInputElement | null;
const refineModeLabel = document.getElementById('refine-mode-label') as HTMLElement | null;

// Mode selection elements
const modeBtns: Record<string, HTMLElement | null> = {
  standard: document.getElementById('mode-standard'),
  prompt: document.getElementById('mode-prompt'),
  professional: document.getElementById('mode-professional'),
  raw: document.getElementById('mode-raw'),
};

// Session statistics
let sessionCount = 0;
let totalChars = 0;
let totalTime = 0;

// Live status messages for each state
const STATUS_MESSAGES: Record<string, { text: string; message: string; typing?: boolean }> = {
  idle: { text: 'READY', message: 'Waiting for input...' },
  recording: { text: 'LISTENING', message: 'Speak clearly', typing: true },
  transcribing: { text: 'TRANSCRIBING', message: 'Converting speech to text', typing: true },
  processing: { text: 'THINKING', message: 'Polishing your text', typing: true },
  injecting: { text: 'TYPING', message: 'Inserting text', typing: true },
  warmup: { text: 'WARMING UP', message: 'Loading model into memory...', typing: true },
  error: { text: 'ERROR', message: 'Something went wrong' },
};

function setStatus(state: string) {
  if (!statusPanel || !statusText || !liveMessage) return;

  const s = state.toLowerCase();
  let stateKey = 'idle';

  if (s.includes('recording')) stateKey = 'recording';
  else if (s.includes('transcrib')) stateKey = 'transcribing';
  else if (s.includes('processing') || s.includes('thinking')) stateKey = 'processing';
  else if (s.includes('inject') || s.includes('typing')) stateKey = 'injecting';
  else if (s.includes('warmup') || s.includes('loading')) stateKey = 'warmup';
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
  perfRecCell?.classList.toggle('active', stateKey === 'recording');
  perfTransCell?.classList.toggle('active', stateKey === 'transcribing');
  perfProcCell?.classList.toggle('active', stateKey === 'processing');
  perfInjectCell?.classList.toggle('active', stateKey === 'injecting');
}

function updatePerformanceMetrics(metrics: PerformanceMetrics) {
  // Update grid display
  if (metrics.recording !== undefined && perfRec) {
    perfRec.textContent = `${(metrics.recording / 1000).toFixed(1)}s`;
  }
  if (metrics.transcription !== undefined && perfTrans) {
    perfTrans.textContent = `${Math.round(metrics.transcription)}ms`;
  }
  if (metrics.processing !== undefined && perfProc) {
    perfProc.textContent = `${Math.round(metrics.processing)}ms`;
  }
  if (metrics.injection !== undefined && perfInject) {
    perfInject.textContent = `${Math.round(metrics.injection)}ms`;
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

  // Update char count
  if (metrics.charCount !== undefined) {
    totalChars += metrics.charCount;
    if (statChars) statChars.textContent = totalChars.toLocaleString();
  }
}

function updateBadges(models?: { transcriber?: string; processor?: string }, authType?: string) {
  if (models?.transcriber && badgeTranscriber) {
    badgeTranscriber.textContent = models.transcriber;
  }
  if (models?.processor && badgeProcessor) {
    badgeProcessor.textContent = models.processor;
  }
  if (authType && badgeAuth) {
    badgeAuth.textContent = authType;
  }
}

function addLogEntry(level: string, message: string, _data?: Record<string, unknown>) {
  // Log UI Removed - internal logging only
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
  if (toggleAdditionalKey) {
    toggleAdditionalKey.addEventListener('change', () => {
      window.electronAPI?.setSetting?.('additionalKeyEnabled', toggleAdditionalKey.checked);
      addLogEntry(
        'INFO',
        `Additional key: ${toggleAdditionalKey.checked ? 'ENABLED' : 'DISABLED'}`
      );
    });
  }
  if (toggleRefineMode && refineModeLabel) {
    toggleRefineMode.addEventListener('change', () => {
      const mode = toggleRefineMode.checked ? 'instruction' : 'autopilot';
      window.electronAPI?.setSetting?.('refineMode', mode);
      refineModeLabel.textContent = mode === 'instruction' ? 'Refine: Instruct' : 'Refine: Auto';
      addLogEntry('INFO', `Refine mode: ${mode.toUpperCase()}`);
    });
  }
}

// Update mode toggle UI
function updateModeUI(mode: string) {
  Object.keys(modeBtns).forEach((k) => {
    const btn = modeBtns[k];
    if (btn) {
      btn.classList.toggle('active', k === mode);
    }
  });
}

// Make switchExecutionMode available globally for onclick handler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).switchExecutionMode = function (
  mode: 'standard' | 'prompt' | 'professional' | 'raw'
) {
  updateModeUI(mode);
  window.electronAPI?.setSetting?.('defaultMode', mode);
  addLogEntry('INFO', `Mode switched to: ${mode.toUpperCase()}`);
};

// Initialize
if (window.electronAPI) {
  window.electronAPI.onLog((level, message, data) => addLogEntry(level, message, data));
  window.electronAPI.onStatusChange((status) => setStatus(status));

  // Performance metrics handler
  if (window.electronAPI.onPerformanceMetrics) {
    window.electronAPI.onPerformanceMetrics((metrics) => {
      updatePerformanceMetrics(metrics);
    });
  }

  // Badge update handler (for provider switches)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window.electronAPI as any).onBadgeUpdate) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.electronAPI as any).onBadgeUpdate(
      (badges: { processor?: string; authType?: string }) => {
        updateBadges(badges, badges.authType);
      }
    );
  }

  // Setting change handler (SPEC_032 UI Sync)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window.electronAPI as any).onSettingChange) {
    window.electronAPI.onSettingChange((key: string, value: unknown) => {
      if (key === 'soundFeedback' && toggleSound && typeof value === 'boolean') {
        toggleSound.checked = value;
      } else if (key === 'processingMode' && toggleCloud && typeof value === 'string') {
        toggleCloud.checked = value === 'cloud';
      } else if (key === 'additionalKeyEnabled' && toggleAdditionalKey && typeof value === 'boolean') {
        toggleAdditionalKey.checked = value;
        addLogEntry('INFO', `Additional key sync: ${value ? 'ENABLED' : 'DISABLED'}`);
      } else if (key === 'refineMode' && toggleRefineMode && refineModeLabel && typeof value === 'string') {
        toggleRefineMode.checked = value === 'instruction';
        refineModeLabel.textContent = value === 'instruction' ? 'Refine: Instruct' : 'Refine: Auto';
      }
    });
  }

  // Mode change handler (triggers status updates, not button changes)
  if (window.electronAPI.onModeChange) {
    window.electronAPI.onModeChange((mode: string) => {
      addLogEntry('INFO', `Active operation: ${mode.toUpperCase()}`);
    });
  }

  // Get initial state
  window.electronAPI
    .getInitialState()
    .then((state) => {
      if (state) {
        setStatus(state.status || 'idle');
        updateBadges(state.models, state.authType);

        // Restore toggle states
        if (toggleSound && state.soundFeedback !== undefined) {
          toggleSound.checked = state.soundFeedback;
        }
        if (toggleCloud && state.processingMode) {
          toggleCloud.checked = state.processingMode === 'cloud';
        }
        if (toggleAdditionalKey && state.additionalKeyEnabled !== undefined) {
          toggleAdditionalKey.checked = state.additionalKeyEnabled;
        }
        if (toggleRefineMode && refineModeLabel && state.refineMode) {
          toggleRefineMode.checked = state.refineMode === 'instruction';
          refineModeLabel.textContent =
            state.refineMode === 'instruction' ? 'Refine: Instruct' : 'Refine: Auto';
        }

        // Restore mode selection
        if (state.defaultMode) {
          updateModeUI(state.defaultMode);
        }
      }
    })
    .catch((err) => addLogEntry('ERROR', 'Init failed'));

  setupToggles();
}

addLogEntry('INFO', 'Dashboard initialized');

// Sound playback
window.electronAPI.onPlaySound((soundName: string) => {
  // Try to play from assets folder
  // In dev, assets are at root level relative to where we serve?
  // In build, we might need to adjust.
  // Let's rely on relative path from the HTML file.
  const audio = new Audio(`../assets/sounds/${soundName}.mp3`);
  audio.volume = 0.5;
  audio.play().catch((e) => console.error('Failed to play sound:', e));
});

// Event listeners for UI controls (CSP-compliant)

document.getElementById('mode-standard')?.addEventListener('click', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).switchExecutionMode('standard');
});

document.getElementById('mode-prompt')?.addEventListener('click', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).switchExecutionMode('prompt');
});

document.getElementById('mode-professional')?.addEventListener('click', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).switchExecutionMode('professional');
});

document.getElementById('mode-raw')?.addEventListener('click', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).switchExecutionMode('raw');
});
