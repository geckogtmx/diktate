/**
 * Tray Manager Service
 * Extracted from main.ts as part of GAP 5 (main.ts Monolith Decomposition)
 *
 * Manages system tray icon, menu, and state updates
 */

import { Tray, Menu, nativeImage, NativeImage, BrowserWindow, shell, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Store from 'electron-store';
import { UserSettings } from '../types/settings';
import { logger } from '../utils/logger';
import { showNotification } from './notificationService';

export interface TrayManagerDependencies {
  store: Store<UserSettings>;
  getWindows: () => {
    debugWindow: BrowserWindow | null;
    settingsWindow: BrowserWindow | null;
  };
  createDebugWindow: () => void;
  createSettingsWindow: () => void;
}

export class TrayManager {
  private tray: Tray | null = null;
  private deps: TrayManagerDependencies;

  constructor(deps: TrayManagerDependencies) {
    this.deps = deps;
  }

  /**
   * Create a simple colored icon programmatically
   * Used as fallback when PNG assets are missing
   */
  private createSimpleIcon(color: string): NativeImage {
    // Create a simple 16x16 colored square as a PNG buffer
    const size = 16;
    const channels = 4; // RGBA
    const buffer = Buffer.alloc(size * size * channels);

    const colors: { [key: string]: [number, number, number] } = {
      gray: [128, 128, 128],
      red: [255, 0, 0],
      blue: [0, 0, 255],
    };

    const rgb = colors[color] || [128, 128, 128];

    for (let i = 0; i < size * size; i++) {
      const offset = i * channels;
      buffer[offset] = rgb[0]; // R
      buffer[offset + 1] = rgb[1]; // G
      buffer[offset + 2] = rgb[2]; // B
      buffer[offset + 3] = 255; // A (fully opaque)
    }

    return nativeImage.createFromBuffer(buffer, { width: size, height: size });
  }

  /**
   * Get tray icon for a given state
   * Public method used by notification service
   */
  public getIcon(state: string): NativeImage {
    const assetsDir = path.join(__dirname, '..', 'assets');
    let iconName = 'icon.png'; // Default to the main app icon

    // In future we can have state-specific variants of the main icon
    if (state === 'recording') iconName = 'icon-recording.png';
    else if (state === 'processing') iconName = 'icon-processing.png';

    const iconPath = path.join(assetsDir, iconName);

    // Try to load PNG from file
    if (fs.existsSync(iconPath)) {
      try {
        return nativeImage.createFromPath(iconPath);
      } catch (err) {
        logger.warn('MAIN', `Failed to load icon from ${iconPath}`, { error: String(err) });
      }
    }

    // Stick with main icon if state icon missing
    const mainIconPath = path.join(assetsDir, 'icon.png');
    if (state !== 'idle' && fs.existsSync(mainIconPath)) {
      return nativeImage.createFromPath(mainIconPath);
    }

    // Fallback to programmatically created icon
    const color = state === 'recording' ? 'red' : state === 'processing' ? 'blue' : 'gray';

    logger.info('MAIN', `Using programmatic icon for state: ${state}`);
    return this.createSimpleIcon(color);
  }

  /**
   * Build tray menu template
   */
  private buildTrayMenu(state: string = 'Idle'): Electron.MenuItemConstructorOptions[] {
    // SPEC_038: Use global localModel setting
    const currentModel =
      this.deps.store.get('localModel') ||
      this.deps.store.get('defaultOllamaModel') ||
      'No model selected';

    return [
      {
        label: `Status: ${state}`,
        enabled: false,
      },
      {
        label: `Model: ${currentModel}`,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => this.deps.createSettingsWindow(),
      },
      {
        label: 'Control Panel',
        click: () => {
          this.deps.createDebugWindow();
          const windows = this.deps.getWindows();
          windows.debugWindow?.show();
        },
      },
      {
        label: 'Show Logs',
        click: () => {
          const logDir = path.join(app.getPath('home'), '.diktate', 'logs');
          shell.openPath(logDir).catch((err) => {
            logger.error('MAIN', 'Failed to open logs folder', err);
            showNotification('Error', 'Could not open logs folder', true, this.getIcon.bind(this));
          });
        },
      },
      { type: 'separator' },
      {
        label: 'Force Restart',
        click: () => {
          logger.info('MAIN', 'Force restart initiated from tray menu');
          showNotification(
            'Restarting dIKtate',
            'The app will restart for a clean startup. This may take a few seconds...',
            false,
            this.getIcon.bind(this)
          );
          // Give notification time to show, then restart
          setTimeout(() => {
            app.relaunch();
            app.exit(0);
          }, 500);
        },
      },
      { type: 'separator' },
      {
        label: 'Check for Updates',
        click: () => {
          shell.openExternal('https://github.com/diktate/diktate/releases').catch((err) => {
            logger.error('MAIN', 'Failed to open releases page', err);
          });
        },
      },
      { type: 'separator' },
      {
        label: 'Quit dIKtate',
        accelerator: 'CommandOrControl+Q',
        click: () => {
          const windows = this.deps.getWindows();
          windows.debugWindow?.destroy();
          app.quit();
        },
      },
    ];
  }

  /**
   * Initialize system tray icon
   */
  public initializeTray(): void {
    this.tray = new Tray(this.getIcon('Idle'));

    // SPEC_035: Double-click tray to open Control Panel
    this.tray.on('double-click', () => {
      logger.info('MAIN', 'Tray double-click: Opening Control Panel');
      this.deps.createDebugWindow();
    });

    const contextMenu = Menu.buildFromTemplate(this.buildTrayMenu('Idle'));
    this.tray.setContextMenu(contextMenu);

    this.updateTrayTooltip();
  }

  /**
   * Update tray tooltip to show current model and mode
   */
  public updateTrayTooltip(): void {
    if (!this.tray) return;

    const mode = this.deps.store.get('processingMode', 'local').toUpperCase();
    // SPEC_038: Use global localModel setting
    const model =
      this.deps.store.get('localModel') || this.deps.store.get('defaultOllamaModel') || 'No model';
    this.tray.setToolTip(`dIKtate [${mode}] - ${model}\nCtrl+Alt+D: Dictate | Ctrl+Alt+A: Ask`);
  }

  /**
   * Update tray menu with current state
   */
  public updateTrayState(state: string): void {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate(this.buildTrayMenu(state));
    this.tray.setContextMenu(contextMenu);

    // Also send status to renderer
    const windows = this.deps.getWindows();
    if (windows.debugWindow) {
      windows.debugWindow.webContents.send('status-update', state);
    }
  }

  /**
   * Update tray icon based on state
   */
  public updateTrayIcon(state: string): void {
    if (!this.tray) return;

    const icon = this.getIcon(state);
    try {
      this.tray.setImage(icon);
    } catch (error) {
      logger.error('MAIN', 'Failed to set tray icon', error);
    }
  }

  /**
   * Set custom tray tooltip (used for mute warning)
   */
  public setTooltip(text: string): void {
    if (!this.tray) return;
    this.tray.setToolTip(text);
  }

  /**
   * Destroy tray icon (cleanup)
   */
  public destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
