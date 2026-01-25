/**
 * Settings window renderer script
 * Uses secure settingsAPI bridge (no direct Node access)
 */

// No export needed, loaded as a script in settings.html

// Type declaration for the secure bridge
interface SettingsAPI {
    getAll: () => Promise<any>;
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    saveAudioDevice: (deviceId: string, deviceLabel: string) => Promise<void>;
    openExternal: (url: string) => void;
    // API Key methods
    getApiKeys: () => Promise<Record<string, boolean>>;
    setApiKey: (provider: string, key: string) => Promise<void>;
    testApiKey: (provider: string, key: string) => Promise<{ success: boolean; error?: string }>;
    // Sound methods
    playSound: (soundName: string) => Promise<void>;
    getSoundFiles: () => Promise<string[]>;
    // Custom Prompts
    getCustomPrompts: () => Promise<Record<string, string>>;
    getDefaultPrompts: () => Promise<Record<string, string>>;
    getDefaultPrompt: (mode: string, model: string) => Promise<string>;
    saveCustomPrompt: (mode: string, promptText: string) => Promise<{ success: boolean; error?: string }>;
    resetCustomPrompt: (mode: string) => Promise<{ success: boolean; error?: string }>;
    // Hardware testing
    runHardwareTest: () => Promise<{ gpu: string; vram: string; tier: string; speed: number }>;
    // App Control
    relaunchApp: () => void;
    // Ollama Warmup
    warmupOllamaModel: () => Promise<{ success: boolean; model: string; error?: string }>;
}

interface Window {
    settingsAPI: SettingsAPI;
}

// State
let isRecordingHotkey = false;
let initialModels: Record<string, string> = {};
let hasModelChanges = false;
let availableModels: any[] = [];
let defaultPrompts: Record<string, string> = {};

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
            } catch (error) {
                console.error('Failed to save audio device:', error);
            }
        };

    } catch (err) {
        console.error('Error listing devices:', err);
        select.innerHTML = '<option>Error loading devices</option>';
    }
}

// Tab Switching
function switchTab(tabId: string) {
    // Buttons - find the correct button for this tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        // Check if this button matches the target tab
        if (btn.textContent?.toLowerCase().includes(tabId.toLowerCase().substring(0, 4))) {
            btn.classList.add('active');
        }
    });

    // If called from an event (like clicking), use event target
    if (event?.target) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        (event.target as HTMLElement).classList.add('active');
    }

    // Content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabId)?.classList.add('active');

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

// Expose to global scope
(window as any).restartOllama = restartOllama;
(window as any).warmupModel = warmupModel;
(window as any).selectMode = selectMode;
(window as any).saveModeDetails = saveModeDetails;
(window as any).resetModeToDefault = resetModeToDefault;
(window as any).initializeModeConfiguration = initializeModeConfiguration;
