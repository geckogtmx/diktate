/**
 * Preload script for the Loading Window
 * Exposes secure IPC bridge for startup events
 */

import { contextBridge, ipcRenderer } from 'electron';

const loadingAPI = {
  // Listen for progress updates from main process
  onProgress: (callback: (data: { message: string; progress?: number }) => void) => {
    ipcRenderer.on('startup-progress', (_, data) => callback(data));
  },

  // Listen for the final completion event
  onReady: (callback: () => void) => {
    ipcRenderer.on('startup-complete', () => callback());
  },

  // Actions triggered by the user in the loading window
  sendAction: (action: 'open-cp' | 'open-settings' | 'close' | 'ready') => {
    ipcRenderer.send('loading-action', action);
  },
};

contextBridge.exposeInMainWorld('loadingAPI', loadingAPI);

console.log('[PRELOAD] Loading window bridge established');
