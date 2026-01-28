/**
 * Google Hub OAuth Logic (SPEC_016)
 * MODULAR QUARANTINE: This module is preserved for legacy support 
 * but new connections are disabled to enforce BYOK (SPEC_032).
 */

/**
 * Updates the OAuth UI with account status and quota info
 */
export async function updateOAuthUI() {
    try {
        const result = await window.settingsAPI.oauth.listAccounts();

        if (!result.success) {
            console.error('Failed to load OAuth accounts:', result.error);
            showOAuthError();
            return;
        }

        const accounts = result.accounts || [];
        const activeResult = await window.settingsAPI.oauth.getActive();
        const activeAccount = activeResult.success ? activeResult.account : null;

        const noAccountsDiv = document.getElementById('oauth-no-accounts');
        const accountsContainer = document.getElementById('oauth-accounts-container');
        const quotaSection = document.getElementById('oauth-quota-section');
        const activeAccountDiv = document.getElementById('oauth-active-account');
        const fallbackNotice = document.getElementById('oauth-fallback-notice');

        if (!noAccountsDiv || !accountsContainer || !quotaSection || !activeAccountDiv || !fallbackNotice) {
            return;
        }

        if (accounts.length === 0) {
            noAccountsDiv.style.display = 'block';
            accountsContainer.style.display = 'none';
            quotaSection.style.display = 'none';
            activeAccountDiv.style.display = 'none';
        } else {
            noAccountsDiv.style.display = 'none';
            accountsContainer.style.display = 'block';

            const addAccountBtn = document.getElementById('oauth-add-account-btn');
            if (addAccountBtn) {
                // QUARANTINE: Keep it hidden even if accounts < 3
                addAccountBtn.style.display = 'none';
            }

            const accountsList = document.getElementById('oauth-accounts-list');
            if (accountsList) {
                accountsList.innerHTML = accounts.map(account => {
                    let statusBadge = '';
                    let statusColor = '';
                    switch (account.status) {
                        case 'active': statusBadge = '✓ Active'; statusColor = '#4ade80'; break;
                        case 'refreshing': statusBadge = '⟳ Refreshing...'; statusColor = '#38bdf8'; break;
                        case 'expired': statusBadge = '⚠ Expired'; statusColor = '#f97316'; break;
                        case 'revoked': statusBadge = '✗ Disconnected'; statusColor = '#f87171'; break;
                        case 'error': statusBadge = '⚠ Error'; statusColor = '#f87171'; break;
                        default: statusBadge = account.status; statusColor = '#94a3b8';
                    }

                    let quotaDisplay = '';
                    if (account.quotaUsedToday !== undefined && account.quotaLimitDaily !== undefined) {
                        const quotaPercent = Math.round((account.quotaUsedToday / account.quotaLimitDaily) * 100);
                        const quotaColor = quotaPercent >= 90 ? '#f87171' : quotaPercent >= 75 ? '#f97316' : '#4ade80';
                        quotaDisplay = `<div style="color: ${quotaColor}; font-size: 0.85em; margin-top: 4px;">${quotaPercent}% quota used</div>`;
                    }

                    return `
                        <div style="padding: 12px; background: #1a2f3a; border: 1px solid #0ea5e9; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="color: #38bdf8; font-weight: 500;">${account.email}</div>
                                <div style="color: #94a3b8; font-size: 0.85em; margin-top: 4px;">
                                    Status: <span style="color: ${statusColor}; font-weight: 600;">${statusBadge}</span>
                                </div>
                                ${quotaDisplay}
                            </div>
                            <div>
                                ${account.accountId === activeAccount?.accountId ?
                            '<span style="color: #4ade80; font-weight: 500; font-size: 0.85em;">✓ Active</span>' :
                            `<button class="btn btn-secondary" onclick="window.oauth.switchAccount('${account.accountId}')" style="font-size: 0.85em;">🔄 Switch</button>`}
                            </div>
                        </div>
                    `;
                }).join('');
            }

            if (activeAccount) {
                activeAccountDiv.style.display = 'block';
                const email = document.getElementById('oauth-active-email');
                const status = document.getElementById('oauth-active-status');
                if (email && status) {
                    email.textContent = activeAccount.email;
                    status.textContent = activeAccount.status === 'active' ? 'Status: Active' : `Status: ${activeAccount.status}`;
                }

                const quotaResult = await window.settingsAPI.oauth.getQuota(activeAccount.accountId);
                if (quotaResult.success && quotaResult.quotaInfo) {
                    quotaSection.style.display = 'block';
                    const quotaText = document.getElementById('oauth-quota-text');
                    if (quotaText) {
                        quotaText.textContent = `${quotaResult.quotaInfo.used.toLocaleString()} chars`;
                        quotaText.style.color = quotaResult.quotaInfo.percentUsed > 100 ? '#f87171' : 'white';
                    }
                }
            } else {
                activeAccountDiv.style.display = 'none';
                quotaSection.style.display = 'none';
            }
        }
        fallbackNotice.style.display = 'none';
    } catch (error) {
        console.error('Error updating OAuth UI:', error);
        showOAuthError();
    }
}

