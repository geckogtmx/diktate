/**
 * Settings window renderer script
 * Uses secure settingsAPI bridge (no direct Node access)
 */

// No export needed, loaded as a script in settings.html
// Type definitions for window.settingsAPI are in src/global.d.ts

// ============================================================================
// AUDIO ANALYZER (SPEC_021) - Inlined to avoid module loading issues
// ============================================================================

/**
 * Audio Analyzer Class
 * Provides real-time audio analysis for microphone input
 */
class AudioAnalyzer {
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private microphone: MediaStreamAudioSourceNode | null = null;
    private dataArray: Float32Array<ArrayBuffer> | null = null;
    private stream: MediaStream | null = null;
    private isRunning: boolean = false;

    constructor() {
        // AudioContext will be created on start
    }

    async start(deviceId?: string): Promise<void> {
        try {
            this.audioContext = new AudioContext();
            const constraints: MediaStreamConstraints = {
                audio: deviceId ? { deviceId: { exact: deviceId } } : true
            };
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.3;
            this.microphone = this.audioContext.createMediaStreamSource(this.stream);
            this.microphone.connect(this.analyser);
            this.dataArray = new Float32Array(this.analyser.fftSize);
            this.isRunning = true;
        } catch (error) {
            this.cleanup();
            throw new Error(`Failed to start audio analyzer: ${error}`);
        }
    }

    stop(): void {
        this.cleanup();
    }

    getRMS(): number {
        if (!this.analyser || !this.dataArray || !this.isRunning) return 0;
        this.analyser.getFloatTimeDomainData(this.dataArray);
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i] * this.dataArray[i];
        }
        return Math.sqrt(sum / this.dataArray.length);
    }

    getPeak(): number {
        if (!this.analyser || !this.dataArray || !this.isRunning) return 0;
        this.analyser.getFloatTimeDomainData(this.dataArray);
        let peak = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            const abs = Math.abs(this.dataArray[i]);
            if (abs > peak) peak = abs;
        }
        return peak;
    }

    toDecibels(amplitude: number): number {
        if (amplitude <= 0) return -Infinity;
        return 20 * Math.log10(amplitude);
    }

    private cleanup(): void {
        this.isRunning = false;
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.analyser = null;
        this.dataArray = null;
    }
}

/**
 * Audio level classification
 */
type AudioLevel = 'silent' | 'low' | 'good' | 'high' | 'clipping';

function classifyAudioLevel(peakDb: number): AudioLevel {
    if (peakDb > -3) return 'clipping';
    if (peakDb > -6) return 'high';
    if (peakDb > -20) return 'good';
    if (peakDb > -40) return 'low';
    return 'silent';
}

function getAudioLevelMessage(level: AudioLevel): string {
    switch (level) {
        case 'clipping': return '⚠️ Too loud! Lower input volume';
        case 'high': return '⚡ Strong signal (near max)';
        case 'good': return '✓ Perfect levels';
        case 'low': return '⚠️ Quiet. Increase volume or move closer';
        case 'silent': return '❌ No signal detected';
        default: return 'Unknown';
    }
}

function getAudioLevelClass(level: AudioLevel): string {
    return `level-${level}`;
}

// State
let isRecordingHotkey = false;
let initialModels: Record<string, string> = {};
let hasModelChanges = false;
let availableModels: any[] = [];
let defaultPrompts: Record<string, string> = {};

// Audio Monitoring State (SPEC_021)
let audioAnalyzer: AudioAnalyzer | null = null;
let animationFrameId: number | null = null;
let isMonitoring: boolean = false;
let peakHoldValue: number = 0;
let peakHoldDecay: number = 0;
let lastStatusUpdate: number = 0;
const STATUS_UPDATE_INTERVAL = 100; // Update text max 10 times/sec

// Active test tracking
let activeTestInterval: ReturnType<typeof setInterval> | null = null;
let activeTestAborted: boolean = false;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const settings = await window.settingsAPI.getAll();
        loadSettings(settings);

        await refreshAudioDevices(settings.audioDeviceId, settings.audioDeviceLabel);

        // Run hardware test first so warnings can be applied to models
        await runHardwareTest();

        await loadOllamaModels();

        await checkOllamaStatus();

        await populateModeModelDropdowns();

        await populateSoundDropdowns();

        await loadApiKeyStatuses();

        // Initialize Mode Configuration (Master-Detail)
        await initializeModeConfiguration();

        // Sidebar tab navigation (CSP-compliant)
        document.querySelectorAll('.tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const tabName = btn.getAttribute('data-tab');
                if (tabName) switchTab(tabName);
            });
        });

        // General tab event listeners (CSP-compliant)
        document.getElementById('processing-mode')?.addEventListener('change', (e) => {
            saveSetting('processingMode', (e.target as HTMLSelectElement).value);
        });

        document.getElementById('default-model')?.addEventListener('change', (e) => {
            onDefaultModelChange((e.target as HTMLSelectElement).value);
        });

        document.getElementById('auto-start')?.addEventListener('change', (e) => {
            saveSetting('autoStart', (e.target as HTMLInputElement).checked);
        });

        // Hotkey event listeners (CSP-compliant)
        document.getElementById('hotkey-display')?.addEventListener('click', () => recordHotkey('dictate'));
        document.getElementById('reset-hotkey-dictate')?.addEventListener('click', () => resetHotkey('dictate'));

        document.getElementById('ask-hotkey-display')?.addEventListener('click', () => recordHotkey('ask'));
        document.getElementById('reset-hotkey-ask')?.addEventListener('click', () => resetHotkey('ask'));

        document.getElementById('translate-hotkey-display')?.addEventListener('click', () => recordHotkey('translate'));
        document.getElementById('reset-hotkey-translate')?.addEventListener('click', () => resetHotkey('translate'));

        document.getElementById('refine-hotkey-display')?.addEventListener('click', () => recordHotkey('refine'));
        document.getElementById('reset-hotkey-refine')?.addEventListener('click', () => resetHotkey('refine'));

        document.getElementById('oops-hotkey-display')?.addEventListener('click', () => recordHotkey('oops'));
        document.getElementById('reset-hotkey-oops')?.addEventListener('click', () => resetHotkey('oops'));

        // Audio tab event listeners (CSP-compliant)
        document.getElementById('start-sound')?.addEventListener('change', (e) => {
            saveSetting('startSound', (e.target as HTMLSelectElement).value);
        });
        document.getElementById('preview-start-sound')?.addEventListener('click', () => {
            previewSpecificSound('start-sound');
        });

        document.getElementById('stop-sound')?.addEventListener('change', (e) => {
            saveSetting('stopSound', (e.target as HTMLSelectElement).value);
        });
        document.getElementById('preview-stop-sound')?.addEventListener('click', () => {
            previewSpecificSound('stop-sound');
        });

        document.getElementById('ask-sound')?.addEventListener('change', (e) => {
            saveSetting('askSound', (e.target as HTMLSelectElement).value);
        });
        document.getElementById('preview-ask-sound')?.addEventListener('click', () => {
            previewSpecificSound('ask-sound');
        });

        // Audio Monitoring event listeners (SPEC_021)
        document.getElementById('start-monitoring-btn')?.addEventListener('click', toggleAudioMonitoring);
        document.getElementById('measure-noise-btn')?.addEventListener('click', measureNoiseFloor);
        document.getElementById('complete-test-btn')?.addEventListener('click', runCompleteMicrophoneTest);

        // Max recording duration radios
        document.querySelectorAll('input[name="max-duration"]').forEach((radio) => {
            radio.addEventListener('change', (e) => {
                const value = parseInt((e.target as HTMLInputElement).value, 10);
                saveSetting('maxRecordingDuration', value);
            });
        });

        // Ollama tab event listeners (CSP-compliant)
        document.getElementById('hardware-test-btn')?.addEventListener('click', runHardwareTest);
        document.getElementById('refresh-ollama-btn')?.addEventListener('click', refreshOllamaStatus);
        document.getElementById('browse-models-link')?.addEventListener('click', () => {
            openExternalLink('https://ollama.com/library');
        });
        document.getElementById('restart-ollama-btn')?.addEventListener('click', restartOllama);
        document.getElementById('warmup-btn')?.addEventListener('click', warmupModel);

        // Quick pull buttons
        document.querySelectorAll('[data-quick-pull]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const modelName = btn.getAttribute('data-quick-pull');
                if (modelName) quickPullModel(modelName);
            });
        });

        document.getElementById('pull-model-btn')?.addEventListener('click', pullOllamaModel);

        document.getElementById('keep-alive-select')?.addEventListener('change', (e) => {
            saveOllamaSetting('keepAlive', (e.target as HTMLSelectElement).value);
        });

        document.getElementById('server-url-input')?.addEventListener('change', (e) => {
            saveOllamaSetting('serverUrl', (e.target as HTMLInputElement).value);
        });

        // Modes tab event listeners (CSP-compliant)
        document.getElementById('default-mode-select')?.addEventListener('change', (e) => {
            saveSetting('defaultMode', (e.target as HTMLSelectElement).value);
        });

        document.getElementById('ask-output-mode-select')?.addEventListener('change', (e) => {
            saveSetting('askOutputMode', (e.target as HTMLSelectElement).value);
        });

        document.querySelectorAll('.mode-list-item').forEach((item) => {
            item.addEventListener('click', () => {
                const mode = item.getAttribute('data-mode');
                if (mode) selectMode(mode);
            });
        });

        document.getElementById('save-mode-btn')?.addEventListener('click', saveModeDetails);
        document.getElementById('reset-mode-btn')?.addEventListener('click', resetModeToDefault);

        document.getElementById('trailing-space-toggle')?.addEventListener('change', (e) => {
            saveSetting('trailingSpaceEnabled', (e.target as HTMLInputElement).checked);
        });

        document.getElementById('additional-key-toggle')?.addEventListener('change', (e) => {
            saveSetting('additionalKeyEnabled', (e.target as HTMLInputElement).checked);
        });

        document.getElementById('additional-key-select')?.addEventListener('change', (e) => {
            saveSetting('additionalKey', (e.target as HTMLSelectElement).value);
        });

        // Google Hub OAuth event listeners (SPEC_016)
        document.getElementById('oauth-connect-btn')?.addEventListener('click', async () => {
            await initializeOAuthFlow();
        });

        document.getElementById('oauth-refresh-btn')?.addEventListener('click', async () => {
            const activeAccount = await window.settingsAPI.oauth.getActive();
            if (activeAccount.success && activeAccount.account) {
                try {
                    // OAuth refresh is handled automatically by OAuthManager
                    // This button manually triggers validation and UI refresh
                    await updateOAuthUI();
                } catch (error) {
                    console.error('Failed to refresh token:', error);
                }
            }
        });

        document.getElementById('oauth-disconnect-btn')?.addEventListener('click', async () => {
            const activeAccount = await window.settingsAPI.oauth.getActive();
            if (activeAccount.success && activeAccount.account) {
                const confirmed = confirm(`Disconnect ${activeAccount.account.email}?`);
                if (confirmed) {
                    const result = await window.settingsAPI.oauth.disconnect(activeAccount.account.accountId);
                    if (result.success) {
                        await updateOAuthUI();
                    } else {
                        alert(`Error disconnecting account: ${result.error}`);
                    }
                }
            }
        });

        // Connect another account button
        document.getElementById('oauth-add-account-btn')?.addEventListener('click', async () => {
            await initializeOAuthFlow();
        });

        // Initialize OAuth UI on load
        updateOAuthUI();

        // Listen for OAuth events from main process (SPEC_016 Phase 5)
        window.settingsAPI.onOAuthEvent((event: any) => {
            console.log('OAuth event received in settings:', event);

            const { type, accountId, data } = event;

            switch (type) {
                case 'token-refreshed':
                    // Silent success - just refresh UI
                    updateOAuthUI();
                    break;

                case 'token-refresh-failed':
                    showOAuthError(`Token refresh failed for ${data?.email}. Retrying...`);
                    updateOAuthUI();
                    break;

                case 'token-revoked':
                    showOAuthError(`Account ${data?.email} was disconnected. Please reconnect.`);
                    updateOAuthUI();
                    break;

                case 'token-expired':
                    showOAuthError(`Token expired for ${data?.email}. Refreshing...`);
                    updateOAuthUI();
                    break;

                case 'quota-warning':
                    const percent = Math.round((data.used / data.limit) * 100);
                    showOAuthWarning(`${percent}% of daily quota used for ${data?.email}`);
                    updateOAuthUI();
                    break;

                case 'quota-exceeded':
                    showOAuthError(`Daily quota exceeded for ${data?.email}. Resets at ${new Date(data.resetAt).toLocaleTimeString()}.`);
                    updateOAuthUI();
                    break;

                case 'network-error':
                    showOAuthWarning(`Network error: ${data?.error}. Retrying automatically...`);
                    break;

                case 'account-status-changed':
                    updateOAuthUI();
                    break;
            }
        });

        // Periodic quota refresh (every 5 seconds while Google Hub tab is visible)
        setInterval(() => {
            const googleHubTab = document.getElementById('google-hub');
            if (googleHubTab && googleHubTab.style.display !== 'none') {
                updateOAuthUI();
            }
        }, 5000);

        // API Keys tab event listeners (CSP-compliant)
        document.getElementById('test-gemini-btn')?.addEventListener('click', () => testApiKey('gemini'));
        document.getElementById('save-gemini-btn')?.addEventListener('click', () => saveApiKey('gemini'));
        document.getElementById('test-gemini-saved-btn')?.addEventListener('click', () => testSavedApiKey('gemini'));
        document.getElementById('delete-gemini-btn')?.addEventListener('click', () => deleteApiKey('gemini'));

        document.getElementById('test-anthropic-btn')?.addEventListener('click', () => testApiKey('anthropic'));
        document.getElementById('save-anthropic-btn')?.addEventListener('click', () => saveApiKey('anthropic'));
        document.getElementById('test-anthropic-saved-btn')?.addEventListener('click', () => testSavedApiKey('anthropic'));
        document.getElementById('delete-anthropic-btn')?.addEventListener('click', () => deleteApiKey('anthropic'));

        document.getElementById('test-openai-btn')?.addEventListener('click', () => testApiKey('openai'));
        document.getElementById('save-openai-btn')?.addEventListener('click', () => saveApiKey('openai'));
        document.getElementById('test-openai-saved-btn')?.addEventListener('click', () => testSavedApiKey('openai'));
        document.getElementById('delete-openai-btn')?.addEventListener('click', () => deleteApiKey('openai'));

        // External links
        document.getElementById('gemini-docs-link')?.addEventListener('click', () => {
            openExternalLink('https://aistudio.google.com/apikey');
        });
        document.getElementById('anthropic-docs-link')?.addEventListener('click', () => {
            openExternalLink('https://console.anthropic.com/');
        });
        document.getElementById('openai-docs-link')?.addEventListener('click', () => {
            openExternalLink('https://platform.openai.com/api-keys');
        });

        // About tab event listeners (CSP-compliant)
        document.getElementById('website-link')?.addEventListener('click', () => {
            openExternalLink('https://dikta.me');
        });
        document.getElementById('github-link')?.addEventListener('click', () => {
            openExternalLink('https://github.com/diktate/diktate');
        });

        // Modal event listeners (CSP-compliant)
        document.getElementById('restart-now-banner-btn')?.addEventListener('click', showRestartModal);
        document.getElementById('modal-cancel-btn')?.addEventListener('click', hideRestartModal);
        document.getElementById('modal-restart-btn')?.addEventListener('click', relaunchApp);

        // Capture initial model selections for change detection
        const defaultSelect = document.getElementById('default-model') as HTMLSelectElement;
        if (defaultSelect) initialModels['default'] = defaultSelect.value;

        const modes = ['standard', 'prompt', 'professional', 'raw'];
        for (const mode of modes) {
            initialModels[`modeModel_${mode}`] = settings[`modeModel_${mode}`] || '';
        }

    } catch (e) {
        console.error('Failed to load settings:', e);
    }
});

