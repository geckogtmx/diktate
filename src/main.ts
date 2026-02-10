/**
 * Main Electron process for dIKtate
 * Handles system tray, Python subprocess, and global hotkey
 */

import { app, clipboard, shell } from 'electron';
import * as dotenv from 'dotenv';
// Fix for Windows Notifications (missing AUMID causes silent failure)
if (process.platform === 'win32') {
  app.setAppUserModelId('com.gecko.diktate');
}
dotenv.config();

import * as path from 'path';
import * as fs from 'fs';
import { PythonManager } from './services/pythonManager';
import { logger, LogLevel } from './utils/logger';
import { performanceMetrics } from './utils/performanceMetrics';

import Store from 'electron-store';
import type {
  StartupProgressEvent,
  PerformanceMetricsEvent,
  DictationSuccessEvent,
  SystemMetricsEvent,
  StatusCheckEvent,
  NoteSavedEvent,
  AskResponseEvent,
  ProcessorFallbackEvent,
  RecordingAutoStoppedEvent,
  MicMutedEvent,
  MicStatusEvent,
  ApiErrorEvent,
  RefineSuccessEvent,
  RefineErrorEvent,
  RefineInstructionSuccessEvent,
  RefineInstructionFallbackEvent,
  RefineInstructionErrorEvent,
} from './types/pythonEvents';
import { UserSettings, USER_SETTINGS_DEFAULTS } from './types/settings';
import { migrateToDualProfileSystem } from './services/settingsMigration';
import { showNotification, playSound } from './services/notificationService';
import { TrayManager } from './services/trayManager';
import { setupGlobalHotkeys, unregisterAllHotkeys } from './services/hotkeyManager';
import { RecordingManager } from './services/recordingManager';
import { WindowManager } from './services/windowManager';
import { I18nService } from './services/i18n';
import {
  syncPythonConfig as syncPythonConfigImpl,
  ConfigSyncDependencies,
} from './services/configSync';
import { registerCoreIpcHandlers, registerI18nHandlers } from './ipc/handlers';
import { registerApiKeyHandlers } from './ipc/apiKeyHandlers';
import { registerOllamaHandlers } from './ipc/ollamaHandlers';
import { registerTrialHandlers, handleAuthDeeplink } from './ipc/trialHandlers';

// ============================================
// SPEC_042: Register diktate:// deep-link protocol
// Must be set before app.requestSingleInstanceLock()
// ============================================
app.setAsDefaultProtocolClient('diktate');

// ============================================
// Single Instance Lock - Prevent multiple instances
// ============================================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running - exit immediately
  console.log('dIKtate is already running. Exiting this instance...');
  process.exit(0);
}

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

// Initialize Store with defaults (types and defaults imported from ./types/settings)
const store = new Store<UserSettings>({
  defaults: USER_SETTINGS_DEFAULTS,
});

// Initialize Store with defaults
// Migration for SPEC_020 (Path cleanup)
const currentPath = store.get('noteFilePath');
if (
  currentPath === '~/diktate-notes.md' ||
  currentPath === '~\\diktate-notes.md' ||
  (currentPath && currentPath.endsWith('diktate-notes.md') && !currentPath.includes('.diktate'))
) {
  logger.info('MAIN', 'Migrating noteFilePath to .diktate folder', { from: currentPath });
  store.set('noteFilePath', '~/.diktate/notes.md');
}

// Migration for notePrompt (Missing {text} placeholder fix)
const currentPrompt = store.get('notePrompt');
if (currentPrompt && !currentPrompt.includes('{text}')) {
  logger.info('MAIN', 'Migrating notePrompt to include required {text} placeholder');
  const fixedPrompt = currentPrompt + '\n\nInput: {text}\nNote:';
  store.set('notePrompt', fixedPrompt);
}

// Run the dual-profile migration (SPEC_034_EXTRAS)
migrateToDualProfileSystem(store);

// Migration: Strip 'models/' prefix from cloud model settings (SPEC_042 UI fix)
const cloudModelKeys = [
  'cloudModel_standard',
  'cloudModel_prompt',
  'cloudModel_professional',
  'cloudModel_ask',
  'cloudModel_refine',
  'cloudModel_refine_instruction',
  'cloudModel_raw',
  'cloudModel_note',
] as const;

