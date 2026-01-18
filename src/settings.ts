/**
 * Settings window renderer script
 * Uses secure settingsAPI bridge (no direct Node access)
 */

export { }; // Make this a module

// Type declaration for the secure bridge
interface SettingsAPI {
    getAll: () => Promise<any>;
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    saveAudioDevice: (deviceId: string, deviceLabel: string) => void;
    openExternal: (url: string) => void;
    // API Key methods
    getApiKeys: () => Promise<Record<string, boolean>>;
    setApiKey: (provider: string, key: string) => Promise<void>;
    testApiKey: (provider: string, key: string) => Promise<{ success: boolean; error?: string }>;
    // Sound methods
    playSound: (soundName: string) => Promise<void>;
    // Hardware testing
    runHardwareTest: () => Promise<{ gpu: string; vram: string; tier: string; speed: number }>;
}

declare global {
    interface Window {
        settingsAPI: SettingsAPI;
    }
}

// State
let isRecordingHotkey = false;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Settings window loaded');
    try {
        const settings = await window.settingsAPI.getAll();
        loadSettings(settings);
        // Refresh devices initially
        await refreshAudioDevices(settings.audioDeviceId);
        // Load Ollama models
        await loadOllamaModels();
        // Check Ollama status
        await checkOllamaStatus();
        // Populate per-mode model dropdowns
        await populateModeModelDropdowns();
        // Load API key statuses
        await loadApiKeyStatuses();
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
});

// Audio Device Handling
async function refreshAudioDevices(selectedId: string | undefined) {
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
        }

        // Handle change
        select.onchange = () => {
            window.settingsAPI.saveAudioDevice(select.value, select.options[select.selectedIndex].text);
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

    // If switching to models tab, refresh the list
    if (tabId === 'models') {
        loadOllamaModels();
    }
}

// Load Settings into UI
function loadSettings(settings: any) {
    if (!settings) return;

    // General
    setVal('processing-mode', settings.processingMode || 'local');
    setCheck('auto-start', settings.autoStart || false);

    // Audio - new feedback sound selector
    setVal('feedback-sound', settings.feedbackSound || 'click');

    // Models
    setVal('default-model', settings.defaultOllamaModel || 'gemma3:4b');
    updateModeModelDisplay(settings.defaultOllamaModel || 'gemma3:4b');

    // Modes
    setVal('default-mode', settings.defaultMode || 'standard');
    setVal('trans-mode', settings.transMode || 'none');
    setVal('ask-output-mode', settings.askOutputMode || 'type');

    // Hotkey
    if (settings.hotkey) {
        const hotkeyDisplay = document.getElementById('hotkey-display');
        if (hotkeyDisplay) hotkeyDisplay.textContent = settings.hotkey;
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
function recordHotkey() {
    const display = document.getElementById('hotkey-display');
    if (isRecordingHotkey || !display) return;

    isRecordingHotkey = true;
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

        // Update UI
        display.textContent = shortcut;
        display.classList.remove('recording');
        isRecordingHotkey = false;

        // Save
        saveSetting('hotkey', shortcut);

        // Remove listener
        document.removeEventListener('keydown', handler);
    };

    document.addEventListener('keydown', handler);
}

function resetHotkey() {
    const defaultHotkey = 'Ctrl+Alt+D';
    const display = document.getElementById('hotkey-display');
    if (display) display.textContent = defaultHotkey;
    saveSetting('hotkey', defaultHotkey);
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
            alert(`❌ ${provider} API key test failed: ${result.error}`);
        }
    } catch (e) {
        alert(`❌ Test failed: ${e}`);
    }
}

// Expose functions to global scope for onclick handlers
(window as any).switchTab = switchTab;
(window as any).saveSetting = saveSetting;
(window as any).recordHotkey = recordHotkey;
(window as any).resetHotkey = resetHotkey;
(window as any).openExternalLink = openExternalLink;
(window as any).saveApiKeys = saveApiKeys;
(window as any).testApiKey = testApiKey;
(window as any).previewSound = previewSound;
(window as any).runHardwareTest = runHardwareTest;
(window as any).launchOllamaUI = launchOllamaUI;
(window as any).refreshOllamaModels = refreshOllamaModels;
// Per-mode model functions
(window as any).saveModeModel = saveModeModel;
(window as any).onDefaultModelChange = onDefaultModelChange;
// API Key management functions
(window as any).saveApiKey = saveApiKey;
(window as any).testSavedApiKey = testSavedApiKey;
(window as any).deleteApiKey = deleteApiKey;

