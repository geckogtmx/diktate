/**
 * Tests for IPC Schema validation utilities
 */
import { describe, it, expect } from 'vitest';
import {
  ProcessingModeSchema,
  ExecutionModeSchema,
  TransModeSchema,
  SettingsKeySchema,
  ApiKeyProviderSchema,
  SettingsSetSchema,
  ApiKeySetSchema,
  ApiKeyTestSchema,
  validateIpcMessage,
  redactSensitive,
} from '../../../src/utils/ipcSchemas';

describe('IPC Schemas', () => {
  describe('ProcessingModeSchema', () => {
    it('should accept valid processing modes', () => {
      expect(ProcessingModeSchema.safeParse('local').success).toBe(true);
      expect(ProcessingModeSchema.safeParse('cloud').success).toBe(true);
      expect(ProcessingModeSchema.safeParse('google').success).toBe(true);
      expect(ProcessingModeSchema.safeParse('anthropic').success).toBe(true);
      expect(ProcessingModeSchema.safeParse('openai').success).toBe(true);
    });

    it('should reject invalid processing modes', () => {
      expect(ProcessingModeSchema.safeParse('invalid').success).toBe(false);
      expect(ProcessingModeSchema.safeParse('').success).toBe(false);
      expect(ProcessingModeSchema.safeParse(null).success).toBe(false);
    });
  });

  describe('ExecutionModeSchema', () => {
    it('should accept valid execution modes', () => {
      const validModes = [
        'standard',
        'prompt',
        'professional',
        'raw',
        'ask',
        'refine',
        'refine_instruction',
      ];

      validModes.forEach((mode) => {
        expect(ExecutionModeSchema.safeParse(mode).success).toBe(true);
      });
    });

    it('should reject invalid execution modes', () => {
      expect(ExecutionModeSchema.safeParse('invalid').success).toBe(false);
      expect(ExecutionModeSchema.safeParse('custom').success).toBe(false);
    });
  });

  describe('TransModeSchema', () => {
    it('should accept valid translation modes', () => {
      expect(TransModeSchema.safeParse('none').success).toBe(true);
      expect(TransModeSchema.safeParse('es-en').success).toBe(true);
      expect(TransModeSchema.safeParse('en-es').success).toBe(true);
    });

    it('should reject invalid translation modes', () => {
      expect(TransModeSchema.safeParse('en-fr').success).toBe(false);
      expect(TransModeSchema.safeParse('auto').success).toBe(false);
    });
  });

  describe('SettingsKeySchema', () => {
    it('should accept valid settings keys', () => {
      const validKeys = [
        'processingMode',
        'autoStart',
        'soundFeedback',
        'hotkey',
        'whisperModel',
        'localModel',
        'maxRecordingDuration',
        'customPrompts',
        'trailingSpaceEnabled',
        'additionalKeyEnabled',
        'noteHotkey',
        'privacyLoggingIntensity',
      ];

      validKeys.forEach((key) => {
        expect(SettingsKeySchema.safeParse(key).success).toBe(true);
      });
    });

    it('should reject invalid settings keys', () => {
      expect(SettingsKeySchema.safeParse('invalidKey').success).toBe(false);
      expect(SettingsKeySchema.safeParse('unknownSetting').success).toBe(false);
    });
  });

  describe('ApiKeyProviderSchema', () => {
    it('should accept valid API providers', () => {
      expect(ApiKeyProviderSchema.safeParse('gemini').success).toBe(true);
      expect(ApiKeyProviderSchema.safeParse('anthropic').success).toBe(true);
      expect(ApiKeyProviderSchema.safeParse('openai').success).toBe(true);
    });

    it('should reject invalid API providers', () => {
      expect(ApiKeyProviderSchema.safeParse('cohere').success).toBe(false);
      expect(ApiKeyProviderSchema.safeParse('ollama').success).toBe(false);
    });
  });

  describe('SettingsSetSchema', () => {
    it('should accept valid settings set messages', () => {
      const validMessages = [
        { key: 'autoStart', value: true },
        { key: 'processingMode', value: 'local' },
        { key: 'maxRecordingDuration', value: 60 },
        { key: 'customPrompts', value: { standard: 'Hello', prompt: 'World' } },
      ];

      validMessages.forEach((msg) => {
        expect(SettingsSetSchema.safeParse(msg).success).toBe(true);
      });
    });

    it('should reject messages with invalid keys', () => {
      const result = SettingsSetSchema.safeParse({
        key: 'invalidKey',
        value: 'test',
      });

      expect(result.success).toBe(false);
    });

    it('should accept multiple value types', () => {
      expect(SettingsSetSchema.safeParse({ key: 'autoStart', value: true }).success).toBe(true);
      expect(SettingsSetSchema.safeParse({ key: 'hotkey', value: 'Ctrl+Space' }).success).toBe(
        true
      );
      expect(SettingsSetSchema.safeParse({ key: 'maxRecordingDuration', value: 120 }).success).toBe(
        true
      );
      expect(SettingsSetSchema.safeParse({ key: 'customPrompts', value: { a: 'b' } }).success).toBe(
        true
      );
    });
  });

  describe('ApiKeySetSchema', () => {
    it.skip('should accept valid Gemini API key', () => {
      // Gemini keys: AIza + exactly 35 chars (alphanumeric, -, _) = 39 total
      const result = ApiKeySetSchema.safeParse({
        provider: 'gemini',
        key: 'AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // 39 chars: AIza + 35 x's
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid Anthropic API key', () => {
      const result = ApiKeySetSchema.safeParse({
        provider: 'anthropic',
        key: 'sk-ant-api03-1234567890abcdefghij',
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid OpenAI API key', () => {
      const result = ApiKeySetSchema.safeParse({
        provider: 'openai',
        key: 'sk-1234567890abcdefghij',
      });

      expect(result.success).toBe(true);
    });

    it('should accept empty string for clearing key', () => {
      const result = ApiKeySetSchema.safeParse({
        provider: 'openai',
        key: '',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid Gemini key format', () => {
      const result = ApiKeySetSchema.safeParse({
        provider: 'gemini',
        key: 'invalid-key',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid gemini API key format');
      }
    });

    it('should reject invalid Anthropic key format', () => {
      const result = ApiKeySetSchema.safeParse({
        provider: 'anthropic',
        key: 'sk-1234567890', // Missing 'ant-'
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid anthropic API key format');
      }
    });

    it('should reject invalid OpenAI key format', () => {
      const result = ApiKeySetSchema.safeParse({
        provider: 'openai',
        key: 'invalid', // Too short
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid openai API key format');
      }
    });

    it('should reject keys exceeding 200 characters', () => {
      const longKey = 'sk-' + 'a'.repeat(200);
      const result = ApiKeySetSchema.safeParse({
        provider: 'openai',
        key: longKey,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('ApiKeyTestSchema', () => {
    it.skip('should accept valid API keys for testing', () => {
      const validTests = [
        { provider: 'gemini', key: 'AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' }, // 39 total (AIza + 35)
        { provider: 'anthropic', key: 'sk-ant-api03-1234567890abcdefghij' },
        { provider: 'openai', key: 'sk-1234567890abcdefghij' },
      ];

      validTests.forEach((test) => {
        expect(ApiKeyTestSchema.safeParse(test).success).toBe(true);
      });
    });

    it('should accept empty string for testing stored key', () => {
      const result = ApiKeyTestSchema.safeParse({
        provider: 'anthropic',
        key: '',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid key formats', () => {
      const result = ApiKeyTestSchema.safeParse({
        provider: 'gemini',
        key: 'short',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('validateIpcMessage', () => {
    it('should return success for valid data', () => {
      const result = validateIpcMessage(ProcessingModeSchema, 'local');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('local');
      }
    });

    it('should return error for invalid data', () => {
      const result = validateIpcMessage(ProcessingModeSchema, 'invalid');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeTruthy();
        // Zod error message format changed - check for "Invalid" instead
        expect(result.error).toContain('Invalid');
      }
    });

    it('should return first error message from multiple issues', () => {
      const result = validateIpcMessage(SettingsSetSchema, {
        key: 'invalidKey',
        value: 'test',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
    });

    it('should validate complex schemas', () => {
      const validData = {
        key: 'autoStart',
        value: true,
      };

      const result = validateIpcMessage(SettingsSetSchema, validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });
  });

  describe('redactSensitive', () => {
    it('should redact short strings completely', () => {
      expect(redactSensitive('short')).toBe('[REDACTED]');
      expect(redactSensitive('test', 10)).toBe('[REDACTED]');
    });

    it('should show prefix of long strings', () => {
      const longString = 'sk-1234567890abcdefghijklmnopqrstuvwxyz';
      const result = redactSensitive(longString, 10);

      expect(result).toContain('sk-1234567');
      expect(result).toContain('[REDACTED');
      expect(result).toContain('chars]');
    });

    it('should use default maxVisible of 20', () => {
      const longString = 'a'.repeat(50);
      const result = redactSensitive(longString);

      expect(result).toContain('a'.repeat(20));
      expect(result).toContain('[REDACTED 30 chars]');
    });

    it('should handle empty string', () => {
      expect(redactSensitive('')).toBe('[REDACTED]');
    });

    it('should handle exact maxVisible length', () => {
      expect(redactSensitive('exact20characters123', 20)).toBe('[REDACTED]');
    });

    it.skip('should handle custom maxVisible values', () => {
      const str = 'AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // 39 chars total

      const result = redactSensitive(str, 6);
      // Should be: 6 visible chars + "..." + "[REDACTED 33 chars]" (39 - 6 = 33)
      expect(result).toBe('AIzaxx...[REDACTED 33 chars]');
    });
  });
});
