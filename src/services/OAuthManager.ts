/**
 * OAuthManager - Manages Google OAuth 2.0 PKCE flows and token lifecycle
 * Handles token storage, refresh scheduling, multi-account support, and error recovery
 */

import * as crypto from 'crypto';
import * as http from 'http';
import { URL } from 'url';
import Store from 'electron-store';
import { BrowserWindow } from 'electron';
import { logger } from '../utils/logger';

// ============================================================================
// Event Types
// ============================================================================

export enum OAuthEventType {
  TOKEN_REFRESHED = 'token-refreshed',
  TOKEN_REFRESH_FAILED = 'token-refresh-failed',
  TOKEN_REVOKED = 'token-revoked',
  TOKEN_EXPIRED = 'token-expired',
  QUOTA_WARNING = 'quota-warning',
  QUOTA_EXCEEDED = 'quota-exceeded',
  ACCOUNT_STATUS_CHANGED = 'account-status-changed',
  NETWORK_ERROR = 'network-error'
}

export interface OAuthEvent {
  type: OAuthEventType;
  accountId: string;
  data?: any;
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface OAuthAccount {
  accountId: string;
  provider: 'google';
  email: string;
  displayName?: string;

  // Tokens (stored encrypted)
  accessToken: string;
  refreshToken: string;

  // Timestamps
  expiresAt: number;
  createdAt: number;
  lastRefreshedAt: number;
  lastUsedAt: number;

  // Quota tracking
  quotaUsedToday: number;
  quotaLimitDaily: number;
  quotaResetAt: number;

  // Status
  status: AccountStatus;
  lastError?: string;
}

export enum AccountStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  ERROR = 'error',
  REFRESHING = 'refreshing'
}

interface PKCEFlowState {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  provider: string;
  createdAt: number;
  expiresAt: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: 'Bearer';
  scope: string;
}

interface UserInfo {
  email: string;
  name?: string;
  picture?: string;
}

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  resetAt: number;
  percentUsed: number;
}

// ============================================================================
// Constants
// ============================================================================


const getGoogleClientId = () => process.env.GOOGLE_CLIENT_ID || '';
const getGoogleClientSecret = () => process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_PORT = 3005;
const REDIRECT_HOST = 'localhost';
const PKCE_FLOW_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const REFRESH_TIMEOUT = 30 * 1000; // 30 seconds
const MAX_CONCURRENT_ACCOUNTS = 3;

// ============================================================================
// OAuthManager Class
// ============================================================================

export class OAuthManager {
  private store: Store;
  private accounts: Map<string, OAuthAccount>;
  private activeAccountId: string | null;
  private refreshTimers: Map<string, NodeJS.Timeout>;
  private redirectServer: http.Server | null;
  private accountLocks: Map<string, Promise<any>>;
  private eventListeners: Map<OAuthEventType, Array<(event: OAuthEvent) => void>>;

  constructor(store: Store) {
    this.store = store;
    this.accounts = new Map();
    this.activeAccountId = null;
    this.refreshTimers = new Map();
    this.redirectServer = null;
    this.accountLocks = new Map();
    this.eventListeners = new Map();

    // Validate credentials
    if (!getGoogleClientId() || !getGoogleClientSecret()) {
      logger.warn(
        'OAuthManager',
        'Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env'
      );
    }

    this.loadAccounts();
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: OAuthEvent): void {
    const listeners = this.eventListeners.get(event.type) || [];
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (err) {
        logger.error('OAuthManager', `Event listener error for ${event.type}`, err);
      }
    }