// Audio Device Handling
async function refreshAudioDevices(selectedId: string | undefined, selectedLabel: string | undefined) {
    const select = document.getElementById('audio-device') as HTMLSelectElement | null;
    if (!select) return;

    select.innerHTML = '<option>Loading...</option>';

    try {
        // Request permission if needed (uses Web API, works in sandbox)
        await navigator.mediaDevices.getUserMedia({ audio: true });

        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');

        select.innerHTML = '';

        // Add Default option
        const defaultOption = document.createElement('option');
        defaultOption.value = 'default';
        defaultOption.text = 'Default Microphone';
        select.appendChild(defaultOption);

        audioInputs.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Microphone ${select.length + 1}`;
            select.appendChild(option);
        });

        // Restore selection
        if (selectedId) {
            select.value = selectedId;

            // FALLBACK: If ID didn't match (e.g. browser re-randomized IDs), try to match by label
            if (select.value !== selectedId && selectedLabel) {
                for (let i = 0; i < select.options.length; i++) {
                    if (select.options[i].text === selectedLabel) {
                        select.selectedIndex = i;
                        console.log('Restored audio selection via label fallback:', selectedLabel);
                        break;
                    }
                }
            }
        }

        // Handle change
        // Handle change
        select.onchange = async () => {
            const deviceId = select.value;
            const label = select.options[select.selectedIndex].text;
            console.log('Saving audio device:', deviceId, label);
            try {
                await window.settingsAPI.saveAudioDevice(deviceId, label);
                console.log('Audio device saved successfully');
                // Load noise floor for new device (SPEC_021)
                await loadNoiseFloorForDevice(deviceId);
            } catch (error) {
                console.error('Failed to save audio device:', error);
            }
        };

        // Load initial noise floor (SPEC_021)
        if (selectedId) {
            await loadNoiseFloorForDevice(selectedId);
        }

    } catch (err) {
        console.error('Error listing devices:', err);
        select.innerHTML = '<option>Error loading devices</option>';
    }
}

// Tab Switching
function switchTab(tabId: string) {
    // Buttons - Remove active from all, then add to the matching button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        // Check if this button's data-tab attribute matches the target tab
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        }
    });

    // Content - Show the corresponding tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabId)?.classList.add('active');

    // Stop monitoring when leaving audio tab (SPEC_021)
    if (tabId !== 'audio' && isMonitoring) {
        stopAudioMonitoring();
        const btn = document.getElementById('start-monitoring-btn') as HTMLButtonElement;
        if (btn) btn.textContent = 'Start Monitoring';
    }

    // Abort any active test when leaving audio tab
    if (tabId !== 'audio') {
        activeTestAborted = true;
        if (audioAnalyzer) {
            audioAnalyzer.stop();
            audioAnalyzer = null;
        }
    }

    // If switching to models tab, refresh the list and status
    if (tabId === 'models') {
        loadOllamaModels();
        checkOllamaStatus();
    }

    // If switching to ollama tab, refresh status and models
    if (tabId === 'ollama') {
        refreshOllamaStatus();
    }
}



// Load Settings into UI
function loadSettings(settings: any) {
    if (!settings) return;

    // General
    setVal('processing-mode', settings.processingMode || 'local');
    setCheck('auto-start', settings.autoStart || false);

    // Audio - sound selection
    setVal('start-sound', settings.startSound || 'a');
    setVal('stop-sound', settings.stopSound || 'a');
    setVal('ask-sound', settings.askSound || 'c');

    // Audio - max recording duration (radio buttons)
    const maxDuration = settings.maxRecordingDuration !== undefined ? settings.maxRecordingDuration : 60;
    const durationRadios = document.querySelectorAll<HTMLInputElement>('input[name="max-duration"]');
    durationRadios.forEach(radio => {
        radio.checked = parseInt(radio.value) === maxDuration;
    });

    // Models
    setVal('default-model', settings.defaultOllamaModel || 'gemma3:4b');
    updateModeModelDisplay(settings.defaultOllamaModel || 'gemma3:4b');

    // Modes
    setVal('default-mode', settings.defaultMode || 'standard');
    setVal('ask-output-mode', settings.askOutputMode || 'type');

    // Trailing Space & Additional Keys (SPEC_006)
    setCheck('trailing-space-enabled', settings.trailingSpaceEnabled !== false); // Default: true
    setVal('additional-key', settings.additionalKey || 'none');
    setCheck('additional-key-enabled', settings.additionalKeyEnabled || false);

    // Hotkeys
    if (settings.hotkey) {
        const hotkeyDisplay = document.getElementById('hotkey-display');
        if (hotkeyDisplay) hotkeyDisplay.textContent = settings.hotkey;
    }
    if (settings.askHotkey) {
        const askHotkeyDisplay = document.getElementById('ask-hotkey-display');
        if (askHotkeyDisplay) askHotkeyDisplay.textContent = settings.askHotkey;
    }
    if (settings.translateHotkey) {
        const translateHotkeyDisplay = document.getElementById('translate-hotkey-display');
        if (translateHotkeyDisplay) translateHotkeyDisplay.textContent = settings.translateHotkey;
    }
    if (settings.refineHotkey) {
        const refineHotkeyDisplay = document.getElementById('refine-hotkey-display');
        if (refineHotkeyDisplay) refineHotkeyDisplay.textContent = settings.refineHotkey;
    }
    if (settings.oopsHotkey) {
        const oopsHotkeyDisplay = document.getElementById('oops-hotkey-display');
        if (oopsHotkeyDisplay) oopsHotkeyDisplay.textContent = settings.oopsHotkey;
    }
}


// Helpers
function setVal(id: string, val: string) {
    const el = document.getElementById(id) as HTMLSelectElement | null;
    if (el) el.value = val;
}

function setCheck(id: string, val: boolean) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.checked = val;
}

// Save Setting
function saveSetting(key: string, value: any) {
    console.log(`Saving ${key}:`, value);
    window.settingsAPI.set(key, value);
}

// Hotkey Recording
function recordHotkey(mode: 'dictate' | 'ask' | 'translate' | 'refine' | 'oops' = 'dictate') {
    const configMap = {
        dictate: { displayId: 'hotkey-display', settingKey: 'hotkey', label: 'Dictate' },
        ask: { displayId: 'ask-hotkey-display', settingKey: 'askHotkey', label: 'Ask Mode' },
        translate: { displayId: 'translate-hotkey-display', settingKey: 'translateHotkey', label: 'Translate' },
        refine: { displayId: 'refine-hotkey-display', settingKey: 'refineHotkey', label: 'Refine' },
        oops: { displayId: 'oops-hotkey-display', settingKey: 'oopsHotkey', label: 'Oops' }
    };

    const { displayId, settingKey, label } = configMap[mode];
    const display = document.getElementById(displayId);
    if (isRecordingHotkey || !display) return;

    isRecordingHotkey = true;
    const originalText = display.textContent;
    display.textContent = 'Press new hotkey...';
    display.classList.add('recording');

    // Global keydown listener
    const handler = (e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Ignore modifier-only presses
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

        const modifiers: string[] = [];
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.altKey) modifiers.push('Alt');
        if (e.shiftKey) modifiers.push('Shift');

        const key = e.key.toUpperCase();
        const shortcut = [...modifiers, key].join('+');

        // Conflict check against ALL other hotkeys
        const conflicts: { id: string, name: string }[] = [
            { id: 'hotkey-display', name: 'Dictate' },
            { id: 'ask-hotkey-display', name: 'Ask Mode' },
            { id: 'translate-hotkey-display', name: 'Translate' },
            { id: 'refine-hotkey-display', name: 'Refine' },
            { id: 'oops-hotkey-display', name: 'Oops' }
        ].filter(item => item.id !== displayId);

        for (const other of conflicts) {
            const otherDisplay = document.getElementById(other.id);
            if (otherDisplay && otherDisplay.textContent === shortcut) {
                alert(`⚠️ Conflict: This hotkey is already used for ${other.name}.`);
                display.textContent = originalText;
                display.classList.remove('recording');
                isRecordingHotkey = false;
                document.removeEventListener('keydown', handler);
                return;
            }
        }

        // Update UI
        display.textContent = shortcut;
        display.classList.remove('recording');
        isRecordingHotkey = false;

        // Save
        saveSetting(settingKey, shortcut);

        // Remove listener
        document.removeEventListener('keydown', handler);
    };

    document.addEventListener('keydown', handler);
}

function resetHotkey(mode: 'dictate' | 'ask' | 'translate' | 'refine' | 'oops' = 'dictate') {
    const defaults = {
        dictate: 'Ctrl+Alt+D',
        ask: 'Ctrl+Alt+A',
        translate: 'Ctrl+Alt+T',
        refine: 'Ctrl+Alt+R',
        oops: 'Ctrl+Alt+V'
    };
    const configMap = {
        dictate: { displayId: 'hotkey-display', settingKey: 'hotkey' },
        ask: { displayId: 'ask-hotkey-display', settingKey: 'askHotkey' },
        translate: { displayId: 'translate-hotkey-display', settingKey: 'translateHotkey' },
        refine: { displayId: 'refine-hotkey-display', settingKey: 'refineHotkey' },
        oops: { displayId: 'oops-hotkey-display', settingKey: 'oopsHotkey' }
    };

    const { displayId, settingKey } = configMap[mode];
    const defaultHotkey = defaults[mode];

    const display = document.getElementById(displayId);
    if (display) display.textContent = defaultHotkey;
    saveSetting(settingKey, defaultHotkey);
}


// External links handler (called from onclick in HTML)
function openExternalLink(url: string) {
    window.settingsAPI.openExternal(url);
}

// ============================================================================
// Google Hub OAuth Functions (SPEC_016)
// ============================================================================

async function updateOAuthUI() {
    try {
        const result = await window.settingsAPI.oauth.listAccounts();

        if (!result.success) {
            console.error('Failed to load OAuth accounts:', result.error);
            showOAuthError();
            return;
        }

        const accounts = result.accounts || [];
        const activeResult = await window.settingsAPI.oauth.getActive();
        const activeAccount = activeResult.success ? activeResult.account : null;

        // Update UI based on account status
        const noAccountsDiv = document.getElementById('oauth-no-accounts');
        const accountsContainer = document.getElementById('oauth-accounts-container');
        const quotaSection = document.getElementById('oauth-quota-section');
        const activeAccountDiv = document.getElementById('oauth-active-account');
        const fallbackNotice = document.getElementById('oauth-fallback-notice');

        if (!noAccountsDiv || !accountsContainer || !quotaSection || !activeAccountDiv || !fallbackNotice) {
            console.warn('OAuth UI elements not found');
            return;
        }

        if (accounts.length === 0) {
            // Show "no accounts" message
            noAccountsDiv.style.display = 'block';
            accountsContainer.style.display = 'none';
            quotaSection.style.display = 'none';
            activeAccountDiv.style.display = 'none';

            // Check if API key fallback is in use
            try {
                const apiKeys = await window.settingsAPI.getApiKeys();
                const hasGeminiKey = apiKeys && (apiKeys.gemini || apiKeys.google);
                if (hasGeminiKey) {
                    fallbackNotice.style.display = 'block';
                } else {
                    fallbackNotice.style.display = 'none';
                }
            } catch (err) {
                console.warn('Failed to check API keys:', err);
                fallbackNotice.style.display = 'none';
            }
        } else {
            // Hide "no accounts" message
            noAccountsDiv.style.display = 'none';
            accountsContainer.style.display = 'block';

            // Hide "Connect Another Account" button if 3 accounts are connected
            const addAccountBtn = document.getElementById('oauth-add-account-btn');
            if (addAccountBtn) {
                addAccountBtn.style.display = accounts.length >= 3 ? 'none' : 'block';
            }

            // Update account list
            const accountsList = document.getElementById('oauth-accounts-list');
            if (accountsList) {
                accountsList.innerHTML = accounts.map(account => {
                    // Enhanced status badge with icons
                    let statusBadge = '';
                    let statusColor = '';
                    switch (account.status) {
                        case 'active':
                            statusBadge = '✓ Active';
                            statusColor = '#4ade80';
                            break;
                        case 'refreshing':
                            statusBadge = '⟳ Refreshing...';
                            statusColor = '#38bdf8';
                            break;
                        case 'expired':
                            statusBadge = '⚠ Expired';
                            statusColor = '#f97316';
                            break;
                        case 'revoked':
                            statusBadge = '✗ Disconnected';
                            statusColor = '#f87171';
                            break;
                        case 'error':
                            statusBadge = '⚠ Error';
                            statusColor = '#f87171';
                            break;
                        default:
                            statusBadge = account.status;
                            statusColor = '#94a3b8';
                    }

                    // Quota display if available
                    let quotaDisplay = '';
                    if (account.quotaUsedToday !== undefined && account.quotaLimitDaily !== undefined) {
                        const quotaPercent = Math.round((account.quotaUsedToday / account.quotaLimitDaily) * 100);
                        const quotaColor = quotaPercent >= 90 ? '#f87171' : quotaPercent >= 75 ? '#f97316' : '#4ade80';
                        quotaDisplay = `<div style="color: ${quotaColor}; font-size: 0.85em; margin-top: 4px;">
                            ${quotaPercent}% quota used
                        </div>`;
                    }

                    return `
                        <div style="padding: 12px; background: #1a2f3a; border: 1px solid #0ea5e9; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="color: #38bdf8; font-weight: 500;">${account.email}</div>
                                <div style="color: #94a3b8; font-size: 0.85em; margin-top: 4px;">
                                    Status: <span style="color: ${statusColor}; font-weight: 600;">${statusBadge}</span>
                                </div>
                                ${quotaDisplay}
                            </div>
                            <div>
                                ${account.accountId === activeAccount?.accountId ? '<span style="color: #4ade80; font-weight: 500; font-size: 0.85em;">✓ Active</span>' : `<button class="btn btn-secondary" onclick="switchOAuthAccount('${account.accountId}')" style="font-size: 0.85em;">🔄 Switch</button>`}
                            </div>
                        </div>
                    `;
                }).join('');
            }

            // If we have accounts but no active account, set the first one as active
            if (accounts.length > 0 && !activeAccount) {
                console.warn('No active account set, setting first account as active');
                const firstAccount = accounts[0];
                await window.settingsAPI.oauth.switchAccount(firstAccount.accountId);
                // Refresh to get the newly set active account
                await updateOAuthUI();
                return;
            }

            // Update active account display
            if (activeAccount) {
                activeAccountDiv.style.display = 'block';
                const email = document.getElementById('oauth-active-email');
                const status = document.getElementById('oauth-active-status');

                if (email && status) {
                    email.textContent = activeAccount.email;
                    const statusText = activeAccount.status === 'active' ?
                        `Expires: ${new Date(activeAccount.expiresAt).toLocaleString()}` :
                        `Status: ${activeAccount.status}`;
                    status.textContent = statusText;
                }

                // Show the active account section
                activeAccountDiv.style.display = 'block';

                // Update quota
                const quotaResult = await window.settingsAPI.oauth.getQuota(activeAccount.accountId);
                if (quotaResult.success && quotaResult.quotaInfo) {
                    const quota = quotaResult.quotaInfo;
                    quotaSection.style.display = 'block';

                    const quotaText = document.getElementById('oauth-quota-text');
                    const quotaPercent = document.getElementById('oauth-quota-percent');
                    const quotaBar = document.getElementById('oauth-quota-bar');

                    if (quotaText && quotaPercent && quotaBar) {
                        quotaText.textContent = `${quota.used.toLocaleString()} / ${quota.limit.toLocaleString()} characters`;
                        quotaPercent.textContent = `${quota.percentUsed.toFixed(1)}%`;
                        quotaBar.style.width = `${Math.min(quota.percentUsed, 100)}%`;

                        // Change bar color based on usage
                        if (quota.percentUsed >= 95) {
                            quotaBar.style.background = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
                        } else if (quota.percentUsed >= 80) {
                            quotaBar.style.background = 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)';
                        }
                    }
                }
            } else {
                activeAccountDiv.style.display = 'none';
                quotaSection.style.display = 'none';
            }
        }

        fallbackNotice.style.display = 'none';
    } catch (error) {
        console.error('Error updating OAuth UI:', error);
        showOAuthError();
    }
}

async function initializeOAuthFlow() {
    try {
        const button = document.getElementById('oauth-connect-btn') as HTMLButtonElement | null;
        if (button) button.disabled = true;

        const result = await window.settingsAPI.oauth.startFlow('google');

        if (!result.success || !result.authUrl) {
            alert(`Failed to start OAuth flow: ${result.error || 'Unknown error'}`);
            if (button) button.disabled = false;
            return;
        }

        // Open browser for authorization
        window.settingsAPI.openExternal(result.authUrl);

        // Wait for user to authorize and return
        // The redirect server will handle the callback
        // Check every second if an account was added
        let attempts = 0;
        const checkInterval = setInterval(async () => {
            attempts++;

            const listResult = await window.settingsAPI.oauth.listAccounts();
            if (listResult.success && listResult.accounts && listResult.accounts.length > 0) {
                clearInterval(checkInterval);
                await updateOAuthUI();
                if (button) button.disabled = false;
            } else if (attempts > 300) {
                // Timeout after 5 minutes
                clearInterval(checkInterval);
                if (button) button.disabled = false;
                console.log('OAuth flow timed out, but you can check again');
            }
        }, 1000);
    } catch (error) {
        console.error('Failed to initialize OAuth flow:', error);
        alert(`Error: ${error}`);
        const button = document.getElementById('oauth-connect-btn') as HTMLButtonElement | null;
        if (button) button.disabled = false;
    }
}

async function switchOAuthAccount(accountId: string) {
    try {
        const result = await window.settingsAPI.oauth.switchAccount(accountId);
        if (result.success) {
            await updateOAuthUI();
        } else {
            alert(`Failed to switch account: ${result.error}`);
        }
    } catch (error) {
        console.error('Error switching account:', error);
        alert(`Error: ${error}`);
    }
}

async function disconnectOAuthAccount(accountId: string) {
    const account = (await window.settingsAPI.oauth.listAccounts()).accounts?.find(a => a.accountId === accountId);
    if (!account) return;

    const confirmed = confirm(`Disconnect ${account.email}?`);
    if (!confirmed) return;

    try {
        const result = await window.settingsAPI.oauth.disconnect(accountId);
        if (result.success) {
            await updateOAuthUI();
        } else {
            alert(`Failed to disconnect account: ${result.error}`);
        }
    } catch (error) {
        console.error('Error disconnecting account:', error);
        alert(`Error: ${error}`);
    }
}

function showOAuthError(message?: string) {
    if (message) {
        // Show error message in dedicated error display
        const errorDiv = document.getElementById('oauth-error-message');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.className = 'oauth-error visible';

            // Auto-hide after 10 seconds
            setTimeout(() => {
                errorDiv.className = 'oauth-error';
            }, 10000);
        }
    } else {
        // Fallback behavior for general OAuth errors
        const noAccountsDiv = document.getElementById('oauth-no-accounts');
        const fallbackNotice = document.getElementById('oauth-fallback-notice');

        if (noAccountsDiv) noAccountsDiv.style.display = 'block';
        if (fallbackNotice) fallbackNotice.style.display = 'block';
    }
}

function showOAuthWarning(message: string) {
    const errorDiv = document.getElementById('oauth-error-message');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.className = 'oauth-warning visible';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorDiv.className = 'oauth-warning';
        }, 5000);
    }
}

function clearOAuthError() {
    const errorDiv = document.getElementById('oauth-error-message');
    if (errorDiv) {
        errorDiv.className = 'oauth-error';
        errorDiv.textContent = '';
    }
}

// API Key Functions
async function loadApiKeys() {
    try {
        const keys = await window.settingsAPI.getApiKeys();
        if (keys) {
            // Only show masked placeholder if key exists
            ['gemini', 'anthropic', 'openai'].forEach(provider => {
                const input = document.getElementById(`${provider}-api-key`) as HTMLInputElement;
                if (input && keys[`${provider}ApiKey`]) {
                    input.placeholder = '••••••••••••••••';
                }
            });
        }
    } catch (e) {
        console.error('Failed to load API keys:', e);
    }
}

async function saveApiKeys() {
    const geminiKey = (document.getElementById('gemini-api-key') as HTMLInputElement)?.value;
    const anthropicKey = (document.getElementById('anthropic-api-key') as HTMLInputElement)?.value;
    const openaiKey = (document.getElementById('openai-api-key') as HTMLInputElement)?.value;

    try {
        if (geminiKey) await window.settingsAPI.setApiKey('gemini', geminiKey);
        if (anthropicKey) await window.settingsAPI.setApiKey('anthropic', anthropicKey);
        if (openaiKey) await window.settingsAPI.setApiKey('openai', openaiKey);

        alert('API keys saved securely!');

        // Clear inputs after save
        ['gemini-api-key', 'anthropic-api-key', 'openai-api-key'].forEach(id => {
            const input = document.getElementById(id) as HTMLInputElement;
            if (input) {
                input.value = '';
                input.placeholder = '••••••••••••••••';
            }
        });
    } catch (e) {
        console.error('Failed to save API keys:', e);
        alert('Failed to save API keys');
    }
}

async function testApiKey(provider: string) {
    const input = document.getElementById(`${provider}-api-key`) as HTMLInputElement;
    const key = input?.value;

    if (!key) {
        alert(`Please enter a ${provider} API key first`);
        return;
    }

    try {
        const result = await window.settingsAPI.testApiKey(provider, key);
        if (result.success) {
            alert(`✅ ${provider} API key is valid!`);
        } else {
            alert(`❌ ${provider} API key test failed:\n\n${result.error}`);
        }
    } catch (e) {
        // Extract clean validation error from Electron IPC wrapper
        let errorMsg = e instanceof Error ? e.message : String(e);

        // Remove Electron IPC wrapper: "Error invoking remote method 'apikey:test': Error: "
        const ipcPrefix = /^Error invoking remote method '[^']+': Error: /;
        errorMsg = errorMsg.replace(ipcPrefix, '');

        alert(`❌ Test failed\n\nThe API key format is invalid. ${errorMsg}`);
    }
}

// Expose functions to global scope for onclick handlers
(window as any).switchTab = switchTab;
(window as any).saveSetting = saveSetting;
(window as any).recordHotkey = recordHotkey;
(window as any).resetHotkey = resetHotkey;
(window as any).openExternalLink = openExternalLink;
(window as any).saveApiKey = saveApiKey;
(window as any).testApiKey = testApiKey;
(window as any).testSavedApiKey = testSavedApiKey;
(window as any).deleteApiKey = deleteApiKey;
(window as any).refreshOllamaStatus = refreshOllamaStatus;
(window as any).restartOllama = restartOllama;
(window as any).warmupModel = warmupModel;
(window as any).pullOllamaModel = pullOllamaModel;
(window as any).onDefaultModelChange = onDefaultModelChange;
(window as any).saveModeModel = saveModeModel;
(window as any).saveOllamaSetting = saveOllamaSetting;
(window as any).quickPullModel = quickPullModel;
(window as any).showRestartModal = showRestartModal;
(window as any).hideRestartModal = hideRestartModal;
(window as any).relaunchApp = relaunchApp;
(window as any).previewSpecificSound = previewSpecificSound;


// ============================================
// Restart Modal Logic
// ============================================

function showRestartModal() {
    const modal = document.getElementById('restart-modal');
    if (modal) modal.style.display = 'flex';
}

function hideRestartModal() {
    const modal = document.getElementById('restart-modal');
    if (modal) modal.style.display = 'none';
}

function relaunchApp() {
    window.settingsAPI.relaunchApp();
}

async function checkModelChanges() {
    const banner = document.getElementById('restart-banner');
    if (!banner) return;

    try {
        const settings = await window.settingsAPI.getAll();
        let changed = false;

        // Check default model
        if (initialModels['default'] !== settings.defaultOllamaModel) {
            changed = true;
        }

        // Check mode models
        if (!changed) {
            const modes = ['standard', 'prompt', 'professional'];
            for (const mode of modes) {
                if (initialModels[`modeModel_${mode}`] !== (settings[`modeModel_${mode}`] || '')) {
                    changed = true;
                    break;
                }
            }
        }

        hasModelChanges = changed;
        banner.style.display = changed ? 'flex' : 'none';
    } catch (e) {
        console.error('Failed to check model changes:', e);
    }
}
// Ollama tab functions
(window as any).refreshOllamaStatus = refreshOllamaStatus;
(window as any).pullOllamaModel = pullOllamaModel;
(window as any).deleteOllamaModel = deleteOllamaModel;
(window as any).saveOllamaSetting = saveOllamaSetting;
(window as any).quickPullModel = quickPullModel;



// ============================================
// Sound Management Functions
// ============================================

async function populateSoundDropdowns() {
    try {
        const soundFiles = await window.settingsAPI.getSoundFiles();
        if (!soundFiles || soundFiles.length === 0) return;

        const ids = ['start-sound', 'stop-sound', 'ask-sound'];

        ids.forEach(id => {
            const select = document.getElementById(id) as HTMLSelectElement;
            if (!select) return;

            // Save current value
            const currentVal = select.value;

            // Clear except for "None"
            select.innerHTML = '<option value="none">🔇 None (Silent)</option>';

            soundFiles.forEach(sound => {
                const option = document.createElement('option');
                option.value = sound;
                option.text = `🔊 ${sound}`;
                select.appendChild(option);
            });

            // Restore value
            select.value = currentVal;
        });

        // Re-load settings to ensure correct values are set after population
        const settings = await window.settingsAPI.getAll();
        setVal('start-sound', settings.startSound || 'a');
        setVal('stop-sound', settings.stopSound || 'a');
        setVal('ask-sound', settings.askSound || 'c');

    } catch (e) {
        console.error('Failed to populate sound dropdowns:', e);
    }
}

function previewSpecificSound(selectId: string) {
    const select = document.getElementById(selectId) as HTMLSelectElement;
    const sound = select?.value;
    if (sound && sound !== 'none') {
        window.settingsAPI.playSound(sound).catch(err => {
            console.error('Failed to play sound:', err);
        });
    }
}

// ============================================
// Ollama Model Management Functions
// ============================================

async function checkOllamaStatus() {
    const statusEl = document.getElementById('ollama-version');
    if (!statusEl) return;

    try {
        const response = await fetch('http://localhost:11434/api/version');
        if (response.ok) {
            const data = await response.json();
            statusEl.textContent = `✅ Ollama v${data.version} running`;
            statusEl.style.color = '#4ade80';
        } else {
            statusEl.textContent = '❌ Ollama not responding';
            statusEl.style.color = '#f87171';
        }
    } catch (e) {
        statusEl.textContent = '❌ Ollama not running';
        statusEl.style.color = '#f87171';
    }
}

async function loadOllamaModels() {
    const select = document.getElementById('default-model') as HTMLSelectElement;

    if (!select) return;

    try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (!response.ok) {
            throw new Error('Ollama not available');
        }

        const data = await response.json();
        const models = data.models || [];

        // Clear and populate select
        select.innerHTML = '';

        if (models.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.text = 'No models installed';
            select.appendChild(option);
            return;
        }

        // Get the recommended max size from hardware test (stored in element)
        const maxRecommendedGB = getRecommendedMaxModelSize();

        models.forEach((model: any) => {
            const sizeGB = model.size / (1024 * 1024 * 1024);
            const modelSizeClass = getModelSizeClass(model.name, sizeGB, maxRecommendedGB);

            // Add to dropdown with warning indicator
            const option = document.createElement('option');
            option.value = model.name;
            const warningPrefix = modelSizeClass === 'too-large' ? '⚠️ ' : '';
            option.text = `${warningPrefix}${model.name} (${formatBytes(model.size)})`;
            if (modelSizeClass === 'too-large') {
                option.style.color = '#f87171';
            }
            select.appendChild(option);
        });

        // Restore saved selection
        try {
            const settings = await window.settingsAPI.getAll();
            if (settings.defaultOllamaModel) {
                select.value = settings.defaultOllamaModel;
            }
            updateModeModelDisplay(select.value || 'gemma3:4b');
        } catch (e) {
            console.error('Failed to restore model selection:', e);
        }

    } catch (e) {
        console.error('Failed to load Ollama models:', e);
        select.innerHTML = '<option value="">Ollama not available</option>';
    }
}


function refreshOllamaModels() {
    loadOllamaModels();
    checkOllamaStatus();
}

function launchOllamaUI() {
    // Open WebUI or default Ollama interface
    window.settingsAPI.openExternal('http://localhost:11434');
}

function updateModeModelDisplay(model: string) {
    const el = document.getElementById('mode-model');
    if (el) {
        el.textContent = model || 'gemma3:4b';
    }
}

// ============================================
// Hardware Testing Functions
// ============================================

async function runHardwareTest() {
    const btn = document.getElementById('hardware-test-btn') as HTMLButtonElement;
    const gpuEl = document.getElementById('hw-gpu');
    const vramEl = document.getElementById('hw-vram');
    const tierEl = document.getElementById('hw-tier');

    if (!btn || !gpuEl || !vramEl || !tierEl) return;

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '🔬 Testing... (please wait)';

    try {
        const result = await window.settingsAPI.runHardwareTest();
        gpuEl.textContent = result.gpu;
        vramEl.textContent = result.vram;
        tierEl.textContent = result.tier;

        // Color code the tier
        if (result.tier.toLowerCase().includes('quality')) {
            tierEl.style.color = '#4ade80'; // Green
        } else if (result.tier.toLowerCase().includes('balanced')) {
            tierEl.style.color = '#fbbf24'; // Yellow
        } else {
            tierEl.style.color = '#60a5fa'; // Blue
        }

    } catch (e) {
        console.error('Hardware test failed:', e);
        gpuEl.textContent = 'Test failed';
        vramEl.textContent = 'Test failed';
        tierEl.textContent = 'Unknown';
    } finally {
        btn.disabled = false;
        btn.textContent = originalText || '🔬 Run Hardware Test';
    }
}

// ============================================
// Utility Functions
// ============================================

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Get the recommended maximum model size based on hardware test results
 * Returns model parameter size in billions (e.g., 4 = 4B models)
 */
function getRecommendedMaxModelSize(): number {
    const tierEl = document.getElementById('hw-tier');
    const tier = tierEl?.textContent?.toLowerCase() || '';

    // Parse tier to determine max recommended model size
    if (tier.includes('quality') || tier.includes('12gb')) {
        return 8; // Can handle 8B models
    } else if (tier.includes('balanced') || tier.includes('6-12gb')) {
        return 8; // Can handle up to 8B with some caution
    } else if (tier.includes('fast') || tier.includes('4-6gb')) {
        return 4; // Should stick to 4B or smaller
    } else {
        // Default to conservative 4B if no hardware test done
        return 4;
    }
}

/**
 * Classify a model as ok, borderline, or too-large based on its name and size
 */
function getModelSizeClass(modelName: string, sizeGB: number, maxRecommendedB: number): 'ok' | 'borderline' | 'too-large' {
    // Extract parameter count from model name (e.g., "gemma3:4b" -> 4, "qwen3:30b" -> 30)
    const match = modelName.toLowerCase().match(/(\d+)b/);
    let modelParamB = 0;

    if (match) {
        modelParamB = parseInt(match[1]);
    } else {
        // Estimate from file size: ~0.5-1GB per billion parameters (quantized)
        // Conservative estimate: 2GB per B for safety margin
        modelParamB = Math.ceil(sizeGB / 2);
    }

    // Classify based on recommended max
    if (modelParamB <= maxRecommendedB) {
        return 'ok';
    } else if (modelParamB <= maxRecommendedB * 1.5) {
        return 'borderline';
    } else {
        return 'too-large';
    }
}

// ============================================
// Per-Mode Model Selection
// ============================================

async function onDefaultModelChange(model: string) {
    if (!model) return;

    // Save to settings
    await window.settingsAPI.set('defaultOllamaModel', model);

    // Update UI/Banner
    checkModelChanges();

    // Show modal if it's different from initial
    if (initialModels['default'] !== model) {
        showRestartModal();
    }

    console.log(`Default model changed to: ${model}`);
}

function saveModeModel(mode: string, model: string) {
    const key = `modeModel_${mode}` as any;
    window.settingsAPI.set(key, model);

    // Update UI/Banner
    checkModelChanges();

    // Show modal if it's different from initial
    if (initialModels[`modeModel_${mode}`] !== model) {
        showRestartModal();
    }

    console.log(`Saved model for ${mode} mode: ${model || 'default'}`);
}

async function populateModeModelDropdowns() {
    const modes = ['standard', 'prompt', 'professional'];

    try {
        // Retry up to 3 times with 1 second delay (Ollama might be starting up)
        let response;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                // Manual timeout using AbortController for compatibility
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);

                response = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
                clearTimeout(timeoutId);

                if (response.ok) break;
            } catch (e) {
                attempts++;
                if (attempts < maxAttempts) {
                    console.log(`Ollama not ready, retrying (${attempts}/${maxAttempts})...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        if (!response || !response.ok) {
            console.warn('Ollama not available for model dropdowns');
            return;
        }

        const data = await response.json();
        const models = data.models || [];

        if (models.length === 0) {
            console.warn('No Ollama models found');
            return;
        }

        // Get the recommended max size from hardware test
        const maxRecommendedGB = getRecommendedMaxModelSize();

        for (const mode of modes) {
            const select = document.getElementById(`model-${mode}`) as HTMLSelectElement;
            if (!select) continue;

            // Clear and add default option
            select.innerHTML = '<option value="">Use default model</option>';

            // Add all models
            models.forEach((model: any) => {
                const sizeGB = model.size / (1024 * 1024 * 1024);
                const modelSizeClass = getModelSizeClass(model.name, sizeGB, maxRecommendedGB);

                const option = document.createElement('option');
                option.value = model.name;
                const warningPrefix = modelSizeClass === 'too-large' ? '⚠️ ' : '';
                option.text = `${warningPrefix}${model.name} (${formatBytes(model.size)})`;

                if (modelSizeClass === 'too-large') {
                    option.style.color = '#f87171';
                }

                select.appendChild(option);
            });

            // Restore saved value
            const settings = await window.settingsAPI.getAll();
            const savedModel = settings[`modeModel_${mode}`];
            if (savedModel) {
                select.value = savedModel;
            }
        }

        console.log(`Populated mode dropdowns with ${models.length} models`);
    } catch (e) {
        console.error('Failed to populate mode model dropdowns:', e);
    }
}

