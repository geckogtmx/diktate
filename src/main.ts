/**
 * Main Electron process for dIKtate
 * Handles system tray, Python subprocess, and global hotkey
 */

import { app, Tray, Menu, ipcMain, globalShortcut, BrowserWindow, Notification, nativeImage, NativeImage, shell, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { PythonManager } from './services/pythonManager';
import { logger } from './utils/logger';
import { performanceMetrics } from './utils/performanceMetrics';

import Store from 'electron-store';
import { validateIpcMessage, SettingsSetSchema, ApiKeySetSchema, ApiKeyTestSchema, redactSensitive } from './utils/ipcSchemas';

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

// Types for Settings
interface UserSettings {
  processingMode: string;
  autoStart: boolean;
  soundFeedback: boolean;
  feedbackSound: string;
  startSound: string;
  stopSound: string;
  askSound: string;
  defaultMode: string;
  transMode: string;
  hotkey: string;
  askHotkey: string;
  translateHotkey: string; // NEW: Ctrl+Alt+T for translate toggle
  refineHotkey: string; // NEW: Ctrl+Alt+R for refine mode
  oopsHotkey: string; // NEW: Ctrl+Alt+V for re-inject last
  askOutputMode: string;
  defaultOllamaModel: string;
  audioDeviceId: string;
  audioDeviceLabel: string;
  maxRecordingDuration: number; // seconds, 0 = unlimited
  customPrompts: { // NEW: Custom prompts for each mode
    standard: string;
    prompt: string;
    professional: string;
    raw: string;
  };
  // Trailing space configuration
  trailingSpaceEnabled: boolean; // NEW: Enable trailing space (default: true)
  additionalKeyEnabled: boolean; // NEW: Enable optional key after space
  additionalKey: string; // NEW: Which additional key ('enter', 'tab', 'none')
}

// Initialize Store with defaults
const store = new Store<UserSettings>({
  defaults: {
    processingMode: 'local',
    autoStart: false,
    soundFeedback: true,
    feedbackSound: 'a', // Deprecated, but keeping for migration/fallback
    startSound: 'a',
    stopSound: 'a',
    askSound: 'c',
    defaultMode: 'standard',
    transMode: 'none',
    hotkey: 'Ctrl+Alt+D',
    askHotkey: 'Ctrl+Alt+A',
    translateHotkey: 'Ctrl+Alt+T', // NEW: Translate toggle hotkey
    refineHotkey: 'Ctrl+Alt+R', // NEW: Refine mode hotkey
    oopsHotkey: 'Ctrl+Alt+V', // NEW: Re-inject last text hotkey
    askOutputMode: 'type',
    defaultOllamaModel: 'gemma3:4b',
    audioDeviceId: 'default',
    audioDeviceLabel: 'Default Microphone',
    maxRecordingDuration: 60, // 60 seconds default
    customPrompts: { // NEW: Custom prompts for each mode (empty = use defaults)
      standard: '',
      prompt: '',
      professional: '',
      raw: ''
    },
    // NEW: Trailing space settings (SPEC_006)
    trailingSpaceEnabled: true, // DEFAULT: ON (natural spacing between words)
    // NEW: Additional key settings (SPEC_006)
    additionalKeyEnabled: false, // DEFAULT: OFF (space only is enough)
    additionalKey: 'none', // DEFAULT: None (can enable Enter/Tab if needed)
  }
});

let tray: Tray | null = null;
let pythonManager: PythonManager | null = null;
let isRecording: boolean = false;
let isWarmupLock: boolean = true; // NEW: Lock interaction until fully initialized
let recordingMode: 'dictate' | 'ask' | 'translate' = 'dictate';
let settingsWindow: BrowserWindow | null = null;

/**
 * Create a simple colored icon programmatically
 */
function createSimpleIcon(color: string): NativeImage {
  // Create a simple 16x16 colored square as a PNG buffer
  const size = 16;
  const channels = 4; // RGBA
  const buffer = Buffer.alloc(size * size * channels);

  const colors: { [key: string]: [number, number, number] } = {
    'gray': [128, 128, 128],
    'red': [255, 0, 0],
    'blue': [0, 0, 255]
  };

  const rgb = colors[color] || [128, 128, 128];

  for (let i = 0; i < size * size; i++) {
    const offset = i * channels;
    buffer[offset] = rgb[0];     // R
    buffer[offset + 1] = rgb[1]; // G
    buffer[offset + 2] = rgb[2]; // B
    buffer[offset + 3] = 255;    // A (fully opaque)
  }

  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

/**
 * Create or get tray icon
 */
function getIcon(state: string): NativeImage {
  const assetsDir = path.join(__dirname, '..', 'assets');
  const iconName = state === 'recording' ? 'icon-recording.png' :
    state === 'processing' ? 'icon-processing.png' :
      'icon-idle.png';
  const iconPath = path.join(assetsDir, iconName);

  // Try to load PNG from file
  if (fs.existsSync(iconPath)) {
    try {
      return nativeImage.createFromPath(iconPath);
    } catch (err) {
      logger.warn('MAIN', `Failed to load icon from ${iconPath}`, err);
    }
  }

  // Fallback to programmatically created icon
  const color = state === 'recording' ? 'red' :
    state === 'processing' ? 'blue' :
      'gray';

  logger.info('MAIN', `Using programmatic icon for state: ${state}`);
  return createSimpleIcon(color);
}

let debugWindow: BrowserWindow | null = null;

/**
 * Create debug dashboard window
 */
function createDebugWindow(): void {
  if (debugWindow) {
    debugWindow.show();
    return;
  }

  debugWindow = new BrowserWindow({
    width: 400,
    height: 600,
    show: true,
    alwaysOnTop: true,
    frame: true, // Keep frame for dragging for now, but maybe remove later
    title: 'dIKtate Status',
    icon: getIcon('idle'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  debugWindow.loadFile(path.join(__dirname, 'index.html'));

  // Remove menu bar
  debugWindow.setMenuBarVisibility(false);

  debugWindow.on('close', (e) => {
    // Just hide instead of closing
    e.preventDefault();
    debugWindow?.hide();
  });

  // Open DevTools by default in Dev environment
  // if (isDev) debugWindow.webContents.openDevTools();
}

/**
 * Create Settings Window
 */
function createSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.show();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    title: 'dIKtate Settings',
    icon: getIcon('idle'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preloadSettings.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

/**
 * Helper to play sound via Main Process (Zero Latency)
 */
function playSound(soundName: string) {
  if (!soundName || soundName === 'none') return;

  const soundPath = path.join(__dirname, '..', 'assets', 'sounds', `${soundName}.wav`);

  if (!fs.existsSync(soundPath)) {
    logger.warn('MAIN', `Sound file not found: ${soundPath}`);
    return;
  }

  try {
    const { exec } = require('child_process');
    // Using Hidden window style and .PlaySync() to ensure process stays alive
    const psCommand = `(New-Object System.Media.SoundPlayer '${soundPath}').PlaySync()`;
    exec(`powershell -c "${psCommand}"`, { windowsHide: true }, (error: Error | null) => {
      if (error) {
        logger.error('MAIN', 'Sound playback failed', error);
      }
    });
  } catch (e) {
    logger.error('MAIN', 'Failed to trigger sound', e);
  }
}

/**
 * Build tray menu template
 */
function buildTrayMenu(state: string = 'Idle'): Electron.MenuItemConstructorOptions[] {
  const currentModel = store.get('defaultOllamaModel', 'gemma3:4b');

  return [
    {
      label: `Status: ${state}`,
      enabled: false
    },
    {
      label: `Model: ${currentModel}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => createSettingsWindow()
    },
    {
      label: 'Control Panel',
      click: () => {
        if (!debugWindow) createDebugWindow();
        debugWindow?.show();
      }
    },
    {
      label: 'Show Logs',
      click: () => {
        const logDir = path.join(app.getPath('home'), '.diktate', 'logs');
        shell.openPath(logDir).catch(err => {
          logger.error('MAIN', 'Failed to open logs folder', err);
          showNotification('Error', 'Could not open logs folder', true);
        });
      }
    },
    { type: 'separator' },
    {
      label: 'Force Restart',
      click: () => {
        logger.info('MAIN', 'Force restart initiated from tray menu');
        showNotification(
          'Restarting dIKtate',
          'The app will restart for a clean startup. This may take a few seconds...',
          false
        );
        // Give notification time to show, then restart
        setTimeout(() => {
          app.relaunch();
          app.exit(0);
        }, 500);
      }
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => {
        shell.openExternal('https://github.com/diktate/diktate/releases').catch(err => {
          logger.error('MAIN', 'Failed to open releases page', err);
        });
      }
    },
    { type: 'separator' },
    {
      label: 'Quit dIKtate',
      accelerator: 'CommandOrControl+Q',
      click: () => {
        debugWindow?.destroy();
        app.quit();
      }
    }
  ];
}

/**
 * Initialize system tray icon
 */
function initializeTray(): void {
  const icon = getIcon('idle');
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate(buildTrayMenu('Idle'));
  tray.setContextMenu(contextMenu);

  updateTrayTooltip();
}

/**
 * Update tray tooltip to show current model and mode
 */
function updateTrayTooltip(): void {
  if (!tray) return;

  const mode = store.get('processingMode', 'local').toUpperCase();
  const model = store.get('defaultOllamaModel', 'gemma3:4b');
  tray.setToolTip(`dIKtate [${mode}] - ${model}\nCtrl+Alt+D: Dictate | Ctrl+Alt+A: Ask`);
}

/**
 * Update tray menu with current state
 */
function updateTrayState(state: string): void {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate(buildTrayMenu(state));
  tray.setContextMenu(contextMenu);

  // Also send status to renderer
  if (debugWindow) {
    debugWindow.webContents.send('status-update', state);
  }
}

/**
 * Update tray icon based on state
 */
function updateTrayIcon(state: string): void {
  if (!tray) return;

  const icon = getIcon(state);
  try {
    tray.setImage(icon);
  } catch (error) {
    logger.error('MAIN', 'Failed to set tray icon', error);
  }
}

/**
 * Show notification to user
 */
function showNotification(title: string, body: string, isError: boolean = false): void {
  if (!Notification.isSupported()) {
    logger.warn('MAIN', 'Notifications not supported on this system');
    return;
  }

  try {
    const icon = getIcon(isError ? 'idle' : 'processing');
    const notification = new Notification({
      title,
      body,
      icon: icon.toDataURL(),
      silent: false,
      urgency: isError ? 'critical' : 'normal'
    });

    notification.show();
    logger.info('MAIN', 'Notification shown', { title, body: redactSensitive(body, 50) });
  } catch (error) {
    logger.error('MAIN', 'Failed to show notification', error);
  }
}

/**
 * Handle Python manager events
 */
function setupPythonEventHandlers(): void {
  if (!pythonManager) return;

  pythonManager.on('state-change', (state: string) => {
    logger.info('MAIN', 'Python state changed', { state });

    // Release lock on first transition to idle after warmup
    if (isWarmupLock && state === 'idle') {
      isWarmupLock = false;
      logger.info('MAIN', 'Warmup lock released - App is fully ready');
      showNotification('dIKtate Ready', 'Models loaded. Press Ctrl+Alt+D to start.', false);
    }

    updateTrayState(state);
    updateTrayIcon(state);
  });

  pythonManager.on('error', (error: Error) => {
    logger.error('MAIN', 'Python error occurred', error);
    showNotification(
      'dIKtate Error',
      `An error occurred: ${error.message}`,
      true
    );
    updateTrayState('Error');
  });

  pythonManager.on('fatal-error', (error: Error) => {
    logger.error('MAIN', 'Fatal Python error - connection lost', error);
    showNotification(
      'dIKtate - Connection Lost',
      'Python backend connection lost. Please restart the application.',
      true
    );
    updateTrayState('Disconnected');
  });

  pythonManager.on('ready', () => {
    logger.info('MAIN', 'Python manager ready');
    showNotification(
      'dIKtate Ready',
      'Press Ctrl+Alt+D to start dictating',
      false
    );
  });

  pythonManager.on('disconnected', () => {
    logger.warn('MAIN', 'Python process disconnected, attempting reconnection');
    updateTrayState('Reconnecting...');
  });

  pythonManager.on('performance-metrics', (metrics: any) => {
    logger.info('MAIN', 'Performance metrics received from Python', metrics);

    // Forward to renderer for dashboard display
    if (debugWindow && !debugWindow.isDestroyed()) {
      debugWindow.webContents.send('performance-metrics', metrics);
    }

    // Log average performance statistics
    const stats = performanceMetrics.getStatistics();
    if (stats.averages) {
      logger.info('MAIN', 'Average performance', stats.averages);
    }
  });

  // Listen for explicit status responses if we implement polling
  pythonManager.on('status-check', (statusData: any) => {
    if (debugWindow && !debugWindow.isDestroyed()) {
      debugWindow.webContents.send('model-info', {
        transcriber: statusData.transcriber,
        processor: statusData.processor
      });
    }
  });

  // Handle Ask Mode responses
  pythonManager.on('ask-response', async (response: any) => {
    logger.info('MAIN', 'Ask response received', { success: response.success });

    // Reset recording state
    isRecording = false;
    updateTrayIcon('idle');
    updateTrayState('Idle');

    if (!response.success) {
      showNotification('Ask Failed', response.error || 'Unknown error', true);
      return;
    }

    const { question, answer } = response;
    const outputMode = store.get('askOutputMode') || 'clipboard';

    logger.info('MAIN', 'Delivering ask response', { outputMode, answerLength: answer?.length });

    // Deliver based on output mode
    switch (outputMode) {
      case 'clipboard':
        // Copy to clipboard
        const { clipboard } = require('electron');
        clipboard.writeText(answer);
        showNotification('Answer Ready', `${answer.substring(0, 100)}${answer.length > 100 ? '...' : ''}\n\n📋 Copied to clipboard!`, false);
        break;

      case 'type':
        // Type the answer (like dictation)
        if (pythonManager) {
          try {
            await pythonManager.sendCommand('inject_text', { text: answer });
          } catch (err) {
            logger.error('MAIN', 'Failed to inject text for Ask response', err);
            showNotification('Injection Failed', 'Could not type the answer automatically.', true);
          }
        }
        break;

      case 'notification':
        // Just show notification
        showNotification('Answer', answer, false);
        break;

      case 'clipboard+notify':
      default:
        // Both clipboard and notification
        const { clipboard: clip } = require('electron');
        clip.writeText(answer);
        showNotification('Answer Ready', `${answer.substring(0, 150)}${answer.length > 150 ? '...' : ''}\n\n📋 Copied to clipboard!`, false);
        break;
    }

    // Forward to debug window if open
    if (debugWindow && !debugWindow.isDestroyed()) {
      debugWindow.webContents.send('ask-response', { question, answer });
    }
  });

  // Handle processor fallback (error recovery)
  pythonManager.on('processor-fallback', (data: any) => {
    const { reason, consecutive_failures, using_raw } = data;

    logger.warn('MAIN', 'Processor fallback triggered', { reason, consecutive_failures });

    // Show notification to user
    const title = consecutive_failures === 1 ? 'Processing Failed' : `Processing Failed (${consecutive_failures}x)`;
    const message = using_raw
      ? `Using raw transcription instead.\n\nReason: ${reason.split(':')[0]}`
      : `LLM unavailable.\n\nReason: ${reason.split(':')[0]}`;

    showNotification(title, message, false);

    // If 3+ consecutive failures, suggest checking Ollama
    if (consecutive_failures >= 3) {
      showNotification(
        'Repeated Failures Detected',
        'Consider checking if Ollama is running or switching to Cloud mode in Settings.',
        true
      );
    }
  });

  // Handle recording auto-stop (duration limit reached)
  pythonManager.on('recording-auto-stopped', (data: any) => {
    const { max_duration } = data;

    logger.info('MAIN', 'Recording auto-stopped', { max_duration });

    // Force stop recording state
    isRecording = false;
    updateTrayIcon('processing');
    updateTrayState('Processing');

    // Show notification
    const durationText = max_duration === 60 ? '1 minute' :
      max_duration === 120 ? '2 minutes' :
        `${max_duration} seconds`;
    showNotification(
      'Recording Auto-Stopped',
      `Maximum recording duration (${durationText}) reached.\n\nProcessing your dictation now...`,
      false
    );
  });

  pythonManager.on('mic-muted', (data: any) => {
    const { message } = data;

    logger.warn('MAIN', 'Microphone muted detected');

    // Force stop recording state
    isRecording = false;
    updateTrayIcon('idle');
    updateTrayState('Ready');

    // Show notification
    showNotification(
      '🔇 Microphone Muted',
      message || 'Your microphone is muted. Please unmute and try again.',
      true
    );
  });

  pythonManager.on('mic-status', (data: any) => {
    const { muted } = data;

    logger.info('MAIN', `Microphone status: ${muted ? 'MUTED' : 'ACTIVE'}`);

    // Update tray tooltip
    if (muted) {
      tray?.setToolTip('dIKtate - ⚠️ Microphone Muted');
    } else {
      updateTrayTooltip();
    }
  });

  // Handle refine mode success
  pythonManager.on('refine-success', (data: any) => {
    logger.info('MAIN', 'Refine success event received', data);

    // Log metrics (refine uses separate workflow from dictation pipeline)
    if (data.charCount) {
      logger.info('MAIN', 'Refine metrics', {
        total: data.total,
        capture: data.capture,
        processing: data.processing,
        injection: data.injection,
        charCount: data.charCount
      });
    }
  });

  // Handle refine mode errors
  pythonManager.on('refine-error', (data: any) => {
    logger.error('MAIN', 'Refine error event received', data);
    handleRefineError(data.error || data.message || data.code || 'Unknown error');
  });
}

/**
 * Synchronize current Electron store settings with the Python backend
 */
async function syncPythonConfig(): Promise<void> {
  if (!pythonManager || !pythonManager.isProcessRunning()) return;

  const processingMode = store.get('processingMode', 'local');
  const defaultMode = store.get('defaultMode', 'standard');
  const transMode = store.get('transMode', 'none');

  // Check for mode-specific model override
  const specificModel = store.get(`modeModel_${defaultMode}` as any);
  const defaultOllamaModel = specificModel || store.get('defaultOllamaModel', 'gemma3:4b');

  // Get custom prompts (empty string = use Python defaults)
  const customPrompts = store.get('customPrompts', {
    standard: '',
    prompt: '',
    professional: '',
    raw: ''
  });

  const audioDeviceLabel = store.get('audioDeviceLabel', 'Default');
  const trailingSpaceEnabled = store.get('trailingSpaceEnabled', true);
  const additionalKeyEnabled = store.get('additionalKeyEnabled', false);
  const additionalKey = store.get('additionalKey', 'none');

  const config: any = {
    provider: processingMode,
    mode: defaultMode,
    transMode: transMode,
    defaultModel: defaultOllamaModel,
    customPrompts: customPrompts,
    audioDeviceLabel: audioDeviceLabel,
    trailingSpaceEnabled: trailingSpaceEnabled,
    additionalKeyEnabled: additionalKeyEnabled,
    additionalKey: additionalKey
  };

  // Get API key if needed
  try {
    let apiKey: string | undefined;
    let storeKey: string | undefined;

    if (processingMode === 'cloud' || processingMode === 'gemini') storeKey = 'encryptedGeminiApiKey';
    else if (processingMode === 'anthropic') storeKey = 'encryptedAnthropicApiKey';
    else if (processingMode === 'openai') storeKey = 'encryptedOpenaiApiKey';

    if (storeKey) {
      const encrypted = store.get(storeKey as any) as string | undefined;
      if (encrypted && safeStorage.isEncryptionAvailable()) {
        apiKey = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
        config.apiKey = apiKey;
      }
    }
  } catch (e) {
    logger.error('MAIN', 'Failed to decrypt API key for sync', e);
  }

  try {
    // Count non-empty custom prompts for logging
    const customPromptCount = Object.values(config.customPrompts).filter((p: any) => p && p.length > 0).length;

    logger.info('MAIN', 'Syncing config to Python', {
      mode: config.mode,
      provider: config.provider,
      model: config.defaultModel,
      customPrompts: customPromptCount > 0 ? `${customPromptCount} custom` : 'none'
    });
    await pythonManager.setConfig(config);

    // Update badge in status window
    if (debugWindow && !debugWindow.isDestroyed()) {
      // Determine processor name based on provider
      let processorDisplay = config.defaultModel; // Default to Ollama model
      if (config.provider === 'cloud' || config.provider === 'gemini') {
        processorDisplay = 'Gemini 1.5 Flash';
      } else if (config.provider === 'anthropic') {
        processorDisplay = 'Claude 3.5 Haiku';
      } else if (config.provider === 'openai') {
        processorDisplay = 'GPT-4o Mini';
      }

      debugWindow.webContents.send('badge-update', { processor: processorDisplay });
      debugWindow.webContents.send('mode-update', config.mode);
      debugWindow.webContents.send('provider-update', config.provider);
    }
  } catch (err) {
    logger.error('MAIN', 'Failed to sync config to Python', err);
  }
}

/**
 * Setup IPC handlers for communication with Python
 */
function setupIpcHandlers(): void {
  // Handle get-initial-state
  ipcMain.handle('get-initial-state', async () => {
    const currentMode = store.get('defaultMode') || 'standard';

    let models = { transcriber: 'Unknown', processor: 'Unknown' };
    if (pythonManager && pythonManager.isProcessRunning()) {
      try {
        const result = await pythonManager.sendCommand('status');
        if (result) {
          if (result.transcriber) models.transcriber = result.transcriber;
          if (result.processor) models.processor = result.processor;
        }
      } catch (e) {
        logger.warn('MAIN', 'Failed to fetch python status for initial state', e);
      }
    }

    const actualProcessingMode = store.get('processingMode', 'local');

    return {
      status: pythonManager?.getStatus() || 'disconnected',
      isRecording,
      mode: currentMode,
      models,
      soundFeedback: store.get('soundFeedback', true),
      processingMode: actualProcessingMode,
      recordingMode: recordingMode
    };
  });

  ipcMain.handle('python:start-recording', async () => {
    if (!isRecording) await toggleRecording();
    return { success: true };
  });

  ipcMain.handle('python:stop-recording', async () => {
    if (isRecording) await toggleRecording();
    return { success: true };
  });

  ipcMain.handle('python:toggle-recording', async () => {
    await toggleRecording();
    return { success: true };
  });

  ipcMain.handle('python:status', async () => {
    if (!pythonManager) return { status: 'disconnected' };
    return { status: pythonManager.getStatus() };
  });

  // Settings IPC
  ipcMain.handle('settings:get-all', () => {
    return store.store;
  });

  ipcMain.handle('settings:set', async (event, key: keyof UserSettings, value: any) => {
    // Validate payload
    const validation = validateIpcMessage(SettingsSetSchema, { key, value });
    if (!validation.success) {
      logger.error('IPC', `Invalid settings payload: ${redactSensitive(validation.error, 100)}`);
      throw new Error(`Invalid payload: ${validation.error}`);
    }

    logger.info('IPC', `Setting update: ${key} = ${value}`);
    store.set(key, value);

    // If hotkey changed, re-register
    if (['hotkey', 'askHotkey', 'translateHotkey', 'refineHotkey', 'oopsHotkey'].includes(key)) {
      setupGlobalHotkey(); // Re-register with new key
    }

    // Trigger sync for core processing modes (non-model changes)
    const syncKeys = [
      'defaultMode',
      'processingMode',
      'transMode',
      'trailingSpaceEnabled',  // NEW: Sync trailing space setting to Python
      'additionalKeyEnabled',  // NEW: Sync additional key settings to Python
      'additionalKey'          // NEW: Sync additional key settings to Python
    ];

    if (syncKeys.includes(key as string)) {
      await syncPythonConfig().catch(err => {
        logger.error('IPC', 'Post-setting sync failed', err);
      });
    }

    // If auto-start setting changed
    if (key === 'autoStart') {
      try {
        app.setLoginItemSettings({
          openAtLogin: value,
          openAsHidden: false
        });
        logger.info('IPC', `Auto-start ${value ? 'enabled' : 'disabled'}`);
      } catch (err) {
        logger.error('IPC', 'Failed to set auto-start', err);
      }
    }

    return { success: true };
  });

  // App Relaunch handler
  ipcMain.handle('app:relaunch', () => {
    logger.info('MAIN', 'Application relaunch requested');
    app.relaunch();
    app.exit(0);
  });
}

// Settings get single value
ipcMain.handle('settings:get', (_event, key: string) => {
  return store.get(key);
});

// ============================================
// Custom Prompts IPC Handlers
// ============================================

// Default Prompts (mirrored from python/config/prompts.py for UI availability)
const DEFAULT_PROMPTS = {
  standard: `You are a text cleanup tool. Fix punctuation and capitalization. Remove filler words (um, uh) only if hesitations. PRESERVE slang/emphasis. Return ONLY cleaned text. Do not include introductory text.

Input: {text}
Cleaned text:`,
  prompt: `You are a prompt engineer. Your job is to clean up spoken text into a clear, structured prompt for an AI model.

Rules:
1. Remove ALL filler words, hesitations, and false starts.
2. Fix punctuation, capitalization, and grammar.
3. Preserve technical terms and specific instructions exactly.
4. Structure the output clearly (use bullet points if appropriate).
5. Return ONLY the cleaned prompt text.

Input: {text}
Cleaned text:`,
  professional: `You are a professional editor. Your job is to polish the text for a business context.

Rules:
1. Remove ALL filler words, hesitations, and false starts.
2. Fix punctuation, capitalization, and grammar.
3. Remove profanity.
4. Ensure the tone is polite and clear.
5. Return ONLY the cleaned text.

Input: {text}
Cleaned text:`,
  raw: `You are a transcriber. Your job is to format the text with punctuation while changing as little as possible.

Rules:
1. Preserve ALL words, including fillers and stutters.
2. Add necessary punctuation and capitalization.
3. DO NOT remove profanity or slang.
4. Return ONLY the processed text.

Input: {text}
Cleaned text:`,
  // Model-specific overrides (mirrored from python/config/prompts.py)
  modelOverrides: {
    'gemma3:4b': {
      standard: `Dictation cleanup. Fix punctuation, remove fillers, apply corrections. Nothing else added.

Input: {text}
Cleaned text:`
    }
  }
};

// Get all custom prompts
ipcMain.handle('settings:get-custom-prompts', async () => {
  return store.get('customPrompts', {
    standard: '',
    prompt: '',
    professional: '',
    raw: ''
  });
});

// Get all default prompts (plural for backward compatibility/global load)
ipcMain.handle('settings:get-default-prompts', async () => {
  return DEFAULT_PROMPTS;
});

// Get specific default prompt based on mode and model
ipcMain.handle('settings:get-default-prompt', async (_event, mode: string, model: string) => {
  const modeLower = mode.toLowerCase();

  // 1. Check for model-specific override first
  if (model && DEFAULT_PROMPTS.modelOverrides[model as keyof typeof DEFAULT_PROMPTS.modelOverrides]) {
    const overrides = DEFAULT_PROMPTS.modelOverrides[model as keyof typeof DEFAULT_PROMPTS.modelOverrides];
    if (overrides[modeLower as keyof typeof overrides]) {
      return overrides[modeLower as keyof typeof overrides];
    }
  }

  // 2. Fall back to base mode prompt
  return DEFAULT_PROMPTS[modeLower as keyof typeof DEFAULT_PROMPTS] || DEFAULT_PROMPTS.standard;
});

// Save custom prompt for a specific mode
ipcMain.handle('settings:save-custom-prompt', async (_event, mode: string, promptText: string) => {
  try {
    // Validate mode
    const validModes = ['standard', 'prompt', 'professional', 'raw'];
    if (!validModes.includes(mode)) {
      return { success: false, error: `Invalid mode: ${mode}` };
    }

    // Validate prompt length
    if (promptText && promptText.length > 1000) {
      return { success: false, error: 'Prompt too long (max 1000 characters)' };
    }

    // Validate {text} placeholder if prompt is not empty
    if (promptText && !promptText.includes('{text}')) {
      return { success: false, error: 'Prompt must include {text} placeholder where transcribed text will be inserted' };
    }

    // Sanitize backticks to prevent breaking prompt structure
    const sanitized = promptText ? promptText.replace(/```/g, "'''") : '';

    // Save to store
    const customPrompts = store.get('customPrompts', {
      standard: '',
      prompt: '',
      professional: '',
      raw: ''
    });
    customPrompts[mode as keyof typeof customPrompts] = sanitized;
    store.set('customPrompts', customPrompts);

    logger.info('IPC', `Custom prompt saved for mode: ${mode} (${sanitized.length} chars)`);

    // Trigger Python config sync to apply immediately
    await syncPythonConfig();

    return { success: true };
  } catch (err) {
    logger.error('IPC', `Failed to save custom prompt for ${mode}`, err);
    return { success: false, error: String(err) };
  }
});

// Reset custom prompt for a specific mode (back to default)
ipcMain.handle('settings:reset-custom-prompt', async (_event, mode: string) => {
  try {
    const validModes = ['standard', 'prompt', 'professional', 'raw'];
    if (!validModes.includes(mode)) {
      return { success: false, error: `Invalid mode: ${mode}` };
    }

    const customPrompts = store.get('customPrompts', {
      standard: '',
      prompt: '',
      professional: '',
      raw: ''
    });
    customPrompts[mode as keyof typeof customPrompts] = '';
    store.set('customPrompts', customPrompts);

    logger.info('IPC', `Custom prompt reset to default for mode: ${mode}`);

    // Trigger Python config sync
    await syncPythonConfig();

    return { success: true };
  } catch (err) {
    logger.error('IPC', `Failed to reset custom prompt for ${mode}`, err);
    return { success: false, error: String(err) };
  }
});

// Sound playback handler
ipcMain.handle('settings:play-sound', async (_event, soundName: string) => {
  playSound(soundName);
});

// Get available sound files
ipcMain.handle('settings:get-sound-files', async () => {
  try {
    const soundsDir = path.join(__dirname, '..', 'assets', 'sounds');
    if (!fs.existsSync(soundsDir)) return [];

    const files = fs.readdirSync(soundsDir);
    // Filter for common audio formats and remove extensions
    return files
      .filter(f => f.endsWith('.wav') || f.endsWith('.mp3'))
      .map(f => path.parse(f).name)
      // Remove duplicates (e.g. if we have a.wav and a.mp3)
      .filter((v, i, a) => a.indexOf(v) === i);
  } catch (err) {
    logger.error('MAIN', 'Failed to list sound files', err);
    return [];
  }
});

// Hardware test handler
ipcMain.handle('settings:run-hardware-test', async () => {
  try {
    const { exec } = require('child_process');

    let gpu = 'Unknown';
    let vram = 'Unknown';
    let tier = 'Fast (CPU-optimized)';

    // Try to get NVIDIA GPU info using nvidia-smi
    return new Promise((resolve) => {
      exec('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader', (err: Error | null, stdout: string) => {
        if (err || !stdout.trim()) {
          // No NVIDIA GPU found, try to detect any GPU
          logger.info('IPC', 'No NVIDIA GPU detected, using CPU mode');
          resolve({
            gpu: 'CPU Mode',
            vram: 'N/A',
            tier: 'Fast (CPU-optimized)',
            speed: 0
          });
          return;
        }

        // Parse nvidia-smi output
        const parts = stdout.trim().split(',').map((s: string) => s.trim());
        gpu = parts[0] || 'Unknown NVIDIA GPU';
        vram = parts[1] || 'Unknown';

        // Determine tier based on VRAM
        const vramMB = parseInt(vram.replace(/[^\d]/g, ''));
        if (vramMB >= 12000) {
          tier = 'Quality (12GB+ VRAM)';
        } else if (vramMB >= 6000) {
          tier = 'Balanced (6-12GB VRAM)';
        } else if (vramMB >= 4000) {
          tier = 'Fast (4-6GB VRAM)';
        } else {
          tier = 'Fast (Low VRAM)';
        }

        logger.info('IPC', `Hardware test complete: ${gpu}, ${vram}, ${tier}`);
        resolve({ gpu, vram, tier, speed: 0 });
      });
    });
  } catch (err) {
    logger.error('IPC', 'Hardware test failed', err);
    return {
      gpu: 'Test failed',
      vram: 'Test failed',
      tier: 'Unknown',
      speed: 0
    };
  }
});
ipcMain.handle('apikey:get-all', () => {
  // Return object indicating which keys are set (not the actual keys)
  return {
    geminiApiKey: !!store.get('encryptedGeminiApiKey'),
    anthropicApiKey: !!store.get('encryptedAnthropicApiKey'),
    openaiApiKey: !!store.get('encryptedOpenaiApiKey')
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
    throw new Error(`Invalid payload: ${validation.error}`);
  }

  const encrypted = safeStorage.encryptString(key);
  const storeKey = `encrypted${provider.charAt(0).toUpperCase() + provider.slice(1)}ApiKey`;
  store.set(storeKey, encrypted.toString('base64'));
  logger.info('IPC', `API key for ${provider} stored securely`);

  // Also update Python with the new key
  if (pythonManager) {
    pythonManager.setConfig({ [`${provider}ApiKey`]: key }).catch(err => {
      logger.error('IPC', `Failed to update Python with ${provider} API key`, err);
    });
  }
});

// Rate limiting for API key testing (M4 security fix)
const apiKeyTestAttempts = new Map<string, { count: number; resetTime: number }>();
const MAX_KEY_TESTS_PER_MINUTE = 5;

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
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }] })
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
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1, messages: [{ role: 'user', content: 'Hi' }] })
      });
      if (response.ok) return { success: true };
      const error = await response.json();
      return { success: false, error: error.error?.message || 'Invalid key' };
    } else if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${testKey}` }
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

// Ollama Service Control
ipcMain.handle('ollama:restart', async () => {
  try {
    logger.info('IPC', 'Restarting Ollama service...');
    const { exec, spawn } = await import('child_process');
    const util = await import('util');
    const execPromise = util.promisify(exec);

    // Kill existing Ollama process (Windows)
    try {
      await execPromise('taskkill /F /IM ollama.exe');
      logger.info('IPC', 'Ollama process terminated');
    } catch (e) {
      // Ignore errors if not running
      logger.info('IPC', 'No existing Ollama process found');
    }

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start Ollama again
    const ollamaProcess = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    ollamaProcess.unref();

    logger.info('IPC', 'Ollama service started');

    // Wait for startup
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify it's running
    const response = await fetch('http://localhost:11434/api/tags');
    if (response.ok) {
      logger.info('IPC', 'Ollama restart successful');
      return { success: true };
    } else {
      logger.error('IPC', 'Ollama failed to start after restart');
      return { success: false, error: 'Ollama failed to start' };
    }
  } catch (error) {
    logger.error('IPC', 'Failed to restart Ollama', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('ollama:warmup', async () => {
  try {
    const defaultModel = store.get('defaultOllamaModel', 'gemma3:4b');
    logger.info('IPC', `Warming up model: ${defaultModel}`);

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: defaultModel,
        prompt: '',
        stream: false,
        options: { num_ctx: 2048, num_predict: 1 },
        keep_alive: '10m'
      })
    });

    if (response.ok) {
      logger.info('IPC', `Model ${defaultModel} warmed up successfully`);
      return { success: true, model: defaultModel };
    } else {
      logger.error('IPC', `Model warmup failed with status ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    logger.error('IPC', 'Failed to warm up model', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Toggle recording state
 * @param mode - 'dictate' for normal dictation, 'ask' for Q&A mode, 'translate' for bidirectional translation
 */
async function toggleRecording(mode: 'dictate' | 'ask' | 'translate' = 'dictate'): Promise<void> {
  if (isWarmupLock) {
    logger.warn('MAIN', 'Recording blocked: App is still warming up');
    return;
  }

  if (!pythonManager) {
    logger.warn('MAIN', 'Python manager not initialized');
    return;
  }

  if (isRecording) {
    // Play feedback sound
    if (store.get('soundFeedback')) {
      const sound = recordingMode === 'ask' || recordingMode === 'translate' ? store.get('askSound') : store.get('stopSound');
      playSound(sound);
    }

    // Stop recording
    logger.info('MAIN', 'Stopping recording', { mode: recordingMode });
    isRecording = false;
    updateTrayIcon('processing');
    updateTrayState(recordingMode === 'ask' ? 'Thinking...' : recordingMode === 'translate' ? 'Translating...' : 'Processing');

    try {
      await pythonManager.sendCommand('stop_recording');
    } catch (error) {
      logger.error('MAIN', 'Failed to stop recording', error);
      updateTrayIcon('idle');
      updateTrayState('Idle');
    }
  } else {
    // Play feedback sound
    if (store.get('soundFeedback')) {
      const sound = mode === 'ask' || mode === 'translate' ? store.get('askSound') : store.get('startSound');
      playSound(sound);
    }

    // Start recording
    recordingMode = mode;
    logger.info('MAIN', 'Starting recording', { mode });
    isRecording = true;
    updateTrayIcon('recording');
    updateTrayState(mode === 'ask' ? 'Listening (Ask)' : mode === 'translate' ? 'Listening (Translate)' : 'Recording');

    // Notify status window of mode change
    if (debugWindow && !debugWindow.isDestroyed()) {
      debugWindow.webContents.send('mode-update', mode);
    }

    try {
      // Get preferred device ID and Label
      const audioDeviceId = store.get('audioDeviceId');
      const audioDeviceLabel = store.get('audioDeviceLabel');
      const maxDuration = store.get('maxRecordingDuration', 60); // Default: 60 seconds

      await pythonManager.sendCommand('start_recording', {
        deviceId: audioDeviceId,
        deviceLabel: audioDeviceLabel,
        mode: mode,  // Pass the mode to Python
        maxDuration: maxDuration  // Pass max duration setting
      });
    } catch (error) {
      logger.error('MAIN', 'Failed to start recording', error);
      isRecording = false;
      updateTrayIcon('idle');
      updateTrayState('Idle');
      showNotification('Recording Error', 'Failed to start recording. Please try again.', true);
    }
  }
}

/**
 * Handle refine selection (Ctrl+Alt+R)
 * Captures selected text, processes it with LLM, and pastes refined version
 */
function handleRefineSelection(): void {
  if (!pythonManager) {
    logger.error('MAIN', 'Python manager not initialized');
    return;
  }

  logger.info('MAIN', 'Refine selection triggered');

  // Update tray to processing state
  updateTrayIcon('processing');
  updateTrayState('Refining...');

  // Play start sound if enabled
  if (store.get('soundFeedback')) {
    playSound(store.get('startSound', 'a'));
  }

  // Send refine command to Python
  pythonManager.sendCommand('refine_selection')
    .then((response) => {
      if (response.success) {
        logger.info('MAIN', 'Refine completed successfully', response.metrics);

        // Play success sound
        if (store.get('soundFeedback')) {
          playSound(store.get('stopSound', 'a'));
        }

        // Reset tray
        updateTrayIcon('idle');
        updateTrayState('Idle');
      } else {
        logger.error('MAIN', `Refine failed: ${response.error}`);
        handleRefineError(response.error);
      }
    })
    .catch((err) => {
      logger.error('MAIN', 'Refine command failed', err);
      handleRefineError(err.message || 'Unknown error');
    });
}

/**
 * Handle refine errors with notifications
 */
function handleRefineError(error: string): void {
  // Play error sound
  if (store.get('soundFeedback')) {
    playSound('error');
  }

  // Determine error message
  let errorMessage = 'Refine mode failed. Please try again.';

  if (error === 'EMPTY_SELECTION') {
    errorMessage = 'No text selected. Please highlight text and try again.';
  } else if (error.includes('processor') || error.includes('Ollama') || error === 'NO_PROCESSOR') {
    errorMessage = 'Text processing failed. Check that Ollama is running.';
  } else if (error.includes('PROCESSING_FAILED')) {
    errorMessage = 'LLM processing failed. Please try again.';
  }

  // Show notification
  showNotification('Refine Mode', errorMessage, true);

  // Flash tray red, then return to idle
  updateTrayIcon('error');
  updateTrayState('Error');

  setTimeout(() => {
    updateTrayIcon('idle');
    updateTrayState('Idle');
  }, 2000);
}

/**
 * Setup global hotkey listeners for both Dictate and Ask modes
 */
function setupGlobalHotkey(): void {
  try {
    let lastHotkeyPress = 0;
    const HOTKEY_DEBOUNCE_MS = 500;

    // Get hotkeys from settings
    const dictateHotkey = store.get('hotkey') || 'Control+Alt+D';
    const askHotkey = store.get('askHotkey') || 'Control+Alt+A';

    // Unregister old if exists
    globalShortcut.unregisterAll();

    // Register Dictate hotkey (Ctrl+Alt+D)
    const dictateRet = globalShortcut.register(dictateHotkey, async () => {
      const now = Date.now();
      if (now - lastHotkeyPress < HOTKEY_DEBOUNCE_MS) {
        logger.debug('HOTKEY', 'Ignoring debounce hotkey press');
        return;
      }
      lastHotkeyPress = now;

      logger.debug('HOTKEY', 'Dictate hotkey pressed', { isRecording, mode: 'dictate' });
      await toggleRecording('dictate');
    });

    if (!dictateRet) {
      logger.warn('HOTKEY', 'Failed to register dictate hotkey', { hotkey: dictateHotkey });
      showNotification(
        'Hotkey Registration Failed',
        `Could not register ${dictateHotkey}. Another application may be using it.`,
        true
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

      logger.debug('HOTKEY', 'Ask hotkey pressed', { isRecording, mode: 'ask' });
      await toggleRecording('ask');
    });

    if (!askRet) {
      logger.warn('HOTKEY', 'Failed to register ask hotkey', { hotkey: askHotkey });
      // Don't show notification for ask - it's a secondary feature
    } else {
      logger.info('HOTKEY', 'Ask hotkey registered', { hotkey: askHotkey });
    }

    // Register Translate hotkey (Ctrl+Alt+T)
    const translateHotkey = store.get('translateHotkey', 'Ctrl+Alt+T');
    const translateRet = globalShortcut.register(translateHotkey, async () => {
      const now = Date.now();
      if (now - lastHotkeyPress < HOTKEY_DEBOUNCE_MS) {
        logger.debug('HOTKEY', 'Ignoring debounce translate hotkey press');
        return;
      }
      lastHotkeyPress = now;

      logger.debug('HOTKEY', 'Translate hotkey pressed', { isRecording, mode: 'translate' });
      await toggleRecording('translate');
    });

    if (!translateRet) {
      logger.warn('HOTKEY', 'Failed to register translate hotkey', { hotkey: translateHotkey });
    } else {
      logger.info('HOTKEY', 'Translate hotkey registered', { hotkey: translateHotkey });
    }

    // Register Refine hotkey (Ctrl+Alt+R)
    const refineHotkey = store.get('refineHotkey', 'Ctrl+Alt+R');
    const refineRet = globalShortcut.register(refineHotkey, () => {
      if (isWarmupLock) {
        logger.warn('HOTKEY', 'Refine blocked: Still warming up');
        return;
      }

      if (isRecording) {
        logger.warn('HOTKEY', 'Refine blocked: Currently recording');
        return;
      }

      logger.debug('HOTKEY', 'Refine hotkey pressed');
      handleRefineSelection();
    });

    if (!refineRet) {
      logger.warn('HOTKEY', 'Failed to register refine hotkey', { hotkey: refineHotkey });
    } else {
      logger.info('HOTKEY', 'Refine hotkey registered', { hotkey: refineHotkey });
    }

    // Register Oops hotkey (Ctrl+Alt+V) - Re-inject last text
    const oopsHotkey = store.get('oopsHotkey', 'Ctrl+Alt+V');
    const oopsRet = globalShortcut.register(oopsHotkey, async () => {
      if (isWarmupLock) {
        logger.warn('HOTKEY', 'Oops blocked: Still warming up');
        return;
      }

      if (isRecording) {
        logger.warn('HOTKEY', 'Oops blocked: Currently recording');
        return;
      }

      logger.debug('HOTKEY', 'Oops hotkey pressed - re-injecting last text');

      if (pythonManager) {
        try {
          const response = await pythonManager.sendCommand('inject_last');

          if (response.success) {
            // Play confirmation sound
            const startSound = store.get('startSound', 'a');
            if (store.get('soundFeedback', true)) {
              playSound(startSound);
            }
            logger.info('HOTKEY', 'Re-injected last text', { charCount: response.char_count });
          } else {
            // Show notification only on failure
            showNotification('No Text to Re-inject', 'No previous text found. Dictate something first.', false);
            logger.warn('HOTKEY', 'No text available to re-inject');
          }
        } catch (err) {
          logger.error('HOTKEY', 'Failed to re-inject last text', err);
          showNotification('Re-inject Failed', 'Could not re-inject text.', true);
        }
      }
    });

    if (!oopsRet) {
      logger.warn('HOTKEY', 'Failed to register oops hotkey', { hotkey: oopsHotkey });
    } else {
      logger.info('HOTKEY', 'Oops hotkey registered', { hotkey: oopsHotkey });
    }

  } catch (error) {
    logger.error('HOTKEY', 'Error registering global hotkeys', error);
    showNotification(
      'Hotkey Error',
      'Failed to register global hotkeys. Please restart the application.',
      true
    );
  }
}

/**
 * Initialize the application
 */
async function initialize(): Promise<void> {
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

    // Initialize tray
    initializeTray();
    logger.info('MAIN', 'System tray initialized');

    // Create debug window hidden
    createDebugWindow();

    // Hook up logger to window
    logger.setLogCallback((level, message, data) => {
      if (debugWindow && !debugWindow.isDestroyed()) {
        debugWindow.webContents.send('log-message', { level, message, data });
      }
    });

    // Setup IPC handlers
    setupIpcHandlers();
    logger.info('MAIN', 'IPC handlers registered');

    // Setup global hotkey
    setupGlobalHotkey();

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

    await pythonManager.start();
    await syncPythonConfig();
    logger.info('MAIN', 'dIKtate initialized and config synced successfully');

  } catch (error) {
    logger.error('MAIN', 'Failed to initialize application', error);
    showNotification(
      'dIKtate Startup Failed',
      'Application failed to start. Check logs for details.',
      true
    );
    setTimeout(() => app.quit(), 3000); // Give time to show notification
  }
}

/**
 * App ready
 */
app.on('ready', () => {
  // Handle when user tries to open a second instance
  app.on('second-instance', () => {
    // Show a notification that app is already running
    if (Notification.isSupported()) {
      new Notification({
        title: 'dIKtate Already Running',
        body: 'One instance is already running. Check your system tray.'
      }).show();
    }

    // Focus the settings window if it exists
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      if (settingsWindow.isMinimized()) settingsWindow.restore();
      settingsWindow.focus();
    }
  });

  initialize();
});

/**
 * Quit when all windows are closed
 */
app.on('window-all-closed', () => {
  app.quit();
});

/**
 * Clean up on quit
 */
app.on('before-quit', async () => {
  logger.info('MAIN', 'Application shutting down');

  // Unregister global hotkey
  globalShortcut.unregisterAll();
  logger.info('MAIN', 'Global hotkeys unregistered');

  if (pythonManager) {
    await pythonManager.stop();
    logger.info('MAIN', 'Python manager stopped');
  }

  // Close logger
  logger.close();
});

// Initial startup message (before logger is initialized)
console.log('[MAIN] dIKtate Electron main process starting...');