    // Also notify renderer processes
    this.notifyRenderers(event);
  }

  /**
   * Notify all renderer processes of OAuth events
   */
  private notifyRenderers(event: OAuthEvent): void {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      if (!window.isDestroyed()) {
        window.webContents.send('oauth-event', event);
      }
    }
  }

  /**
   * Subscribe to OAuth events
   */
  on(type: OAuthEventType, listener: (event: OAuthEvent) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  /**
   * Unsubscribe from OAuth events
   */
  off(type: OAuthEventType, listener: (event: OAuthEvent) => void): void {
    const listeners = this.eventListeners.get(type);
    if (!listeners) return;

    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * Load accounts from encrypted storage
   */
  private loadAccounts(): void {
    try {
      const activeId = this.store.get('oauth_active_account_id', null) as string | null;
      this.activeAccountId = activeId;

      const encrypted = this.store.get('oauth_accounts', null) as string | null;
      if (!encrypted) {
        this.accounts.clear();
        return;
      }

      const decrypted = this.decryptData(encrypted);
      const accountsArray = JSON.parse(decrypted) as OAuthAccount[];

      this.accounts.clear();
      for (const account of accountsArray) {
        this.accounts.set(account.accountId, account);

        // Schedule refresh if token exists and is within refresh window
        if (account.status === AccountStatus.ACTIVE && account.accessToken) {
          const timeUntilExpiry = account.expiresAt - Date.now();
          if (timeUntilExpiry > 0) {
            this.scheduleTokenRefresh(account.accountId);
          } else if (timeUntilExpiry > -5 * 60 * 1000) {
            // Token expired less than 5 minutes ago, refresh immediately
            this.refreshToken(account.accountId).catch(err => {
              logger.warn('OAuthManager', `Startup refresh failed for ${account.email}`, err);
            });
          }
        }
      }

      logger.info('OAuthManager', `Loaded ${this.accounts.size} OAuth accounts`);
    } catch (error) {
      logger.error('OAuthManager', 'Failed to load accounts', error);
      this.accounts.clear();
    }
  }

  /**
   * Save accounts to encrypted storage
   */
  private saveAccounts(): void {
    try {
      const accountsArray = Array.from(this.accounts.values());
      const json = JSON.stringify(accountsArray);
      const encrypted = this.encryptData(json);

      this.store.set('oauth_accounts', encrypted);
      logger.debug('OAuthManager', 'Accounts saved');
    } catch (error) {
      logger.error('OAuthManager', 'Failed to save accounts', error);
    }
  }

  /**
   * Encrypt OAuth data using AES-256
   * Note: OAuth accounts use AES-256 instead of safeStorage for consistency across restarts.
   * safeStorage can be unavailable on subsequent app launches (Windows credential manager issues),
   * which would cause decryption to fail. Using consistent AES-256 ensures accounts persist reliably.
   */
  private encryptData(plaintext: string): string {
    try {
      // Always use AES-256 for OAuth accounts (consistent, cross-platform reliable)
      return this.aesEncrypt(plaintext);
    } catch (error) {
      logger.error('OAuthManager', 'Failed to encrypt OAuth account data', error);
      throw error;
    }
  }

  /**
   * Decrypt OAuth data using AES-256
   */
  private decryptData(encrypted: string): string {
    try {
      // Always use AES-256 for OAuth accounts
      return this.aesDecrypt(encrypted);
    } catch (error) {
      logger.error('OAuthManager', 'Failed to decrypt OAuth account data', error);
      throw error;
    }
  }

  /**
   * AES-256 encryption fallback
   */
  private aesEncrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Prepend IV for decryption
    return iv.toString('base64') + ':' + encrypted;
  }

  /**
   * AES-256 decryption fallback
   */
  private aesDecrypt(encrypted: string): string {
    const [ivStr, ciphertext] = encrypted.split(':');
    if (!ivStr || !ciphertext) {
      throw new Error('Invalid encrypted data format');
    }

    const key = this.getEncryptionKey();
    const iv = Buffer.from(ivStr, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Get encryption key derived from machine ID
   */
  private getEncryptionKey(): Buffer {
    // Use a fixed app secret for now
    // In production, consider using machine-id package
    const appSecret = 'diktate-oauth-spec-016-v1';
    return crypto
      .pbkdf2Sync(appSecret, 'diktate-salt', 100000, 32, 'sha256')
      .slice(0, 32);
  }

  /**
   * Apply lock for concurrent access protection
   */
  private async withLock<T>(accountId: string, operation: () => Promise<T>): Promise<T> {
    const existingLock = this.accountLocks.get(accountId);
    if (existingLock) {
      await existingLock.catch(() => { });
    }

    const lock = operation();
    this.accountLocks.set(accountId, lock);

    try {
      return await lock;
    } finally {
      this.accountLocks.delete(accountId);
    }
  }

  // ========================================================================
  // PKCE Flow
  // ========================================================================

  /**
   * Generate PKCE code verifier and challenge
   */
  private generatePKCEPair(): { verifier: string; challenge: string } {
    // Code verifier: 128 random bytes, base64url encoded
    const verifier = crypto.randomBytes(96).toString('base64url');

    // Code challenge: SHA-256 hash of verifier
    const hash = crypto.createHash('sha256').update(verifier).digest();
    const challenge = hash.toString('base64url');

    return { verifier, challenge };
  }

  /**
   * Initiate OAuth flow with PKCE
   */
  async initiateFlow(provider: string): Promise<{ authUrl: string; state: string }> {
    if (provider !== 'google') {
      throw new Error('Only Google OAuth supported');
    }

    if (!getGoogleClientId()) {
      throw new Error('Google OAuth not configured');
    }

    // Check account limit
    if (this.accounts.size >= MAX_CONCURRENT_ACCOUNTS) {
      throw new Error(
        `Maximum ${MAX_CONCURRENT_ACCOUNTS} accounts allowed. Disconnect one first.`
      );
    }

    // Generate PKCE pair
    const { verifier, challenge } = this.generatePKCEPair();
    const state = crypto.randomBytes(32).toString('base64url');

    // Store flow state
    const flowState: PKCEFlowState = {
      state,
      codeVerifier: verifier,
      codeChallenge: challenge,
      provider,
      createdAt: Date.now(),
      expiresAt: Date.now() + PKCE_FLOW_TIMEOUT
    };

    const flowsJson = JSON.stringify(flowState);
    const flowsEncrypted = this.encryptData(flowsJson);

    const flowMap = (this.store.get('oauth_pkce_states', {}) as any) || {};
    flowMap[state] = flowsEncrypted;
    this.store.set('oauth_pkce_states', flowMap);

    // Start redirect server
    const port = await this.startRedirectServer();

    // Build authorization URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', getGoogleClientId());
    authUrl.searchParams.set('redirect_uri', `http://${REDIRECT_HOST}:${port}/callback`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set(
      'scope',
      [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/generative-language.retriever'
      ].join(' ')
    );
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    logger.info('OAuthManager', 'OAuth flow initiated');

    return { authUrl: authUrl.toString(), state };
  }

  /**
   * Start local redirect server for OAuth callback
   */
  private async startRedirectServer(): Promise<number> {
    if (this.redirectServer) {
      return REDIRECT_PORT;
    }

    return new Promise((resolve, reject) => {
      this.redirectServer = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url || '', `http://${REDIRECT_HOST}:${REDIRECT_PORT}`);

          if (url.pathname !== '/callback') {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }

          const code = url.searchParams.get('code');
          const state = url.searchParams.get('state');
          const error = url.searchParams.get('error');

          if (error) {
            logger.error('OAuthManager', `OAuth error: ${error}`);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html>
                <head><title>Authorization Failed</title></head>
                <body>
                  <h1>Authorization Failed</h1>
                  <p>Error: ${error}</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `);
            this.stopRedirectServer();
            return;
          }

          if (!code || !state) {
            res.writeHead(400);
            res.end('Missing parameters');
            return;
          }

          // Validate state (CSRF protection)
          const flowMap = (this.store.get('oauth_pkce_states', {}) as any) || {};
          const encryptedFlow = flowMap[state];

          if (!encryptedFlow) {
            logger.error('OAuthManager', 'Invalid state parameter');
            res.writeHead(400);
            res.end('Invalid state');
            return;
          }

          try {
            const flowJson = this.decryptData(encryptedFlow);
            const flowState = JSON.parse(flowJson) as PKCEFlowState;

            // Check if flow is expired
            if (flowState.expiresAt < Date.now()) {
              logger.error('OAuthManager', 'OAuth flow expired');
              res.writeHead(400);
              res.end('OAuth flow expired, please try again');
              return;
            }

            // Process authorization
            await this.handleCallback(code, flowState);

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Authorization Successful</title>
                <style>
                  * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                  }

                  body {
                    background-color: #020617;
                    color: #f8fafc;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    padding: 20px;
                  }

                  .container {
                    text-align: center;
                    max-width: 400px;
                  }

                  .checkmark {
                    width: 80px;
                    height: 80px;
                    margin: 0 auto 32px;
                    background-color: #2563eb;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: pulse 2s ease-in-out infinite;
                  }

                  .checkmark svg {
                    width: 48px;
                    height: 48px;
                    stroke: white;
                    stroke-width: 2;
                    fill: none;
                  }

                  h1 {
                    font-size: 28px;
                    font-weight: 600;
                    margin-bottom: 12px;
                    letter-spacing: -0.5px;
                  }

                  p {
                    font-size: 15px;
                    color: #94a3b8;
                    line-height: 1.6;
                    margin-bottom: 24px;
                  }

                  .note {
                    font-size: 13px;
                    color: #64748b;
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                  }

                  @keyframes pulse {
                    0%, 100% {
                      opacity: 1;
                    }
                    50% {
                      opacity: 0.7;
                    }
                  }

                  @keyframes slideUp {
                    from {
                      opacity: 0;
                      transform: translateY(20px);
                    }
                    to {
                      opacity: 1;
                      transform: translateY(0);
                    }
                  }

                  .container {
                    animation: slideUp 0.6s ease-out;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="checkmark">
                    <svg viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <h1>Connected</h1>
                  <p>Your Google account has been successfully linked to dIKtate.</p>
                  <p class="note">This window will close automatically.</p>
                </div>
                <script>setTimeout(() => window.close(), 3000);</script>
              </body>
              </html>
            `);

            // Clean up flow state
            delete flowMap[state];
            this.store.set('oauth_pkce_states', flowMap);
          } catch (err) {
            logger.error('OAuthManager', 'Token exchange failed', err);
            res.writeHead(500);
            res.end('Token exchange failed');
          } finally {
            this.stopRedirectServer();
          }
        } catch (err) {
          logger.error('OAuthManager', 'Callback handler error', err);
          res.writeHead(500);
          res.end('Internal error');
        }
      });

      this.redirectServer!.listen(REDIRECT_PORT, REDIRECT_HOST, () => {
        logger.info('OAuthManager', `Redirect server listening on port ${REDIRECT_PORT}`);
        resolve(REDIRECT_PORT);
      });

      this.redirectServer!.on('error', reject);

      // Auto-close after timeout
      setTimeout(() => {
        if (this.redirectServer) {
          logger.warn('OAuthManager', 'Redirect server timeout');
          this.stopRedirectServer();
        }
      }, PKCE_FLOW_TIMEOUT);
    });
  }

  /**
   * Stop redirect server
   */
  private async stopRedirectServer(): Promise<void> {
    if (!this.redirectServer) return;

    return new Promise(resolve => {
      this.redirectServer!.close(() => {
        this.redirectServer = null;
        logger.info('OAuthManager', 'Redirect server stopped');
        resolve();
      });
    });
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  private async handleCallback(code: string, flowState: PKCEFlowState): Promise<OAuthAccount> {
    // Exchange code for tokens
    const tokens = await this.exchangeCodeForToken(code, flowState.codeVerifier);

    // Fetch user info
    const userInfo = await this.fetchUserInfo(tokens.access_token);

    // Create account
    const account: OAuthAccount = {
      accountId: crypto.randomUUID(),
      provider: 'google',
      email: userInfo.email,
      displayName: userInfo.name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      expiresAt: Date.now() + tokens.expires_in * 1000,
      createdAt: Date.now(),
      lastRefreshedAt: Date.now(),
      lastUsedAt: Date.now(),
      quotaUsedToday: 0,
      quotaLimitDaily: 1_000_000, // Free tier
      quotaResetAt: this.getNextUTCMidnight(),
      status: AccountStatus.ACTIVE
    };

    // Store account
    this.accounts.set(account.accountId, account);
    this.saveAccounts();

    // Set as active if first account
    if (!this.activeAccountId) {
      this.activeAccountId = account.accountId;
      this.store.set('oauth_active_account_id', account.accountId);
    }

    // Schedule refresh
    this.scheduleTokenRefresh(account.accountId);

    logger.info('OAuthManager', `Account connected: ${account.email}`);

    return account;
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(
    code: string,
    codeVerifier: string
  ): Promise<TokenResponse> {
    if (!getGoogleClientId() || !getGoogleClientSecret()) {
      throw new Error('OAuth credentials not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT);

    let response;
    try {
      response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: getGoogleClientId(),
          client_secret: getGoogleClientSecret(),
          code,
          code_verifier: codeVerifier,
          grant_type: 'authorization_code',
          redirect_uri: `http://${REDIRECT_HOST}:${REDIRECT_PORT}/callback`
        }).toString(),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
    }

    return (await response.json()) as TokenResponse;
  }

  /**
   * Fetch user info from Google
   */
  private async fetchUserInfo(accessToken: string): Promise<UserInfo> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT);

    let response;
    try {
      response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    return (await response.json()) as UserInfo;
  }

  // ========================================================================
  // Token Refresh
  // ========================================================================

  /**
   * Schedule proactive token refresh
   */
  private scheduleTokenRefresh(accountId: string): void {
    const account = this.accounts.get(accountId);
    if (!account) return;

    // Clear existing timer
    const existingTimer = this.refreshTimers.get(accountId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Calculate refresh time: 5 minutes before expiration
    const refreshTime = account.expiresAt - 5 * 60 * 1000;
    const delay = refreshTime - Date.now();

    if (delay <= 0) {
      // Already expired or very close, refresh immediately
      this.refreshToken(accountId).catch(err => {
        logger.warn('OAuthManager', `Immediate refresh failed: ${err.message}`);
      });
      return;
    }

    // Add jitter to prevent thundering herd (±30 seconds)
    const jitter = (Math.random() - 0.5) * 60000;
    const scheduledDelay = Math.max(0, delay + jitter);

    const timer = setTimeout(() => {
      this.refreshToken(accountId).catch(err => {
        logger.warn('OAuthManager', `Scheduled refresh failed: ${err.message}`);
      });
    }, scheduledDelay);

    this.refreshTimers.set(accountId, timer);
    logger.debug('OAuthManager', `Refresh scheduled for ${account.email} in ${scheduledDelay}ms`);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(accountId: string): Promise<void> {
    return this.withLock(accountId, async () => {
      const account = this.accounts.get(accountId);
      if (!account) throw new Error('Account not found');

      if (!account.refreshToken) {
        throw new Error('No refresh token available');
      }

      // Prevent concurrent refreshes
      if (account.status === AccountStatus.REFRESHING) {
        logger.debug('OAuthManager', 'Refresh already in progress');
        return;
      }

      account.status = AccountStatus.REFRESHING;
      this.saveAccounts();

      try {
        if (!getGoogleClientId() || !getGoogleClientSecret()) {
          throw new Error('OAuth credentials not configured');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT);

        let response;
        try {
          response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: getGoogleClientId(),
              client_secret: getGoogleClientSecret(),
              refresh_token: account.refreshToken,
              grant_type: 'refresh_token'
            }).toString(),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }));

          if (error.error === 'invalid_grant') {
            // Refresh token revoked
            account.status = AccountStatus.REVOKED;
            account.lastError = 'Access revoked in Google account settings';
            this.saveAccounts();
            logger.error('OAuthManager', `Refresh token revoked for ${account.email}`);
            throw new Error('REVOKED');
          }

          throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
        }

        const tokens = (await response.json()) as TokenResponse;

        // Update tokens
        account.accessToken = tokens.access_token;
        if (tokens.refresh_token) {
          account.refreshToken = tokens.refresh_token;
        }
        account.expiresAt = Date.now() + tokens.expires_in * 1000;
        account.lastRefreshedAt = Date.now();
        account.status = AccountStatus.ACTIVE;
        delete account.lastError;

        this.saveAccounts();

        // Schedule next refresh
        this.scheduleTokenRefresh(accountId);

        logger.info('OAuthManager', `Token refreshed for ${account.email}`);

        // Emit success event
        this.emit({
          type: OAuthEventType.TOKEN_REFRESHED,
          accountId,
          data: { email: account.email, expiresAt: account.expiresAt }
        });
      } catch (error) {
        const errorMessage = (error as Error).message;

        if (errorMessage === 'REVOKED') {
          account.status = AccountStatus.REVOKED;
          this.saveAccounts();

          // Emit revocation event
          this.emit({
            type: OAuthEventType.TOKEN_REVOKED,
            accountId,
            data: { email: account.email, reason: 'Token revoked by user' }
          });

          logger.error('OAuthManager', `Token revoked for ${account.email}`);
          throw error;
        }

        // Network or temporary error
        const isNetworkError = errorMessage.includes('ENOTFOUND') ||
          errorMessage.includes('ETIMEDOUT') ||
          errorMessage.includes('ECONNREFUSED');

        account.status = AccountStatus.ERROR;
        account.lastError = errorMessage;
        this.saveAccounts();

        // Emit failure event
        this.emit({
          type: isNetworkError ? OAuthEventType.NETWORK_ERROR : OAuthEventType.TOKEN_REFRESH_FAILED,
          accountId,
          data: { email: account.email, error: errorMessage }
        });

        // Retry with exponential backoff
        this.scheduleRefreshRetry(accountId);

        logger.error('OAuthManager', `Token refresh failed for ${account.email}`, error);
        throw error;
      }
    });
  }

  /**
   * Schedule retry with exponential backoff
   */
  private scheduleRefreshRetry(accountId: string, attempt: number = 1): void {
    if (attempt > 5) {
      logger.error('OAuthManager', `Max refresh retries exceeded for account ${accountId}`);
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);

    setTimeout(() => {
      this.refreshToken(accountId).catch(() => {
        this.scheduleRefreshRetry(accountId, attempt + 1);
      });
    }, delay);
  }

  // ========================================================================
  // Account Management
  // ========================================================================

  /**
   * Get all connected accounts
   */
  getAccounts(): OAuthAccount[] {
    return Array.from(this.accounts.values());
  }

  /**
   * Get active account
   */
  getActiveAccount(): OAuthAccount | null {
    if (!this.activeAccountId) return null;
    return this.accounts.get(this.activeAccountId) || null;
  }

  /**
   * Set active account
   */
  async setActiveAccount(accountId: string): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account) throw new Error('Account not found');

    if (account.status !== AccountStatus.ACTIVE) {
      throw new Error(`Cannot activate account with status: ${account.status}`);
    }

    this.activeAccountId = accountId;
    account.lastUsedAt = Date.now();
    this.store.set('oauth_active_account_id', accountId);
    this.saveAccounts();

    logger.info('OAuthManager', `Switched to account ${account.email}`);
  }

  /**
   * Disconnect account
   */
  async disconnectAccount(accountId: string): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account) throw new Error('Account not found');

    // Clear refresh timer
    const timer = this.refreshTimers.get(accountId);
    if (timer) {
      clearTimeout(timer);
      this.refreshTimers.delete(accountId);
    }

    // Remove account
    this.accounts.delete(accountId);

    // If was active, switch to another account
    if (this.activeAccountId === accountId) {
      const remaining = Array.from(this.accounts.values());
      if (remaining.length > 0) {
        this.activeAccountId = remaining[0].accountId;
        this.store.set('oauth_active_account_id', this.activeAccountId);
      } else {
        this.activeAccountId = null;
        this.store.delete('oauth_active_account_id');
      }
    }

    this.saveAccounts();
    logger.info('OAuthManager', `Account disconnected: ${account.email}`);
  }

  /**
   * Validate token
   */
  async validateToken(accountId: string): Promise<boolean> {
    const account = this.accounts.get(accountId);
    if (!account) return false;

    if (!account.accessToken) return false;
    if (account.status === AccountStatus.REVOKED) return false;
    if (account.expiresAt < Date.now()) return false;

    return true;
  }

  /**
   * Handle 401 Unauthorized error from API
   * Attempts to refresh the token, or marks as revoked if refresh fails
   */
  async handle401Error(accountId?: string): Promise<void> {
    const targetAccountId = accountId || this.activeAccountId;
    if (!targetAccountId) {
      logger.warn('OAuthManager', 'handle401Error called but no account specified or active');
      return;
    }

    const account = this.accounts.get(targetAccountId);
    if (!account) {
      logger.error('OAuthManager', `handle401Error: Account ${targetAccountId} not found`);
      return;
    }

    logger.warn('OAuthManager', `401 Unauthorized detected for ${account.email}, attempting token refresh`);

    try {
      // Attempt immediate refresh
      await this.refreshToken(targetAccountId);
      logger.info('OAuthManager', `Token refresh successful after 401 for ${account.email}`);
    } catch (error) {
      const errorMessage = (error as Error).message;

      if (errorMessage === 'REVOKED') {
        // Token was revoked, account already marked as REVOKED
        logger.error('OAuthManager', `Token revoked for ${account.email}, user needs to reconnect`);
      } else {
        // Other error during refresh
        logger.error('OAuthManager', `Token refresh failed after 401 for ${account.email}`, error);
      }
    }
  }

  /**
   * Handle network errors with retry logic
   * @param accountId - Account to check/refresh
   * @param error - The network error
   */
  async handleNetworkError(accountId: string, error: Error): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account) {
      logger.warn('OAuthManager', `handleNetworkError: Account ${accountId} not found`);
      return;
    }

    // Emit network error event
    this.emit({
      type: OAuthEventType.NETWORK_ERROR,
      accountId,
      data: { email: account.email, error: error.message }
    });

    // If token is close to expiry, try to refresh
    const now = Date.now();
    const timeUntilExpiry = account.expiresAt - now;
    const FIVE_MINUTES = 5 * 60 * 1000;

    if (timeUntilExpiry < FIVE_MINUTES) {
      logger.info('OAuthManager', `Token close to expiry, attempting refresh after network error`);
      try {
        await this.refreshToken(accountId);
      } catch (refreshError) {
        logger.error('OAuthManager', `Token refresh failed after network error`, refreshError);
        // Don't throw - let exponential backoff in Python retry
      }
    }
  }

  /**
   * Handle quota exceeded scenario - suggest fallback options
   * @param accountId - Account that exceeded quota
   */
  handleQuotaExceeded(accountId: string): void {
    const account = this.accounts.get(accountId);
    if (!account) return;

    const quotaInfo = this.getQuotaInfo(accountId);
    if (!quotaInfo) return;

    logger.warn('OAuthManager', `Quota exceeded for account ${accountId}`, quotaInfo);

    // Emit quota exceeded event with reset time
    this.emit({
      type: OAuthEventType.QUOTA_EXCEEDED,
      accountId,
      data: {
        email: account.email,
        used: quotaInfo.used,
        limit: quotaInfo.limit,
        resetAt: quotaInfo.resetAt,
        suggestFallback: true  // Hint to switch to local processing
      }
    });
  }

  // ========================================================================
  // Quota Tracking
  // ========================================================================

  /**
   * Get next UTC midnight timestamp
   */
  private getNextUTCMidnight(): number {
    const now = new Date();
    const tomorrow = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
    );
    return tomorrow.getTime();
  }

  /**
   * Update quota after processing
   */
  updateQuota(accountId: string, textProcessed: string): void {
    const account = this.accounts.get(accountId);
    if (!account) return;

    // Check if daily reset needed
    const now = Date.now();
    if (now >= account.quotaResetAt) {
      account.quotaUsedToday = 0;
      account.quotaResetAt = this.getNextUTCMidnight();
    }

    // Add character count
    const oldUsed = account.quotaUsedToday;
    account.quotaUsedToday += textProcessed.length;
    account.lastUsedAt = now;

    this.saveAccounts();

    // Calculate percentage used
    const percentUsed = (account.quotaUsedToday / account.quotaLimitDaily) * 100;
    const oldPercentUsed = (oldUsed / account.quotaLimitDaily) * 100;

    // Emit events at thresholds
    if (percentUsed >= 100 && oldPercentUsed < 100) {
      // Quota exceeded
      this.emit({
        type: OAuthEventType.QUOTA_EXCEEDED,
        accountId,
        data: {
          email: account.email,
          used: account.quotaUsedToday,
          limit: account.quotaLimitDaily,
          resetAt: account.quotaResetAt
        }
      });
      logger.warn('OAuthManager', `${account.email}: Daily quota exceeded`);
    } else if (percentUsed >= 90 && oldPercentUsed < 90) {
      // 90% warning
      this.emit({
        type: OAuthEventType.QUOTA_WARNING,
        accountId,
        data: {
          email: account.email,
          percentUsed,
          used: account.quotaUsedToday,
          limit: account.quotaLimitDaily,
          remaining: account.quotaLimitDaily - account.quotaUsedToday
        }
      });
      logger.warn('OAuthManager', `${account.email}: 90% quota threshold reached`);
    } else if (percentUsed >= 75 && oldPercentUsed < 75) {
      // 75% warning
      this.emit({
        type: OAuthEventType.QUOTA_WARNING,
        accountId,
        data: {
          email: account.email,
          percentUsed,
          used: account.quotaUsedToday,
          limit: account.quotaLimitDaily,
          remaining: account.quotaLimitDaily - account.quotaUsedToday
        }
      });
      logger.info('OAuthManager', `${account.email}: 75% quota threshold reached`);
    }
  }

  /**
   * Get quota info
   */
  getQuotaInfo(accountId: string): QuotaInfo {
    const account = this.accounts.get(accountId);
    if (!account) throw new Error('Account not found');

    // Check if reset needed
    if (Date.now() >= account.quotaResetAt) {
      account.quotaUsedToday = 0;
      account.quotaResetAt = this.getNextUTCMidnight();
      this.saveAccounts();
    }

    const remaining = Math.max(0, account.quotaLimitDaily - account.quotaUsedToday);
    const percentUsed = (account.quotaUsedToday / account.quotaLimitDaily) * 100;

    return {
      used: account.quotaUsedToday,
      limit: account.quotaLimitDaily,
      remaining,
      resetAt: account.quotaResetAt,
      percentUsed
    };
  }

  /**
   * Cleanup on shutdown
   */
  async destroy(): Promise<void> {
    // Clear all timers
    for (const timer of this.refreshTimers.values()) {
      clearTimeout(timer);
    }
    this.refreshTimers.clear();

    // Stop redirect server
    await this.stopRedirectServer();

    logger.info('OAuthManager', 'Destroyed');
  }
}

// Export singleton instance
let oauthManagerInstance: OAuthManager | null = null;

export function initializeOAuthManager(store: Store): OAuthManager {
  if (!oauthManagerInstance) {
    oauthManagerInstance = new OAuthManager(store);
  }
  return oauthManagerInstance;
}

export function getOAuthManager(): OAuthManager {
  if (!oauthManagerInstance) {
    throw new Error('OAuthManager not initialized');
  }
  return oauthManagerInstance;
}
