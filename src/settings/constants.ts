/**
 * Settings Page Constants
 */

export const STATUS_UPDATE_INTERVAL = 100; // Update text max 10 times/sec

export const DEFAULT_SETTINGS: Record<string, any> = {
    processingMode: 'local',
    autoStart: false,
    startSound: 'a',
    stopSound: 'a',
    askSound: 'c',
    maxRecordingDuration: 60,
    defaultOllamaModel: 'gemma3:4b',
    defaultMode: 'standard',
    askOutputMode: 'type',
    trailingSpaceEnabled: true,
    additionalKeyEnabled: false,
    additionalKey: 'none'
};

export const HOTKEY_DEFAULTS = {
    dictate: 'Ctrl+Alt+D',
    ask: 'Ctrl+Alt+A',
    translate: 'Ctrl+Alt+T',
    refine: 'Ctrl+Alt+R',
    oops: 'Ctrl+Alt+V'
};
