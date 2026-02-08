/**
 * Recording Manager Service
 * Extracted from main.ts as part of GAP 5 (main.ts Monolith Decomposition)
 *
 * Manages recording state and recording/refine workflows
 */

import { BrowserWindow, NativeImage } from 'electron';
import Store from 'electron-store';
import { UserSettings } from '../types/settings';
import { logger } from '../utils/logger';
import { PythonManager } from './pythonManager';
import { showNotification, playSound } from './notificationService';

export type RecordingMode = 'dictate' | 'ask' | 'translate' | 'refine' | 'note';

export interface RecordingManagerDependencies {
  store: Store<UserSettings>;
  getPythonManager: () => PythonManager | null;
  getTrayManager: () => {
    updateTrayIcon: (state: string) => void;
    updateTrayState: (state: string) => void;
    getIcon: (state: string) => NativeImage;
  };
  getDebugWindow: () => BrowserWindow | null;
}

export class RecordingManager {
  private isRecording = false;
  private recordingMode: RecordingMode = 'dictate';
  private isWarmupLock = true;
  private isGlobalMute = false;
  private deps: RecordingManagerDependencies;

  constructor(deps: RecordingManagerDependencies) {
    this.deps = deps;
  }

  // --- State getters ---
  getState(): {
    isRecording: boolean;
    recordingMode: RecordingMode;
    isWarmupLock: boolean;
    isGlobalMute: boolean;
  } {
    return {
      isRecording: this.isRecording,
      recordingMode: this.recordingMode,
      isWarmupLock: this.isWarmupLock,
      isGlobalMute: this.isGlobalMute,
    };
  }

  // --- State setters (called by setupPythonEventHandlers in main.ts) ---
  setIsRecording(v: boolean): void {
    this.isRecording = v;
  }

  setRecordingMode(v: RecordingMode): void {
    this.recordingMode = v;
  }

  setWarmupLock(v: boolean): void {
    this.isWarmupLock = v;
  }

  setGlobalMute(v: boolean): void {
    this.isGlobalMute = v;
  }

  /**
   * Toggle recording state
   * @param mode - 'dictate' for normal dictation, 'ask' for Q&A mode, 'translate' for bidirectional translation, 'refine' for instruction mode, 'note' for Post-It Notes
   */
  async toggleRecording(mode: RecordingMode = 'dictate'): Promise<void> {
    const tray = this.deps.getTrayManager();

    if (this.isWarmupLock) {
      logger.warn('MAIN', 'Recording blocked: App is still warming up');
      showNotification(
        'Warming Up',
        'AI services are still loading... please wait.',
        false,
        tray.getIcon.bind(tray)
      );
      return;
    }

    const pythonManager = this.deps.getPythonManager();
    if (!pythonManager) {
      logger.warn('MAIN', 'Python manager not initialized');
      return;
    }

    // REQ: Proactively block if microphone is muted
    if (this.isGlobalMute && !this.isRecording) {
      logger.warn('MAIN', 'Recording blocked: Microphone is muted (Frontend Check)');
      showNotification(
        '🔇 Microphone Muted',
        'Your microphone is muted. Please unmute to dictate.',
        true,
        tray.getIcon.bind(tray)
      );
      // Beep to indicate failure
      if (this.deps.store.get('soundFeedback')) {
        // Use a distinct error sound or just the stop sound
        playSound('c');
      }
      return;
    }

    if (this.isRecording) {
      // Play feedback sound
      if (this.deps.store.get('soundFeedback')) {
        const sound =
          this.recordingMode === 'ask' ||
          this.recordingMode === 'translate' ||
          this.recordingMode === 'refine' ||
          this.recordingMode === 'note'
            ? this.deps.store.get('askSound')
            : this.deps.store.get('stopSound');
        playSound(sound);
      }

      // Stop recording
      logger.info('MAIN', 'Stopping recording', { mode: this.recordingMode });
      this.isRecording = false;
      tray.updateTrayIcon('processing');
      tray.updateTrayState(
        this.recordingMode === 'ask'
          ? 'Thinking...'
          : this.recordingMode === 'translate'
            ? 'Translating...'
            : this.recordingMode === 'refine'
              ? 'Refining...'
              : this.recordingMode === 'note'
                ? 'Saving Note...'
                : 'Processing'
      );

      try {
        await pythonManager.sendCommand('stop_recording');
      } catch (error) {
        logger.error('MAIN', 'Failed to stop recording', error);
        tray.updateTrayIcon('idle');
        tray.updateTrayState('Idle');
      }
    } else {
      // Start recording
      this.recordingMode = mode;
      logger.info('MAIN', 'Starting recording', { mode });
      this.isRecording = true;
      tray.updateTrayIcon('recording');
      tray.updateTrayState(
        mode === 'ask'
          ? 'Listening (Ask)'
          : mode === 'translate'
            ? 'Listening (Translate)'
            : mode === 'refine'
              ? 'Listening (Instruction)'
              : mode === 'note'
                ? 'Taking Note...'
                : 'Recording'
      );

      // Notify status window of mode change
      const debugWindow = this.deps.getDebugWindow();
      if (debugWindow && !debugWindow.isDestroyed()) {
        debugWindow.webContents.send('mode-update', mode);
      }

      try {
        // Get preferred device ID and Label
        const audioDeviceId = this.deps.store.get('audioDeviceId');
        const audioDeviceLabel = this.deps.store.get('audioDeviceLabel');
        const maxDuration = this.deps.store.get('maxRecordingDuration', 60); // Default: 60 seconds

        // Play feedback sound (Moved here to ensure it only plays if NOT blocked)
        if (this.deps.store.get('soundFeedback')) {
          const sound =
            mode === 'ask' || mode === 'translate' || mode === 'refine' || mode === 'note'
              ? this.deps.store.get('askSound')
              : this.deps.store.get('startSound');
          playSound(sound);
        }

        await pythonManager.sendCommand('start_recording', {
          deviceId: audioDeviceId,
          deviceLabel: audioDeviceLabel,
          mode: mode, // Pass the mode to Python
          maxDuration: maxDuration, // Pass max duration setting
        });
      } catch (error: unknown) {
        logger.error('MAIN', 'Failed to start recording', { error: String(error) });
        this.isRecording = false;
        tray.updateTrayIcon('idle');
        tray.updateTrayState('Idle');

        // SPEC_014: Don't show generic error if it's just a muted mic (handle race condition)
        if (error instanceof Error && error.message.includes('Microphone is muted')) {
          showNotification(
            '🔇 Microphone Muted',
            'Your microphone is muted. Please unmute to dictate.',
            true,
            tray.getIcon.bind(tray)
          );
          // Play error sound to cancel out the start sound
          if (this.deps.store.get('soundFeedback')) {
            playSound('c');
          }
          return;
        }

        showNotification(
          'Recording Error',
          'Failed to start recording. Please try again.',
          true,
          tray.getIcon.bind(tray)
        );
      }
    }
  }

