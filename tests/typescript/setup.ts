/**
 * Vitest setup file - mocks Electron APIs
 */
import { vi } from 'vitest';

// Mock Electron module
vi.mock('electron', () => ({
  app: {
    on: vi.fn(),
    once: vi.fn(),
    whenReady: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn(),
    getPath: vi.fn((name: string) => `/mock/path/${name}`),
    getName: vi.fn(() => 'diktate'),
    getVersion: vi.fn(() => '1.0.0'),
    isReady: vi.fn(() => true),
  },
  BrowserWindow: vi.fn(() => ({
    loadFile: vi.fn().mockResolvedValue(undefined),
    loadURL: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    once: vi.fn(),
    webContents: {
      send: vi.fn(),
      on: vi.fn(),
    },
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    destroy: vi.fn(),
    isDestroyed: vi.fn(() => false),
  })),
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeHandler: vi.fn(),
    removeAllListeners: vi.fn(),
  },
  ipcRenderer: {
    send: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    invoke: vi.fn().mockResolvedValue(undefined),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
  },
  globalShortcut: {
    register: vi.fn(() => true),
    unregister: vi.fn(),
    unregisterAll: vi.fn(),
    isRegistered: vi.fn(() => false),
  },
  Tray: vi.fn(() => ({
    setImage: vi.fn(),
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
  })),
  Menu: {
    buildFromTemplate: vi.fn(() => ({})),
    setApplicationMenu: vi.fn(),
  },
  Notification: vi.fn(() => ({
    show: vi.fn(),
    on: vi.fn(),
  })),
  nativeImage: {
    createFromPath: vi.fn(() => ({})),
    createFromDataURL: vi.fn(() => ({})),
  },
  shell: {
    openExternal: vi.fn().mockResolvedValue(undefined),
    showItemInFolder: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: [] }),
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: undefined }),
    showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
    showErrorBox: vi.fn(),
  },
}));

// Mock electron-store
vi.mock('electron-store', () => {
  const Store = vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    has: vi.fn(() => false),
    delete: vi.fn(),
    clear: vi.fn(),
    store: {},
  }));
  return { default: Store };
});
