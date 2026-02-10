/**
 * Trial Account UI Logic (SPEC_042)
 * Manages the dikta.me trial panel in the settings sidebar.
 */

/** Render the trial panel based on current status */
async function loadTrialStatus(): Promise<void> {
  try {
    const status = await window.settingsAPI.trial.getStatus();
    renderTrialPanel(status);
  } catch (err) {
    console.error('[TRIAL] Failed to load trial status:', err);
  }
}

interface TrialStatus {
  loggedIn: boolean;
  email: string;
  wordsUsed: number;
  wordsQuota: number;
  daysRemaining: number;
  expiresAt: string;
  trialActive: boolean;
}

function renderTrialPanel(status: TrialStatus): void {
  const loggedOut = document.getElementById('trial-logged-out');
  const loggedIn = document.getElementById('trial-logged-in');
  if (!loggedOut || !loggedIn) return;

  if (!status.loggedIn) {
    loggedOut.style.display = 'block';
    loggedIn.style.display = 'none';
    return;
  }

  loggedOut.style.display = 'none';
  loggedIn.style.display = 'block';

  // Email
  const emailEl = document.getElementById('trial-email');
  if (emailEl) emailEl.textContent = status.email || 'Signed in';

  // Progress bar
  const bar = document.getElementById('trial-progress-bar');
  if (bar) {
    const pct =
      status.wordsQuota > 0 ? Math.min(100, (status.wordsUsed / status.wordsQuota) * 100) : 0;
    bar.style.width = `${pct}%`;
    // Turn red when > 80% used
    bar.style.background = pct >= 80 ? '#f87171' : '#4ade80';
  }

  // Words
  const wordsEl = document.getElementById('trial-words');
  if (wordsEl) {
    wordsEl.textContent = `${status.wordsUsed.toLocaleString()} / ${status.wordsQuota.toLocaleString()} words`;
  }

  // Days
  const daysEl = document.getElementById('trial-days');
  if (daysEl) {
    if (!status.trialActive) {
      daysEl.textContent = 'Trial expired';
      daysEl.style.color = '#f87171';
    } else {
      daysEl.textContent = `${status.daysRemaining} day${status.daysRemaining !== 1 ? 's' : ''} remaining`;
      daysEl.style.color = status.daysRemaining <= 3 ? '#fbbf24' : '#888';
    }
  }
}

async function handleLogin(): Promise<void> {
  const btn = document.getElementById('trial-login-btn') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Opening browser…';
  }
  try {
    await window.settingsAPI.trial.login();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Sign in for free trial';
    }
  }
}

async function handleLogout(): Promise<void> {
  const btn = document.getElementById('trial-logout-btn') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  try {
    await window.settingsAPI.trial.logout();
    await loadTrialStatus();
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleRefresh(): Promise<void> {
  try {
    await window.settingsAPI.trial.refresh();
    await loadTrialStatus();
  } catch (err) {
    console.error('[TRIAL] Refresh failed:', err);
  }
}

/** Attach event listeners and register for push updates */
export function initTrialAccountPanel(): void {
  // Load initial state
  void loadTrialStatus();

  // Button handlers
  const loginBtn = document.getElementById('trial-login-btn');
  if (loginBtn) loginBtn.addEventListener('click', () => void handleLogin());

  const logoutBtn = document.getElementById('trial-logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => void handleLogout());

  const dashboardBtn = document.getElementById('trial-dashboard-btn');
  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', () => {
      window.settingsAPI.openExternal('https://dikta.me/dashboard');
    });
  }

  // Listen for push updates from main process (after deeplink login, logout, etc.)
  window.settingsAPI.trial.onStatusUpdated(() => {
    void handleRefresh();
  });
}