let migratedModels = false;
for (const key of cloudModelKeys) {
  const currentValue = store.get(key);
  if (currentValue && typeof currentValue === 'string' && currentValue.startsWith('models/')) {
    const cleanValue = currentValue.replace('models/', '');
    store.set(key, cleanValue);
    migratedModels = true;
    logger.info('MAIN', `Migrated ${key}: ${currentValue} → ${cleanValue}`);
  }
}
if (migratedModels) {
  logger.info('MAIN', 'Cloud model settings migrated to remove models/ prefix');
}

let trayManager: TrayManager;
let pythonManager: PythonManager | null = null;
let recordingManager: RecordingManager;
let windowManager: WindowManager;
let i18nService: I18nService;

// Window creation functions moved to src/services/windowManager.ts

/**
 * Handle Python manager events
 */
function setupPythonEventHandlers(): void {
  if (!pythonManager) return;

  pythonManager.on('state-change', (state: string) => {
    logger.info('MAIN', 'Python state changed', { state });

    // forward state to loading window if it exists
    if (windowManager.getLoadingWindow() && !windowManager.getLoadingWindow()!.isDestroyed()) {
      windowManager.getLoadingWindow()!.webContents.send('startup-progress', {
        message: `System State: ${state.toUpperCase()}`,
      });
    }

    // Release lock on first transition to idle after warmup
    if (recordingManager.getState().isWarmupLock && state === 'idle') {
      recordingManager.setWarmupLock(false);
      logger.info('MAIN', 'Warmup lock released - App is fully ready');

      // Defer notification and status sync to avoid event loop starvation
      // This is the FINAL truth-in-UI signal: Only show when everything is IDLE
      setTimeout(() => {
        showNotification(
          'dIKtate Ready',
          'AI Engine loaded. Press Ctrl+Alt+D to start.',
          false,
          trayManager.getIcon.bind(trayManager)
        );

        // SPEC_035: Signal loading window to show ready state ONLY when we are truly responsive
        if (windowManager.getLoadingWindow() && !windowManager.getLoadingWindow()!.isDestroyed()) {
          windowManager.getLoadingWindow()!.webContents.send('startup-complete');
        }

        if (pythonManager) {
          pythonManager
            .sendCommand('status')
            .then((result) => {
              if (
                typeof result === 'object' &&
                result &&
                'success' in result &&
                'data' in result &&
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (result as any).success &&
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (result as any).data
              ) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                logger.info('MAIN', 'Status synced on ready', (result as any).data);
              }
            })
            .catch((err) => logger.error('MAIN', 'Failed to fetch status on ready', err));
        }
      }, 200);
    }

    trayManager.updateTrayState(state);
    trayManager.updateTrayIcon(state);
  });

  // SPEC_035: Forward granular progress to loading window (now simplified to single status)
  pythonManager.on('startup-progress', (data: StartupProgressEvent) => {
    if (windowManager.getLoadingWindow() && !windowManager.getLoadingWindow()!.isDestroyed()) {
      windowManager.getLoadingWindow()!.webContents.send('startup-progress', data);
    }
  });

  pythonManager.on('startup-complete', () => {
    if (windowManager.getLoadingWindow() && !windowManager.getLoadingWindow()!.isDestroyed()) {
      windowManager.getLoadingWindow()!.webContents.send('startup-complete');
    }
  });

  pythonManager.on('error', (error: Error) => {
    logger.error('MAIN', 'Python error occurred', error);
    showNotification(
      'dIKtate Error',
      `An error occurred: ${error.message}`,
      true,
      trayManager.getIcon.bind(trayManager)
    );
    trayManager.updateTrayState('Error');
  });

  pythonManager.on('fatal-error', (error: Error) => {
    logger.error('MAIN', 'Fatal Python error - connection lost', error);
    showNotification(
      'dIKtate - Connection Lost',
      'Python backend connection lost. Please restart the application.',
      true,
      trayManager.getIcon.bind(trayManager)
    );
    trayManager.updateTrayState('Disconnected');
  });

  pythonManager.on('ready', () => {
    logger.info('MAIN', 'Python manager process spawned');
    // REMOVED premature 'Ready' notification here to prevent UX stall (UX_001)
  });

  pythonManager.on('disconnected', () => {
    logger.warn('MAIN', 'Python process disconnected, attempting reconnection');
    trayManager.updateTrayState('Reconnecting...');
  });

  pythonManager.on('performance-metrics', (metrics: PerformanceMetricsEvent) => {
    logger.info('MAIN', 'Performance metrics received from Python', { ...metrics });

    // Forward to renderer for dashboard display
    if (windowManager.getDebugWindow() && !windowManager.getDebugWindow()!.isDestroyed()) {
      windowManager.getDebugWindow()!.webContents.send('performance-metrics', metrics);
    }

    // Log average performance statistics
    const stats = performanceMetrics.getStatistics();
    if (stats.averages) {
      logger.info('MAIN', 'Average performance', { ...stats.averages });
    }
  });

  // Track quota for main dictation (SPEC_016 Phase 4) - REMOVED
  pythonManager.on('dictation-success', (data: DictationSuccessEvent) => {
    logger.info('MAIN', 'Dictation success event received', {
      charCount: data.char_count,
      mode: data.mode,
    });
  });

  // Southbound metrics
  pythonManager.on('system-metrics', (data: SystemMetricsEvent) => {
    const { phase, activity_count, metrics } = data;

    if (!metrics) return;

    // Special notation for sampled metrics
    const logPrefix =
      phase === 'post-activity'
        ? `[SAMPLED #${activity_count}]`
        : phase && phase.startsWith('during-')
          ? `[SAMPLED #${activity_count} ${phase}]`
          : `[${phase}]`;

    // Log to file for beta analysis - Clean format
    const gpuInfo = metrics.gpu_available
      ? `${metrics.gpu_device_name} (${metrics.gpu_memory_percent}%)`
      : 'N/A';

    logger.info(
      'SystemMetrics',
      `${logPrefix} CPU: ${metrics.cpu_percent}% | Memory: ${metrics.memory_percent}% | GPU: ${gpuInfo}`
    );

    // Forward to debug dashboard if open
    if (windowManager.getDebugWindow() && !windowManager.getDebugWindow()!.isDestroyed()) {
      windowManager
        .getDebugWindow()!
        .webContents.send('system-metrics', { phase, activity_count, metrics });
    }
  });

  // Listen for explicit status responses if we implement polling
  pythonManager.on('status-check', (statusData: StatusCheckEvent) => {
    if (windowManager.getDebugWindow() && !windowManager.getDebugWindow()!.isDestroyed()) {
      windowManager.getDebugWindow()!.webContents.send('badge-update', {
        transcriber: statusData.transcriber,
        processor: statusData.processor,
      });
    }
  });

  // Handle note saved event (SPEC_020)
  pythonManager.on('note-saved', (data: NoteSavedEvent) => {
    const filePath = data.filePath || data.filepath;
    logger.info('MAIN', 'Note saved event received', { filePath });

    if (!filePath) return;

    // Play success sound
    if (store.get('soundFeedback', true)) {
      playSound(store.get('stopSound', 'a'));
    }

    // Show notification (note: click-to-open not supported with showNotification helper)
    showNotification(
      'Note Saved',
      `Appended to ${path.basename(filePath)}`,
      false,
      trayManager.getIcon.bind(trayManager)
    );
  });

  // Handle Ask Mode responses
  pythonManager.on('ask-response', async (response: AskResponseEvent) => {
    logger.info('MAIN', 'Ask response received', { success: response.success });

    // Reset recording state
    recordingManager.setIsRecording(false);
    trayManager.updateTrayIcon('idle');
    trayManager.updateTrayState('Idle');

    if (!response.success) {
      showNotification(
        'Ask Failed',
        response.error || 'Unknown error',
        true,
        trayManager.getIcon.bind(trayManager)
      );
      return;
    }

    const { question, answer } = response;
    const outputMode = store.get('askOutputMode') || 'clipboard';

    if (!answer) {
      showNotification(
        'Ask Failed',
        'No answer received',
        true,
        trayManager.getIcon.bind(trayManager)
      );
      return;
    }

    logger.info('MAIN', 'Delivering ask response', { outputMode, answerLength: answer.length });

    // Deliver based on output mode
    switch (outputMode) {
      case 'clipboard':
        // Copy to clipboard
        clipboard.writeText(answer);
        showNotification(
          'Answer Ready',
          `${answer.substring(0, 100)}${answer.length > 100 ? '...' : ''}\n\n📋 Copied to clipboard!`,
          false,
          trayManager.getIcon.bind(trayManager)
        );
        break;

      case 'type':
        // Type the answer (like dictation)
        if (pythonManager) {
          try {
            await pythonManager.sendCommand('inject_text', { text: answer });
          } catch (err) {
            logger.error('MAIN', 'Failed to inject text for Ask response', err);
            showNotification(
              'Injection Failed',
              'Could not type the answer automatically.',
              true,
              trayManager.getIcon.bind(trayManager)
            );
          }
        }
        break;

      case 'notification':
        // Just show notification
        showNotification('Answer', answer, false, trayManager.getIcon.bind(trayManager));
        break;

      case 'clipboard+notify':
      default:
        // Both clipboard and notification
        clipboard.writeText(answer);
        showNotification(
          'Answer Ready',
          `${answer.substring(0, 150)}${answer.length > 150 ? '...' : ''}\n\n📋 Copied to clipboard!`,
          false,
          trayManager.getIcon.bind(trayManager)
        );
        break;
    }

    // Forward to debug window if open
    if (windowManager.getDebugWindow() && !windowManager.getDebugWindow()!.isDestroyed()) {
      windowManager.getDebugWindow()!.webContents.send('ask-response', { question, answer });
    }
  });

  // Handle processor fallback (error recovery)
  pythonManager.on('processor-fallback', (data: ProcessorFallbackEvent) => {
    const { reason, consecutive_failures, using_raw } = data;

    logger.warn('MAIN', 'Processor fallback triggered', { reason, consecutive_failures });

    // Show notification to user
    const title =
      consecutive_failures === 1
        ? 'Processing Failed'
        : `Processing Failed (${consecutive_failures}x)`;
    const message = using_raw
      ? `Using raw transcription instead.\n\nReason: ${reason.split(':')[0]}`
      : `LLM unavailable.\n\nReason: ${reason.split(':')[0]}`;

    showNotification(title, message, false, trayManager.getIcon.bind(trayManager));

    // If 3+ consecutive failures, suggest checking Ollama
    if (consecutive_failures && consecutive_failures >= 3) {
      showNotification(
        'Repeated Failures Detected',
        'Consider checking if Ollama is running or switching to Cloud mode in Settings.',
        true,
        trayManager.getIcon.bind(trayManager)
      );
    }
  });

  // Handle recording auto-stop (duration limit reached)
  pythonManager.on('recording-auto-stopped', (data: RecordingAutoStoppedEvent) => {
    const { max_duration } = data;

    logger.info('MAIN', 'Recording auto-stopped', { max_duration });

    // Force stop recording state
    recordingManager.setIsRecording(false);
    trayManager.updateTrayIcon('processing');
    trayManager.updateTrayState('Processing');

    // Show notification
    const durationText =
      max_duration === 60
        ? '1 minute'
        : max_duration === 120
          ? '2 minutes'
          : `${max_duration} seconds`;
    showNotification(
      'Recording Auto-Stopped',
      `Maximum recording duration (${durationText}) reached.\n\nProcessing your dictation now...`,
      false,
      trayManager.getIcon.bind(trayManager)
    );
  });

  pythonManager.on('mic-muted', (data: MicMutedEvent) => {
    const { message } = data;

    logger.warn('MAIN', 'Microphone muted detected');

    // Force stop recording state
    recordingManager.setIsRecording(false);
    trayManager.updateTrayIcon('idle');
    trayManager.updateTrayState('Ready');

    // Show notification
    showNotification(
      '🔇 Microphone Muted',
      message || 'Your microphone is muted. Please unmute and try again.',
      true,
      trayManager.getIcon.bind(trayManager)
    );
  });

  pythonManager.on('mic-status', (data: MicStatusEvent) => {
    const { muted } = data;

    logger.info('MAIN', `Microphone status: ${muted ? 'MUTED' : 'ACTIVE'}`);

    // Update tray tooltip
    if (muted) {
      trayManager.setTooltip('dIKtate - ⚠️ Microphone Muted');
    } else {
      trayManager.updateTrayTooltip();
    }

    // REQ: Update global state
    recordingManager.setGlobalMute(muted);
  });

  // Handle API errors from Python (OAuth, rate limits, network)
  pythonManager.on('api-error', (data: ApiErrorEvent) => {
    logger.error('MAIN', 'API error received from Python', { ...data });

    if (data.error_type === 'trial_quota_exceeded') {
      showNotification(
        'Trial Credits Used Up',
        'Your free trial words have run out. Visit dikta.me to upgrade.',
        true,
        trayManager.getIcon.bind(trayManager)
      );
      shell.openExternal('https://dikta.me/dashboard').catch(() => {});
      return;
    }

    if (data.error_type === 'oauth_token_invalid' && data.provider === 'trial') {
      showNotification(
        'Trial Session Expired',
        'Your dikta.me session has expired. Please sign in again.',
        true,
        trayManager.getIcon.bind(trayManager)
      );
      // Clear the stale token
      store.delete('encryptedTrialSessionToken' as keyof UserSettings);
      const sw = windowManager.getSettingsWindow();
      if (sw && !sw.isDestroyed()) sw.webContents.send('trial:status-updated');
      return;
    }

    // Generic API error fallback
    showNotification(
      'API Error',
      `Error: ${data.error_message || data.message || 'Unknown error'}`,
      true,
      trayManager.getIcon.bind(trayManager)
    );
  });

  // Handle refine mode success
  pythonManager.on('refine-success', (data: RefineSuccessEvent) => {
    logger.info('MAIN', 'Refine success event received', { ...data });

    // Log metrics (refine uses separate workflow from dictation pipeline)
    if (data.charCount) {
      logger.info('MAIN', 'Refine metrics', {
        total: data.total,
        capture: data.capture,
        processing: data.processing,
        injection: data.injection,
        charCount: data.charCount,
      });
    }

    // Track quota usage logic removed (SPEC_016)
  });

  // Handle refine mode errors
  pythonManager.on('refine-error', (data: RefineErrorEvent) => {
    logger.error('MAIN', 'Refine error event received', data);
    recordingManager.handleRefineError(data.error || data.message || data.code || 'Unknown error');
  });

  // Handle refine instruction mode success (SPEC_025)
  pythonManager.on('refine-instruction-success', (data: RefineInstructionSuccessEvent) => {
    logger.info('MAIN', 'Refine instruction success', {
      instruction: data.instruction,
      originalLength: data.original_length,
      refinedLength: data.refined_length,
      metrics: data.metrics,
    });

    // Reset state
    recordingManager.setIsRecording(false);
    trayManager.updateTrayIcon('idle');
    trayManager.updateTrayState('Idle');

    // Show success notification
    const instructionPreview = data.instruction.substring(0, 50);
    const origLen = data.original_length || data.original_text.length;
    const refinedLen = data.refined_length || data.refined_text.length;
    showNotification(
      'Text Refined',
      `✨ "${instructionPreview}${data.instruction.length > 50 ? '...' : ''}"\n\n${origLen} → ${refinedLen} chars`,
      false,
      trayManager.getIcon.bind(trayManager)
    );

    // Log performance metrics
    if (data.metrics) {
      logger.info('MAIN', 'Refine instruction metrics', { ...data.metrics });
    }
  });

  // Handle refine instruction mode fallback (no selection - Ask mode)
  pythonManager.on('refine-instruction-fallback', async (data: RefineInstructionFallbackEvent) => {
    logger.info('MAIN', 'Refine instruction fallback to Ask mode', {
      instruction: data.instruction,
      answerLength: data.answer?.length,
    });

    // Reset state
    recordingManager.setIsRecording(false);
    trayManager.updateTrayIcon('idle');
    trayManager.updateTrayState('Idle');

    const { instruction, answer } = data;

    if (!answer) {
      showNotification(
        'Refine Failed',
        'No answer received',
        true,
        trayManager.getIcon.bind(trayManager)
      );
      return;
    }

    // Copy answer to clipboard (already done in Python, but ensure it's done)
    clipboard.writeText(answer);

    // Show notification
    showNotification(
      'No Selection - Answer Ready',
      `💡 "${instruction.substring(0, 60)}${instruction.length > 60 ? '...' : ''}"\n\n${answer.substring(0, 100)}${answer.length > 100 ? '...' : ''}\n\n📋 Copied to clipboard!`,
      false,
      trayManager.getIcon.bind(trayManager)
    );

    // Forward to debug window if open
    if (windowManager.getDebugWindow() && !windowManager.getDebugWindow()!.isDestroyed()) {
      windowManager
        .getDebugWindow()!
        .webContents.send('refine-instruction-fallback', { instruction, answer });
    }
  });

  // Handle refine instruction mode errors (SPEC_025)
  pythonManager.on('refine-instruction-error', (data: RefineInstructionErrorEvent) => {
    logger.error('MAIN', 'Refine instruction error', {
      code: data.code,
      error: data.error,
    });

    // Reset state
    recordingManager.setIsRecording(false);
    trayManager.updateTrayIcon('idle');
    trayManager.updateTrayState('Idle');

    // Determine error message based on code
    let errorMessage = 'Failed to refine text with instruction';
    if (data.code) {
      if (data.code === 'EMPTY_INSTRUCTION') {
        errorMessage = 'No instruction detected. Please speak clearly and try again.';
      } else if (data.code === 'NO_PROCESSOR') {
        errorMessage = 'Text processing unavailable. Check that Ollama is running.';
      } else if (data.code === 'PROCESSING_FAILED') {
        errorMessage = 'LLM processing failed. Please try again.';
      }
    } else if (data.error) {
      errorMessage = data.error;
    }

    // Show error notification
    showNotification(
      'Refine Instruction Failed',
      errorMessage,
      true,
      trayManager.getIcon.bind(trayManager)
    );
  });
}

