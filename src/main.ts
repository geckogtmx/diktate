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
  defaultMode: string;
  transMode: string;
  hotkey: string;
  askHotkey: string;
  askOutputMode: string;
  defaultOllamaModel: string;
  audioDeviceId: string;
  audioDeviceLabel: string;
  maxRecordingDuration: number; // seconds, 0 = unlimited
}

// Initialize Store with defaults
const store = new Store<UserSettings>({
  defaults: {
    processingMode: 'local',
    autoStart: false,
    soundFeedback: true,
    feedbackSound: 'click',
    defaultMode: 'standard',
    transMode: 'none',
    hotkey: 'Ctrl+Alt+D',
    askHotkey: 'Ctrl+Alt+A',
    askOutputMode: 'type',
    defaultOllamaModel: 'gemma3:4b',
    audioDeviceId: 'default',
    audioDeviceLabel: 'Default Microphone',
    maxRecordingDuration: 60 // 60 seconds default
  }
});

let tray: Tray | null = null;
let pythonManager: PythonManager | null = null;
let isRecording: boolean = false;
let recordingMode: 'dictate' | 'ask' = 'dictate';
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
    height: 500,
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
      label: 'Show Debug Console',
      click: () => {
        if (!debugWindow) createDebugWindow();
        debugWindow?.show();
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
          await pythonManager.sendCommand('inject_text', { text: answer });
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
}

/**
 * Setup IPC handlers for communication with Python
 */
