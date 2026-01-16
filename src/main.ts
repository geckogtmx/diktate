/**
 * Main Electron process for dIKtate
 * Handles system tray, Python subprocess, and global hotkey
 */

import { app, Tray, Menu, ipcMain, globalShortcut, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { PythonManager } from './services/pythonManager';

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

let tray: Tray | null = null;
let pythonManager: PythonManager | null = null;
let isRecording: boolean = false;

/**
 * Create or get tray icon path
 */
function getIconPath(state: string): string {
  const assetsDir = path.join(__dirname, '..', 'assets');
  const iconName = state === 'recording' ? 'icon-recording.png' :
                   state === 'processing' ? 'icon-processing.png' :
                   'icon-idle.png';
  const iconPath = path.join(assetsDir, iconName);

  // Use SVG fallback if PNG doesn't exist
  const svgPath = path.join(assetsDir, iconName.replace('.png', '.svg'));
  if (!fs.existsSync(iconPath) && fs.existsSync(svgPath)) {
    return svgPath;
  }

  return iconPath;
}

/**
 * Initialize system tray icon
 */
function initializeTray(): void {
  const iconPath = getIconPath('idle');

  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Status: Idle',
      enabled: false,
      id: 'status'
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
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.setToolTip('dIKtate - Press Ctrl+Shift+Space to dictate');
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
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

/**
 * Update tray icon based on state
 */
function updateTrayIcon(state: string): void {
  if (!tray) return;

  const iconPath = getIconPath(state);
  try {
    tray.setImage(iconPath);
  } catch (error) {
    console.error(`[MAIN] Failed to set tray icon: ${error}`);
  }
}

/**
 * Handle Python manager events
 */
function setupPythonEventHandlers(): void {
  if (!pythonManager) return;

  pythonManager.on('state-change', (state: string) => {
    console.log(`[MAIN] Python state changed: ${state}`);
    updateTrayState(state);
    updateTrayIcon(state);
  });

  pythonManager.on('error', (error: Error) => {
    console.error(`[MAIN] Python error: ${error.message}`);
  });

  pythonManager.on('ready', () => {
    console.log('[MAIN] Python manager ready');
  });
}

/**
 * Setup IPC handlers for communication with Python
 */
function setupIpcHandlers(): void {
  ipcMain.handle('python:start-recording', async () => {
    if (!pythonManager) return { success: false, error: 'Python manager not ready' };
    try {
      const result = await pythonManager.sendCommand('start_recording');
      isRecording = true;
      updateTrayState('Recording');
      updateTrayIcon('recording');
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('python:stop-recording', async () => {
    if (!pythonManager) return { success: false, error: 'Python manager not ready' };
    try {
      const result = await pythonManager.sendCommand('stop_recording');
      isRecording = false;
      updateTrayState('Idle');
      updateTrayIcon('idle');
      return { success: true, data: result };
    } catch (error) {
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
    const ret = globalShortcut.register('Control+Shift+Space', () => {
      console.log('[MAIN] Hotkey pressed: Ctrl+Shift+Space');

      if (isRecording) {
        // Stop recording
        ipcMain.emit('hotkey-released');
      } else {
        // Start recording
        ipcMain.emit('hotkey-pressed');
      }
    });

    if (!ret) {
      console.warn('[MAIN] Failed to register global hotkey');
    } else {
      console.log('[MAIN] Global hotkey registered: Ctrl+Shift+Space');
    }
  } catch (error) {
    console.error('[MAIN] Error registering hotkey:', error);
  }
}

/**
 * Initialize the application
 */
async function initialize(): Promise<void> {
  try {
    console.log('[MAIN] Initializing dIKtate...');

    // Create user data directory for logs
    const userDataPath = app.getPath('userData');
    const logsPath = path.join(userDataPath, 'logs');
    if (!fs.existsSync(logsPath)) {
      fs.mkdirSync(logsPath, { recursive: true });
    }

    // Initialize tray
    initializeTray();
    console.log('[MAIN] System tray initialized');

    // Setup IPC handlers
    setupIpcHandlers();
    console.log('[MAIN] IPC handlers registered');

    // Setup global hotkey
    setupGlobalHotkey();
    console.log('[MAIN] Global hotkey setup complete');

    // Initialize Python manager
    const pythonExePath = path.join(__dirname, '..', 'python', 'venv', 'Scripts', 'python.exe');
    const pythonScriptPath = path.join(__dirname, '..', 'python', 'ipc_server.py');

    pythonManager = new PythonManager(pythonExePath, pythonScriptPath);
    setupPythonEventHandlers();

    await pythonManager.start();
    console.log('[MAIN] dIKtate initialized successfully');

  } catch (error) {
    console.error('[MAIN] Failed to initialize:', error);
    app.quit();
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
  // Unregister global hotkey
  globalShortcut.unregisterAll();

  if (pythonManager) {
    await pythonManager.stop();
  }
});

console.log('[MAIN] dIKtate Electron main process starting...');