// ============================================
// Sound Preview Functions
// ============================================

function previewSound() {
    const select = document.getElementById('feedback-sound') as HTMLSelectElement;
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
    const list = document.getElementById('models-list');

    if (!select || !list) return;

    try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (!response.ok) {
            throw new Error('Ollama not available');
        }

        const data = await response.json();
        const models = data.models || [];

        // Clear and populate select
        select.innerHTML = '';
        list.innerHTML = '';

        if (models.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.text = 'No models installed';
            select.appendChild(option);

            list.innerHTML = '<div style="color: #888;">No models found. Use <code>ollama pull gemma3:4b</code> to install one.</div>';
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

            // Add to list with color coding
            const card = document.createElement('div');
            card.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #333;';

            let statusBadge = '';
            let nameColor = '#fff';

            if (modelSizeClass === 'too-large') {
                statusBadge = '<span style="background: #dc2626; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.7em; margin-left: 8px;">⚠️ TOO LARGE</span>';
                nameColor = '#f87171';
            } else if (modelSizeClass === 'borderline') {
                statusBadge = '<span style="background: #d97706; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.7em; margin-left: 8px;">HEAVY</span>';
                nameColor = '#fbbf24';
            } else {
                statusBadge = '<span style="background: #16a34a; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.7em; margin-left: 8px;">✓ OK</span>';
                nameColor = '#4ade80';
            }

            card.innerHTML = `
                <span style="color: ${nameColor};">${model.name}${statusBadge}</span>
                <span style="color: #888;">${formatBytes(model.size)}</span>
            `;
            list.appendChild(card);
        });

        // Add warning if any models are too large
        const hasLargeModels = models.some((m: any) => {
            const sizeGB = m.size / (1024 * 1024 * 1024);
            return getModelSizeClass(m.name, sizeGB, maxRecommendedGB) === 'too-large';
        });

        if (hasLargeModels) {
            const warning = document.createElement('div');
            warning.style.cssText = 'background: #7f1d1d; border: 1px solid #dc2626; padding: 10px; border-radius: 6px; margin-top: 12px; font-size: 0.85em;';
            warning.innerHTML = `
                <strong style="color: #fca5a5;">⚠️ Large Model Warning</strong>
                <p style="color: #fca5a5; margin: 4px 0 0;">Models marked "TOO LARGE" may cause slow performance or crashes on your hardware. Consider using 4B or smaller models.</p>
            `;
            list.appendChild(warning);
        }

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
        list.innerHTML = '<div style="color: #f87171;">Could not connect to Ollama. Make sure it\'s running.</div>';
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
    const btn = document.querySelector('[onclick="runHardwareTest()"]') as HTMLButtonElement;
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

    // Show status message
    const statusEl = document.getElementById('model-change-status');
    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.textContent = `✓ Model changed to ${model}! Will be used for next dictation.`;

        // Auto-hide after 5 seconds
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 5000);
    }

    console.log(`Default model changed to: ${model}`);
}

function saveModeModel(mode: string, model: string) {
    const key = `modeModel_${mode}` as any;
    window.settingsAPI.set(key, model);
    console.log(`Saved model for ${mode} mode: ${model || 'default'}`);
}

async function populateModeModelDropdowns() {
    const modes = ['standard', 'prompt', 'professional'];

    try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (!response.ok) return;

        const data = await response.json();
        const models = data.models || [];

        for (const mode of modes) {
            const select = document.getElementById(`model-${mode}`) as HTMLSelectElement;
            if (!select) continue;

            // Clear and add default option
            select.innerHTML = '<option value="">Use default model</option>';

            // Add all models
            models.forEach((model: any) => {
                const option = document.createElement('option');
                option.value = model.name;
                option.text = `${model.name} (${formatBytes(model.size)})`;
                select.appendChild(option);
            });

            // Restore saved value
            const settings = await window.settingsAPI.getAll();
            const savedModel = settings[`modeModel_${mode}`];
            if (savedModel) {
                select.value = savedModel;
            }
        }
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
        alert(`❌ Failed to save ${provider} API key`);
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
