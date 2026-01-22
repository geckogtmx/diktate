/**
 * Secure preload script for Settings window
 * Exposes only necessary IPC channels to renderer
 */

import { contextBridge, ipcRenderer, shell } from 'electron';

const settingsAPI = {
    // Settings CRUD
    getAll: () => ipcRenderer.invoke('settings:get-all'),
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),

    // Audio devices (uses Web API, no IPC needed, but we expose the save)
    saveAudioDevice: async (deviceId: string, deviceLabel: string) => {
        await ipcRenderer.invoke('settings:set', 'audioDeviceId', deviceId);
        await ipcRenderer.invoke('settings:set', 'audioDeviceLabel', deviceLabel);
    },

    // External links (safe wrapper)
    openExternal: (url: string) => {
        // Whitelist allowed URLs for security (L3 fix: proper subdomain check)
        const allowedDomains = ['dikta.me', 'github.com', 'ko-fi.com', 'aistudio.google.com', 'console.anthropic.com', 'platform.openai.com', 'localhost'];
        try {
            const parsed = new URL(url);
            // Fixed: Check for exact match OR proper subdomain (hostname ends with '.domain')
            const isAllowed = allowedDomains.some(d =>
                parsed.hostname === d || parsed.hostname.endsWith('.' + d)
            );
            if (isAllowed) {
                shell.openExternal(url);
            } else {
                console.warn('Blocked external URL:', url);
            }
        } catch (e) {
            console.error('Invalid URL:', url);
        }
    },

    // API Key methods (secure IPC)
    getApiKeys: () => ipcRenderer.invoke('apikey:get-all'),
    setApiKey: (provider: string, key: string) => ipcRenderer.invoke('apikey:set', provider, key),
    testApiKey: (provider: string, key: string) => ipcRenderer.invoke('apikey:test', provider, key),

    // Sound playback
    playSound: (soundName: string) => ipcRenderer.invoke('settings:play-sound', soundName),
    getSoundFiles: () => ipcRenderer.invoke('settings:get-sound-files'),

    // Custom Prompts
    getCustomPrompts: () => ipcRenderer.invoke('settings:get-custom-prompts'),
    saveCustomPrompt: (mode: string, promptText: string) => ipcRenderer.invoke('settings:save-custom-prompt', mode, promptText),
    resetCustomPrompt: (mode: string) => ipcRenderer.invoke('settings:reset-custom-prompt', mode),

    // Hardware testing
    runHardwareTest: () => ipcRenderer.invoke('settings:run-hardware-test'),

    // Ollama control
    restartOllama: () => ipcRenderer.invoke('ollama:restart'),
    warmupOllamaModel: () => ipcRenderer.invoke('ollama:warmup'),

    // App Control
    relaunchApp: () => ipcRenderer.invoke('app:relaunch')
};

contextBridge.exposeInMainWorld('settingsAPI', settingsAPI);

console.log('[PRELOAD:Settings] Secure settings bridge loaded');
