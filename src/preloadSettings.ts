/**
 * Secure preload script for Settings window
 * Exposes only necessary IPC channels to renderer
 */

import { contextBridge, ipcRenderer, shell } from 'electron';

const settingsAPI = {
    // Settings CRUD
    getAll: () => ipcRenderer.invoke('settings:get-all'),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),

    // Audio devices (uses Web API, no IPC needed, but we expose the save)
    saveAudioDevice: (deviceId: string, deviceLabel: string) => {
        ipcRenderer.invoke('settings:set', 'audioDeviceId', deviceId);
        ipcRenderer.invoke('settings:set', 'audioDeviceLabel', deviceLabel);
    },

    // External links (safe wrapper)
    openExternal: (url: string) => {
        // Whitelist allowed URLs for security
        const allowedDomains = ['dikta.me', 'github.com', 'ko-fi.com'];
        try {
            const parsed = new URL(url);
            if (allowedDomains.some(d => parsed.hostname.endsWith(d))) {
                shell.openExternal(url);
            } else {
                console.warn('Blocked external URL:', url);
            }
        } catch (e) {
            console.error('Invalid URL:', url);
        }
    }
};

contextBridge.exposeInMainWorld('settingsAPI', settingsAPI);

console.log('[PRELOAD:Settings] Secure settings bridge loaded');
