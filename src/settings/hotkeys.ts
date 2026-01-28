/**
 * Hotkey Management
 */

import { state } from './store';
import { saveSetting } from './utils';
import { HOTKEY_DEFAULTS } from './constants';

type HotkeyMode = 'dictate' | 'ask' | 'translate' | 'refine' | 'oops';

/**
 * Records a new hotkey by listening to user input
 */
export function recordHotkey(mode: HotkeyMode = 'dictate') {
    const configMap = {
        dictate: { displayId: 'hotkey-display', settingKey: 'hotkey', label: 'Dictate' },
        ask: { displayId: 'ask-hotkey-display', settingKey: 'askHotkey', label: 'Ask Mode' },
        translate: { displayId: 'translate-hotkey-display', settingKey: 'translateHotkey', label: 'Translate' },
        refine: { displayId: 'refine-hotkey-display', settingKey: 'refineHotkey', label: 'Refine' },
        oops: { displayId: 'oops-hotkey-display', settingKey: 'oopsHotkey', label: 'Oops' }
    };

    const { displayId, settingKey } = configMap[mode];
    const display = document.getElementById(displayId);
    if (state.isRecordingHotkey || !display) return;

    state.isRecordingHotkey = true;
    const originalText = display.textContent;
    display.textContent = 'Press new hotkey...';
    display.classList.add('recording');

    const handler = (e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

        const modifiers: string[] = [];
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.altKey) modifiers.push('Alt');
        if (e.shiftKey) modifiers.push('Shift');

        const key = e.key.toUpperCase();
        const shortcut = [...modifiers, key].join('+');

        const conflicts = [
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
                state.isRecordingHotkey = false;
                document.removeEventListener('keydown', handler);
                return;
            }
        }

        display.textContent = shortcut;
        display.classList.remove('recording');
        state.isRecordingHotkey = false;
        saveSetting(settingKey, shortcut);
        document.removeEventListener('keydown', handler);
    };

    document.addEventListener('keydown', handler);
}

/**
 * Resets a hotkey to its default value
 */
export function resetHotkey(mode: HotkeyMode = 'dictate') {
    const configMap = {
        dictate: { displayId: 'hotkey-display', settingKey: 'hotkey' },
        ask: { displayId: 'ask-hotkey-display', settingKey: 'askHotkey' },
        translate: { displayId: 'translate-hotkey-display', settingKey: 'translateHotkey' },
        refine: { displayId: 'refine-hotkey-display', settingKey: 'refineHotkey' },
        oops: { displayId: 'oops-hotkey-display', settingKey: 'oopsHotkey' }
    };

    const { displayId, settingKey } = configMap[mode];
    const defaultHotkey = (HOTKEY_DEFAULTS as any)[mode];

    const display = document.getElementById(displayId);
    if (display) display.textContent = defaultHotkey;
    saveSetting(settingKey, defaultHotkey);
}
