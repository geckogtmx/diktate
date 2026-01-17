/**
 * Main Electron process for dIKtate
 * Handles system tray, Python subprocess, and global hotkey
 */

import { app, Tray, Menu, ipcMain, globalShortcut, BrowserWindow, Notification, nativeImage, NativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { PythonManager } from './services/pythonManager';
import { logger } from './utils/logger';
import { performanceMetrics } from './utils/performanceMetrics';

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

let tray: Tray | null = null;
let pythonManager: PythonManager | null = null;
let isRecording: boolean = false;

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
 * Initialize system tray icon
 */
function initializeTray(): void {
  const icon = getIcon('idle');

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Status: Idle',
      enabled: false,
      id: 'status'
    },
    { type: 'separator' },
    {
      label: 'Show Debug Console',
      click: () => {
        if (!debugWindow) createDebugWindow();
        debugWindow?.show();
        debugWindow?.webContents.openDevTools({ mode: 'detach' });
      }
    },
    { type: 'separator' },
    {
      label: 'Open Logs',
      click: () => {
        const logsPath = path.join(app.getPath('userData'), 'logs');
        require('electron').shell.openPath(logsPath);
      }
    },
    { type: 'separator' },
    {
      label: 'Quit dIKtate',
      accelerator: 'CommandOrControl+Q',
      click: () => {
        // Destroy window to allow quit
        debugWindow?.destroy();
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.setToolTip('dIKtate - Press Ctrl+Alt+D to dictate');
}

/**
 * Update tray menu with current state
 */
function updateTrayState(state: string): void {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Status: ${state}`,
      enabled: false,
      id: 'status'
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
      label: 'Open Logs',
      click: () => {
        const logsPath = path.join(app.getPath('userData'), 'logs');
        require('electron').shell.openPath(logsPath);
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
  ]);

  tray.setContextMenu(contextMenu);

  // Also sendstatus to renderer
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
    logger.info('MAIN', 'Notification shown', { title, body });
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
    // Log average performance statistics
    const stats = performanceMetrics.getStatistics();
    if (stats.averages) {
      logger.info('MAIN', 'Average performance', stats.averages);
    }
  });
}

/**
 * Setup IPC handlers for communication with Python
 */
function setupIpcHandlers(): void {
  ipcMain.handle('python:start-recording', async () => {
    if (!pythonManager) {
      logger.error('IPC', 'Start recording failed - Python manager not ready');
      return { success: false, error: 'Python manager not ready' };
    }
    try {
      logger.info('IPC', 'Starting recording');
      const result = await pythonManager.sendCommand('start_recording');
      isRecording = true;
      updateTrayState('Recording');
      updateTrayIcon('recording');
      return { success: true, data: result };
    } catch (error) {
      logger.error('IPC', 'Failed to start recording', error);
      showNotification('Recording Error', 'Failed to start recording. Please try again.', true);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('python:stop-recording', async () => {
    if (!pythonManager) {
      logger.error('IPC', 'Stop recording failed - Python manager not ready');
      return { success: false, error: 'Python manager not ready' };
    }
    try {
      logger.info('IPC', 'Stopping recording');
      const result = await pythonManager.sendCommand('stop_recording');
      isRecording = false;
      updateTrayState('Idle');
      updateTrayIcon('idle');
      return { success: true, data: result };
    } catch (error) {
      logger.error('IPC', 'Failed to stop recording', error);
      showNotification('Processing Error', 'Failed to process recording. Please try again.', true);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('python:status', async () => {
    if (!pythonManager) return { status: 'disconnected' };
    return { status: pythonManager.getStatus() };
  });
}

/**
 * Setup global hotkey listener for Ctrl+Shift+Space
 */
function setupGlobalHotkey(): void {
  try {
    let lastHotkeyPress = 0;
    const HOTKEY_DEBOUNCE_MS = 500;

    const ret = globalShortcut.register('Control+Alt+D', async () => {
      const now = Date.now();
      if (now - lastHotkeyPress < HOTKEY_DEBOUNCE_MS) {
        logger.debug('HOTKEY', 'Ignoring debounce hotkey press');
        return;
      }
      lastHotkeyPress = now;

      logger.debug('HOTKEY', 'Hotkey pressed: Ctrl+Alt+D', { isRecording });

      if (!pythonManager) {
        logger.warn('HOTKEY', 'Python manager not initialized');
        return;
      }

      if (isRecording) {
        // Stop recording
        logger.info('HOTKEY', 'Stopping recording');
        isRecording = false;
        updateTrayIcon('processing');
        updateTrayState('Processing');

        try {
          await pythonManager.sendCommand('stop_recording');
        } catch (error) {
          logger.error('HOTKEY', 'Failed to stop recording', error);
          updateTrayIcon('idle');
          updateTrayState('Idle');
        }
      } else {
        // Start recording
        logger.info('HOTKEY', 'Starting recording');
        isRecording = true;
        updateTrayIcon('recording');
        updateTrayState('Recording');

        try {
          await pythonManager.sendCommand('start_recording');
        } catch (error) {
          logger.error('HOTKEY', 'Failed to start recording', error);
          isRecording = false;
          updateTrayIcon('idle');
          updateTrayState('Idle');
        }
      }
    });

    if (!ret) {
      logger.warn('HOTKEY', 'Failed to register global hotkey');
      showNotification(
        'Hotkey Registration Failed',
        'Could not register Ctrl+Alt+D. Another application may be using it.',
        true
      );
    } else {
      logger.info('HOTKEY', 'Global hotkey registered successfully', { hotkey: 'Ctrl+Alt+D' });
    }
  } catch (error) {
    logger.error('HOTKEY', 'Error registering global hotkey', error);
    showNotification(
      'Hotkey Error',
      'Failed to register global hotkey. Please restart the application.',
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
    ipcMain.handle('get-initial-state', () => {
      return {
        status: pythonManager?.getStatus() || 'disconnected',
        isRecording
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
