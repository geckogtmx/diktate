/**
 * Secure preload script for Settings window
 * Exposes only necessary IPC channels to renderer
 */

import { contextBridge, ipcRenderer } from 'electron';

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
        ipcRenderer.send('log', 'DEBUG', `[Preload] Request to open external URL: ${url}`);
        // Whitelist allowed URLs for security (L3 fix: proper subdomain check)
        const allowedDomains = ['dikta.me', 'github.com', 'ko-fi.com', 'ollama.com', 'aistudio.google.com', 'accounts.google.com', 'console.anthropic.com', 'platform.openai.com', 'localhost'];
        try {
            const parsed = new URL(url);
            ipcRenderer.send('log', 'DEBUG', `[Preload] Parsed hostname: ${parsed.hostname}`);

            // Fixed: Check for exact match OR proper subdomain (hostname ends with '.domain')
            const isAllowed = allowedDomains.some(d =>
                parsed.hostname === d || parsed.hostname.endsWith('.' + d)
            );

            ipcRenderer.send('log', 'DEBUG', `[Preload] URL allowed? ${isAllowed}`);

            if (isAllowed) {
                ipcRenderer.send('open-external', url);
            } else {
                ipcRenderer.send('log', 'WARN', `[Preload] Blocked external URL: ${url}`);
            }
        } catch (e) {
            ipcRenderer.send('log', 'ERROR', `[Preload] Invalid URL: ${url} - ${e}`);
        }
    },

    // API Key methods (secure IPC)
    getApiKeys: () => ipcRenderer.invoke('apikey:get-all'),
    setApiKey: (provider: string, key: string) => ipcRenderer.invoke('apikey:set', provider, key),
    testApiKey: (provider: string, key: string) => ipcRenderer.invoke('apikey:test', provider, key),
    getModels: (provider: string) => ipcRenderer.invoke('apikey:get-models', provider),

    // Sound playback
    playSound: (soundName: string) => ipcRenderer.invoke('settings:play-sound', soundName),
    getSoundFiles: () => ipcRenderer.invoke('settings:get-sound-files'),

    // Custom Prompts
    getCustomPrompts: () => ipcRenderer.invoke('settings:get-custom-prompts'),
    getDefaultPrompts: () => ipcRenderer.invoke('settings:get-default-prompts'),
    getDefaultPrompt: (mode: string, model: string) => ipcRenderer.invoke('settings:get-default-prompt', mode, model),
    saveCustomPrompt: (mode: string, promptText: string) => ipcRenderer.invoke('settings:save-custom-prompt', mode, promptText),
    resetCustomPrompt: (mode: string) => ipcRenderer.invoke('settings:reset-custom-prompt', mode),

    // Hardware testing
    runHardwareTest: () => ipcRenderer.invoke('settings:run-hardware-test'),

    // Ollama control
    restartOllama: () => ipcRenderer.invoke('ollama:restart'),
    warmupOllamaModel: () => ipcRenderer.invoke('ollama:warmup'),

    // App Control
    relaunchApp: () => ipcRenderer.invoke('app:relaunch'),

    // Post-It Notes (SPEC_020)
    selectNoteFile: () => ipcRenderer.invoke('settings:select-note-file'),

    // Backend Interaction (SPEC_030)
    invokeBackend: (command: string, args: any) => ipcRenderer.invoke('settings:invoke-backend', command, args)
};

contextBridge.exposeInMainWorld('settingsAPI', settingsAPI);

console.log('[PRELOAD:Settings] Secure settings bridge loaded');