// ============================================
// API Key Management
// ============================================

async function saveApiKey(provider: string) {
    const input = document.getElementById(`${provider}-api-key`) as HTMLInputElement;
    const key = input?.value?.trim();

    if (!key) {
        alert(`Please enter a ${provider} API key first`);
        return;
    }

    try {
        await window.settingsAPI.setApiKey(provider, key);
        input.value = '';
        updateApiKeyStatus(provider, true);
        alert(`✅ ${provider} API key saved securely!`);
    } catch (e) {
        console.error(`Failed to save ${provider} API key:`, e);
        // Extract clean validation error from Electron IPC wrapper
        let errorMsg = e instanceof Error ? e.message : String(e);

        // Remove Electron IPC wrapper: "Error invoking remote method 'apikey:set': Error: "
        const ipcPrefix = /^Error invoking remote method '[^']+': Error: /;
        errorMsg = errorMsg.replace(ipcPrefix, '');

        alert(`❌ Failed to save ${provider} API key\n\nThe API key format is invalid. ${errorMsg}`);
    }
}

async function testSavedApiKey(provider: string) {
    try {
        // The main process will test using the stored encrypted key
        const result = await window.settingsAPI.testApiKey(provider, '');
        if (result.success) {
            alert(`✅ ${provider} API key is valid!`);
        } else {
            alert(`❌ ${provider} API key test failed: ${result.error}`);
        }
    } catch (e) {
        alert(`❌ Test failed: ${e}`);
    }
}

