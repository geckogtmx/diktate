/**
 * Trial Account IPC Handlers (SPEC_042)
 * Manages dikta.me managed Gemini trial credits:
 * - Login via browser OAuth → deeplink callback
 * - Logout / clear session
 * - Fetch trial status from dikta.me API
 */

import { ipcMain, safeStorage, shell, BrowserWindow } from 'electron';
import Store from 'electron-store';
import { UserSettings } from '../types/settings';
import { logger } from '../utils/logger';

// SPEC_042: dikta.me API base URL
const DIKTA_API_BASE =
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://dikta.me';

export const SUPABASE_EDGE_FUNCTION_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:54321/functions/v1/gemini-proxy'
    : 'https://volwljbiyzvvcqqdojyf.supabase.co/functions/v1/gemini-proxy';

export interface TrialStatus {
  loggedIn: boolean;
  email: string;
  wordsUsed: number;
  wordsQuota: number;
  daysRemaining: number;
  expiresAt: string;
  trialActive: boolean;
}

export interface TrialHandlerDependencies {
  store: Store<UserSettings>;
  /** Notify the settings window of a trial status update */
  notifySettingsWindow: (event: string, data?: unknown) => void;
  /** Trigger a Python config re-sync after token change */
  syncPythonConfig: () => void;
}

