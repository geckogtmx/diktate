const { ipcRenderer } = require('electron');

// State
let isRecordingHotkey = false;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Settings window loaded');
    try {
        const settings = await ipcRenderer.invoke('settings:get-all');
        loadSettings(settings);
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
});

// Tab Switching
function switchTab(tabId) {
    // Buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
}

// Load Settings into UI
function loadSettings(settings) {
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
        document.getElementById('hotkey-display').textContent = settings.hotkey;
    }
}

// Helpers
function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function setCheck(id, val) {
    const el = document.getElementById(id);
    if (el) el.checked = val;
}

// Save Setting
function saveSetting(key, value) {
    console.log(`Saving ${key}:`, value);
    ipcRenderer.invoke('settings:set', key, value);
}

// Hotkey Recording
function recordHotkey() {
    const display = document.getElementById('hotkey-display');
    if (isRecordingHotkey) return;

    isRecordingHotkey = true;
    display.textContent = 'Press new hotkey...';
    display.classList.add('recording');

    // Global keydown listener
    const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Ignore modifier-only presses
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

        const modifiers = [];
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
        saveSetting('hotkey', shortcut.replace(/\+/g, '+')); // Format for Electron

        // Remove listener
        document.removeEventListener('keydown', handler);
    };

    document.addEventListener('keydown', handler);
}

function resetHotkey() {
    const defaultHotkey = 'Ctrl+Alt+D';
    document.getElementById('hotkey-display').textContent = defaultHotkey;
    saveSetting('hotkey', defaultHotkey);
}
