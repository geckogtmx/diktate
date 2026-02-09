/**
 * Core IPC Handlers
 * Extracted from main.ts as part of GAP 5 (main.ts Monolith Decomposition)
 *
 * Registers settings, recording, prompt, sound, and system IPC handlers
 */

import { ipcMain, BrowserWindow, shell, dialog, app, NativeImage } from 'electron';
import child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import Store from 'electron-store';
import { UserSettings, DEFAULT_PROMPTS } from '../types/settings';
import { PythonManager } from '../services/pythonManager';
import { logger } from '../utils/logger';
import { validateIpcMessage, SettingsSetSchema, redactSensitive } from '../utils/ipcSchemas';
import { showNotification, playSound } from '../services/notificationService';
import { RecordingManager } from '../services/recordingManager';

import type { I18nService } from '../services/i18n';

export interface CoreIpcHandlerDependencies {
  store: Store<UserSettings>;
  getPythonManager: () => PythonManager | null;
  getDebugWindow: () => BrowserWindow | null;
  getIcon: (state: string) => NativeImage;
  recordingManager: RecordingManager;
  syncPythonConfig: () => Promise<void>;
  reregisterHotkeys: () => void;
  getI18n: () => I18nService;
}

export function registerCoreIpcHandlers(deps: CoreIpcHandlerDependencies): void {
  const { store, recordingManager } = deps;

  // Debug logging from preload (settings window)
  ipcMain.on('log', (_event, level: string, message: string) => {
    if (level === 'DEBUG') {
      logger.debug('PRELOAD', message);
    } else if (level === 'WARN') {
      logger.warn('PRELOAD', message);
    } else if (level === 'ERROR') {
      logger.error('PRELOAD', message);
    } else {
      logger.info('PRELOAD', message);
    }
  });

  // Open external URLs (delegated from preload for security)
  ipcMain.on('open-external', (_event, url: string) => {
    logger.info('PRELOAD', `Opening external URL: ${url}`);
    shell.openExternal(url);
  });

  // Handle get-initial-state
  ipcMain.handle('get-initial-state', async () => {
    const currentMode = store.get('defaultMode') || 'standard';
    const pythonManager = deps.getPythonManager();

    const models = { transcriber: 'Unknown', processor: 'Unknown' };
    if (pythonManager && pythonManager.isProcessRunning()) {
      try {
        const result = await pythonManager.sendCommand('status');

        if (
          result &&
          typeof result === 'object' &&
          'success' in result &&
          'data' in result &&
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (result as any).success &&
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (result as any).data
        ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((result as any).data.transcriber)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            models.transcriber = (result as any).data.transcriber;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((result as any).data.processor) models.processor = (result as any).data.processor;
        }
      } catch (e) {
        logger.warn('MAIN', 'Failed to fetch python status for initial state', {
          error: String(e),
        });
      }
    }

    const actualProcessingMode = store.get('processingMode', 'local');

    // Determine auth type: LOC (local/ollama), API (API key)
    let authType = 'LOC';
    if (actualProcessingMode === 'cloud' || actualProcessingMode === 'gemini') {
      const apiKeys = store.get('encryptedGeminiApiKey');
      if (apiKeys) authType = 'API';
    }

    return {
      status: pythonManager?.getStatus() || 'disconnected',
      isRecording: recordingManager.getState().isRecording,
      mode: currentMode,
      defaultMode: currentMode,
      models,
      soundFeedback: store.get('soundFeedback', true),
      processingMode: actualProcessingMode,
      recordingMode: recordingManager.getState().recordingMode,
      refineMode: store.get('refineMode', 'autopilot'),
      authType: authType,
      additionalKeyEnabled: store.get('additionalKeyEnabled', false),
      additionalKey: store.get('additionalKey', 'none'),
      trailingSpaceEnabled: store.get('trailingSpaceEnabled', true),
    };
  });

  // Post-It Notes: Select note file (SPEC_020)
  ipcMain.handle('settings:select-note-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Note File',
      filters: [
        { name: 'Markdown Files', extensions: ['md'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile', 'promptToCreate'],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('python:start-recording', async () => {
    if (!recordingManager.getState().isRecording) await recordingManager.toggleRecording();
    return { success: true };
  });

  ipcMain.handle('python:stop-recording', async () => {
    if (recordingManager.getState().isRecording) await recordingManager.toggleRecording();
    return { success: true };
  });

  ipcMain.handle('python:toggle-recording', async () => {
    await recordingManager.toggleRecording();
    return { success: true };
  });

  ipcMain.handle('python:status', async () => {
    const pythonManager = deps.getPythonManager();
    if (!pythonManager) return { status: 'disconnected' };
    return { status: pythonManager.getStatus() };
  });

  // Settings IPC
  ipcMain.handle('settings:get-all', () => {
    return store.store;
  });

  ipcMain.handle(
    'settings:set',
    async (_event, key: keyof UserSettings, value: UserSettings[keyof UserSettings]) => {
      // Validate payload
      const validation = validateIpcMessage(SettingsSetSchema, { key, value });
      if (!validation.success) {
        logger.error('IPC', `Invalid settings payload: ${redactSensitive(validation.error, 100)}`);
        throw new Error(`Invalid payload: ${validation.error}`);
      }

      // Log update (redact long values like prompts)
      const logValue =
        typeof value === 'string' && value.length > 50 ? redactSensitive(value, 50) : value;
      logger.info('IPC', `Setting update: ${key} = ${logValue}`);
      store.set(key, value);

      // If hotkey changed, re-register
      if (['hotkey', 'askHotkey', 'translateHotkey', 'refineHotkey', 'oopsHotkey'].includes(key)) {
        deps.reregisterHotkeys();
      }

      // Trigger sync for core processing modes and model changes
      const syncKeys = [
        'defaultMode',
        'processingMode',
        'transMode',
        'trailingSpaceEnabled',
        'additionalKeyEnabled',
        'additionalKey',
        'noteFilePath',
        'noteFormat',
        'noteUseProcessor',
        'noteTimestampFormat',
        'notePrompt',
        'privacyLoggingIntensity',
        'privacyPiiScrubber',
        'whisperModel',
        'localModel',
        'localModel_standard',
        'localModel_prompt',
        'localModel_professional',
        'localModel_ask',
        'localModel_refine',
        'localModel_refine_instruction',
        'localModel_raw',
        'localModel_note',
        'localPrompt_standard',
        'localPrompt_prompt',
        'localPrompt_professional',
        'localPrompt_ask',
        'localPrompt_refine',
        'localPrompt_refine_instruction',
        'localPrompt_raw',
        'localPrompt_note',
        'cloudProvider_standard',
        'cloudProvider_prompt',
        'cloudProvider_professional',
        'cloudProvider_ask',
        'cloudProvider_refine',
        'cloudProvider_refine_instruction',
        'cloudProvider_raw',
        'cloudProvider_note',
        'cloudModel_standard',
        'cloudModel_prompt',
        'cloudModel_professional',
        'cloudModel_ask',
        'cloudModel_refine',
        'cloudModel_refine_instruction',
        'cloudModel_raw',
        'cloudModel_note',
        'cloudPrompt_standard',
        'cloudPrompt_prompt',
        'cloudPrompt_professional',
        'cloudPrompt_ask',
        'cloudPrompt_refine',
        'cloudPrompt_refine_instruction',
        'cloudPrompt_raw',
        'cloudPrompt_note',
      ];

      if (syncKeys.includes(key as string)) {
        await deps.syncPythonConfig().catch((err) => {
          logger.error('IPC', 'Post-setting sync failed', { error: String(err) });
        });
      }

      // Update auth type badge if processingMode changed
      if (key === 'processingMode') {
        const actualProcessingMode = store.get('processingMode', 'local');
        let authType = 'LOC';
        if (actualProcessingMode === 'cloud' || actualProcessingMode === 'gemini') {
          const apiKeys = store.get('encryptedGeminiApiKey');
          if (apiKeys) authType = 'API';
        }
        const dw = deps.getDebugWindow();
        if (dw && !dw.isDestroyed()) {
          dw.webContents.send('badge-update', { authType });
        }
      }

      // If auto-start setting changed
      if (key === 'autoStart' && typeof value === 'boolean') {
        try {
          app.setLoginItemSettings({
            openAtLogin: value,
            openAsHidden: false,
          });
          logger.info('IPC', `Auto-start ${value ? 'enabled' : 'disabled'}`);
        } catch (err) {
          logger.error('IPC', 'Failed to set auto-start', { error: String(err) });
        }
      }

      // Broadcast generic setting change to dashboard (SPEC_032 UI Sync)
      const dw = deps.getDebugWindow();
      if (dw && !dw.isDestroyed()) {
        dw.webContents.send('setting-changed', { key, value });
      }

      return { success: true };
    }
  );

  // App Relaunch handler
  ipcMain.handle('app:relaunch', () => {
    logger.info('MAIN', 'Application relaunch requested');
    app.relaunch();
    app.exit(0);
  });

  // Backend Command Invocation (SPEC_030)
  ipcMain.handle('settings:invoke-backend', async (_event, command: string, args: unknown) => {
    const pythonManager = deps.getPythonManager();
    if (!pythonManager) {
      logger.error('MAIN', `Cannot invoke ${command}: Python backend not ready`);
      return { success: false, error: 'Backend not ready' };
    }

    try {
      logger.info(
        'MAIN',
        `Invoking backend command: ${command}`,
        typeof args === 'object' && args ? { ...args } : { args }
      );
      const result = await pythonManager.sendCommand(command, args);
      return result;
    } catch (err) {
      logger.error('MAIN', `Backend command ${command} failed`, { error: String(err) });
      return { success: false, error: String(err) };
    }
  });

  // Settings get single value
  ipcMain.handle('settings:get', (_event, key: string) => {
    return store.get(key);
  });

  // ============================================
  // Custom Prompts IPC Handlers
  // ============================================

  // Get all custom prompts
  ipcMain.handle('settings:get-custom-prompts', async () => {
    return store.get('customPrompts', {
      standard: '',
      prompt: '',
      professional: '',
      raw: '',
      ask: '',
      refine: '',
      refine_instruction: '',
    });
  });

  // Get all default prompts (plural for backward compatibility/global load)
  ipcMain.handle('settings:get-default-prompts', async () => {
    return DEFAULT_PROMPTS;
  });

  // Get specific default prompt based on mode and model
  ipcMain.handle('settings:get-default-prompt', async (_event, mode: string, model: string) => {
    const modeLower = mode.toLowerCase();

    // 1. Check for model-specific override first
    if (
      model &&
      DEFAULT_PROMPTS.modelOverrides[model as keyof typeof DEFAULT_PROMPTS.modelOverrides]
    ) {
      const overrides =
        DEFAULT_PROMPTS.modelOverrides[model as keyof typeof DEFAULT_PROMPTS.modelOverrides];
      if (overrides[modeLower as keyof typeof overrides]) {
        return overrides[modeLower as keyof typeof overrides];
      }
    }

    // 2. Fall back to base mode prompt
    return DEFAULT_PROMPTS[modeLower as keyof typeof DEFAULT_PROMPTS] || DEFAULT_PROMPTS.standard;
  });

  // Save custom prompt for a specific mode
  ipcMain.handle(
    'settings:save-custom-prompt',
    async (_event, mode: string, promptText: string) => {
      try {
        // Validate mode
        const validModes = [
          'standard',
          'prompt',
          'professional',
          'raw',
          'ask',
          'refine',
          'refine_instruction',
        ];
        if (!validModes.includes(mode)) {
          return { success: false, error: `Invalid mode: ${mode}` };
        }

        // Validate prompt length
        if (promptText && promptText.length > 2000) {
          return { success: false, error: 'Prompt too long (max 2000 characters)' };
        }

        // Validate {text} placeholder if prompt is not empty
        if (promptText && !promptText.includes('{text}')) {
          const errorMessage =
            'Prompt must include {text} placeholder where transcribed text will be inserted';
          showNotification(
            'Invalid Prompt',
            errorMessage,
            true,
            deps.getIcon.bind(null, 'idle') as (state: string) => NativeImage
          );
          if (store.get('soundFeedback')) {
            playSound('c');
          }
          return {
            success: false,
            error: errorMessage,
          };
        }

        // Sanitize backticks to prevent breaking prompt structure
        const sanitized = promptText ? promptText.replace(/```/g, "'''") : '';

        // Save to store
        const customPrompts = store.get('customPrompts', {
          standard: '',
          prompt: '',
          professional: '',
          raw: '',
          ask: '',
          refine: '',
          refine_instruction: '',
        });
        customPrompts[mode as keyof typeof customPrompts] = sanitized;
        store.set('customPrompts', customPrompts);

        logger.info('IPC', `Custom prompt saved for mode: ${mode} (${sanitized.length} chars)`);

        // Trigger Python config sync to apply immediately
        await deps.syncPythonConfig();

        return { success: true };
      } catch (err) {
        logger.error('IPC', `Failed to save custom prompt for ${mode}`, err);
        return { success: false, error: String(err) };
      }
    }
  );

  // Reset custom prompt for a specific mode (back to default)
  ipcMain.handle('settings:reset-custom-prompt', async (_event, mode: string) => {
    try {
      const validModes = [
        'standard',
        'prompt',
        'professional',
        'raw',
        'ask',
        'refine',
        'refine_instruction',
      ];
      if (!validModes.includes(mode)) {
        return { success: false, error: `Invalid mode: ${mode}` };
      }

      const customPrompts = store.get('customPrompts', {
        standard: '',
        prompt: '',
        professional: '',
        raw: '',
        ask: '',
        refine: '',
        refine_instruction: '',
      });
      customPrompts[mode as keyof typeof customPrompts] = '';
      store.set('customPrompts', customPrompts);

      logger.info('IPC', `Custom prompt reset to default for mode: ${mode}`);

      // Trigger Python config sync
      await deps.syncPythonConfig();

      return { success: true };
    } catch (err) {
      logger.error('IPC', `Failed to reset custom prompt for ${mode}`, err);
      return { success: false, error: String(err) };
    }
  });

  // Sound playback handler
  ipcMain.handle('settings:play-sound', async (_event, soundName: string) => {
    playSound(soundName);
  });

  // Get available sound files
  ipcMain.handle('settings:get-sound-files', async () => {
    try {
      const soundsDir = path.join(__dirname, '..', '..', 'assets', 'sounds');
      if (!fs.existsSync(soundsDir)) return [];

      const files = fs.readdirSync(soundsDir);
      // Filter for common audio formats and remove extensions
      return (
        files
          .filter((f) => f.endsWith('.wav') || f.endsWith('.mp3'))
          .map((f) => path.parse(f).name)
          // Remove duplicates (e.g. if we have a.wav and a.mp3)
          .filter((v, i, a) => a.indexOf(v) === i)
      );
    } catch (err) {
      logger.error('MAIN', 'Failed to list sound files', err);
      return [];
    }
  });

  // Hardware test handler
  ipcMain.handle('settings:run-hardware-test', async () => {
    try {
      let gpu = 'Unknown';
      let vram = 'Unknown';
      let tier = 'Fast (CPU-optimized)';

      // Try to get NVIDIA GPU info using nvidia-smi

      return new Promise((resolve) => {
        child_process.exec(
          'nvidia-smi --query-gpu=name,memory.total --format=csv,noheader',
          (err: Error | null, stdout: string) => {
            if (err || !stdout.trim()) {
              // No NVIDIA GPU found, try to detect any GPU
              logger.info('IPC', 'No NVIDIA GPU detected, using CPU mode');
              resolve({
                gpu: 'CPU Mode',
                vram: 'N/A',
                tier: 'Fast (CPU-optimized)',
                speed: 0,
              });
              return;
            }

            // Parse nvidia-smi output
            const parts = stdout
              .trim()
              .split(',')
              .map((s: string) => s.trim());
            gpu = parts[0] || 'Unknown NVIDIA GPU';
            vram = parts[1] || 'Unknown';

            // Determine tier based on VRAM
            const vramMB = parseInt(vram.replace(/[^\d]/g, ''));
            if (vramMB >= 12000) {
              tier = 'Quality (12GB+ VRAM)';
            } else if (vramMB >= 6000) {
              tier = 'Balanced (6-12GB VRAM)';
            } else if (vramMB >= 4000) {
              tier = 'Fast (4-6GB VRAM)';
            } else {
              tier = 'Fast (Low VRAM)';
            }

            logger.info('IPC', `Hardware test complete: ${gpu}, ${vram}, ${tier}`);
            resolve({ gpu, vram, tier, speed: 0 });
          }
        );
      });
    } catch (err) {
      logger.error('IPC', 'Hardware test failed', err);
      return {
        gpu: 'Test failed',
        vram: 'Test failed',
        tier: 'Unknown',
        speed: 0,
      };
    }
  });

  logger.info('IPC', 'Core IPC handlers registered');
}

/**
 * Register i18n IPC Handlers
 * Handles translation requests and language changes
 */
export function registerI18nHandlers(deps: CoreIpcHandlerDependencies): void {
  const { getI18n } = deps;

  // Translate a key
  ipcMain.handle('i18n:translate', async (_event, key: string, options?: unknown) => {
    try {
      return getI18n().t(key, options as Record<string, unknown>);
    } catch (error) {
      logger.error('I18N_IPC', `Translation failed for key: ${key}`, error);
      return key; // Fallback to key name
    }
  });

  // Change language
  ipcMain.handle('i18n:changeLanguage', async (_event, lang: string) => {
    try {
      await getI18n().changeLanguage(lang);

      // Emit language change event to all windows
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send('i18n:languageChanged', lang);
      });

      logger.info('I18N_IPC', `Language changed to: ${lang}`);
    } catch (error) {
      logger.error('I18N_IPC', `Failed to change language to: ${lang}`, error);
      throw error;
    }
  });

  // Get current language
  ipcMain.handle('i18n:getLanguage', async () => {
    try {
      return getI18n().getCurrentLanguage();
    } catch (error) {
      logger.error('I18N_IPC', 'Failed to get current language', error);
      return 'en'; // Fallback to English
    }
  });

  logger.info('IPC', 'i18n IPC handlers registered');
}
