// Import UserSettings type from main.ts
import type { UserSettings } from './main';

// Type for initial application state
interface InitialState {
  status: string;
  isRecording: boolean;
  mode: string;
  defaultMode: string; // For UI compatibility
  models: { transcriber: string; processor: string };
  soundFeedback: boolean;
  processingMode: string;
  recordingMode: string;
  refineMode: string;
  authType: string;
  additionalKeyEnabled: boolean;
  additionalKey: string;
  trailingSpaceEnabled: boolean;
}

// Type for electronAPI - main process bridge
interface ElectronAPI {
  onLog: (
    callback: (level: string, message: string, data?: Record<string, unknown>) => void
  ) => void;
  onStatusChange: (callback: (status: string) => void) => void;
  onPerformanceMetrics: (callback: (metrics: unknown) => void) => void;
  onModeChange: (callback: (mode: string) => void) => void;
  onBadgeUpdate: (callback: (badges: { processor?: string; authType?: string }) => void) => void;
  toggleRecording: () => Promise<unknown>;
  getInitialState: () => Promise<InitialState>;
  setSetting: (key: string, value: unknown) => Promise<void>;
  onPlaySound: (callback: (soundName: string) => void) => void;
  onSettingChange: (callback: (key: string, value: unknown) => void) => void;
}

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

    // SPEC_042: Trial account (dikta.me managed Gemini credits)
    trial: {
      getStatus: () => Promise<{
        loggedIn: boolean;
        email: string;
        wordsUsed: number;
        wordsQuota: number;
        daysRemaining: number;
        expiresAt: string;
        trialActive: boolean;
      }>;
      login: () => Promise<{ started: boolean }>;
      logout: () => Promise<{ success: boolean }>;
      refresh: () => Promise<
        | {
            loggedIn: boolean;
            email: string;
            wordsUsed: number;
            wordsQuota: number;
            daysRemaining: number;
            expiresAt: string;
            trialActive: boolean;
          }
        | { error: string }
      >;
      onStatusUpdated: (callback: () => void) => void;
    };
  }

  // i18n API exposed from preload
  interface I18nAPI {
    t: (key: string, options?: unknown) => Promise<string>;
    changeLanguage: (lang: string) => Promise<void>;
    getLanguage: () => Promise<string>;
    onLanguageChange: (callback: (lang: string) => void) => void;
  }

  // Extend the Window interface
  interface Window {
    settingsAPI: SettingsAPI;
    electronAPI: ElectronAPI;
    i18n: I18nAPI;
  }
}

export {};
