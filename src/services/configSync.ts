/**
 * Config Sync Service
 * Extracted from main.ts as part of GAP 5 (main.ts Monolith Decomposition)
 *
 * Synchronizes Electron store settings with the Python backend
 */

import { BrowserWindow, safeStorage } from 'electron';
import Store from 'electron-store';
import {
  UserSettings,
  LocalProfile,
  CloudProfile,
  PythonConfig,
  DEFAULT_PROMPTS,
} from '../types/settings';
import { PythonManager } from './pythonManager';
import { logger } from '../utils/logger';
import { SUPABASE_EDGE_FUNCTION_URL } from '../ipc/trialHandlers';

export interface ConfigSyncDependencies {
  store: Store<UserSettings>;
  getPythonManager: () => PythonManager | null;
  getDebugWindow: () => BrowserWindow | null;
}

/**
 * Validate API key format for stored keys (SPEC_013 - soft validation)
 * Returns true if valid, false if invalid (logs warning but doesn't throw)
 */
export function validateStoredKeyFormat(provider: string, key: string): boolean {
  const patterns: Record<string, RegExp> = {
    gemini: /^AIza[0-9A-Za-z-_]{35}$/,
    anthropic: /^sk-ant-[a-zA-Z0-9\-_]{20,}$/,
    openai: /^sk-[a-zA-Z0-9]{20,}$/,
  };
  return patterns[provider]?.test(key) ?? true;
}

/**
 * Synchronize current Electron store settings with the Python backend
 */
