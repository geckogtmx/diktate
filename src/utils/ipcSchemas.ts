/**
 * Zod schemas for IPC message validation
 * Ensures all IPC messages are type-safe and validated
 */

import { z } from 'zod';

// Settings schemas
export const ProcessingModeSchema = z.enum(['local', 'cloud', 'google', 'anthropic', 'openai']);
export const ExecutionModeSchema = z.enum([
  'standard',
  'prompt',
  'professional',
  'raw',
  'ask',
  'refine',
  'refine_instruction',
]);
export const TransModeSchema = z.enum(['none', 'es-en', 'en-es']);

export const SettingsKeySchema = z.enum([
  'processingMode',
  'autoStart',
  'soundFeedback',
  'feedbackSound',
  'startSound',
  'stopSound',
  'askSound',
  'hotkey',
  'askHotkey',
  'translateHotkey',
  'askOutputMode',
  'defaultMode',
  'transMode',
  'audioDeviceId',
  'audioDeviceLabel',
  'audioDeviceProfiles', // NEW: SPEC_021 - Audio device noise floor profiles
  'whisperModel', // NEW: SPEC_041 - Whisper model selection (turbo/medium/small/base/tiny)
  'defaultOllamaModel',
  'localModel', // NEW: SPEC_038 - Global local model for all modes
  'maxRecordingDuration',
  'modeModel_standard',
  'modeModel_prompt',
  'modeModel_professional',
  'modeModel_ask', // NEW: Ask mode model override
  'modeModel_refine', // NEW: Refine mode model override
  'modeModel_refine_instruction', // NEW: Refine Instruction mode model override
  'modeProvider_standard',
  'modeProvider_prompt',
  'modeProvider_professional',
  'modeProvider_ask',
  'modeProvider_refine',
  'modeProvider_refine_instruction',
  'modeProvider_raw',
  'customPrompts',
  'trailingSpaceEnabled', // NEW: Enable/disable trailing space (SPEC_006)
  'additionalKeyEnabled', // NEW: Enable/disable additional key (SPEC_006)
  'additionalKey', // NEW: Which additional key to press (SPEC_006)
  'refineMode', // NEW: Refine behavior mode - 'autopilot' or 'instruction' (SPEC_025)
  // Note-taking settings (SPEC_020)
  'noteHotkey',
  'noteFilePath',
  'noteFormat',
  'noteUseProcessor',
  'noteTimestampFormat',
  'noteDefaultFolder',
  'noteFileNameTemplate',
  'notePrompt',
  'privacyLoggingIntensity', // NEW: SPEC_030
  'privacyPiiScrubber', // NEW: SPEC_030
  // SPEC_034_EXTRAS: Dual-profile configuration keys
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
]);

// API key provider schema
export const ApiKeyProviderSchema = z.enum(['gemini', 'anthropic', 'openai']);

// API key validation regexes (SPEC_013)
const GEMINI_KEY_REGEX = /^AIza[0-9A-Za-z-_]{35}$/;
const ANTHROPIC_KEY_REGEX = /^sk-ant-[a-zA-Z0-9\-_]{20,}$/;
const OPENAI_KEY_REGEX = /^sk-[a-zA-Z0-9\-_]{20,}$/;

// IPC Message schemas
export const SettingsSetSchema = z.object({
  key: SettingsKeySchema,
  value: z.union([z.string(), z.boolean(), z.number(), z.record(z.string(), z.any())]), // Allow objects for audioDeviceProfiles
});

export const ApiKeySetSchema = z
  .object({
    provider: ApiKeyProviderSchema,
    key: z.string().max(200), // Removed min(10) to allow empty string (clearing key)
  })
  .superRefine((data, ctx) => {
    const { provider, key } = data;

    // Allow clearing the key
    if (key === '') {
      return;
    }

    let isValid = false;
    let expectedFormat = '';

    switch (provider) {
      case 'gemini':
        isValid = GEMINI_KEY_REGEX.test(key);
        expectedFormat = 'AIza followed by 35 characters (letters, numbers, -, _)';
        break;
      case 'anthropic':
        isValid = ANTHROPIC_KEY_REGEX.test(key);
        expectedFormat = 'sk-ant- followed by 20+ characters (letters, numbers, -, _)';
        break;
      case 'openai':
        isValid = OPENAI_KEY_REGEX.test(key);
        expectedFormat =
          'sk- followed by 20+ characters (letters, numbers, underscores, or dashes)';
        break;
    }

    if (!isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid ${provider} API key format. Expected: ${expectedFormat}`,
        path: ['key'],
      });
    }
  });

export const ApiKeyTestSchema = z
  .object({
    provider: ApiKeyProviderSchema,
    key: z.string().max(200), // Empty string = "test stored key"
  })
  .superRefine((data, ctx) => {
    const { provider, key } = data;

    // Skip validation for empty string (testing stored key)
    if (key === '') {
      return;
    }

    let isValid = false;
    let expectedFormat = '';

    switch (provider) {
      case 'gemini':
        isValid = GEMINI_KEY_REGEX.test(key);
        expectedFormat = 'AIza followed by 35 characters (letters, numbers, -, _)';
        break;
      case 'anthropic':
        isValid = ANTHROPIC_KEY_REGEX.test(key);
        expectedFormat = 'sk-ant- followed by 20+ characters (letters, numbers, -, _)';
        break;
      case 'openai':
        isValid = OPENAI_KEY_REGEX.test(key);
        expectedFormat =
          'sk- followed by 20+ characters (letters, numbers, underscores, or dashes)';
        break;
    }

    if (!isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid ${provider} API key format. Expected: ${expectedFormat}`,
        path: ['key'],
      });
    }
  });

// Validation helper
export function validateIpcMessage<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  // Extract the first error message from Zod errors
  const issues = result.error.issues;
  const errorMessage = issues.length > 0 ? issues[0].message : result.error.message;

  return { success: false, error: errorMessage };
}

// Log redaction utility
export function redactSensitive(text: string, maxVisible: number = 20): string {
  if (!text || text.length <= maxVisible) {
    return '[REDACTED]';
  }
  return `${text.substring(0, maxVisible)}...[REDACTED ${text.length - maxVisible} chars]`;
}