  /**
   * Handle refine selection (Ctrl+Alt+R)
   * Captures selected text, processes it with LLM, and pastes refined version
   */
  handleRefineSelection(): void {
    const pythonManager = this.deps.getPythonManager();
    if (!pythonManager) {
      logger.error('MAIN', 'Python manager not initialized');
      return;
    }

    logger.info('MAIN', 'Refine selection triggered');

    const tray = this.deps.getTrayManager();

    // Update tray to processing state
    tray.updateTrayIcon('processing');
    tray.updateTrayState('Refining...');

    // Play start sound if enabled
    if (this.deps.store.get('soundFeedback')) {
      playSound(this.deps.store.get('startSound', 'a'));
    }

    // Send refine command to Python
    // Note: Success/error handling is done via events (refine-success, refine-error)
    pythonManager.sendCommand('refine_selection').catch((err) => {
      logger.error('MAIN', 'Refine command failed', err);
      this.handleRefineError(err.message || 'Unknown error');
    });
  }

  /**
   * Handle refine errors with notifications
   */
  handleRefineError(error: string): void {
    const tray = this.deps.getTrayManager();

    // Play error sound
    if (this.deps.store.get('soundFeedback')) {
      playSound('error');
    }

    // Determine error message
    let errorMessage = 'Refine mode failed. Please try again.';

    if (error === 'EMPTY_SELECTION') {
      errorMessage = 'No text selected. Please highlight text and try again.';
    } else if (
      error.includes('processor') ||
      error.includes('Ollama') ||
      error === 'NO_PROCESSOR'
    ) {
      errorMessage = 'Text processing failed. Check that Ollama is running.';
    } else if (error.includes('PROCESSING_FAILED')) {
      errorMessage = 'LLM processing failed. Please try again.';
    }

    // Show notification
    showNotification('Refine Mode', errorMessage, true, tray.getIcon.bind(tray));

    // Flash tray red, then return to idle
    tray.updateTrayIcon('error');
    tray.updateTrayState('Error');

    setTimeout(() => {
      tray.updateTrayIcon('idle');
      tray.updateTrayState('Idle');
    }, 2000);
  }
}
