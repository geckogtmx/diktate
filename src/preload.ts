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

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api);

// Log that preload script is loaded
console.log('[PRELOAD] dIKtate preload script loaded');
