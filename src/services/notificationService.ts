/**
 * Notification Service
 * Extracted from main.ts as part of GAP 5 (main.ts Monolith Decomposition)
 *
 * Handles system notifications and sound playback
 */

import { Notification, NativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import child_process from 'child_process';
import { logger } from '../utils/logger';
import { redactSensitive } from '../utils/ipcSchemas';

// Encapsulated module state for sound playback lock
let soundPlaybackLock = false;

/**
 * Show a system notification with title and body
 * @param title - Notification title
 * @param body - Notification body text
 * @param isError - Whether this is an error notification (affects icon and urgency)
 * @param getIcon - Function to retrieve icon for the notification
 */
export function showNotification(
  title: string,
  body: string,
  isError: boolean = false,
  getIcon: (state: string) => NativeImage
): void {
  if (!Notification.isSupported()) {
    logger.warn('MAIN', 'Notifications not supported on this system');
    return;
  }

  try {
    const icon = getIcon(isError ? 'idle' : 'processing');
    const notification = new Notification({
      title,
      body,
      icon: icon, // NativeImage accepted directly, no toDataURL() conversion needed
      silent: false,
      urgency: isError ? 'critical' : 'normal',
    });

    notification.show();
    logger.info('MAIN', 'Notification shown', { title, body: redactSensitive(body, 50) });
  } catch (error) {
    logger.error('MAIN', 'Failed to show notification', error);
  }
}

/**
 * Play a sound file using PowerShell SoundPlayer
 * SPEC_008: Security-hardened with strict input validation
 *
 * @param soundName - Name of the sound file (without extension) in assets/sounds/
 */
export function playSound(soundName: string): void {
  if (!soundName || soundName === 'none') return;

  // Prevent overlapping sound playback
  if (soundPlaybackLock) {
    logger.debug('MAIN', `[SOUND] Skipping ${soundName} - playback already in progress`);
    return;
  }

  // SECURITY (SPEC_008): Strict whitelist validation to prevent command injection
  // Only allow alphanumeric characters, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(soundName)) {
    logger.warn('MAIN', `[SECURITY] Blocked unsafe sound name: ${soundName}`);
    return;
  }

  // SECURITY: Additional defense - ensure no path traversal
  if (path.basename(soundName) !== soundName) {
    logger.warn('MAIN', `[SECURITY] Blocked path traversal attempt in sound name: ${soundName}`);
    return;
  }

  const soundPath = path.join(__dirname, '..', '..', 'assets', 'sounds', `${soundName}.wav`);

  if (!fs.existsSync(soundPath)) {
    logger.warn('MAIN', `Sound file not found: ${soundPath}`);
    return;
  }

  try {
    // Using Hidden window style and .PlaySync() to ensure process stays alive
    const psCommand = `(New-Object System.Media.SoundPlayer '${soundPath}').PlaySync()`;
    const execTimestamp = Date.now();
    soundPlaybackLock = true;
    logger.debug('MAIN', `[SOUND] Spawning PowerShell [${execTimestamp}] for: ${soundName}`);
    child_process.exec(
      `powershell -c "${psCommand}"`,
      { windowsHide: true },
      (error: Error | null) => {
        soundPlaybackLock = false;
        if (error) {
          logger.error('MAIN', `[SOUND] Playback failed [${execTimestamp}]`, error);
        } else {
          logger.debug('MAIN', `[SOUND] Playback complete [${execTimestamp}]`);
        }
      }
    );
  } catch (e) {
    soundPlaybackLock = false;
    logger.error('MAIN', 'Failed to trigger sound', e);
  }
}
