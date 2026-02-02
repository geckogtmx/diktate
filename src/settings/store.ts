/**
 * Settings Page Store
 * Centralized state management to replace global variables
 */

import type { AudioAnalyzer } from './audio.js';

export interface SettingsState {
    isRecordingHotkey: boolean;
    initialModels: Record<string, string>;
    hasModelChanges: boolean;
    availableModels: any[];
    defaultPrompts: Record<string, string>;

    // Audio Monitoring State (SPEC_021)
    audioAnalyzer: AudioAnalyzer | null;
    animationFrameId: number | null;
    isMonitoring: boolean;
    peakHoldValue: number;
    peakHoldDecay: number;
    lastStatusUpdate: number;

    // Active test tracking
    activeTestInterval: ReturnType<typeof setInterval> | null;
    activeTestAborted: boolean;
    currentSelectedMode: string;

    // Mode detail HTML backup (for Raw mode restore)
    originalModeDetailHTML: string | null;

    // Visual Smoothing
    currentMeterDb: number;
    statusBuffer: number[];
}

export const state: SettingsState = {
    isRecordingHotkey: false,
    initialModels: {},
    hasModelChanges: false,
    availableModels: [],
    defaultPrompts: {},

    audioAnalyzer: null,
    animationFrameId: null,
    isMonitoring: false,
    peakHoldValue: 0,
    peakHoldDecay: 0,
    lastStatusUpdate: 0,

    activeTestInterval: null,
    activeTestAborted: false,
    currentSelectedMode: 'standard',

    // Mode detail HTML backup (for Raw mode restore)
    originalModeDetailHTML: null,

    // Visual Smoothing
    currentMeterDb: -60,
    statusBuffer: []
};
