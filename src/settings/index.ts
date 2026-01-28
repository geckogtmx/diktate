/**
 * Settings Page - Main Entry Point (ESM)
 * SPEC_032 - Settings Page Refactoring
 */

import { state } from './store.js';
import { loadSettings, setVal, setCheck, switchTab, openExternalLink, saveSetting } from './utils.js';
import { checkOllamaStatus, loadOllamaModels, onDefaultModelChange, saveOllamaSetting, restartOllama, warmupModel, pullOllamaModel, quickPullModel } from './ollama.js';
import { refreshAudioDevices } from './audio.js';
import { updateOAuthUI, initializeOAuthFlow, switchAccount, disconnectAccount, initOAuthListeners } from './oauth.js';
import { recordHotkey, resetHotkey } from './hotkeys.js';
import { saveApiKey, testSavedApiKey, deleteApiKey, loadApiKeyStatuses } from './apiKeys.js';
import { initializeModeConfiguration, selectMode, saveModeDetails, resetModeToDefault } from './modes.js';
import { runHardwareTest, populateSoundDropdowns, previewSpecificSound, showRestartModal, hideRestartModal, relaunchApp } from './ui.js';

// 1. Flat exposure for legacy static HTML
(window as any).switchTab = switchTab;
(window as any).openExternalLink = openExternalLink;
(window as any).saveSetting = saveSetting;

// 2. Namespaced exposure for modular dynamic fragments (SPEC_032)
(window as any).oauth = {
    initializeOAuthFlow,
    switchAccount,
    disconnectAccount,
    updateOAuthUI
};

(window as any).apiKeys = {
    saveApiKey,
    testSavedApiKey,
    deleteApiKey,
    loadApiKeyStatuses
};

(window as any).hotkeys = {
    recordHotkey,
    resetHotkey
};

(window as any).ollama = {
    checkOllamaStatus,
    loadOllamaModels,
    onDefaultModelChange,
    saveOllamaSetting,
    restartOllama,
    warmupModel,
    pullOllamaModel,
    quickPullModel,
    deleteOllamaModel: async (name: string) => {
        const { deleteOllamaModel } = await import('./ollama.js');
        return deleteOllamaModel(name);
    }
};

(window as any).modes = {
    initializeModeConfiguration,
    selectMode,
    saveModeDetails,
    resetModeToDefault
};

(window as any).ui = {
    runHardwareTest,
    populateSoundDropdowns,
    previewSpecificSound,
    showRestartModal,
    hideRestartModal,
    relaunchApp
};

// Aliases for legacy static HTML compatibility
(window as any).initializeOAuthFlow = initializeOAuthFlow;
(window as any).switchOAuthAccount = switchAccount;
(window as any).disconnectOAuthAccount = disconnectAccount;
(window as any).saveApiKey = saveApiKey;
(window as any).testSavedApiKey = testSavedApiKey;
(window as any).deleteApiKey = deleteApiKey;
(window as any).recordHotkey = recordHotkey;
(window as any).resetHotkey = resetHotkey;
(window as any).refreshOllamaStatus = checkOllamaStatus;
(window as any).restartOllama = restartOllama;
(window as any).warmupModel = warmupModel;
(window as any).selectMode = selectMode;
(window as any).saveModeDetails = saveModeDetails;
(window as any).resetModeToDefault = resetModeToDefault;
(window as any).runHardwareTest = runHardwareTest;
(window as any).relaunchApp = relaunchApp;
(window as any).previewSpecificSound = previewSpecificSound;