/**
 * QUARANTINED: Prevents new OAuth flows
 */
export async function initializeOAuthFlow() {
    alert('⚠️ Direct Google Account integration is currently disabled in favor of Bring Your Own Key (BYOK).\nPlease use the API Keys tab to configure your Gemini API Key.');
    console.warn('OAuth Flow blocked by Modular Quarantine (SPEC_032)');
}

export async function switchAccount(accountId: string) {
    try {
        const result = await window.settingsAPI.oauth.switchAccount(accountId);
        if (result.success) await updateOAuthUI();
        else alert(`Failed to switch account: ${result.error}`);
    } catch (error) {
        alert(`Error: ${error}`);
    }
}

export async function disconnectAccount(accountId: string) {
    const list = await window.settingsAPI.oauth.listAccounts();
    const account = list.accounts?.find(a => a.accountId === accountId);
    if (!account) return;

    if (confirm(`Disconnect ${account.email}?`)) {
        try {
            const result = await window.settingsAPI.oauth.disconnect(accountId);
            if (result.success) await updateOAuthUI();
            else alert(`Failed to disconnect: ${result.error}`);
        } catch (error) {
            alert(`Error: ${error}`);
        }
    }
}

export function showOAuthError(message?: string) {
    const errorDiv = document.getElementById('oauth-error-message');
    if (errorDiv && message) {
        errorDiv.textContent = message;
        errorDiv.className = 'oauth-error visible';
        setTimeout(() => { errorDiv.className = 'oauth-error'; }, 10000);
    } else {
        const noAccountsDiv = document.getElementById('oauth-no-accounts');
        const fallbackNotice = document.getElementById('oauth-fallback-notice');
        if (noAccountsDiv) noAccountsDiv.style.display = 'block';
        if (fallbackNotice) fallbackNotice.style.display = 'block';
    }
}

export function showOAuthWarning(message: string) {
    const errorDiv = document.getElementById('oauth-error-message');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.className = 'oauth-warning visible';
        setTimeout(() => { errorDiv.className = 'oauth-warning'; }, 5000);
    }
}

/**
 * Initializes listeners for OAuth-related events
 */
export function initOAuthListeners() {
    window.settingsAPI.onOAuthEvent((event: any) => {
        console.log('OAuth event received:', event);
        const { type, data } = event;
        switch (type) {
            case 'token-refreshed':
            case 'account-status-changed':
                updateOAuthUI();
                break;
            case 'token-refresh-failed':
                showOAuthError(`Token refresh failed for ${data?.email}.`);
                updateOAuthUI();
                break;
            case 'token-revoked':
                showOAuthError(`Account ${data?.email} was disconnected.`);
                updateOAuthUI();
                break;
            case 'quota-warning':
                showOAuthWarning(`${Math.round((data.used / data.limit) * 100)}% quota used for ${data?.email}`);
                updateOAuthUI();
                break;
            case 'quota-exceeded':
                showOAuthError(`Daily quota exceeded for ${data?.email}.`);
                updateOAuthUI();
                break;
        }
    });

    // Periodic quota refresh
    setInterval(() => {
        const googleHubTab = document.getElementById('google-hub');
        if (googleHubTab && googleHubTab.style.display !== 'none') {
            updateOAuthUI();
        }
    }, 5000);
}
