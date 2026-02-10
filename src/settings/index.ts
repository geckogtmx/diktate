/**
 * Settings Page - Main Entry Point (ESM)
 * SPEC_032 - Settings Page Refactoring
 */

import { state } from './store.js';
import type { UserSettings } from '../types/settings.js';
import { loadSettings, switchTab, openExternalLink, saveSetting } from './utils.js';
import {
  checkOllamaStatus,
  loadOllamaModels,
  onDefaultModelChange,
  saveOllamaSetting,
  restartOllama,
  warmupModel,
  pullOllamaModel,
  quickPullModel,
  initSafeModelLibrary,
} from './ollama.js';
import { refreshAudioDevices } from './audio.js';
import { recordHotkey, resetHotkey } from './hotkeys.js';
import {
  saveApiKey,
  testCurrentApiKey,
  testSavedApiKey,
  deleteApiKey,
  loadApiKeyStatuses,
} from './apiKeys.js';
import { initializeModeConfiguration, selectMode } from './modes.js';
import {
  runHardwareTest,
  populateSoundDropdowns,
  previewSpecificSound,
  showRestartModal,
  hideRestartModal,
  relaunchApp,
} from './ui.js';
import { initializeNotesSettings } from './notes.js';
import { initializePrivacySettings } from './privacy.js';
import { initializeI18n } from './i18n.js';
import { initTrialAccountPanel } from './trialAccount.js';

// Dynamic window property assignment for HTML onclick handlers (SPEC_032)
// These are necessary for HTML-based UI fragments to access functions at runtime
// Inline onclick handlers cannot be typed at compile-time, so `as any` is justified
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).switchTab = switchTab;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).openExternalLink = openExternalLink;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).saveSetting = saveSetting;

// Namespaced exposure for modular dynamic fragments (SPEC_032)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).oauth = {}; // OAuth Module Removed

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).apiKeys = {
  saveApiKey,
  testSavedApiKey,
  deleteApiKey,
  loadApiKeyStatuses,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).hotkeys = {
  recordHotkey,
  resetHotkey,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).modes = {
  initializeModeConfiguration,
  selectMode,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).ui = {
  runHardwareTest,
  populateSoundDropdowns,
  previewSpecificSound,
  showRestartModal,
  hideRestartModal,
  relaunchApp,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).notes = {
  initializeNotesSettings,
};

// Aliases for legacy static HTML compatibility
// (window as any).initializeOAuthFlow = initializeOAuthFlow; // Removed
// (window as any).switchOAuthAccount = switchAccount; // Removed
// (window as any).disconnectOAuthAccount = disconnectAccount; // Removed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).saveApiKey = saveApiKey;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).testSavedApiKey = testSavedApiKey;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).deleteApiKey = deleteApiKey;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).recordHotkey = recordHotkey;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).resetHotkey = resetHotkey;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).refreshOllamaStatus = checkOllamaStatus;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).restartOllama = restartOllama;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).warmupModel = warmupModel;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).selectMode = selectMode;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).runHardwareTest = runHardwareTest;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).relaunchApp = relaunchApp;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).previewSpecificSound = previewSpecificSound;