async function deleteApiKey(provider: string) {
    if (!confirm(`Delete ${provider} API key? This cannot be undone.`)) {
        return;
    }

    try {
        await window.settingsAPI.setApiKey(provider, '');
        updateApiKeyStatus(provider, false);
        alert(`🗑️ ${provider} API key deleted`);
    } catch (e) {
        console.error(`Failed to delete ${provider} API key:`, e);
        alert(`❌ Failed to delete ${provider} API key`);
    }
}

function updateApiKeyStatus(provider: string, hasSaved: boolean) {
    const inputRow = document.getElementById(`${provider}-input-row`);
    const savedRow = document.getElementById(`${provider}-saved-row`);

    if (inputRow && savedRow) {
        if (hasSaved) {
            inputRow.style.display = 'none';
            savedRow.style.display = 'block';
        } else {
            inputRow.style.display = 'flex';
            savedRow.style.display = 'none';
        }
    }
}

async function loadApiKeyStatuses() {
    try {
        const statuses = await window.settingsAPI.getApiKeys();
        ['gemini', 'anthropic', 'openai'].forEach(provider => {
            const hasKey = statuses[`${provider}ApiKey`];
            updateApiKeyStatus(provider, hasKey);
        });
    } catch (e) {
        console.error('Failed to load API key statuses:', e);
    }
}