// SPEC_042: Handle diktate:// deeplink URL (auth callback)
function handleDeeplink(url: string): void {
  logger.info('MAIN', `Deeplink received: ${url.replace(/token=[^&]+/, 'token=REDACTED')}`);
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'auth') {
      const token = parsed.searchParams.get('token');
      if (token) {
        const trialDeps = {
          store,
          notifySettingsWindow: (event: string, data?: unknown) => {
            const sw = windowManager.getSettingsWindow();
            if (sw && !sw.isDestroyed()) {
              sw.webContents.send(event, data);
            }
          },
          syncPythonConfig,
        };
        handleAuthDeeplink(token, store, trialDeps).catch((err) =>
          logger.error('MAIN', 'Deeplink auth handling failed', err)
        );
      }
    }
  } catch (err) {
    logger.error('MAIN', 'Failed to parse deeplink URL', err);
  }
}

// Config sync functions moved to src/services/configSync.ts

/** Convenience wrapper that provides current dependencies to syncPythonConfig */
function getConfigSyncDeps(): ConfigSyncDependencies {
  return {
    store,
    getPythonManager: () => pythonManager,
    getDebugWindow: () => windowManager.getDebugWindow(),
  };
}

function syncPythonConfig(): Promise<void> {
  return syncPythonConfigImpl(getConfigSyncDeps());
}

