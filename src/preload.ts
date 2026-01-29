/**
 * Preload script for dIKtate
 * Exposes secure IPC bridge to renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';

// Define the API that will be exposed to the renderer
const api = {
  python: {
    startRecording: () => ipcRenderer.invoke('python:start-recording'),
    stopRecording: () => ipcRenderer.invoke('python:stop-recording'),
    getStatus: () => ipcRenderer.invoke('python:status')
  },
  onPythonStateChange: (callback: (state: string) => void) => {
    ipcRenderer.on('python:state-change', (_, state: string) => {
      callback(state);
    });
  },
  onPythonError: (callback: (error: string) => void) => {
    ipcRenderer.on('python:error', (_, error: string) => {
      callback(error);
    });
  }
};

const electronAPI = {
  onLog: (callback: (level: string, message: string, data?: any) => void) => {
    ipcRenderer.on('log-message', (_, { level, message, data }) => callback(level, message, data));
  },
  onStatusChange: (callback: (status: string) => void) => {
    ipcRenderer.on('status-update', (_, status) => callback(status));
  },
  onPerformanceMetrics: (callback: (metrics: any) => void) => {
    ipcRenderer.on('performance-metrics', (_, metrics) => callback(metrics));
  },
  onModeChange: (callback: (mode: string) => void) => {
    ipcRenderer.on('mode-update', (_, mode) => callback(mode));
  },
  onBadgeUpdate: (callback: (badges: { processor?: string; authType?: string }) => void) => {
    ipcRenderer.on('badge-update', (_, badges) => callback(badges));
  },
  toggleRecording: () => ipcRenderer.invoke('python:toggle-recording'),
  getInitialState: () => ipcRenderer.invoke('get-initial-state'),
  setSetting: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
  onPlaySound: (callback: (soundName: string) => void) => {
    ipcRenderer.on('play-sound', (_, soundName) => callback(soundName));
  },
  onSettingChange: (callback: (key: string, value: any) => void) => {
    ipcRenderer.on('setting-changed', (_, { key, value }) => callback(key, value));
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api);

// Log that preload script is loaded
console.log('[PRELOAD] dIKtate preload script loaded');