// ============================================
// Ollama Tab Functions
// ============================================

async function refreshOllamaStatus() {
    const statusEl = document.getElementById('ollama-service-status');
    const versionEl = document.getElementById('ollama-service-version');
    const loadedEl = document.getElementById('ollama-loaded-models');

    if (statusEl) statusEl.textContent = 'Checking...';

    try {
        // Check version
        const versionResponse = await fetch('http://localhost:11434/api/version');
        if (versionResponse.ok) {
            const versionData = await versionResponse.json();
            if (statusEl) {
                statusEl.textContent = '✅ Running';
                statusEl.style.color = '#4ade80';
            }
            if (versionEl) {
                versionEl.textContent = `v${versionData.version}`;
            }
        } else {
            throw new Error('Not responding');
        }

        // Check loaded models
        const psResponse = await fetch('http://localhost:11434/api/ps');
        if (psResponse.ok) {
            const psData = await psResponse.json();
            const loadedModels = psData.models || [];
            if (loadedEl) {
                loadedEl.textContent = loadedModels.length > 0
                    ? loadedModels.map((m: any) => m.name).join(', ')
                    : 'None (idle)';
            }
        }

        // Refresh models list
        await loadOllamaModelsList();

    } catch (e) {
        if (statusEl) {
            statusEl.textContent = '❌ Not running';
            statusEl.style.color = '#f87171';
        }
        if (versionEl) versionEl.textContent = '--';
        if (loadedEl) loadedEl.textContent = '--';
    }
}

async function loadOllamaModelsList() {
    const listEl = document.getElementById('ollama-models-list');
    if (!listEl) return;

    try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (!response.ok) throw new Error('Ollama not available');

        const data = await response.json();
        const models = data.models || [];

        if (models.length === 0) {
            listEl.innerHTML = '<div style="color: #888;">No models installed. Use "Pull New Model" above.</div>';
            return;
        }

        listEl.innerHTML = models.map((model: any) => {
            const sizeGB = (model.size / (1024 * 1024 * 1024)).toFixed(1);
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #333;">
                    <div>
                        <span style="color: #fff;">${model.name}</span>
                        <span style="color: #888; font-size: 0.85em; margin-left: 8px;">${sizeGB} GB</span>
                    </div>
                    <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.8em;" 
                            onclick="deleteOllamaModel('${model.name}')">🗑️ Delete</button>
                </div>
            `;
        }).join('');

    } catch (e) {
        listEl.innerHTML = '<div style="color: #f87171;">Could not connect to Ollama.</div>';
    }
}

async function pullOllamaModel() {
    const input = document.getElementById('ollama-pull-model') as HTMLInputElement;
    const statusEl = document.getElementById('ollama-pull-status');
    const modelName = input?.value?.trim();

    if (!modelName) {
        if (statusEl) statusEl.textContent = '⚠️ Please enter a model name';
        return;
    }

    if (statusEl) {
        statusEl.textContent = `⏳ Pulling ${modelName}... This may take several minutes.`;
        statusEl.style.color = '#fbbf24';
    }

    try {
        const response = await fetch('http://localhost:11434/api/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName, stream: false })
        });

        if (response.ok) {
            if (statusEl) {
                statusEl.textContent = `✅ Successfully pulled ${modelName}!`;
                statusEl.style.color = '#4ade80';
            }
            input.value = '';
            // Refresh lists
            await loadOllamaModelsList();
            await loadOllamaModels(); // Also refresh the Models tab dropdown
        } else {
            const errorData = await response.text();
            if (statusEl) {
                statusEl.textContent = `❌ Failed: ${errorData}`;
                statusEl.style.color = '#f87171';
            }
        }
    } catch (e) {
        if (statusEl) {
            statusEl.textContent = `❌ Error: ${e}`;
            statusEl.style.color = '#f87171';
        }
    }
}

async function deleteOllamaModel(modelName: string) {
    if (!confirm(`Delete model "${modelName}"? This will free up disk space but you'll need to re-download it to use again.`)) {
        return;
    }

    try {
        const response = await fetch('http://localhost:11434/api/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName })
        });

        if (response.ok) {
            alert(`🗑️ ${modelName} deleted successfully`);
            // Refresh lists
            await loadOllamaModelsList();
            await loadOllamaModels(); // Also refresh the Models tab dropdown
        } else {
            const errorData = await response.text();
            alert(`❌ Failed to delete: ${errorData}`);
        }
    } catch (e) {
        alert(`❌ Error deleting model: ${e}`);
    }
}

