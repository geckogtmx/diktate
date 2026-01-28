/**
 * Settings Page - Main Entry Point (ESM)
 * SPEC_032 - Settings Page Refactoring
 */

import { state } from './store';
import { loadSettings, setVal, setCheck, switchTab, openExternalLink } from './utils';
import { checkOllamaStatus, loadOllamaModels, onDefaultModelChange, saveOllamaSetting, restartOllama, warmupModel, pullOllamaModel, quickPullModel } from './ollama';
import { refreshAudioDevices } from './audio';
import { updateOAuthUI, initializeOAuthFlow, switchAccount, disconnectAccount, initOAuthListeners } from './oauth';
import { recordHotkey, resetHotkey } from './hotkeys';
import { saveApiKey, testSavedApiKey, deleteApiKey, loadApiKeyStatuses } from './apiKeys';
import { initializeModeConfiguration, selectMode, saveModeDetails, resetModeToDefault } from './modes';
import { runHardwareTest, populateSoundDropdowns, previewSpecificSound, showRestartModal, hideRestartModal, relaunchApp } from './ui';

/**
 * Expose functions to global scope for HTML onclick handlers
 * This ensures zero regression with the existing HTML structure.
 */
(window as any).switchTab = switchTab;
(window as any).openExternalLink = openExternalLink;
(window as any).saveSetting = (key: string, val: any) => window.settingsAPI.set(key, val);

// OAuth
(window as any).initializeOAuthFlow = initializeOAuthFlow;
(window as any).switchOAuthAccount = switchAccount;
(window as any).disconnectOAuthAccount = disconnectAccount;

// API Keys
(window as any).saveApiKey = saveApiKey;
(window as any).testApiKey = (provider: string) => {
    // Determine if we are testing a new input or a saved one
    const input = document.getElementById(`${provider}-api-key`) as HTMLInputElement;
    if (input && input.value) {
        // This is handled in apiKeys.ts but let's ensure the HTML call works
        saveApiKey(provider);
    } else {
        testSavedApiKey(provider);
    }
};
(window as any).testSavedApiKey = testSavedApiKey;
(window as any).deleteApiKey = deleteApiKey;

// Hotkeys
(window as any).recordHotkey = recordHotkey;
(window as any).resetHotkey = resetHotkey;

// Ollama
(window as any).refreshOllamaStatus = checkOllamaStatus;
(window as any).restartOllama = restartOllama;
(window as any).warmupModel = warmupModel;
(window as any).onDefaultModelChange = onDefaultModelChange;
(window as any).saveOllamaSetting = saveOllamaSetting;

// Modes
(window as any).selectMode = selectMode;
(window as any).saveModeDetails = saveModeDetails;
(window as any).resetModeToDefault = resetModeToDefault;

// UI & Hardware
(window as any).runHardwareTest = runHardwareTest;
(window as any).showRestartModal = showRestartModal;
(window as any).hideRestartModal = hideRestartModal;
(window as any).relaunchApp = relaunchApp;
(window as any).previewSpecificSound = previewSpecificSound;

/**
 * Initialization Sequence
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 dIKtate Modular Settings Initializing...');

    // Define saveSetting locally for use within this block
    const saveSetting = (key: string, val: any) => window.settingsAPI.set(key, val);

    try {
        // 1. Fetch all settings from Electron
        const settings = await window.settingsAPI.getAll();

        // 2. Initialize State
        state.initialModels = {
            'default': settings.defaultOllamaModel || 'gemma3:4b',
            'modeModel_standard': settings.modeModel_standard || '',
            'modeModel_prompt': settings.modeModel_prompt || '',
            'modeModel_professional': settings.modeModel_professional || '',
            'modeModel_raw': settings.modeModel_raw || ''
        };

        // 3. Populate UI
        loadSettings(settings); // from utils.ts
        await refreshAudioDevices(settings.audioDeviceId, settings.audioDeviceLabel);
        await populateSoundDropdowns();
        await loadApiKeyStatuses();

        // 4. Initialize Engines
        await checkOllamaStatus();
        await loadOllamaModels();
        await updateOAuthUI();
        initOAuthListeners();

        // 5. Initialize Mode View
        await initializeModeConfiguration();

        // 6. Bind UI Event Listeners (Zero Regression)

        // Sidebar
        document.querySelectorAll('.tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const tabName = btn.getAttribute('data-tab');
                if (tabName) switchTab(tabName);
            });
        });

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
            import('./audio').then(m => m.toggleAudioMonitoring());
        });
        document.getElementById('measure-noise-btn')?.addEventListener('click', () => {
            import('./audio').then(m => m.measureNoiseFloor());
        });
        document.getElementById('complete-test-btn')?.addEventListener('click', () => {
            import('./audio').then(m => m.runCompleteMicrophoneTest());
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

        // Links
        const linkIds = ['browse-models-link', 'gemini-docs-link', 'anthropic-docs-link', 'openai-docs-link', 'website-link', 'github-link'];
        const urls: Record<string, string> = {
            'browse-models-link': 'https://ollama.com/library',
            'gemini-docs-link': 'https://aistudio.google.com/apikey',
            'anthropic-docs-link': 'https://console.anthropic.com/',
            'openai-docs-link': 'https://platform.openai.com/api-keys',
            'website-link': 'https://dikta.me',
            'github-link': 'https://github.com/diktate/diktate'
        };
        linkIds.forEach(id => {
            document.getElementById(id)?.addEventListener('click', () => openExternalLink(urls[id]));
        });

        // Modals
        document.getElementById('restart-now-banner-btn')?.addEventListener('click', showRestartModal);
        document.getElementById('modal-cancel-btn')?.addEventListener('click', hideRestartModal);
        document.getElementById('modal-restart-btn')?.addEventListener('click', relaunchApp);

        console.log('✅ Settings Initialization Complete.');
    } catch (error) {
        console.error('❌ Settings Initialization Failed:', error);
    }
});