export async function syncPythonConfig(deps: ConfigSyncDependencies): Promise<void> {
  const { store } = deps;
  const pythonManager = deps.getPythonManager();
  if (!pythonManager || !pythonManager.isProcessRunning()) return;

  const processingMode = store.get('processingMode', 'local');
  const defaultMode = store.get('defaultMode', 'standard');
  const transMode = store.get('transMode', 'none');

  // Get audio and feature settings
  const audioDeviceLabel = store.get('audioDeviceLabel', 'Default');
  const whisperModel = store.get('whisperModel', 'turbo'); // SPEC_041
  const trailingSpaceEnabled = store.get('trailingSpaceEnabled', true);
  const additionalKeyEnabled = store.get('additionalKeyEnabled', false);
  const additionalKey = store.get('additionalKey', 'none');
  const privacyLoggingIntensity = store.get('privacyLoggingIntensity', 2);
  const privacyPiiScrubber = store.get('privacyPiiScrubber', true);

  // SPEC_034_EXTRAS / SPEC_038: Build dual-profile configuration
  const modes = [
    'standard',
    'prompt',
    'professional',
    'ask',
    'refine',
    'refine_instruction',
    'raw',
    'note',
  ];

  const localProfiles: Record<string, LocalProfile> = {};
  const cloudProfiles: Record<string, CloudProfile> = {};

  // SPEC_038: Get global local model (used for ALL local modes)
  const globalLocalModel = store.get('localModel', '');
  logger.debug('SYNC', `SPEC_038: Global local model = "${globalLocalModel}"`);

  for (const mode of modes) {
    // SPEC_038: Local Profile - now contains only per-mode prompts (NO model selection)
    // Type assertion safe: mode-specific keys are explicitly defined in UserSettings
    localProfiles[mode] = {
      prompt: String(store.get(`localPrompt_${mode}` as keyof UserSettings) || ''),
    };

    // Cloud Profile - per-mode model selection still supported
    // fallback to default prompt for this mode if not set
    const defaultPrompt =
      DEFAULT_PROMPTS[mode as keyof typeof DEFAULT_PROMPTS] || DEFAULT_PROMPTS.standard;

    cloudProfiles[mode] = {
      provider: String(store.get(`cloudProvider_${mode}` as keyof UserSettings) || ''),
      model: String(store.get(`cloudModel_${mode}` as keyof UserSettings) || ''),
      prompt: String(store.get(`cloudPrompt_${mode}` as keyof UserSettings) || defaultPrompt),
    };
  }

  // Build default model for display (based on active profile)
  let displayModel = globalLocalModel;

  if (processingMode === 'cloud') {
    const cloudProvider = cloudProfiles[defaultMode]?.provider || 'gemini';
    const cloudModel = cloudProfiles[defaultMode]?.model || '';
    displayModel =
      cloudModel ||
      (cloudProvider === 'gemini'
        ? ''
        : cloudProvider === 'anthropic'
          ? ''
          : cloudProvider === 'openai'
            ? ''
            : '');
  } else {
    // SPEC_038: Display the global local model (all modes use the same one)
    displayModel = globalLocalModel;
  }

  const config: PythonConfig = {
    processingMode: processingMode, // SPEC_034_EXTRAS: Global toggle
    provider: processingMode, // Keep for backward compatibility
    mode: defaultMode,
    transMode: transMode,
    defaultModel: displayModel,

    // SPEC_038: Send global local model to Python
    localModel: globalLocalModel,
    defaultOllamaModel: globalLocalModel, // Also send as legacy field for backward compatibility

    // SPEC_034_EXTRAS: Send dual-profile data
    localProfiles: localProfiles,
    cloudProfiles: cloudProfiles,

    audioDeviceLabel: audioDeviceLabel,
    // SPEC_041: Whisper model selection
    model: whisperModel,
    trailingSpaceEnabled: trailingSpaceEnabled,
    additionalKeyEnabled: additionalKeyEnabled,
    additionalKey: additionalKey,
    // Note settings (SPEC_020)
    noteFilePath: store.get('noteFilePath'),
    noteFormat: store.get('noteFormat'),
    noteUseProcessor: store.get('noteUseProcessor'),
    noteTimestampFormat: store.get('noteTimestampFormat'),
    notePrompt: store.get('notePrompt'),
    privacyLoggingIntensity: privacyLoggingIntensity,
    privacyPiiScrubber: privacyPiiScrubber,
  };

  // Get API credentials for all providers (SPEC_033: support multi-processor routing)
  try {
    const providers = [
      { id: 'gemini', storeKey: 'encryptedGeminiApiKey', configKey: 'geminiApiKey' },
      { id: 'anthropic', storeKey: 'encryptedAnthropicApiKey', configKey: 'anthropicApiKey' },
      { id: 'openai', storeKey: 'encryptedOpenaiApiKey', configKey: 'openaiApiKey' },
    ];

    for (const p of providers) {
      const encrypted = store.get(p.storeKey as keyof UserSettings) as string | undefined;
      if (encrypted && safeStorage.isEncryptionAvailable()) {
        try {
          const decrypted = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
          if (decrypted && validateStoredKeyFormat(p.id, decrypted)) {
            config[p.configKey] = decrypted;
            // Set legacy main apiKey if this is the active global provider
            if (processingMode === p.id || (processingMode === 'cloud' && p.id === 'gemini')) {
              config.apiKey = decrypted;
              config.authType = 'apikey';
            }
          }
        } catch (err) {
          logger.error('MAIN', `Failed to decrypt ${p.id} API key`, err);
        }
      }
    }
  } catch (e) {
    logger.error('MAIN', 'Failed to retrieve API credentials for sync', e);
  }

  // SPEC_042: Trial session token — decrypt and pass to Python if present
  try {
    const encryptedTrialToken = store.get('encryptedTrialSessionToken') as string | undefined;
    if (encryptedTrialToken && safeStorage.isEncryptionAvailable()) {
      const trialToken = safeStorage.decryptString(Buffer.from(encryptedTrialToken, 'base64'));
      if (trialToken) {
        config.trialSessionToken = trialToken;
        config.supabaseEdgeFunctionUrl = SUPABASE_EDGE_FUNCTION_URL;
        logger.debug('SYNC', 'Trial session token included in config sync');
      }
    }
  } catch (err) {
    logger.error('SYNC', 'Failed to decrypt trial session token for config sync', err);
  }

  try {
    logger.debug('MAIN', 'Syncing dual-profile config to Python', {
      mode: config.mode,
      processingMode: config.processingMode,
      model: config.defaultModel,
    });
    logger.debug(
      'SYNC',
      `SPEC_038: Sending localModel="${config.localModel}", defaultOllamaModel="${config.defaultOllamaModel}"`
    );
    await pythonManager.setConfig(config);

    // Update badge in status window
    const dw = deps.getDebugWindow();
    if (dw && !dw.isDestroyed()) {
      // Determine processor name based on active profile
      let processorDisplay = config.defaultModel;
      if (config.processingMode === 'cloud') {
        const cloudProvider = cloudProfiles[defaultMode]?.provider || 'gemini';
        const cloudModel = cloudProfiles[defaultMode]?.model || '';

        if (cloudProvider === 'gemini') {
          processorDisplay = cloudModel || '';
        } else if (cloudProvider === 'anthropic') {
          processorDisplay = cloudModel || '';
        } else if (cloudProvider === 'openai') {
          processorDisplay = cloudModel || '';
        }
      }

      // SPEC_041: Include Whisper transcriber model in badge update
      dw.webContents.send('badge-update', {
        processor: processorDisplay,
        transcriber: whisperModel.toUpperCase(),
      });
      dw.webContents.send('mode-update', config.mode);
      dw.webContents.send('provider-update', config.processingMode);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('MAIN', `Failed to sync config to Python: ${message}`);
  }
}
