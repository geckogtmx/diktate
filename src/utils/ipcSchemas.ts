/**
 * Zod schemas for IPC message validation
 * Ensures all IPC messages are type-safe and validated
 */

import { z } from 'zod';

// Settings schemas
export const ProcessingModeSchema = z.enum(['local', 'cloud', 'google', 'anthropic', 'openai']);
export const PersonalityModeSchema = z.enum(['standard', 'prompt', 'professional', 'raw']);
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
    'defaultOllamaModel',
    'maxRecordingDuration',
    'modeModel_standard',
    'modeModel_prompt',
    'modeModel_professional',
    'customPrompts'
]);

// API key provider schema
export const ApiKeyProviderSchema = z.enum(['gemini', 'anthropic', 'openai']);

// IPC Message schemas
export const SettingsSetSchema = z.object({
    key: SettingsKeySchema,
    value: z.union([z.string(), z.boolean(), z.number()])
});

export const ApiKeySetSchema = z.object({
    provider: ApiKeyProviderSchema,
    key: z.string().min(10).max(200)
});

export const ApiKeyTestSchema = z.object({
    provider: ApiKeyProviderSchema,
    key: z.string().max(200) // Empty string = "test stored key"
});


// Validation helper
export function validateIpcMessage<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, error: result.error.message };
}

// Log redaction utility
export function redactSensitive(text: string, maxVisible: number = 20): string {
    if (!text || text.length <= maxVisible) {
        return '[REDACTED]';
    }
    return `${text.substring(0, maxVisible)}...[REDACTED ${text.length - maxVisible} chars]`;
}
