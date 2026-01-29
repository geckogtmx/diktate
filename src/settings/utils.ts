/**
 * Settings Page Utilities
 */

export function setVal(id: string, val: string) {
    const el = document.getElementById(id) as HTMLSelectElement | null;
    if (el) el.value = val;
}

export function setCheck(id: string, val: boolean) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.checked = val;
}

export function saveSetting(key: string, value: any) {
    console.log(`Saving ${key}:`, value);
    window.settingsAPI.set(key, value);
}

/**
 * Loads settings into the DOM
 */
export function loadSettings(settings: any) {
    if (!settings) return;

    // General
    setVal('processing-mode', settings.processingMode || 'local');
    setCheck('auto-start', settings.autoStart || false);

    // Audio - sound selection
    setVal('start-sound', settings.startSound || 'a');
    setVal('stop-sound', settings.stopSound || 'a');
    setVal('ask-sound', settings.askSound || 'c');

    // Audio - max recording duration
    const maxDuration = settings.maxRecordingDuration !== undefined ? settings.maxRecordingDuration : 60;
    const durationRadios = document.querySelectorAll<HTMLInputElement>('input[name="max-duration"]');
    durationRadios.forEach(radio => {
        radio.checked = parseInt(radio.value) === maxDuration;
    });

    // Models
    setVal('default-model', settings.defaultOllamaModel || 'gemma3:4b');

    // Modes
    setVal('default-mode', settings.defaultMode || 'standard');
    setVal('ask-output-mode', settings.askOutputMode || 'type');

    // Trailing Space Configuration (SPEC_006)
    setCheck('trailing-space-toggle', settings.trailingSpaceEnabled !== false); // Default to true

    // Optional Keys Section (SPEC_006)
    setCheck('additional-key-toggle', settings.additionalKeyEnabled || false);
    setVal('additional-key-select', settings.additionalKey || 'none');

    // Hotkeys
    if (settings.hotkey) {
        const d = document.getElementById('hotkey-display');
        if (d) d.textContent = settings.hotkey;
    }
    if (settings.askHotkey) {
        const d = document.getElementById('ask-hotkey-display');
        if (d) d.textContent = settings.askHotkey;
    }
    if (settings.translateHotkey) {
        const d = document.getElementById('translate-hotkey-display');
        if (d) d.textContent = settings.translateHotkey;
    }
    if (settings.refineHotkey) {
        const d = document.getElementById('refine-hotkey-display');
        if (d) d.textContent = settings.refineHotkey;
    }
    if (settings.oopsHotkey) {
        const d = document.getElementById('oops-hotkey-display');
        if (d) d.textContent = settings.oopsHotkey;
    }
    if (settings.noteHotkey) {
        const d = document.getElementById('note-hotkey-display');
        if (d) d.textContent = settings.noteHotkey;
    }

    // Post-It Notes (SPEC_020)
    setVal('note-file-path', settings.noteFilePath || '');
    setCheck('note-use-processor', settings.noteUseProcessor !== false);
    setVal('note-timestamp-format', settings.noteTimestampFormat || '%Y-%m-%d %H:%M:%S');
    setVal('note-default-folder', settings.noteDefaultFolder || '');
    setVal('note-filename-template', settings.noteFileNameTemplate || '');
    setVal('note-prompt', settings.notePrompt || '');
}


/**
 * Tab Switching Logic
 */
export function switchTab(tabId: string) {
    // Buttons - Remove active from all, then add to the matching button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        }
    });

    // Content - Show the corresponding tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabId)?.classList.add('active');
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * External links handler
 */
export function openExternalLink(url: string) {
    window.settingsAPI.openExternal(url);
}
