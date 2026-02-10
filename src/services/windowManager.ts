/**
 * Window Manager Service
 * Extracted from main.ts as part of GAP 5 (main.ts Monolith Decomposition)
 *
 * Manages BrowserWindow creation and lifecycle for debug, settings, and loading windows
 */

import { BrowserWindow, ipcMain, NativeImage } from 'electron';
import * as path from 'path';
import { logger } from '../utils/logger';
import { PythonManager } from './pythonManager';

export interface WindowManagerDependencies {
  getIcon: (state: string) => NativeImage | undefined;
  getPythonManager: () => PythonManager | null;
}

export class WindowManager {
  private debugWindow: BrowserWindow | null = null;
  private settingsWindow: BrowserWindow | null = null;
  private loadingWindow: BrowserWindow | null = null;
  private deps: WindowManagerDependencies;

  constructor(deps: WindowManagerDependencies) {
    this.deps = deps;
    this.registerLoadingActionHandler();
  }

  // --- Window getters ---
  getDebugWindow(): BrowserWindow | null {
    return this.debugWindow;
  }

  getSettingsWindow(): BrowserWindow | null {
    return this.settingsWindow;
  }

  getLoadingWindow(): BrowserWindow | null {
    return this.loadingWindow;
  }

  getWindows(): {
    debugWindow: BrowserWindow | null;
    settingsWindow: BrowserWindow | null;
  } {
    return {
      debugWindow: this.debugWindow,
      settingsWindow: this.settingsWindow,
    };
  }

  /**
   * Create debug dashboard window
   */
  createDebugWindow(): void {
    if (this.debugWindow) {
      if (this.debugWindow.isDestroyed()) {
        this.debugWindow = null;
      } else {
        this.debugWindow.show();
        return;
      }
    }

    this.debugWindow = new BrowserWindow({
      width: 400,
      height: 265,
      show: true,
      alwaysOnTop: true,
      frame: false,
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      title: 'dIKtate Status',
      icon: this.deps.getIcon('idle'),
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
    });

    this.debugWindow.loadFile(path.join(__dirname, '..', 'index.html'));

    // Remove menu bar
    this.debugWindow.setMenuBarVisibility(false);

    this.debugWindow.on('close', (e) => {
      // Just hide instead of closing
      e.preventDefault();
      this.debugWindow?.hide();
    });

    this.debugWindow.on('closed', () => {
      this.debugWindow = null;
    });
  }

  /**
   * Create Settings Window
   */
  createSettingsWindow(): void {
    if (this.settingsWindow) {
      this.settingsWindow.show();
      return;
    }

    this.settingsWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: true,
      title: 'dIKtate Settings',
      icon: this.deps.getIcon('idle'),
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preloadSettings.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    });

    this.settingsWindow.loadFile(path.join(__dirname, '..', 'settings.html'));

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });
  }

  /**
   * Create the Loading Window (SPEC_035)
   */
  createLoadingWindow(): void {
    if (this.loadingWindow) return;

    this.loadingWindow = new BrowserWindow({
      width: 450,
      height: 380,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      backgroundColor: '#002029',
      icon: this.deps.getIcon('idle'),
      show: false, // Don't show until ready-to-show to prevent "not responding"
      webPreferences: {
        preload: path.join(__dirname, '..', 'preloadLoading.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    this.loadingWindow.loadFile(path.join(__dirname, '..', 'loading.html'));

    // Show window only when it's ready to prevent "not responding" flash
    this.loadingWindow.once('ready-to-show', () => {
      if (this.loadingWindow) {
        this.loadingWindow.show();
      }
    });

    this.loadingWindow.on('closed', () => {
      this.loadingWindow = null;
    });
  }

  /**
   * Register IPC handler for loading window actions
   */
  private registerLoadingActionHandler(): void {
    ipcMain.on('loading-action', (_event, action: string) => {
      logger.info('MAIN', `Loading window action received: ${action}`);

      // Trigger quick Ollama warmup in Python (uses the production HTTP session)
      const pythonManager = this.deps.getPythonManager();
      if (pythonManager && pythonManager.isProcessRunning()) {
        logger.info('MAIN', `Sending quick_warmup command to Python (triggered by: ${action})`);
        pythonManager
          .sendCommand('quick_warmup')
          .then((result) => {
            logger.info('MAIN', `Quick warmup response: ${JSON.stringify(result)}`);
          })
          .catch((err) => {
            logger.warn('MAIN', `Quick warmup command failed (non-fatal): ${err}`);
          });
      } else {
        logger.warn('MAIN', 'Python not running, skipping quick warmup');
      }

      if (action === 'open-cp') {
        this.createDebugWindow();
        if (this.loadingWindow) this.loadingWindow.close();
      } else if (action === 'open-settings') {
        this.createSettingsWindow();
        if (this.loadingWindow) this.loadingWindow.close();
      } else if (action === 'close') {
        if (this.loadingWindow) this.loadingWindow.close();
      }
    });
  }
}
