/**
 * Settings window renderer script
 * Uses secure settingsAPI bridge (no direct Node access)
 */

export { }; // Make this a module

// Type declaration for the secure bridge
interface SettingsAPI {
    getAll: () => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    saveAudioDevice: (deviceId: string, deviceLabel: string) => void;
    openExternal: (url: string) => void;
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
    // Buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    (event?.target as HTMLElement)?.classList.add('active');

    // Content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabId)?.classList.add('active');
}

// Load Settings into UI
function loadSettings(settings: any) {
    if (!settings) return;

    // General
    setVal('processing-mode', settings.processingMode || 'local');
    setCheck('auto-start', settings.autoStart || false);

    // Audio
    setCheck('sound-feedback', settings.soundFeedback !== false); // Default true

    // Modes
    setVal('default-mode', settings.defaultMode || 'standard');
    setVal('trans-mode', settings.transMode || 'none');

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

// Expose functions to global scope for onclick handlers
(window as any).switchTab = switchTab;
(window as any).saveSetting = saveSetting;
(window as any).recordHotkey = recordHotkey;
(window as any).resetHotkey = resetHotkey;
(window as any).openExternalLink = openExternalLink;