function setupIpcHandlers(): void {
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

  ipcMain.handle('settings:set', (event, key: keyof UserSettings, value: any) => {
    // Validate payload
    const validation = validateIpcMessage(SettingsSetSchema, { key, value });
    if (!validation.success) {
      logger.error('IPC', `Invalid settings payload: ${redactSensitive(validation.error, 100)}`);
      throw new Error(`Invalid payload: ${validation.error}`);
    }

    store.set(key, value);

    // If hotkey changed, re-register
    if (key === 'hotkey') {
      setupGlobalHotkey(); // Re-register with new key
    }

    // If processing mode changed (Standard/Professional/Literal)
    if (key === 'defaultMode' && pythonManager) {
      logger.info('IPC', `Default mode changed to ${value}, updating Python`);
      pythonManager.setConfig({ mode: value }).catch(err => {
        logger.error('IPC', 'Failed to update Python config', err);
      });

      // Update Debug Window UI
      if (debugWindow && !debugWindow.isDestroyed()) {
        debugWindow.webContents.send('mode-update', value);
      }
    }

    // If processing provider changed (local/cloud/anthropic/openai)
    if (key === 'processingMode' && pythonManager) {
      logger.info('IPC', `Processing provider changed to ${value}, updating Python`);

      // Decrypt and pass API key for cloud providers
      let apiKey: string | undefined;
      try {
        if (value === 'cloud' || value === 'gemini') {
          const encrypted = store.get('encryptedGeminiApiKey') as string | undefined;
          if (encrypted && safeStorage.isEncryptionAvailable()) {
            apiKey = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
          }
        } else if (value === 'anthropic') {
          const encrypted = store.get('encryptedAnthropicApiKey') as string | undefined;
          if (encrypted && safeStorage.isEncryptionAvailable()) {
            apiKey = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
          }
        } else if (value === 'openai') {
          const encrypted = store.get('encryptedOpenaiApiKey') as string | undefined;
          if (encrypted && safeStorage.isEncryptionAvailable()) {
            apiKey = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
          }
        }
      } catch (e) {
        logger.error('IPC', 'Failed to decrypt API key', e);
      }

      pythonManager.setConfig({ provider: value, apiKey }).then(() => {
        // Refresh badges after successful provider switch
        if (debugWindow && !debugWindow.isDestroyed()) {
          pythonManager!.sendCommand('status').then((result: any) => {
            if (result?.processor) {
              debugWindow!.webContents.send('badge-update', { processor: result.processor });
            }
          }).catch(() => { });
        }
      }).catch(err => {
        logger.error('IPC', 'Failed to update Python provider', err);
      });

      // Update Debug Window UI with new provider
      if (debugWindow && !debugWindow.isDestroyed()) {
        debugWindow.webContents.send('provider-update', value);
      }

      // Update tray tooltip to show current mode
      if (tray) {
        tray.setToolTip(`dIKtate [${value.toUpperCase()}] - Press Ctrl+Alt+D to dictate`);
      }
    }

    // If translation mode changed (none/es-en/en-es)
    if (key === 'transMode' && pythonManager) {
      logger.info('IPC', `Translation mode changed to ${value}, updating Python`);
      pythonManager.setConfig({ transMode: value }).catch(err => {
        logger.error('IPC', 'Failed to update Python transMode', err);
      });
    }

    // If default Ollama model changed
    if (key === 'defaultOllamaModel' && pythonManager) {
      logger.info('IPC', `Default Ollama model changed to ${value}, updating Python`);
      pythonManager.setConfig({ defaultModel: value }).catch(err => {
        logger.error('IPC', 'Failed to update Python default model', err);
      });
      // Update tray tooltip to show new model
      updateTrayTooltip();
      // Update tray menu to show new model
      if (tray) {
        const currentState = isRecording ? (recordingMode === 'ask' ? 'Listening (Ask)' : 'Recording') : 'Idle';
        updateTrayState(currentState);
      }
      // Update Status Window badge with new model
      if (debugWindow && !debugWindow.isDestroyed()) {
        debugWindow.webContents.send('badge-update', { processor: value });
      }
    }


    // If processing mode changed
    if (key === 'processingMode') {
      // Update tray tooltip to show new mode
      updateTrayTooltip();
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
  });

  // Settings get single value
  ipcMain.handle('settings:get', (_event, key: string) => {
    return store.get(key);
  });

  // Sound playback handler
  ipcMain.handle('settings:play-sound', async (_event, soundName: string) => {
    playSound(soundName);
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

  ipcMain.handle('apikey:test', async (_event, provider: string, key: string) => {
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
}

/**
 * Toggle recording state
 * @param mode - 'dictate' for normal dictation, 'ask' for Q&A mode
 */
async function toggleRecording(mode: 'dictate' | 'ask' = 'dictate'): Promise<void> {
  if (!pythonManager) {
    logger.warn('MAIN', 'Python manager not initialized');
    return;
  }

  if (isRecording) {
    // Play feedback sound
    if (store.get('soundFeedback')) {
      const sound = store.get('feedbackSound');
      playSound(sound);
    }

    // Stop recording
    logger.info('MAIN', 'Stopping recording', { mode: recordingMode });
    isRecording = false;
    updateTrayIcon('processing');
    updateTrayState(recordingMode === 'ask' ? 'Thinking...' : 'Processing');

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
      const sound = store.get('feedbackSound');
      playSound(sound);
    }

    // Start recording
    recordingMode = mode;
    logger.info('MAIN', 'Starting recording', { mode });
    isRecording = true;
    updateTrayIcon('recording');
    updateTrayState(mode === 'ask' ? 'Listening (Ask)' : 'Recording');

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

    // Handle get-initial-state
    ipcMain.handle('get-initial-state', async () => {
      const currentMode = store.get('defaultMode') || 'standard';

      let models = { transcriber: 'Unknown', processor: 'Unknown' };
      if (pythonManager && pythonManager.isProcessRunning()) {
        try {
          const result = await pythonManager.sendCommand('status');
          // sendCommand returns the content of 'data' directly if success=True (see PythonManager.ts:156)
          // Wait, PythonManager.ts:156 says: resolve(response.data);
          // And ipc_server.py returns { success: true, data: { transcriber: ..., processor: ... } }
          // So 'result' here IS the inner data object.

          if (result) {
            if (result.transcriber) models.transcriber = result.transcriber;
            if (result.processor) models.processor = result.processor;
          }
        } catch (e) {
          logger.warn('MAIN', 'Failed to fetch python status for initial state', e);
        }
      }

      // Use stored processingMode (user's preference controls the setting)
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
      // In production, resources are at: app.asar/../bin/diktate-engine.exe
      // process.resourcesPath points to the folder containing app.asar
      pythonExePath = path.join(process.resourcesPath, 'bin', 'diktate-engine.exe');
      // For executable, the script path argument is ignored or handled internally by the frozen app
      pythonScriptPath = '';
      logger.info('MAIN', 'Running in PRODUCTION mode');
    }

    logger.info('MAIN', 'Initializing Python manager', { pythonExePath, pythonScriptPath });
    pythonManager = new PythonManager(pythonExePath, pythonScriptPath);
    setupPythonEventHandlers();

    await pythonManager.start();
    logger.info('MAIN', 'dIKtate initialized successfully');

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