// IPC handlers moved to src/ipc/ directory
// Recording functions moved to src/services/recordingManager.ts

/**
 * Initialize the application
 */
async function initialize(): Promise<void> {
  // Loading window already created in app.on('ready') via windowManager
  try {
    // Initialize logger first
    logger.initialize();
    logger.info('MAIN', 'Starting dIKtate initialization');

    // Create user data directory for logs
    const userDataPath = app.getPath('userData');
    const logsPath = path.join(userDataPath, 'logs');
    if (!fs.existsSync(logsPath)) {
      fs.mkdirSync(logsPath, { recursive: true });
    }

    // Set console threshold: DEBUG for dev/debug modes, INFO for production
    // This prevents synchronous console.log from blocking the loop during bursts
    if (isDev || process.env.DEBUG === '1') {
      logger.setConsoleThreshold(LogLevel.DEBUG);
    } else {
      logger.setConsoleThreshold(LogLevel.INFO);
    }

    // Initialize i18n service BEFORE other services
    i18nService = new I18nService({ store, app });
    await i18nService.initialize();
    logger.info('MAIN', 'i18n service initialized');

    // Initialize tray manager
    trayManager = new TrayManager({
      store,
      i18n: i18nService,
      getWindows: () => windowManager.getWindows(),
      createDebugWindow: () => windowManager.createDebugWindow(),
      createSettingsWindow: () => windowManager.createSettingsWindow(),
    });
    trayManager.initializeTray();
    logger.info('MAIN', 'System tray initialized');

    // Initialize recording manager
    recordingManager = new RecordingManager({
      store,
      getPythonManager: () => pythonManager,
      getTrayManager: () => trayManager,
      getDebugWindow: () => windowManager.getDebugWindow(),
    });
    logger.info('MAIN', 'Recording manager initialized');

    // Hook up logger to window - will be active once window is created later
    logger.setLogCallback((level, message, data) => {
      const dw = windowManager.getDebugWindow();
      if (dw && !dw.isDestroyed()) {
        dw.webContents.send('log-message', { level, message, data });
      }
    });

    // Setup IPC handlers (extracted to src/ipc/)
    registerCoreIpcHandlers({
      store,
      getPythonManager: () => pythonManager,
      getDebugWindow: () => windowManager.getDebugWindow(),
      getIcon: trayManager.getIcon.bind(trayManager),
      recordingManager,
      syncPythonConfig,
      reregisterHotkeys: () =>
        setupGlobalHotkeys({
          store,
          showNotification,
          toggleRecording: recordingManager.toggleRecording.bind(recordingManager),
          handleRefineSelection: recordingManager.handleRefineSelection.bind(recordingManager),
          getPythonManager: () => pythonManager,
          getState: () => recordingManager.getState(),
          getIcon: trayManager.getIcon.bind(trayManager),
        }),
      getI18n: () => i18nService,
    });
    registerApiKeyHandlers({
      store,
      getPythonManager: () => pythonManager,
    });
    registerOllamaHandlers({ store });
    registerTrialHandlers({
      store,
      notifySettingsWindow: (event: string, data?: unknown) => {
        const sw = windowManager.getSettingsWindow();
        if (sw && !sw.isDestroyed()) {
          sw.webContents.send(event, data);
        }
      },
      syncPythonConfig,
    });
    registerI18nHandlers({
      store,
      getPythonManager: () => pythonManager,
      getDebugWindow: () => windowManager.getDebugWindow(),
      getIcon: trayManager.getIcon.bind(trayManager),
      recordingManager,
      syncPythonConfig,
      reregisterHotkeys: () =>
        setupGlobalHotkeys({
          store,
          showNotification,
          toggleRecording: recordingManager.toggleRecording.bind(recordingManager),
          handleRefineSelection: recordingManager.handleRefineSelection.bind(recordingManager),
          getPythonManager: () => pythonManager,
          getState: () => recordingManager.getState(),
          getIcon: trayManager.getIcon.bind(trayManager),
        }),
      getI18n: () => i18nService,
    });
    logger.info('MAIN', 'IPC handlers registered');

    // Setup global hotkeys
    setupGlobalHotkeys({
      store,
      showNotification,
      toggleRecording: recordingManager.toggleRecording.bind(recordingManager),
      handleRefineSelection: recordingManager.handleRefineSelection.bind(recordingManager),
      getPythonManager: () => pythonManager,
      getState: () => recordingManager.getState(),
      getIcon: trayManager.getIcon.bind(trayManager),
    });

    // Initialize Python manager
    let pythonExePath: string;
    let pythonScriptPath: string;

    if (isDev) {
      pythonExePath = path.join(__dirname, '..', 'python', 'venv', 'Scripts', 'python.exe');
      pythonScriptPath = path.join(__dirname, '..', 'python', 'ipc_server.py');
      logger.info('MAIN', 'Running in DEVELOPMENT mode');
    } else {
      // Production - use bundled executable
      pythonExePath = path.join(process.resourcesPath, 'bin', 'diktate-engine.exe');
      pythonScriptPath = '';
      logger.info('MAIN', 'Running in PRODUCTION mode');
    }

    logger.info('MAIN', 'Initializing Python manager', { pythonExePath, pythonScriptPath });
    pythonManager = new PythonManager(pythonExePath, pythonScriptPath);
    setupPythonEventHandlers();

    // SPEC_035: Status update for UI
    if (windowManager.getLoadingWindow() && !windowManager.getLoadingWindow()!.isDestroyed()) {
      windowManager.getLoadingWindow()!.webContents.send('startup-progress', {
        message: 'Starting AI Engine...',
        progress: 5,
      });
    }

    // Yield before backend orchestration
    await new Promise((resolve) => setImmediate(resolve));

    // SPEC_041: Get whisperModel setting before starting Python
    const whisperModel = store.get('whisperModel', 'turbo');
    logger.info('MAIN', 'Starting Python with Whisper model', { whisperModel });
    await pythonManager.start(whisperModel);

    // Yield after process spawn
    await new Promise((resolve) => setImmediate(resolve));

    // Fire config sync without blocking - prevents "not responding" freeze
    // Python will continue initializing in background while loading window stays responsive
    syncPythonConfig().catch((err) => {
      logger.error('MAIN', 'Failed to sync config to Python', err);
    });

    logger.info('MAIN', 'dIKtate initialized (config sync in progress)');
  } catch (error) {
    logger.error('MAIN', 'Failed to initialize application', error);
    showNotification(
      'dIKtate Startup Failed',
      'Application failed to start. Check logs for details.',
      true,
      trayManager.getIcon.bind(trayManager)
    );
    setTimeout(() => app.quit(), 3000); // Give time to show notification
  }
}

