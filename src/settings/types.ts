/**
 * Settings Page Type Definitions
 */

export type AudioLevel = 'silent' | 'low' | 'good' | 'high' | 'clipping';

export interface Settings {
    processingMode: 'local' | 'cloud' | 'google';
    autoStart: boolean;
    audioDeviceId?: string;
    audioDeviceLabel?: string;
    startSound: string;
    stopSound: string;
    askSound: string;
    maxRecordingDuration: number;
    defaultOllamaModel: string;
    defaultMode: string;
    askOutputMode: 'type' | 'clipboard';
    trailingSpaceEnabled: boolean;
    additionalKeyEnabled: boolean;
    additionalKey: string;
    hotkey?: string;
    askHotkey?: string;
    translateHotkey?: string;
    refineHotkey?: string;
    oopsHotkey?: string;
    noteHotkey?: string;
    noteFilePath?: string;
    noteFormat?: 'md' | 'txt';
    noteUseProcessor?: boolean;
    noteDefaultFolder?: string;
    noteFileNameTemplate?: string;
    notePrompt?: string;
    [key: string]: any;
}
