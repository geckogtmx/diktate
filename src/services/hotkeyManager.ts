/**
 * Hotkey Manager Service
 * Extracted from main.ts as part of GAP 5 (main.ts Monolith Decomposition)
 *
 * Manages global hotkey registration for all dictation modes
 */

import { globalShortcut, NativeImage } from 'electron';
import Store from 'electron-store';
import { UserSettings } from '../types/settings';
import { logger } from '../utils/logger';
import { PythonManager } from './pythonManager';
import { playSound } from './notificationService';

export interface HotkeyDependencies {
  store: Store<UserSettings>;
  showNotification: (title: string, body: string, isError: boolean, getIcon: (state: string) => NativeImage) => void;
  toggleRecording: (mode: 'dictate' | 'ask' | 'translate' | 'refine' | 'note') => Promise<void>;
  handleRefineSelection: () => void;
  getPythonManager: () => PythonManager | null;
  getState: () => { isWarmupLock: boolean; isRecording: boolean };
  getIcon: (state: string) => NativeImage;
}

/**
 * Setup all global hotkeys for dictation modes
 * Unregisters existing hotkeys first to prevent conflicts
 */
export function setupGlobalHotkeys(deps: HotkeyDependencies): void {
  try {
    let lastHotkeyPress = 0;
    const HOTKEY_DEBOUNCE_MS = 500;

    // Get hotkeys from settings
    const dictateHotkey = deps.store.get('hotkey') || 'Control+Alt+D';
    const askHotkey = deps.store.get('askHotkey') || 'Control+Alt+A';

    // Unregister old if exists
    globalShortcut.unregisterAll();

    // SPEC_038: Validation helper - check if local model is configured
    const validateLocalModel = (): boolean => {
      const processingMode = deps.store.get('processingMode', 'local');
      if (processingMode === 'local') {
        const localModel = deps.store.get('localModel', '') || deps.store.get('defaultOllamaModel', '');
        if (!localModel) {
          logger.error('HOTKEY', 'Blocked: No local model configured');
          deps.showNotification(
            'No Model Selected',
            'Please select an Ollama model in Settings > General > Default AI Model before using dictation.',
            true,
            deps.getIcon
          );
          return false;
        }
      }
      return true;
    };

    // Register Dictate hotkey (Ctrl+Alt+D)
    const dictateRet = globalShortcut.register(dictateHotkey, async () => {
      const now = Date.now();
      if (now - lastHotkeyPress < HOTKEY_DEBOUNCE_MS) {
        logger.debug('HOTKEY', 'Ignoring debounce hotkey press');
        return;
      }
      lastHotkeyPress = now;

      // SPEC_038: Block if no model selected
      if (!validateLocalModel()) return;

      const state = deps.getState();
      logger.debug('HOTKEY', 'Dictate hotkey pressed', { isRecording: state.isRecording, mode: 'dictate' });
      await deps.toggleRecording('dictate');
    });

    if (!dictateRet) {
      logger.warn('HOTKEY', 'Failed to register dictate hotkey', { hotkey: dictateHotkey });
      deps.showNotification(
        'Hotkey Registration Failed',
        `Could not register ${dictateHotkey}. Another application may be using it.`,
        true,
        deps.getIcon
      );
    } else {
      logger.info('HOTKEY', 'Dictate hotkey registered', { hotkey: dictateHotkey });
    }

    // Register Ask hotkey (Ctrl+Alt+A)
    const askRet = globalShortcut.register(askHotkey, async () => {
      const now = Date.now();
      if (now - lastHotkeyPress < HOTKEY_DEBOUNCE_MS) {
        logger.debug('HOTKEY', 'Ignoring debounce ask hotkey press');
        return;
      }
      lastHotkeyPress = now;

      // SPEC_038: Block if no model selected
      if (!validateLocalModel()) return;

      const state = deps.getState();
      logger.debug('HOTKEY', 'Ask hotkey pressed', { isRecording: state.isRecording, mode: 'ask' });
      await deps.toggleRecording('ask');
    });

    if (!askRet) {
      logger.warn('HOTKEY', 'Failed to register ask hotkey', { hotkey: askHotkey });
      // Don't show notification for ask - it's a secondary feature
    } else {
      logger.info('HOTKEY', 'Ask hotkey registered', { hotkey: askHotkey });
    }

    // Register Translate hotkey (Ctrl+Alt+T)
    const translateHotkey = deps.store.get('translateHotkey', 'Ctrl+Alt+T');
    const translateRet = globalShortcut.register(translateHotkey, async () => {
      const now = Date.now();
      if (now - lastHotkeyPress < HOTKEY_DEBOUNCE_MS) {
        logger.debug('HOTKEY', 'Ignoring debounce translate hotkey press');
        return;
      }
      lastHotkeyPress = now;

      // SPEC_038: Block if no model selected
      if (!validateLocalModel()) return;

      const state = deps.getState();
      logger.debug('HOTKEY', 'Translate hotkey pressed', { isRecording: state.isRecording, mode: 'translate' });
      await deps.toggleRecording('translate');
    });

    if (!translateRet) {
      logger.warn('HOTKEY', 'Failed to register translate hotkey', { hotkey: translateHotkey });
    } else {
      logger.info('HOTKEY', 'Translate hotkey registered', { hotkey: translateHotkey });
    }

    // Register Refine hotkey (Ctrl+Alt+R) - SPEC_025
    const refineHotkey = deps.store.get('refineHotkey', 'Ctrl+Alt+R');
    const refineRet = globalShortcut.register(refineHotkey, async () => {
      const state = deps.getState();
      if (state.isWarmupLock) {
        logger.warn('HOTKEY', 'Refine blocked: Still warming up');
        return;
      }

      // SPEC_038: Block if no model selected
      if (!validateLocalModel()) return;

      const refineMode = deps.store.get('refineMode', 'autopilot');
      logger.debug('HOTKEY', `Refine hotkey pressed (mode: ${refineMode})`);

      if (refineMode === 'instruction') {
        // Instruction Mode: Start recording for dictated instruction
        if (state.isRecording) {
          // Stop recording (second press completes the instruction)
          await deps.toggleRecording('refine');
        } else {
          // Start recording for instruction
          await deps.toggleRecording('refine');
        }
      } else {
        // Autopilot Mode: Immediate refine with default prompt
        if (state.isRecording) {
          logger.warn('HOTKEY', 'Refine blocked: Currently recording');
          return;
        }
        deps.handleRefineSelection();
      }
    });

    if (!refineRet) {
      logger.warn('HOTKEY', 'Failed to register refine hotkey', { hotkey: refineHotkey });
    } else {
      logger.info('HOTKEY', 'Refine hotkey registered', { hotkey: refineHotkey });
    }

    // Register Oops hotkey (Ctrl+Alt+V) - Re-inject last text
    const oopsHotkey = deps.store.get('oopsHotkey', 'Ctrl+Alt+V');
    const oopsRet = globalShortcut.register(oopsHotkey, async () => {
      const state = deps.getState();
      if (state.isWarmupLock) {
        logger.warn('HOTKEY', 'Oops blocked: Still warming up');
        return;
      }

      if (state.isRecording) {
        logger.warn('HOTKEY', 'Oops blocked: Currently recording');
        return;
      }

      const pressTimestamp = Date.now();
      logger.debug('HOTKEY', `Oops hotkey pressed [${pressTimestamp}] - re-injecting last text`);

      const pythonManager = deps.getPythonManager();
      if (pythonManager) {
        try {
          const response = await pythonManager.sendCommand('inject_last');
          logger.debug(
            'HOTKEY',
            `inject_last response [${pressTimestamp}]`,
            typeof response === 'object' && response ? { ...response } : { response }
          );

          // Response can be either a number (char_count) or an object
          // Success case: response is the char_count number
          // The sendCommand resolves on success, rejects on failure

          const charCount =
            typeof response === 'number'
              ? response
              : (typeof response === 'object' && response && 'char_count' in response
                  ? (response as { char_count?: number }).char_count
                  : 0) || 0;

          // Play stop sound as confirmation
          const stopSound = deps.store.get('stopSound', 'a');
          if (deps.store.get('soundFeedback', true)) {
            logger.debug('HOTKEY', `Playing stop sound [${pressTimestamp}]: ${stopSound}`);
            playSound(stopSound);
          }
          logger.info('HOTKEY', `Re-injected last text [${pressTimestamp}]`, { charCount });
        } catch (err: unknown) {
          // sendCommand rejects on failure (response.success = false)
          const message = err instanceof Error ? err.message : String(err);
          logger.warn('HOTKEY', 'No text available to re-inject', { error: message });
          deps.showNotification(
            'No Text to Re-inject',
            'No previous text found. Dictate something first.',
            false,
            deps.getIcon
          );
        }
      }
    });

    if (!oopsRet) {
      logger.warn('HOTKEY', 'Failed to register oops hotkey', { hotkey: oopsHotkey });
    } else {
      logger.info('HOTKEY', 'Oops hotkey registered', { hotkey: oopsHotkey });
    }

    // Register Note hotkey (Ctrl+Alt+N) - SPEC_020
    const noteHotkey = deps.store.get('noteHotkey', 'Ctrl+Alt+N');
    const noteRet = globalShortcut.register(noteHotkey, async () => {
      const state = deps.getState();
      if (state.isWarmupLock) {
        logger.warn('HOTKEY', 'Note blocked: Still warming up');
        return;
      }

      // SPEC_038: Block if no model selected
      if (!validateLocalModel()) return;

      const now = Date.now();
      if (now - lastHotkeyPress < HOTKEY_DEBOUNCE_MS) {
        logger.debug('HOTKEY', 'Ignoring debounce note hotkey press');
        return;
      }
      lastHotkeyPress = now;

      logger.debug('HOTKEY', 'Note hotkey pressed', { isRecording: state.isRecording, mode: 'note' });
      await deps.toggleRecording('note');
    });

    if (!noteRet) {
      logger.warn('HOTKEY', 'Failed to register note hotkey', { hotkey: noteHotkey });
    } else {
      logger.info('HOTKEY', 'Note hotkey registered', { hotkey: noteHotkey });
    }
  } catch (error) {
    logger.error('HOTKEY', 'Error registering global hotkeys', error);
    deps.showNotification(
      'Hotkey Error',
      'Failed to register global hotkeys. Please restart the application.',
      true,
      deps.getIcon
    );
  }
}

/**
 * Unregister all global hotkeys (used during cleanup)
 */
export function unregisterAllHotkeys(): void {
  globalShortcut.unregisterAll();
}
