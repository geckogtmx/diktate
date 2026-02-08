/**
 * API Key IPC Handlers
 * Extracted from main.ts as part of GAP 5 (main.ts Monolith Decomposition)
 */

import { ipcMain, safeStorage } from 'electron';
import Store from 'electron-store';
import { UserSettings } from '../types/settings';
import { PythonManager } from '../services/pythonManager';
import { logger } from '../utils/logger';
import {
  validateIpcMessage,
  ApiKeySetSchema,
  ApiKeyTestSchema,
  redactSensitive,
} from '../utils/ipcSchemas';
import {
  GeminiModelInfo,
  GeminiModelsResponse,
  AnthropicModelInfo,
  AnthropicModelsResponse,
  OpenAIModelInfo,
  OpenAIModelsResponse,
  OllamaModelInfo,
  OllamaModelsResponse,
} from './types';

export interface ApiKeyHandlerDependencies {
  store: Store<UserSettings>;
  getPythonManager: () => PythonManager | null;
}

// Rate limiting for API key testing (M4 security fix)
const apiKeyTestAttempts = new Map<string, { count: number; resetTime: number }>();
const MAX_KEY_TESTS_PER_MINUTE = 5;

export function registerApiKeyHandlers(deps: ApiKeyHandlerDependencies): void {
  const { store } = deps;

  ipcMain.handle('apikey:get-all', () => {
    // Return object indicating which keys are set (not the actual keys)
    return {
      geminiApiKey: !!store.get('encryptedGeminiApiKey'),
      anthropicApiKey: !!store.get('encryptedAnthropicApiKey'),
      openaiApiKey: !!store.get('encryptedOpenaiApiKey'),
    };
  });

  ipcMain.handle('apikey:set', async (_event, provider: string, key: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      logger.warn('IPC', 'safeStorage encryption not available');
      throw new Error('Encryption not available');
    }

    // Validate payload
    const validation = validateIpcMessage(ApiKeySetSchema, { provider, key });
    if (!validation.success) {
      logger.error('IPC', `Invalid API key payload: ${redactSensitive(validation.error)}`);
      throw new Error(validation.error);
    }

    const storeKey = `encrypted${provider.charAt(0).toUpperCase() + provider.slice(1)}ApiKey`;

    if (!key) {
      // If key is empty, delete it from the store
      // Type assertion safe: encrypted API key fields are explicitly defined in UserSettings
      store.delete(storeKey as keyof UserSettings);
      logger.info('IPC', `API key for ${provider} deleted`);
    } else {
      // If key is present, encrypt and save
      const encrypted = safeStorage.encryptString(key);
      store.set(storeKey, encrypted.toString('base64'));
      logger.info('IPC', `API key for ${provider} stored securely`);
    }

    // Also update Python with the new key
    const pythonManager = deps.getPythonManager();
    if (pythonManager) {
      pythonManager.setConfig({ [`${provider}ApiKey`]: key }).catch((err) => {
        logger.error('IPC', `Failed to update Python with ${provider} API key`, err);
      });
    }
  });

  ipcMain.handle('apikey:test', async (_event, provider: string, key: string) => {
    // Rate limit check
    const now = Date.now();
    const rateLimit = apiKeyTestAttempts.get(provider);
    if (rateLimit) {
      if (now < rateLimit.resetTime) {
        if (rateLimit.count >= MAX_KEY_TESTS_PER_MINUTE) {
          logger.warn('IPC', `Rate limit exceeded for ${provider} API key testing`);
          return { success: false, error: 'Rate limit exceeded. Please wait 1 minute.' };
        }
        rateLimit.count++;
      } else {
        // Reset after 1 minute
        apiKeyTestAttempts.set(provider, { count: 1, resetTime: now + 60000 });
      }
    } else {
      apiKeyTestAttempts.set(provider, { count: 1, resetTime: now + 60000 });
    }

    // Validate payload
    const validation = validateIpcMessage(ApiKeyTestSchema, { provider, key });
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    // If empty key passed, retrieve the stored encrypted key
    let testKey = key;
    if (!key) {
      const storeKey = `encrypted${provider.charAt(0).toUpperCase() + provider.slice(1)}ApiKey`;
      const storedKey = store.get(storeKey);

      if (storedKey && safeStorage.isEncryptionAvailable()) {
        try {
          testKey = safeStorage.decryptString(Buffer.from(storedKey as string, 'base64'));
        } catch (e) {
          return { success: false, error: 'Failed to decrypt stored key' };
        }
      } else {
        return { success: false, error: 'No saved key found' };
      }
    }

    // Simple validation test for each provider
    try {
      if (provider === 'gemini') {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${testKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }] }),
          }
        );
        if (response.ok) return { success: true };
        const error = await response.json();
        return { success: false, error: error.error?.message || 'Invalid key' };
      } else if (provider === 'anthropic') {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': testKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });
        if (response.ok) return { success: true };
        const error = await response.json();
        return { success: false, error: error.error?.message || 'Invalid key' };
      } else if (provider === 'openai') {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${testKey}` },
        });
        if (response.ok) return { success: true };
        const error = await response.json();
        return { success: false, error: error.error?.message || 'Invalid key' };
      }
      return { success: false, error: 'Unknown provider' };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  });

  // SPEC_034: Granular Model Control - Get available models for each provider
  ipcMain.handle('apikey:get-models', async (_event, provider: string) => {
    try {
      provider = provider.toLowerCase();

      // Get the stored API key if not provided inline
      const storeKey = `encrypted${provider.charAt(0).toUpperCase() + provider.slice(1)}ApiKey`;
      const storedKey = store.get(storeKey);

      let apiKey: string | null = null;
      if (storedKey && safeStorage.isEncryptionAvailable()) {
        try {
          apiKey = safeStorage.decryptString(Buffer.from(storedKey as string, 'base64'));
        } catch (e) {
          logger.error('IPC', `Failed to decrypt ${provider} API key`, e);
          return { success: false, error: 'Failed to decrypt API key' };
        }
      }

      if (!apiKey && provider !== 'local') {
        return { success: false, error: `No API key found for ${provider}` };
      }

      // Fetch models from each provider
      if (provider === 'gemini') {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);

          if (!response.ok) {
            return { success: false, error: `Gemini API error: ${response.status}` };
          }

          const data = (await response.json()) as GeminiModelsResponse;
          const models =
            data.models
              ?.filter((m: GeminiModelInfo) =>
                m.supportedGenerationMethods?.includes('generateContent')
              )
              .map((m: GeminiModelInfo) => ({
                id: m.name,
                name: m.displayName || m.name,
                description: m.description || '',
              })) || [];

          return { success: true, models };
        } catch (error: unknown) {
          clearTimeout(timeoutId);
          if (error instanceof Error && error.name === 'AbortError') {
            return { success: false, error: 'Request timed out after 10 seconds' };
          }
          throw error;
        }
      } else if (provider === 'anthropic') {
        // Anthropic doesn't have a public models endpoint, so return hardcoded list with API fallback
        try {
          // Try to get live list from Anthropic API
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          try {
            const response = await fetch('https://api.anthropic.com/v1/models', {
              headers: {
                'x-api-key': apiKey!,
                'anthropic-version': '2023-06-01',
              },
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (response.ok) {
              const data = (await response.json()) as AnthropicModelsResponse;
              const models =
                data.data?.map((m: AnthropicModelInfo) => ({
                  id: m.id,
                  name: m.id,
                  description: '',
                })) || [];
              return { success: true, models };
            }
          } catch (e: unknown) {
            clearTimeout(timeoutId);
            if (e instanceof Error && e.name === 'AbortError') {
              logger.debug('IPC', 'Anthropic API request timed out, using hardcoded list');
            } else {
              logger.debug('IPC', 'Anthropic live API not available, using hardcoded list');
            }
          }
        } catch (e) {
          logger.debug('IPC', 'Anthropic live API not available, using hardcoded list');
        }

        // Fallback: hardcoded list of Anthropic models
        return {
          success: true,
          models: [
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
            { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
          ],
        };
      } else if (provider === 'openai') {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const response = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            return { success: false, error: `OpenAI API error: ${response.status}` };
          }

          const data = (await response.json()) as OpenAIModelsResponse;
          // Filter for chat-capable models, exclude deprecated and instruct variants
          const models =
            data.data
              ?.filter(
                (m: OpenAIModelInfo) =>
                  m.id.includes('gpt') && !m.id.includes('instruct') && !m.deprecated
              )
              .map((m: OpenAIModelInfo) => ({
                id: m.id,
                name: m.id,
                description: '',
              })) || [];

          return { success: true, models };
        } catch (error: unknown) {
          clearTimeout(timeoutId);
          if (error instanceof Error && error.name === 'AbortError') {
            return { success: false, error: 'Request timed out after 10 seconds' };
          }
          throw error;
        }
      } else if (provider === 'local') {
        // Ollama model discovery
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch('http://localhost:11434/api/tags', {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            return { success: false, error: 'Ollama not running or not responding' };
          }

          const data = (await response.json()) as OllamaModelsResponse;
          const models =
            data.models?.map((m: OllamaModelInfo) => ({
              id: m.name,
              name: m.name,
              size: m.size ? `${(m.size / 1e9).toFixed(1)} GB` : 'Unknown',
            })) || [];

          return { success: true, models };
        } catch (e: unknown) {
          clearTimeout(timeoutId);
          if (e instanceof Error && e.name === 'AbortError') {
            return { success: false, error: 'Ollama request timed out' };
          }
          return { success: false, error: 'Ollama not running or not responding' };
        }
      }

      return { success: false, error: 'Unknown provider' };
    } catch (e) {
      logger.error('IPC', `Failed to fetch models for ${provider}`, e);
      return { success: false, error: String(e) };
    }
  });
}