/**
 * Initialization Sequence
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 dIKtate Modular Settings Initializing...');

    // 1. IMMEDIATE BINDING (Non-blocking, zero-dependency)

    // Sidebar navigation should work instantly
    document.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            if (tabId) switchTab(tabId);
        });
    });

    // Modal controls
    document.getElementById('modal-cancel-btn')?.addEventListener('click', hideRestartModal);
    document.getElementById('modal-restart-btn')?.addEventListener('click', relaunchApp);
    document.getElementById('restart-now-banner-btn')?.addEventListener('click', showRestartModal);

    // External links
    const urls: Record<string, string> = {
        'browse-models-link': 'https://ollama.com/library',
        'gemini-docs-link': 'https://aistudio.google.com/apikey',
        'anthropic-docs-link': 'https://console.anthropic.com/',
        'openai-docs-link': 'https://platform.openai.com/api-keys',
        'website-link': 'https://dikta.me',
        'github-link': 'https://github.com/diktate/diktate'
    };
    Object.keys(urls).forEach(id => {
        document.getElementById(id)?.addEventListener('click', () => openExternalLink(urls[id]));
    });

    // 2. ASYNC INITIALIZATION (Data-dependent)
    try {
        // Fetch settings - this is the only shared dependency
        const settings = await window.settingsAPI.getAll();

        // 1. POPULATE DROPDOWNS FIRST (Crucial for persistence)
        // We do these first so that loadSettings() has valid options to select
        try {
            await refreshAudioDevices(settings.audioDeviceId, settings.audioDeviceLabel);
        } catch (e) { console.error('Audio init failed:', e); }

        try {
            await populateSoundDropdowns();
        } catch (e) { console.error('Sound init failed:', e); }

        try {
            await checkOllamaStatus();
            await loadOllamaModels();
        } catch (e) { console.error('Ollama init failed:', e); }

        // 2. LOAD VALUES INTO POPULATED DROPDOWNS
        loadSettings(settings);

        // 3. Initialize Domain Logic
        try {
            await loadApiKeyStatuses();
        } catch (e) { console.error('API Key status init failed:', e); }

        try {
            await updateOAuthUI();
            initOAuthListeners();
        } catch (e) { console.error('OAuth init failed:', e); }

        try {
            await initializeModeConfiguration();
        } catch (e) { console.error('Modes init failed:', e); }

        // 4. Initialize State base values (for change tracking)
        state.initialModels = {
            'default': settings.defaultOllamaModel || 'gemma3:4b',
            'modeModel_standard': settings.modeModel_standard || '',
            'modeModel_prompt': settings.modeModel_prompt || '',
            'modeModel_professional': settings.modeModel_professional || '',
            'modeModel_raw': settings.modeModel_raw || ''
        };


        // 6. Bind Remaining Interactive Components


        // General
        document.getElementById('processing-mode')?.addEventListener('change', (e) => {
            saveSetting('processingMode', (e.target as HTMLSelectElement).value);
        });
        document.getElementById('default-model')?.addEventListener('change', (e) => {
            onDefaultModelChange((e.target as HTMLSelectElement).value);
        });
        document.getElementById('auto-start')?.addEventListener('change', (e) => {
            saveSetting('autoStart', (e.target as HTMLInputElement).checked);
        });

        // Hotkeys
        const hotkeyConfigs: { id: string, mode: any }[] = [
            { id: 'hotkey-display', mode: 'dictate' },
            { id: 'ask-hotkey-display', mode: 'ask' },
            { id: 'translate-hotkey-display', mode: 'translate' },
            { id: 'refine-hotkey-display', mode: 'refine' },
            { id: 'oops-hotkey-display', mode: 'oops' }
        ];
        hotkeyConfigs.forEach(cfg => {
            document.getElementById(cfg.id)?.addEventListener('click', () => recordHotkey(cfg.mode));
            document.getElementById(`reset-hotkey-${cfg.mode}`)?.addEventListener('click', () => resetHotkey(cfg.mode));
        });

        // Audio
        ['start', 'stop', 'ask'].forEach(s => {
            document.getElementById(`${s}-sound`)?.addEventListener('change', (e) => {
                saveSetting(`${s}Sound`, (e.target as HTMLSelectElement).value);
            });
            document.getElementById(`preview-${s}-sound`)?.addEventListener('click', () => {
                previewSpecificSound(`${s}-sound`);
            });
        });

        document.getElementById('start-monitoring-btn')?.addEventListener('click', () => {
            // Need to import toggleAudioMonitoring
            import('./audio.js').then(m => m.toggleAudioMonitoring());
        });
        document.getElementById('measure-noise-btn')?.addEventListener('click', () => {
            import('./audio.js').then(m => m.measureNoiseFloor());
        });
        document.getElementById('complete-test-btn')?.addEventListener('click', () => {
            import('./audio.js').then(m => m.runCompleteMicrophoneTest());
        });

        document.querySelectorAll('input[name="max-duration"]').forEach((radio) => {
            radio.addEventListener('change', (e) => {
                const value = parseInt((e.target as HTMLInputElement).value, 10);
                saveSetting('maxRecordingDuration', value);
            });
        });

        // Ollama
        document.getElementById('hardware-test-btn')?.addEventListener('click', runHardwareTest);
        document.getElementById('refresh-ollama-btn')?.addEventListener('click', checkOllamaStatus);
        document.getElementById('restart-ollama-btn')?.addEventListener('click', restartOllama);
        document.getElementById('warmup-btn')?.addEventListener('click', warmupModel);
        document.getElementById('pull-model-btn')?.addEventListener('click', () => {
            pullOllamaModel();
        });

        // Modes
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

        // API Keys
        ['gemini', 'anthropic', 'openai'].forEach(p => {
            document.getElementById(`test-${p}-btn`)?.addEventListener('click', () => {
                // Determine if we test new or saved
                const input = document.getElementById(`${p}-api-key`) as HTMLInputElement;
                if (input && input.value) saveApiKey(p);
                else testSavedApiKey(p);
            });
            document.getElementById(`save-${p}-btn`)?.addEventListener('click', () => saveApiKey(p));
            document.getElementById(`test-${p}-saved-btn`)?.addEventListener('click', () => testSavedApiKey(p));
            document.getElementById(`delete-${p}-btn`)?.addEventListener('click', () => deleteApiKey(p));
        });

        console.log('✅ Settings Initialization Complete.');
    } catch (error) {
        console.error('❌ Settings Initialization Failed:', error);
    }
});