function saveOllamaSetting(key: string, value: string) {
    // Save Ollama-specific settings
    const ollamaKey = `ollama_${key}`;
    saveSetting(ollamaKey, value);
    console.log(`Saved Ollama setting: ${key} = ${value}`);
}

function quickPullModel(modelName: string) {
    // Set the model name in the input field and trigger pull
    const input = document.getElementById('ollama-pull-model') as HTMLInputElement;
    if (input) {
        input.value = modelName;
    }
    pullOllamaModel();
}

// ============================================
// Ollama Service Control
// ============================================

async function restartOllama() {
    const statusDiv = document.getElementById('ollama-restart-status');
    if (!statusDiv) return;

    statusDiv.textContent = '⏳ Restarting Ollama service...';
    statusDiv.style.color = '#888';

    try {
        const result = await (window.settingsAPI as any).restartOllama();

        if (result.success) {
            statusDiv.textContent = '✓ Ollama restarted successfully';
            statusDiv.style.color = '#4ade80';

            // Refresh status after 2 seconds
            setTimeout(() => {
                refreshOllamaStatus();
                statusDiv.textContent = '';
            }, 2000);
        } else {
            statusDiv.textContent = `✗ Failed: ${result.error}`;
            statusDiv.style.color = '#ef4444';
        }
    } catch (error) {
        statusDiv.textContent = `✗ Error: ${error}`;
        statusDiv.style.color = '#ef4444';
    }
}

async function warmupModel() {
    const statusDiv = document.getElementById('ollama-restart-status');
    if (!statusDiv) return;

    statusDiv.textContent = '🔥 Warming up model...';
    statusDiv.style.color = '#888';

    try {
        const result = await (window.settingsAPI as any).warmupOllamaModel();

        if (result.success) {
            statusDiv.textContent = `✓ Model ${result.model} is ready`;
            statusDiv.style.color = '#4ade80';
            setTimeout(() => statusDiv.textContent = '', 3000);
        } else {
            statusDiv.textContent = `✗ Failed: ${result.error}`;
            statusDiv.style.color = '#ef4444';
        }
    } catch (error) {
        statusDiv.textContent = `✗ Error: ${error}`;
        statusDiv.style.color = '#ef4444';
    }
}

// ============================================
// Mode Configuration (Master-Detail)
// ============================================

let currentSelectedMode = 'standard';

async function initializeModeConfiguration() {
    try {
        // Load available models for dropdowns
        const response = await fetch('http://localhost:11434/api/tags').catch(() => null);
        if (response && response.ok) {
            const data = await response.json();
            availableModels = data.models || [];
        }

        const modelSelect = document.getElementById('mode-detail-model') as HTMLSelectElement;
        if (modelSelect) {
            modelSelect.innerHTML = ''; // No "Use default model"
            availableModels.forEach((model: any) => {
                const option = document.createElement('option');
                option.value = model.name;
                option.text = model.name;
                modelSelect.appendChild(option);
            });

            // On model change, refresh the prompt preview
            modelSelect.onchange = () => {
                updatePromptDisplay(currentSelectedMode, modelSelect.value);
            };
        }

        // Load prompts and initial mode
        await loadPrompts();
        await selectMode('standard');

    } catch (error) {
        console.error('Failed to initialize mode configuration:', error);
    }
}

async function loadPrompts() {
    try {
        const customPrompts = await window.settingsAPI.getCustomPrompts();
        const defaults = await window.settingsAPI.getDefaultPrompts();

        // Store in global
        (window as any).customPrompts = customPrompts || {};
        defaultPrompts = defaults || {};
    } catch (error) {
        console.error('Failed to load prompts:', error);
    }
}

async function selectMode(mode: string) {
    currentSelectedMode = mode;

    // Update list UI
    const modeListItems = document.querySelectorAll('.mode-list-item');
    modeListItems.forEach(item => {
        const content = item.textContent?.trim().toLowerCase();
        item.classList.toggle('active', content?.includes(mode));
    });

    // Update detail view headers
    const modeEmojis: Record<string, string> = {
        'standard': '',
        'prompt': '',
        'professional': '',
        'raw': ''
    };

    const modeNames: Record<string, string> = {
        'standard': 'Standard',
        'prompt': 'Prompt',
        'professional': 'Professional',
        'raw': 'Raw'
    };

    const titleEl = document.getElementById('mode-detail-title');
    if (titleEl) {
        titleEl.textContent = `${modeEmojis[mode]} ${modeNames[mode]}`;
    }

    // Set model dropdown selection
    const modelSelect = document.getElementById('mode-detail-model') as HTMLSelectElement;
    if (modelSelect) {
        const settings = await window.settingsAPI.getAll();
        const savedModel = settings[`modeModel_${mode}`];

        // If no saved override, pre-select the global default model
        modelSelect.value = savedModel || settings.defaultOllamaModel || 'gemma3:4b';
    }

    // Show/hide sections and update info message for Raw mode
    const modelSection = document.querySelector('[id="mode-detail-model"]')?.parentElement;
    const promptSection = document.querySelector('[id="mode-detail-prompt"]')?.parentElement;
    const infoEl = document.getElementById('prompt-info');

    if (mode === 'raw') {
        const modelSection = document.getElementById('mode-detail-model')?.parentElement;
        const promptTextarea = document.getElementById('mode-detail-prompt') as HTMLTextAreaElement;
        const promptLabel = promptTextarea?.previousElementSibling as HTMLElement;
        const buttonContainer = document.querySelector('button[onclick="saveModeDetails()"]')?.parentElement;
        const infoEl = document.getElementById('prompt-info');

        if (modelSection) modelSection.style.display = 'none';
        if (promptTextarea) promptTextarea.style.display = 'none';
        if (promptLabel) promptLabel.style.display = 'none';
        if (buttonContainer) buttonContainer.style.display = 'none';

        if (infoEl) {
            infoEl.style.marginTop = '0';
            infoEl.innerHTML = `
                <div style="color: #e0e0e0; font-family: sans-serif; line-height: 1.6;">
                    <p style="margin-top: 0;">Raw mode injects text directly from Whisper with <strong>zero latency</strong>. No LLM processing or prompting is applied.</p>
                    
                    <div style="margin-top: 20px;">
                        <strong style="font-size: 0.9em; display: block; margin-bottom: 8px; color: #888; text-transform: uppercase; letter-spacing: 0.05em;">What to expect:</strong>
                        <ul style="margin: 0; padding-left: 18px; color: #bbb; font-size: 0.95em; line-height: 1.8;">
                            <li>Includes all filler words (um, uh, etc.)</li>
                            <li>May contain audio artifacts (e.g. [Music])</li>
                            <li>Preserves every stutter and false start</li>
                        </ul>
                    </div>
                </div>
            `;
            infoEl.style.color = 'inherit';
        }
    } else {
        const modelSection = document.getElementById('mode-detail-model')?.parentElement;
        const promptTextarea = document.getElementById('mode-detail-prompt') as HTMLTextAreaElement;
        const promptLabel = promptTextarea?.previousElementSibling as HTMLElement;
        const buttonContainer = document.querySelector('button[onclick="saveModeDetails()"]')?.parentElement;
        const infoEl = document.getElementById('prompt-info');

        if (modelSection) modelSection.style.display = 'block';
        if (promptTextarea) promptTextarea.style.display = 'block';
        if (promptLabel) promptLabel.style.display = 'block';
        if (buttonContainer) buttonContainer.style.display = 'flex';

        if (infoEl) {
            infoEl.style.marginTop = '4px';
        }

        const modelSelect = document.getElementById('mode-detail-model') as HTMLSelectElement;
        // Load prompt display for non-raw modes
        await updatePromptDisplay(mode, modelSelect?.value);
    }
}

/**
 * Updates the prompt display based on mode and model
 */
async function updatePromptDisplay(mode: string, model: string) {
    const promptTextarea = document.getElementById('mode-detail-prompt') as HTMLTextAreaElement;
    if (!promptTextarea) return;

    const customPrompts = (window as any).customPrompts || {};
    const customPrompt = customPrompts[mode];

    if (customPrompt && customPrompt.length > 0) {
        promptTextarea.value = customPrompt;
    } else {
        // Fetch exact default from backend based on Mode + Model
        try {
            const defaultPrompt = await window.settingsAPI.getDefaultPrompt(mode, model);
            promptTextarea.value = defaultPrompt;
        } catch (e) {
            console.error('Failed to fetch default prompt:', e);
            promptTextarea.value = '';
        }
    }

    // Update info text
    const infoEl = document.getElementById('prompt-info');
    if (infoEl) {
        const hasCustom = customPrompt && customPrompt.length > 0;
        infoEl.textContent = hasCustom ? `✓ Custom prompt in use` : 'No custom prompt (showing current default)';
        infoEl.style.color = hasCustom ? '#4ade80' : '#888';
    }
}

async function saveModeDetails() {
    const promptTextarea = document.getElementById('mode-detail-prompt') as HTMLTextAreaElement;
    const modelSelect = document.getElementById('mode-detail-model') as HTMLSelectElement;
    let promptText = promptTextarea?.value?.trim() || '';

    // Check if the prompt is identical to the default for this specific (Mode, Model)
    // if so, we clear the custom prompt to avoid redundant storage
    const currentDefaultPrompt = await window.settingsAPI.getDefaultPrompt(currentSelectedMode, modelSelect?.value || '');
    if (promptText === currentDefaultPrompt) {
        promptText = '';
    }

    if (promptText && !promptText.includes('{text}')) {
        alert('❌ Prompt must include {text} placeholder where the transcribed text will be inserted');
        return;
    }

    try {
        // Save prompt
        const promptResult = await window.settingsAPI.saveCustomPrompt(currentSelectedMode, promptText);

        // Save model override
        const modelSelect = document.getElementById('mode-detail-model') as HTMLSelectElement;
        if (modelSelect && currentSelectedMode !== 'raw') {
            await window.settingsAPI.set(`modeModel_${currentSelectedMode}`, modelSelect.value);
            checkModelChanges();
        }

        if (promptResult.success) {
            // Reload prompts
            await loadPrompts();
            selectMode(currentSelectedMode);

            // Show success message
            const promptEl = document.getElementById('prompt-info');
            if (promptEl) {
                promptEl.textContent = '✓ Saved changes!';
                promptEl.style.color = '#4ade80';
                setTimeout(() => {
                    selectMode(currentSelectedMode);
                }, 2000);
            }
        } else {
            alert(`❌ Failed to save: ${promptResult.error}`);
        }
    } catch (error) {
        console.error('Failed to save mode details:', error);
        alert(`❌ Error: ${error}`);
    }
}