/**
 * Initialization Sequence
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 dIKtate Modular Settings Initializing...');

  // 0. INITIALIZE I18N (SPEC_028) - Load translations FIRST before UI elements
  try {
    await initializeI18n();
    console.log('[Init] i18n initialized');
  } catch (e) {
    console.error('i18n initialization failed:', e);
  }

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
    'gemini-docs-link': 'https://aistudio.google.com/apikey',
    'anthropic-docs-link': 'https://console.anthropic.com/',
    'openai-docs-link': 'https://platform.openai.com/api-keys',
    'website-link': 'https://dikta.me',
    'github-link': 'https://github.com/diktate/diktate',
    'ollama-help-link': 'https://docs.ollama.com/',
  };
  Object.keys(urls).forEach((id) => {
    document.getElementById(id)?.addEventListener('click', () => openExternalLink(urls[id]));
  });

  // 2. ASYNC INITIALIZATION (Data-dependent)
  let settings: UserSettings | undefined;
  try {
    // Step 1: Initialize stores and static UI
    console.log('[Init] Starting settings initialization...');

    // Step 2: Load settings from Electron store FIRST
    // This is the source of truth for IDs that dynamic loaders need
    settings = await window.settingsAPI.getAll();

    // Step 3: Populate dynamic dropdowns (async)
    const dropdownTask = populateSoundDropdowns().catch((e) => console.error('Sound error:', e));
    const deviceTask = refreshAudioDevices(
      settings?.audioDeviceId,
      settings?.audioDeviceLabel
    ).catch((e) => console.error('Audio error:', e));
    const hardwareTask = runHardwareTest().catch((e) => console.error('Hardware test error:', e));

    // Wait for dynamic UI to be ready
    await Promise.all([dropdownTask, deviceTask, hardwareTask]);
  } catch (e) {
    console.error('Core initialization failed:', e);
  }

  try {
    await checkOllamaStatus();
    await loadOllamaModels();
    await initSafeModelLibrary();
  } catch (e) {
    console.error('Ollama init failed:', e);
  }

  // 2. LOAD VALUES INTO POPULATED DROPDOWNS
  if (settings) {
    loadSettings(settings);

    // 4. Initialize State base values (for change tracking)
    // SPEC_038: Use localModel (global) instead of defaultOllamaModel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settingsAny = settings as any;
    state.initialModels = {
      default: settings.localModel || settings.defaultOllamaModel || '',
      modeModel_standard: settingsAny.modeModel_standard || '',
      modeModel_prompt: settingsAny.modeModel_prompt || '',
      modeModel_professional: settingsAny.modeModel_professional || '',
      modeModel_raw: settingsAny.modeModel_raw || '',
      modeModel_ask: settingsAny.modeModel_ask || '',
      modeModel_refine: settingsAny.modeModel_refine || '',
      modeModel_refine_instruction: settingsAny.modeModel_refine_instruction || '',
    };
  }

  // 3. Initialize Domain Logic
  try {
    await loadApiKeyStatuses();
  } catch (e) {
    console.error('API Key status init failed:', e);
  }

  // OAuth initialization removed (SPEC_016)

  try {
    await initializeModeConfiguration();
    // Bind Mode Selector Click Events
    document.querySelectorAll('.mode-list-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        const mode = (e.currentTarget as HTMLElement).getAttribute('data-mode');
        if (mode) selectMode(mode);
      });
    });
  } catch (e) {
    console.error('Modes init failed:', e);
  }

  try {
    initializeNotesSettings();
  } catch (e) {
    console.error('Notes init failed:', e);
  }

  try {
    initializePrivacySettings();
  } catch (e) {
    console.error('Privacy init failed:', e);
  }

  // SPEC_042: Trial account panel (sidebar bottom)
  try {
    initTrialAccountPanel();
  } catch (e) {
    console.error('Trial panel init failed:', e);
  }

  // 6. Bind Remaining Interactive Components

  // General - Language Save Button
  document.getElementById('save-language-btn')?.addEventListener('click', async () => {
    const select = document.getElementById('language-select') as HTMLSelectElement;
    if (select && select.value) {
      const newLang = select.value;
      const statusDiv = document.getElementById('language-change-status');

      try {
        // Show loading message
        if (statusDiv) {
          statusDiv.textContent = '⏳ Changing language...';
          statusDiv.style.display = 'block';
          statusDiv.style.background = '#1a3a1a';
          statusDiv.style.borderColor = '#22c55e';
          statusDiv.style.color = '#4ade80';
        }

        // Change language
        await window.i18n.changeLanguage(newLang);
        console.log(`✓ Language changed to: ${newLang}`);

        // Show success message
        if (statusDiv) {
          statusDiv.textContent = '✓ Language saved! Restarting app...';
        }

        // Wait 1 second to show the message, then restart
        setTimeout(() => {
          relaunchApp();
        }, 1000);
      } catch (error) {
        console.error('Failed to change language:', error);
        if (statusDiv) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          statusDiv.textContent = `✗ Failed: ${errorMsg}`;
          statusDiv.style.display = 'block';
          statusDiv.style.background = '#3a1a1a';
          statusDiv.style.borderColor = '#c55e22';
          statusDiv.style.color = '#de8080';
        }
      }
    }
  });

  document.getElementById('processing-mode')?.addEventListener('change', (e) => {
    saveSetting('processingMode', (e.target as HTMLSelectElement).value);
  });

  // SPEC_038: Save Model button handler
  document.getElementById('save-model-btn')?.addEventListener('click', async () => {
    const select = document.getElementById('default-model') as HTMLSelectElement;
    if (select && select.value) {
      await onDefaultModelChange(select.value);

      // Show confirmation
      const statusDiv = document.getElementById('model-change-status');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        setTimeout(() => {
          statusDiv.style.display = 'none';
        }, 3000);
      }

      // Trigger warmup to load model and update UI badge
      setTimeout(() => {
        warmupModel();
      }, 500);
    }
  });

  document.getElementById('auto-start')?.addEventListener('change', (e) => {
    saveSetting('autoStart', (e.target as HTMLInputElement).checked);
  });

  // Hotkeys
  const hotkeyConfigs: {
    id: string;
    mode: 'dictate' | 'ask' | 'translate' | 'refine' | 'oops' | 'note';
  }[] = [
    { id: 'hotkey-display', mode: 'dictate' },
    { id: 'ask-hotkey-display', mode: 'ask' },
    { id: 'translate-hotkey-display', mode: 'translate' },
    { id: 'refine-hotkey-display', mode: 'refine' },
    { id: 'oops-hotkey-display', mode: 'oops' },
    { id: 'note-hotkey-display', mode: 'note' },
  ];
  hotkeyConfigs.forEach((cfg) => {
    document.getElementById(cfg.id)?.addEventListener('click', () => recordHotkey(cfg.mode));
    document
      .getElementById(`reset-hotkey-${cfg.mode}`)
      ?.addEventListener('click', () => resetHotkey(cfg.mode));
  });

  // Audio
  ['start', 'stop', 'ask'].forEach((s) => {
    document.getElementById(`${s}-sound`)?.addEventListener('change', (e) => {
      saveSetting(`${s}Sound`, (e.target as HTMLSelectElement).value);
    });
    document.getElementById(`preview-${s}-sound`)?.addEventListener('click', () => {
      previewSpecificSound(`${s}-sound`);
    });
  });

  // SPEC_041: Whisper Model Selection
  document.getElementById('whisper-model-select')?.addEventListener('change', async (e) => {
    const newModel = (e.target as HTMLSelectElement).value;
    await window.settingsAPI.set('whisperModel', newModel);
    console.log(`[SPEC_041] Whisper model changed to: ${newModel} - will sync to backend`);
  });

  document.getElementById('start-monitoring-btn')?.addEventListener('click', () => {
    // Need to import toggleAudioMonitoring
    import('./audio.js').then((m) => m.toggleAudioMonitoring());
  });
  document.getElementById('measure-noise-btn')?.addEventListener('click', () => {
    import('./audio.js').then((m) => m.measureNoiseFloor());
  });
  document.getElementById('complete-test-btn')?.addEventListener('click', () => {
    import('./audio.js').then((m) => m.runCompleteMicrophoneTest());
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

  // Modes - Note: Save/Reset buttons are handled within modes.ts for dual-profile system

  document.getElementById('trailing-space-toggle')?.addEventListener('change', (e) => {
    saveSetting('trailingSpaceEnabled', (e.target as HTMLInputElement).checked);
  });
  document.getElementById('additional-key-toggle')?.addEventListener('change', (e) => {
    saveSetting('additionalKeyEnabled', (e.target as HTMLInputElement).checked);
  });
  document.getElementById('additional-key-select')?.addEventListener('change', (e) => {
    saveSetting('additionalKey', (e.target as HTMLSelectElement).value);
  });

  ['gemini', 'anthropic', 'openai'].forEach((p) => {
    document.getElementById(`test-${p}-btn`)?.addEventListener('click', () => {
      // Determine if we test new or saved
      const input = document.getElementById(`${p}-api-key`) as HTMLInputElement;
      if (input && input.value) testCurrentApiKey(p);
      else testSavedApiKey(p);
    });
    document.getElementById(`save-${p}-btn`)?.addEventListener('click', () => saveApiKey(p));
    document
      .getElementById(`test-${p}-saved-btn`)
      ?.addEventListener('click', () => testSavedApiKey(p));
    document.getElementById(`delete-${p}-btn`)?.addEventListener('click', () => deleteApiKey(p));
  });

  console.log('✅ Settings Initialization Complete.');
});
