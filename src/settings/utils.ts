/**
 * Settings Page Utilities
 */

export function setVal(id: string, val: string) {
    const el = document.getElementById(id) as HTMLSelectElement | null;
    if (el) el.value = val;
}

export function setCheck(id: string, val: boolean) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.checked = val;
}

export function saveSetting(key: string, value: any) {
    console.log(`Saving ${key}:`, value);
    window.settingsAPI.set(key, value);
}

/**
 * Tab Switching Logic
 */
export function switchTab(tabId: string) {
    // Buttons - Remove active from all, then add to the matching button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        }
    });

    // Content - Show the corresponding tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabId)?.classList.add('active');
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * External links handler
 */
export function openExternalLink(url: string) {
    window.settingsAPI.openExternal(url);
}