export function registerTrialHandlers(deps: TrialHandlerDependencies): void {
  const { store } = deps;

  // ── trial:get-status ─────────────────────────────────────────────────────
  ipcMain.handle('trial:get-status', (): TrialStatus => {
    const hasToken = !!store.get('encryptedTrialSessionToken');
    return {
      loggedIn: hasToken,
      email: store.get('trialEmail') ?? '',
      wordsUsed: store.get('trialWordsUsed') ?? 0,
      wordsQuota: store.get('trialWordsQuota') ?? 15000,
      daysRemaining: store.get('trialDaysRemaining') ?? 0,
      expiresAt: store.get('trialExpiresAt') ?? '',
      trialActive: store.get('trialActive') ?? false,
    };
  });

  // ── trial:login ───────────────────────────────────────────────────────────
  ipcMain.handle('trial:login', async () => {
    const loginUrl = `${DIKTA_API_BASE}/login?mode=app`;
    logger.info('TRIAL', `Opening browser for trial login: ${loginUrl}`);
    await shell.openExternal(loginUrl);
    return { started: true };
  });

  // ── trial:logout ──────────────────────────────────────────────────────────
  ipcMain.handle('trial:logout', () => {
    clearTrialSession(store);
    deps.syncPythonConfig();
    deps.notifySettingsWindow('trial:status-updated');
    logger.info('TRIAL', 'User logged out of trial account');
    return { success: true };
  });

  // ── trial:refresh ─────────────────────────────────────────────────────────
  ipcMain.handle('trial:refresh', async (): Promise<TrialStatus | { error: string }> => {
    const encryptedToken = store.get('encryptedTrialSessionToken');
    if (!encryptedToken || !safeStorage.isEncryptionAvailable()) {
      return { error: 'Not logged in' };
    }

    let token: string;
    try {
      const buf = Buffer.from(encryptedToken as string, 'base64');
      token = safeStorage.decryptString(buf);
    } catch (err) {
      logger.error('TRIAL', 'Failed to decrypt trial session token', { error: String(err) });
      clearTrialSession(store);
      return { error: 'Token decryption failed' };
    }

    try {
      const response = await fetch(`${DIKTA_API_BASE}/api/trial/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        logger.warn('TRIAL', 'Trial token expired — clearing session');
        clearTrialSession(store);
        deps.notifySettingsWindow('trial:status-updated');
        return { error: 'Session expired. Please log in again.' };
      }

      if (!response.ok) {
        logger.warn('TRIAL', `Trial status API returned ${response.status}`);
        return { error: `API error: ${response.status}` };
      }

      const data = (await response.json()) as {
        wordsUsed: number;
        wordsQuota: number;
        daysRemaining: number;
        expiresAt: string;
        trialActive: boolean;
        hasCustomKey: boolean;
      };

      // Cache the refreshed values in store
      store.set('trialWordsUsed', data.wordsUsed);
      store.set('trialWordsQuota', data.wordsQuota);
      store.set('trialDaysRemaining', data.daysRemaining);
      store.set('trialExpiresAt', data.expiresAt);
      store.set('trialActive', data.trialActive);
      store.set('trialLastSynced', new Date().toISOString());

      deps.notifySettingsWindow('trial:status-updated');
      logger.info(
        'TRIAL',
        `Trial status refreshed: ${data.wordsUsed}/${data.wordsQuota} words, ${data.daysRemaining} days remaining`
      );

      return {
        loggedIn: true,
        email: store.get('trialEmail') ?? '',
        wordsUsed: data.wordsUsed,
        wordsQuota: data.wordsQuota,
        daysRemaining: data.daysRemaining,
        expiresAt: data.expiresAt,
        trialActive: data.trialActive,
      };
    } catch (err) {
      logger.error('TRIAL', 'Failed to refresh trial status', { error: String(err) });
      return { error: 'Network error' };
    }
  });
}

/**
 * Called from main.ts when the diktate://auth deeplink is received.
 * Stores the Supabase JWT encrypted and fetches initial trial status.
 */
export async function handleAuthDeeplink(
  token: string,
  store: Store<UserSettings>,
  deps: TrialHandlerDependencies
): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    logger.error('TRIAL', 'safeStorage not available — cannot store trial token');
    return;
  }

  try {
    const encrypted = safeStorage.encryptString(token);
    store.set('encryptedTrialSessionToken', encrypted.toString('base64'));
    logger.info('TRIAL', 'Trial session token stored securely');
  } catch (err) {
    logger.error('TRIAL', 'Failed to encrypt trial session token', { error: String(err) });
    return;
  }

  // Attempt to fetch trial status and extract email from JWT payload
  try {
    // JWT payload is base64url-encoded middle segment
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
        email?: string;
      };
      if (payload.email) {
        store.set('trialEmail', payload.email);
      }
    }
  } catch {
    // Non-critical: email display can fail silently
  }

  // Sync Python config so the new token is available immediately
  deps.syncPythonConfig();

  // Fetch fresh trial quota numbers
  await refreshTrialStatusInternal(store, deps);

  // Notify settings window to re-render the panel
  deps.notifySettingsWindow('trial:status-updated');

  // Bring the settings window to focus so the user sees the result
  const settingsWin = BrowserWindow.getAllWindows().find((w) =>
    w.webContents.getURL().includes('settings')
  );
  if (settingsWin) {
    settingsWin.show();
    settingsWin.focus();
  }
}

/**
 * Perform an internal trial status refresh (used after deeplink login).
 * Does NOT go through IPC — called directly from main process.
 */
export async function refreshTrialStatusInternal(
  store: Store<UserSettings>,
  _deps: TrialHandlerDependencies
): Promise<void> {
  const encryptedToken = store.get('encryptedTrialSessionToken');
  if (!encryptedToken || !safeStorage.isEncryptionAvailable()) return;

  let token: string;
  try {
    const buf = Buffer.from(encryptedToken as string, 'base64');
    token = safeStorage.decryptString(buf);
  } catch {
    return;
  }

  const apiBase =
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://dikta.me';

  try {
    const response = await fetch(`${apiBase}/api/trial/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;

    const data = (await response.json()) as {
      wordsUsed: number;
      wordsQuota: number;
      daysRemaining: number;
      expiresAt: string;
      trialActive: boolean;
    };

    store.set('trialWordsUsed', data.wordsUsed);
    store.set('trialWordsQuota', data.wordsQuota);
    store.set('trialDaysRemaining', data.daysRemaining);
    store.set('trialExpiresAt', data.expiresAt);
    store.set('trialActive', data.trialActive);
    store.set('trialLastSynced', new Date().toISOString());

    logger.info('TRIAL', 'Initial trial status fetched after deeplink login');
  } catch (err) {
    logger.warn('TRIAL', 'Could not fetch initial trial status', { error: String(err) });
  }
}

function clearTrialSession(store: Store<UserSettings>): void {
  store.delete('encryptedTrialSessionToken' as keyof UserSettings);
  store.set('trialEmail', '');
  store.set('trialWordsUsed', 0);
  store.set('trialDaysRemaining', 0);
  store.set('trialExpiresAt', '');
  store.set('trialActive', false);
  store.set('trialLastSynced', '');
}
