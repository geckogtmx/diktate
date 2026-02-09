/**
 * i18n Translation File Validator
 * Uses Zod schema to validate translation files for security and structure
 */

import { z } from 'zod';
import * as fs from 'fs/promises';
import { logger } from '../utils/logger';

const TranslationMetaSchema = z.object({
  type: z.enum(['human', 'ai']),
  verified: z.boolean(),
  version: z.string(),
  contributor: z.string().optional(),
});

const TranslationFileSchema = z
  .object({
    _meta: TranslationMetaSchema,
  })
  .passthrough(); // Allow other keys for translation strings

export async function validateTranslationFile(filePath: string): Promise<void> {
  try {
    // Check file size (500KB limit for security)
    const stats = await fs.stat(filePath);
    if (stats.size > 500 * 1024) {
      throw new Error(`Translation file exceeds 500KB limit: ${filePath} (${stats.size} bytes)`);
    }

    // Read and parse JSON
    const content = await fs.readFile(filePath, 'utf-8');
    const json = JSON.parse(content);

    // Validate with Zod schema
    TranslationFileSchema.parse(json);

    logger.info('I18N_VALIDATOR', `Validated translation file: ${filePath}`);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('I18N_VALIDATOR', `Validation failed for ${filePath}`, {
        errors: error.issues,
      });
      throw new Error(`Invalid translation file structure: ${filePath}`);
    }
    throw error;
  }
}