async function resetModeToDefault() {
    if (!confirm(`Reset ${currentSelectedMode} mode to default prompt?`)) {
        return;
    }

    try {
        const result = await window.settingsAPI.resetCustomPrompt(currentSelectedMode);

        if (result.success) {
            // Reload prompts
            await loadPrompts();
            selectMode(currentSelectedMode);

            // Show success message
            const promptEl = document.getElementById('prompt-info');
            if (promptEl) {
                promptEl.textContent = '✓ Reset to default!';
                promptEl.style.color = '#4ade80';
                setTimeout(() => {
                    selectMode(currentSelectedMode);
                }, 2000);
            }
        } else {
            alert(`❌ Failed to reset: ${result.error}`);
        }
    } catch (error) {
        console.error('Failed to reset mode:', error);
        alert(`❌ Error: ${error}`);
    }
}

// ============================================================================
// AUDIO MONITORING FUNCTIONS (SPEC_021)
// ============================================================================

/**
 * Toggle audio monitoring on/off
 */
async function toggleAudioMonitoring() {
    const btn = document.getElementById('start-monitoring-btn') as HTMLButtonElement;

    if (isMonitoring) {
        stopAudioMonitoring();
        btn.textContent = 'Start Monitoring';
    } else {
        try {
            await startAudioMonitoring();
            btn.textContent = 'Stop Monitoring';
        } catch (error) {
            console.error('Failed to start monitoring:', error);
            alert('Failed to access microphone. Please check permissions.');
        }
    }
}

/**
 * Start audio monitoring
 */
async function startAudioMonitoring() {
    const deviceSelect = document.getElementById('audio-device') as HTMLSelectElement;
    const deviceId = deviceSelect.value === 'default' ? undefined : deviceSelect.value;

    // Clean up any existing analyzer
    if (audioAnalyzer) {
        audioAnalyzer.stop();
        audioAnalyzer = null;
    }

    // Cancel any existing animation frame
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    try {
        audioAnalyzer = new AudioAnalyzer();
        await audioAnalyzer.start(deviceId);

        isMonitoring = true;
        peakHoldValue = 0;

        // Update meter using requestAnimationFrame
        function animate() {
            if (isMonitoring && audioAnalyzer) {
                updateSignalMeter();
                animationFrameId = requestAnimationFrame(animate);
            }
        }
        animate();
    } catch (error) {
        // Clean up on error
        if (audioAnalyzer) {
            audioAnalyzer.stop();
            audioAnalyzer = null;
        }
        isMonitoring = false;
        throw error;
    }
}

/**
 * Stop audio monitoring
 */
function stopAudioMonitoring() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    if (audioAnalyzer) {
        audioAnalyzer.stop();
        audioAnalyzer = null;
    }

    isMonitoring = false;

    // Reset UI
    const meter = document.getElementById('signal-meter');
    const status = document.getElementById('signal-status');
    const peakDb = document.getElementById('peak-db');
    const rmsDb = document.getElementById('rms-db');
    const peakHold = document.getElementById('peak-hold');

    if (meter) meter.style.width = '0%';
    if (status) status.textContent = 'Monitoring stopped';
    if (peakDb) peakDb.textContent = '--';
    if (rmsDb) rmsDb.textContent = '--';
    if (peakHold) peakHold.classList.remove('visible');
}

/**
 * Update signal meter display
 */
function updateSignalMeter() {
    if (!audioAnalyzer || !isMonitoring) return;

    const rms = audioAnalyzer.getRMS();
    const peak = audioAnalyzer.getPeak();
    const rmsDb = audioAnalyzer.toDecibels(rms);
    const peakDb = audioAnalyzer.toDecibels(peak);

    // Update peak hold
    if (peakDb > peakHoldValue) {
        peakHoldValue = peakDb;
        peakHoldDecay = 60; // Hold for 1 second at 60fps
    } else if (peakHoldDecay > 0) {
        peakHoldDecay--;
    } else {
        peakHoldValue = Math.max(peakHoldValue - 0.5, peakDb);
    }

    // Get DOM elements
    const meter = document.getElementById('signal-meter');
    const status = document.getElementById('signal-status');
    const peakDbEl = document.getElementById('peak-db');
    const rmsDbEl = document.getElementById('rms-db');
    const peakHold = document.getElementById('peak-hold');

    if (!meter || !status) return;

    // Classify audio level
    const level = classifyAudioLevel(peakDb);
    const statusText = getAudioLevelMessage(level);
    const colorClass = getAudioLevelClass(level);

    // Update meter fill
    meter.className = `meter-fill ${colorClass}`;
    const percentage = Math.max(0, Math.min(100, (peakDb + 60) / 60 * 100));
    meter.style.width = `${percentage}%`;

    // Update status text (throttled)
    const now = Date.now();
    if (now - lastStatusUpdate > STATUS_UPDATE_INTERVAL) {
        status.textContent = statusText;
        lastStatusUpdate = now;
    }

    // Update technical readout
    if (peakDbEl) peakDbEl.textContent = isFinite(peakDb) ? peakDb.toFixed(1) : '--';
    if (rmsDbEl) rmsDbEl.textContent = isFinite(rmsDb) ? rmsDb.toFixed(1) : '--';

    // Update peak hold indicator
    if (peakHold && isFinite(peakHoldValue)) {
        const peakPercentage = Math.max(0, Math.min(100, (peakHoldValue + 60) / 60 * 100));
        peakHold.style.left = `${peakPercentage}%`;
        peakHold.classList.add('visible');
    }
}

/**
 * Measure noise floor
 */
async function measureNoiseFloor() {
    const btn = document.getElementById('measure-noise-btn') as HTMLButtonElement;
    const resultDiv = document.getElementById('noise-result');

    if (!resultDiv) return;

    // Ensure monitoring is active
    if (!isMonitoring) {
        alert('Please start monitoring first');
        return;
    }

    // Disable button
    btn.disabled = true;
    btn.textContent = 'Measuring...';

    // Show countdown
    resultDiv.style.display = 'block';
    resultDiv.textContent = '🤫 Please remain silent...\n\nStarting in 3...';

    await sleep(1000);
    resultDiv.textContent = '🤫 Please remain silent...\n\nStarting in 2...';

    await sleep(1000);
    resultDiv.textContent = '🤫 Please remain silent...\n\nStarting in 1...';

    await sleep(1000);
    resultDiv.textContent = '🤫 Recording silence...\n\n⏱️ 3 seconds remaining';

    // Collect samples for 3 seconds
    const samples: number[] = [];
    const startTime = Date.now();
    const duration = 3000;

    const collectInterval = setInterval(() => {
        if (!audioAnalyzer || !isMonitoring) {
            clearInterval(collectInterval);
            return;
        }

        const rms = audioAnalyzer.getRMS();
        samples.push(rms);

        const elapsed = Date.now() - startTime;
        const remaining = Math.ceil((duration - elapsed) / 1000);
        if (resultDiv) {
            resultDiv.textContent = `🤫 Recording silence...\n\n⏱️ ${remaining} seconds remaining`;
        }
    }, 50);

    // Store the interval ID for cleanup
    activeTestInterval = collectInterval;

    try {
        // Wait for duration
        await sleep(duration);
        clearInterval(collectInterval);
        activeTestInterval = null;

        // Check if we collected enough samples
        if (samples.length === 0 || !audioAnalyzer) {
            throw new Error('Measurement aborted or no data collected');
        }

        // Calculate average RMS
        const avgRms = samples.reduce((a, b) => a + b, 0) / samples.length;
        const noiseFloorDb = audioAnalyzer.toDecibels(avgRms);

        // Save to settings
        await saveNoiseFloor(noiseFloorDb);

        // Display result
        displayNoiseFloorResult(noiseFloorDb);
    } catch (error) {
        console.error('Noise floor measurement failed:', error);
        if (resultDiv) {
            resultDiv.textContent = '❌ Measurement failed. Please try again.';
        }
    } finally {
        // Re-enable button
        if (activeTestInterval) {
            clearInterval(activeTestInterval);
            activeTestInterval = null;
        }
        btn.disabled = false;
        btn.textContent = '📊 Measure Noise Floor';
    }
}

/**
 * Helper function to sleep
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Save noise floor to settings
 */
async function saveNoiseFloor(noiseFloorDb: number) {
    const deviceSelect = document.getElementById('audio-device') as HTMLSelectElement;
    const deviceId = deviceSelect.value;
    const deviceLabel = deviceSelect.options[deviceSelect.selectedIndex].text;

    // Get current profiles
    const settings = await window.settingsAPI.getAll();
    const profiles = settings.audioDeviceProfiles || {};

    // Update profile
    profiles[deviceId] = {
        deviceId,
        deviceLabel,
        noiseFloor: noiseFloorDb,
        lastCalibrated: new Date().toISOString()
    };

    // Save
    await window.settingsAPI.set('audioDeviceProfiles', profiles);
}

/**
 * Display noise floor result
 */
function displayNoiseFloorResult(noiseFloorDb: number) {
    const resultDiv = document.getElementById('noise-result');
    const historyDiv = document.getElementById('noise-history');

    if (!resultDiv) return;

    let emoji = '';
    let assessment = '';
    let recommendation = '';

    if (noiseFloorDb < -50) {
        emoji = '✅';
        assessment = 'Excellent';
        recommendation = 'Your environment is very quiet. No changes needed.';
    } else if (noiseFloorDb < -35) {
        emoji = '⚠️';
        assessment = 'Moderate';
        recommendation = 'Moderate background noise detected. Consider:\n• Closing windows\n• Turning off fans\n• Using a headset microphone';
    } else {
        emoji = '❌';
        assessment = 'High Noise';
        recommendation = 'High noise level detected! Transcription accuracy will be degraded.\n\nRecommendations:\n• Move to a quieter room\n• Use a headset with noise cancellation\n• Enable noise suppression in Windows Sound Settings';
    }

    resultDiv.textContent = `${emoji} Noise Floor: ${noiseFloorDb.toFixed(1)} dB\n\nAssessment: ${assessment}\n\n${recommendation}`;

    // Show history
    if (historyDiv) {
        const now = new Date().toLocaleString();
        historyDiv.style.display = 'block';
        historyDiv.textContent = `Last measured: ${now}`;
    }
}

/**
 * Load noise floor for device
 */
