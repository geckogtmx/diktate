// Import UserSettings type from main.ts
import type { UserSettings } from './main';

// Declare the SettingsAPI interface in global scope
declare global {
  interface SettingsAPI {
    // Settings CRUD
    getAll: () => Promise<UserSettings>;
    get: <K extends keyof UserSettings>(key: K) => Promise<UserSettings[K]>;
    set: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => Promise<void>;

    // Audio devices
    saveAudioDevice: (deviceId: string, deviceLabel: string) => Promise<void>;

    // External links
    openExternal: (url: string) => void;

    // API Key methods
    getApiKeys: () => Promise<Record<string, boolean>>;
    setApiKey: (provider: string, key: string) => Promise<void>;
    testApiKey: (provider: string, key: string) => Promise<{ success: boolean; error?: string }>;
    getModels: (provider: string) => Promise<{
      success: boolean;
      models?: Array<{
        id: string;
        name: string;
        description?: string;
        size?: string;
        tier?: string;
      }>;
      error?: string;
    }>;

    // Sound methods
    playSound: (soundName: string) => Promise<void>;
    getSoundFiles: () => Promise<string[]>;

    // Custom Prompts
    getCustomPrompts: () => Promise<Record<string, string>>;
    getDefaultPrompts: () => Promise<Record<string, string>>;
    getDefaultPrompt: (mode: string, model: string) => Promise<string>;
    saveCustomPrompt: (
      mode: string,
      promptText: string
    ) => Promise<{ success: boolean; error?: string }>;
    resetCustomPrompt: (mode: string) => Promise<{ success: boolean; error?: string }>;

    // Hardware testing
    runHardwareTest: () => Promise<{ gpu: string; vram: string; tier: string; speed: number }>;

    // Ollama control
    restartOllama: () => Promise<{ success: boolean; error?: string }>;
    warmupOllamaModel: () => Promise<{ success: boolean; model: string; error?: string }>;

    // App Control
    relaunchApp: () => void;

    // Post-It Notes (SPEC_020)
    selectNoteFile: () => Promise<string>;

    // Backend Interaction (SPEC_030)
    invokeBackend: (command: string, args: unknown) => Promise<unknown>;
  }

  // Extend the Window interface
  interface Window {
    settingsAPI: SettingsAPI;
  }
}

export {};