/**
 * App ready
 */
app.on('ready', () => {
  // Create window manager early so loading window can be shown before full initialization
  windowManager = new WindowManager({
    getIcon: (state: string) => trayManager?.getIcon(state),
    getPythonManager: () => pythonManager,
  });

  // Handle when user tries to open a second instance
  // On Windows, deeplinks (diktate://...) arrive here as a second-instance launch
  app.on('second-instance', (_event, argv) => {
    // Check if this is a deeplink callback (SPEC_042)
    const deeplink = argv.find((arg) => arg.startsWith('diktate://'));
    if (deeplink) {
      handleDeeplink(deeplink);
      return;
    }

    // Not a deeplink — show already-running notification
    showNotification(
      'dIKtate Already Running',
      'One instance is already running. Check your system tray.',
      false,
      trayManager.getIcon.bind(trayManager)
    );

    // Focus the settings window if it exists
    const sw = windowManager.getSettingsWindow();
    if (sw && !sw.isDestroyed()) {
      if (sw.isMinimized()) sw.restore();
      sw.focus();
    }
  });

  // macOS / Linux: deeplink arrives via open-url event (SPEC_042)
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (url.startsWith('diktate://')) {
      handleDeeplink(url);
    }
  });
  // SPEC_035: Show loading window first
  windowManager.createLoadingWindow();

  // Yield to allow UI to paint before heavy initialization
  setTimeout(() => {
    initialize();
  }, 300);
});

/**
 * Quit when all windows are closed
 */
app.on('window-all-closed', () => {
  // dIKtate runs in the system tray, so we don't quit when all windows are closed.
  // The app will stay alive until explicitly quit from the tray menu.
});

/**
 * Clean up on quit
 */
app.on('before-quit', async () => {
  logger.info('MAIN', 'Application shutting down');

  // Unregister global hotkeys
  unregisterAllHotkeys();
  logger.info('MAIN', 'Global hotkeys unregistered');

  // Cleanup performed
  if (pythonManager) {
    await pythonManager.stop();
    logger.info('MAIN', 'Python manager stopped');
  }

  // Close logger
  logger.close();
});

// Initial startup message (before logger is initialized)
console.log('[MAIN] dIKtate Electron main process starting...');