async function loadNoiseFloorForDevice(deviceId: string) {
    const settings = await window.settingsAPI.getAll();
    const profiles = settings.audioDeviceProfiles || {};
    const profile = profiles[deviceId];

    const historyDiv = document.getElementById('noise-history');

    if (profile && profile.noiseFloor !== null && historyDiv) {
        const date = new Date(profile.lastCalibrated!).toLocaleString();
        historyDiv.style.display = 'block';
        historyDiv.textContent = `Last measured: ${date} (${profile.noiseFloor.toFixed(1)} dB)`;
    } else if (historyDiv) {
        historyDiv.style.display = 'none';
    }
}

/**
 * ONE-CLICK MICROPHONE TEST (SPEC_021 - Frictionless UX)
 * Two-step automated test: 30s speech + 15s silence
 */
async function runCompleteMicrophoneTest() {
    const btn = document.getElementById('complete-test-btn') as HTMLButtonElement;
    const instructionsDiv = document.getElementById('test-instructions');
    const resultDiv = document.getElementById('test-result');

    if (!btn || !instructionsDiv || !resultDiv) return;

    // Reset abort flag
    activeTestAborted = false;

    // Disable button
    btn.disabled = true;
    btn.textContent = 'Testing...';

    // Get device
    const deviceSelect = document.getElementById('audio-device') as HTMLSelectElement;
    const deviceId = deviceSelect.value === 'default' ? undefined : deviceSelect.value;
    const deviceLabel = deviceSelect.options[deviceSelect.selectedIndex].text;

    try {
        // Initialize analyzer
        if (audioAnalyzer) {
            audioAnalyzer.stop();
        }
        audioAnalyzer = new AudioAnalyzer();
        await audioAnalyzer.start(deviceId);

        // STEP 1: Speech Quality Test (15 seconds)
        instructionsDiv.style.display = 'block';
        resultDiv.style.display = 'none';

        instructionsDiv.innerHTML = `
            <h4>📢 Step 1: Read This Aloud</h4>
            <p><strong>Please read at your normal speaking volume:</strong></p>
            <div style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 4px; margin: 12px 0; font-size: 14px; line-height: 1.6;">
                Imagine all the people<br>
                Living life in peace<br>
                You may say I'm a dreamer<br>
                But I'm not the only one<br>
                I hope someday you'll join us<br>
                And the world will be as one<br><br>
                Imagine no possessions<br>
                I wonder if you can<br>
                No need for greed or hunger<br>
                A brotherhood of man<br>
                Imagine all the people<br>
                Sharing all the world
            </div>
            <p style="color: #888; font-size: 13px;">⏱️ Recording for 15 seconds...</p>
        `;

        const speechSamples: { rms: number, peak: number }[] = [];
        const speechStartTime = Date.now();
        const speechDuration = 15000;

        while (Date.now() - speechStartTime < speechDuration && !activeTestAborted) {
            if (!audioAnalyzer) break;
            const rms = audioAnalyzer.getRMS();
            const peak = audioAnalyzer.getPeak();
            speechSamples.push({ rms, peak });

            const remaining = Math.ceil((speechDuration - (Date.now() - speechStartTime)) / 1000);
            const timeDisplay = instructionsDiv.querySelector('p:last-child');
            if (timeDisplay) {
                timeDisplay.textContent = `⏱️ Recording for ${remaining} seconds...`;
            }

            await sleep(100);
        }

        if (activeTestAborted) {
            throw new Error('Test aborted');
        }

        // STEP 2: Noise Floor Test (10 seconds) - User triggered
        instructionsDiv.innerHTML = `
            <h4>🤫 Step 2: Background Noise Test</h4>
            <p><strong>Click the button below, then remain completely silent for 10 seconds.</strong></p>
            <button id="start-silence-btn" class="btn btn-primary" style="margin-top: 12px;">Ready - Start Silence Test</button>
        `;

        // Wait for user to click button
        await new Promise<void>((resolve) => {
            const silenceBtn = document.getElementById('start-silence-btn');
            if (silenceBtn) {
                silenceBtn.addEventListener('click', () => resolve(), { once: true });
            }
        });

        instructionsDiv.innerHTML = `
            <h4>🤫 Step 2: Background Noise Test</h4>
            <p><strong>Please remain completely silent...</strong></p>
            <p style="color: #888; font-size: 13px;">⏱️ Measuring silence for 10 seconds...</p>
        `;

        const noiseSamples: number[] = [];
        const noiseStartTime = Date.now();
        const noiseDuration = 10000;

        while (Date.now() - noiseStartTime < noiseDuration && !activeTestAborted) {
            if (!audioAnalyzer) break;
            const rms = audioAnalyzer.getRMS();
            noiseSamples.push(rms);

            const remaining = Math.ceil((noiseDuration - (Date.now() - noiseStartTime)) / 1000);
            const timeDisplay = instructionsDiv.querySelector('p:last-child');
            if (timeDisplay) {
                timeDisplay.textContent = `⏱️ Measuring silence for ${remaining} seconds...`;
            }

            await sleep(100);
        }

        if (activeTestAborted) {
            throw new Error('Test aborted');
        }

        // ANALYZE RESULTS
        const results = analyzeTestResults(speechSamples, noiseSamples, audioAnalyzer);

        // Save noise floor to profile
        if (results.noiseFloorDb !== null) {
            const settings = await window.settingsAPI.getAll();
            const profiles = settings.audioDeviceProfiles || {};
            profiles[deviceSelect.value] = {
                deviceId: deviceSelect.value,
                deviceLabel: deviceLabel,
                noiseFloor: results.noiseFloorDb,
                lastCalibrated: new Date().toISOString()
            };
            await window.settingsAPI.set('audioDeviceProfiles', profiles);
        }

        // Display results
        displayTestResults(results, instructionsDiv, resultDiv);

    } catch (error) {
        console.error('Microphone test failed:', error);
        instructionsDiv.style.display = 'none';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <h4 style="color: #f87171;">❌ Test Failed</h4>
            <p>${error instanceof Error ? error.message : 'Please check your microphone permissions and try again.'}</p>
        `;
    } finally {
        // Cleanup
        if (audioAnalyzer) {
            audioAnalyzer.stop();
            audioAnalyzer = null;
        }
        btn.disabled = false;
        btn.textContent = '🎤 Test My Microphone';
        activeTestAborted = false;
    }
}

/**
 * Analyze test results and generate recommendations
 */
function analyzeTestResults(
    speechSamples: { rms: number, peak: number }[],
    noiseSamples: number[],
    analyzer: AudioAnalyzer
): {
    peakDb: number,
    avgSpeechDb: number,
    noiseFloorDb: number | null,
    clipping: boolean,
    tooQuiet: boolean,
    highNoise: boolean,
    status: 'excellent' | 'good' | 'warning' | 'poor',
    issues: string[],
    recommendations: string[]
} {
    // Calculate speech metrics
    const peaks = speechSamples.map(s => s.peak);
    const rmsValues = speechSamples.map(s => s.rms);

    const maxPeak = Math.max(...peaks);
    const avgRms = rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length;

    const peakDb = analyzer.toDecibels(maxPeak);
    const avgSpeechDb = analyzer.toDecibels(avgRms);

    // Calculate noise floor
    const avgNoise = noiseSamples.reduce((a, b) => a + b, 0) / noiseSamples.length;
    const noiseFloorDb = analyzer.toDecibels(avgNoise);

    // Analyze issues
    const issues: string[] = [];
    const recommendations: string[] = [];

    const clipping = peakDb > -3;
    const tooQuiet = peakDb < -30;
    const highNoise = noiseFloorDb > -40;
    const signalToNoise = avgSpeechDb - noiseFloorDb;

    if (clipping) {
        issues.push('Audio is clipping (distortion detected)');
        recommendations.push('Lower your microphone input volume in Windows Sound settings');
    }

    if (tooQuiet) {
        issues.push('Microphone levels are very low');
        recommendations.push('Increase microphone volume or move closer to the microphone');
    }

    if (highNoise) {
        issues.push('High background noise detected');
        recommendations.push('Reduce ambient noise or use noise cancellation if available');
    }

    if (signalToNoise < 15 && !tooQuiet) {
        issues.push('Poor signal-to-noise ratio');
        recommendations.push('Try moving to a quieter environment');
    }

    // Determine overall status
    let status: 'excellent' | 'good' | 'warning' | 'poor';
    if (issues.length === 0 && peakDb > -12 && peakDb < -6) {
        status = 'excellent';
    } else if (issues.length === 0) {
        status = 'good';
    } else if (clipping || tooQuiet) {
        status = 'poor';
    } else {
        status = 'warning';
    }

    return {
        peakDb,
        avgSpeechDb,
        noiseFloorDb,
        clipping,
        tooQuiet,
        highNoise,
        status,
        issues,
        recommendations
    };
}

/**
 * Display formatted test results
 */
function displayTestResults(
    results: ReturnType<typeof analyzeTestResults>,
    instructionsDiv: HTMLElement,
    resultDiv: HTMLElement
) {
    instructionsDiv.style.display = 'none';
    resultDiv.style.display = 'block';

    let statusEmoji = '';
    let statusText = '';
    let statusColor = '';

    switch (results.status) {
        case 'excellent':
            statusEmoji = '✅';
            statusText = 'Excellent';
            statusColor = '#4ade80';
            break;
        case 'good':
            statusEmoji = '✓';
            statusText = 'Good';
            statusColor = '#6ee7b7';
            break;
        case 'warning':
            statusEmoji = '⚠️';
            statusText = 'Needs Attention';
            statusColor = '#fbbf24';
            break;
        case 'poor':
            statusEmoji = '❌';
            statusText = 'Issues Detected';
            statusColor = '#f87171';
            break;
    }

    let html = `
        <h4 style="color: ${statusColor};">${statusEmoji} ${statusText}</h4>

        <div style="margin: 16px 0; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Peak Level:</span>
                <strong>${isFinite(results.peakDb) ? results.peakDb.toFixed(1) : '--'} dB</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Average Speech:</span>
                <strong>${isFinite(results.avgSpeechDb) ? results.avgSpeechDb.toFixed(1) : '--'} dB</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>Noise Floor:</span>
                <strong>${results.noiseFloorDb !== null && isFinite(results.noiseFloorDb) ? results.noiseFloorDb.toFixed(1) : '--'} dB</strong>
            </div>
        </div>
    `;

    if (results.issues.length > 0) {
        html += `<h5 style="margin-top: 16px; color: #fbbf24;">Issues Found:</h5><ul style="margin: 8px 0; padding-left: 20px;">`;
        results.issues.forEach(issue => {
            html += `<li style="margin: 4px 0;">${issue}</li>`;
        });
        html += `</ul>`;
    }

    if (results.recommendations.length > 0) {
        html += `<h5 style="margin-top: 16px; color: #60a5fa;">Recommendations:</h5><ul style="margin: 8px 0; padding-left: 20px;">`;
        results.recommendations.forEach(rec => {
            html += `<li style="margin: 4px 0;">${rec}</li>`;
        });
        html += `</ul>`;
    }

    if (results.status === 'excellent' || results.status === 'good') {
        html += `<p style="margin-top: 16px; color: #4ade80;">Your microphone is ready for dictation!</p>`;
    }

    resultDiv.innerHTML = html;
}

// Expose to global scope
(window as any).restartOllama = restartOllama;
(window as any).warmupModel = warmupModel;
(window as any).selectMode = selectMode;
(window as any).saveModeDetails = saveModeDetails;
(window as any).resetModeToDefault = resetModeToDefault;
(window as any).initializeModeConfiguration = initializeModeConfiguration;
