/**
 * Global type definitions for settingsAPI exposed via contextBridge
 * This file extends the Window interface to include the settingsAPI bridge
 */

// OAuth Account type
interface OAuthAccountInfo {
    accountId: string;
    email: string;
    displayName?: string;
    status: string;
    expiresAt: number;
    quotaUsedToday: number;
    quotaLimitDaily: number;
    lastUsedAt: number;
}

interface QuotaInfo {
    used: number;
    limit: number;
    remaining: number;
    resetAt: number;
    percentUsed: number;
}

interface OAuthAPI {
    startFlow: (provider: string) => Promise<{ success: boolean; authUrl?: string; state?: string; error?: string }>;
    listAccounts: () => Promise<{ success: boolean; accounts?: OAuthAccountInfo[]; error?: string }>;
    getActive: () => Promise<{ success: boolean; account?: OAuthAccountInfo | null; error?: string }>;
    switchAccount: (accountId: string) => Promise<{ success: boolean; error?: string }>;
    disconnect: (accountId: string) => Promise<{ success: boolean; error?: string }>;
    getQuota: (accountId: string) => Promise<{ success: boolean; quotaInfo?: QuotaInfo; error?: string }>;
    validateToken: (accountId: string) => Promise<{ success: boolean; valid?: boolean; error?: string }>;
}

// Declare the SettingsAPI interface in global scope
interface SettingsAPI {
    // Settings CRUD
    getAll: () => Promise<any>;
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;

    // Audio devices
    saveAudioDevice: (deviceId: string, deviceLabel: string) => Promise<void>;

    // External links
    openExternal: (url: string) => void;

    // API Key methods
    getApiKeys: () => Promise<Record<string, boolean>>;
    setApiKey: (provider: string, key: string) => Promise<void>;
    testApiKey: (provider: string, key: string) => Promise<{ success: boolean; error?: string }>;

    // OAuth Google Hub (SPEC_016)
    oauth: OAuthAPI;

    // OAuth Event Listener (SPEC_016 Phase 5)
    onOAuthEvent: (callback: (event: any) => void) => void;

    // Sound methods
    playSound: (soundName: string) => Promise<void>;
    getSoundFiles: () => Promise<string[]>;

    // Custom Prompts
    getCustomPrompts: () => Promise<Record<string, string>>;
    getDefaultPrompts: () => Promise<Record<string, string>>;
    getDefaultPrompt: (mode: string, model: string) => Promise<string>;
    saveCustomPrompt: (mode: string, promptText: string) => Promise<{ success: boolean; error?: string }>;
    resetCustomPrompt: (mode: string) => Promise<{ success: boolean; error?: string }>;

    // Hardware testing
    runHardwareTest: () => Promise<{ gpu: string; vram: string; tier: string; speed: number }>;

    // Ollama control
    restartOllama: () => Promise<{ success: boolean; error?: string }>;
    warmupOllamaModel: () => Promise<{ success: boolean; model: string; error?: string }>;

    // App Control
    relaunchApp: () => void;
}

// Extend the Window interface
interface Window {
    settingsAPI: SettingsAPI;
}
