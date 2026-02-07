/**
 * Settings Migration Service
 * Extracted from main.ts as part of GAP 5 (main.ts Monolith Decomposition)
 *
 * Handles migration of user settings across different schema versions
 */

import Store from 'electron-store';
import { UserSettings } from '../types/settings';
import { logger } from '../utils/logger';

/**
 * SPEC_034_EXTRAS: Migrate from single-profile to dual-profile system
 * Converts old modeProvider/modeModel to new localModel/cloudProvider/cloudModel structure
 */
export function migrateToDualProfileSystem(store: Store<UserSettings>): void {
  // Type assertions safe: mode-specific and legacy keys are explicitly defined in UserSettings interface

  // Check if migration already ran
  if (store.get('profileSystemMigrated' as keyof UserSettings)) {
    logger.info('MAIN', 'Dual-profile migration already completed');
    return;
  }

  logger.info('MAIN', 'Starting dual-profile system migration (SPEC_034_EXTRAS)');

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
  let migratedCount = 0;

  for (const mode of modes) {
    const oldProvider = store.get(`modeProvider_${mode}` as keyof UserSettings) as
      | string
      | undefined;
    const oldModel = store.get(`modeModel_${mode}` as keyof UserSettings) as string | undefined;
    const customPrompts = store.get('customPrompts' as keyof UserSettings);
    const oldPrompt = (
      typeof customPrompts === 'object' && customPrompts && mode in customPrompts
        ? (customPrompts as Record<string, string>)[mode]
        : undefined
    ) as string | undefined;

    if (!oldProvider && !oldModel && !oldPrompt) {
      // No settings for this mode, skip
      continue;
    }

    if (oldProvider === 'local' || !oldProvider) {
      // Migrate to Local Profile
      if (oldModel) {
        store.set(`localModel_${mode}` as keyof UserSettings, oldModel);
        logger.info('MAIN', `[MIGRATION] ${mode}: Local model -> ${oldModel}`);
      }
      if (oldPrompt) {
        store.set(`localPrompt_${mode}` as keyof UserSettings, oldPrompt);
      }
    } else {
      // Migrate to Cloud Profile (gemini/anthropic/openai)
      store.set(`cloudProvider_${mode}` as keyof UserSettings, oldProvider);
      if (oldModel) {
        store.set(`cloudModel_${mode}` as keyof UserSettings, oldModel);
      }
      if (oldPrompt) {
        store.set(`cloudPrompt_${mode}` as keyof UserSettings, oldPrompt);
      }
      logger.info(
        'MAIN',
        `[MIGRATION] ${mode}: Cloud provider -> ${oldProvider}${oldModel ? `, model -> ${oldModel}` : ''}`
      );
    }

    // Delete old keys
    store.delete(`modeProvider_${mode}` as keyof UserSettings);
    store.delete(`modeModel_${mode}` as keyof UserSettings);

    migratedCount++;
  }

  // Mark migration as complete
  store.set('profileSystemMigrated' as keyof UserSettings, true);
  logger.info('MAIN', `Dual-profile migration complete: ${migratedCount} modes migrated`);
}
