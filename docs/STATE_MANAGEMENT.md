# State Management Design

Comprehensive state management architecture for dIKtate using Zustand 5.

## Table of Contents

1. [Store Architecture](#store-architecture)
2. [Recording Store](#recording-store)
3. [Transcription Store](#transcription-store)
4. [Settings Store](#settings-store)
5. [UI Store](#ui-store)
6. [Provider Store](#provider-store)
7. [Selectors](#selectors)
8. [Persistence Strategy](#persistence-strategy)
9. [IPC Integration](#ipc-integration)
10. [TypeScript Types](#typescript-types)

---

## Store Architecture

### Overview

dIKtate uses a domain-driven store architecture with clear separation of concerns. Each store manages a specific aspect of the application state, enabling independent updates and optimized re-renders.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React Components                             │
├─────────────────────────────────────────────────────────────────────┤
│                           Selectors Layer                            │
│    (Memoized selectors prevent unnecessary re-renders)              │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────────┤
│ Recording│Transcrip │ Settings │    UI    │ Provider │              │
│  Store   │   Store  │  Store   │  Store   │  Store   │              │
├──────────┴──────────┴──────────┴──────────┴──────────┴──────────────┤
│                      Zustand Middleware Stack                        │
│              (devtools, persist, immer, subscribeWithSelector)       │
├─────────────────────────────────────────────────────────────────────┤
│                      Electron IPC Bridge                             │
│                  (Preload API + WebSocket)                           │
├─────────────────────────────────────────────────────────────────────┤
│                      Python Backend                                  │
│          (FastAPI + WebSocket for real-time updates)                │
└─────────────────────────────────────────────────────────────────────┘
```

### Store Relationships

```
┌─────────────────┐     triggers      ┌─────────────────────┐
│  RecordingStore │ ─────────────────▶│  TranscriptionStore │
│  (audio state)  │                   │  (text processing)  │
└────────┬────────┘                   └──────────┬──────────┘
         │                                       │
         │ reads config                          │ reads provider
         ▼                                       ▼
┌─────────────────┐                   ┌─────────────────────┐
│  SettingsStore  │◀──────────────────│    ProviderStore    │
│  (preferences)  │   provider config │   (LLM availability)│
└────────┬────────┘                   └─────────────────────┘
         │
         │ theme/layout
         ▼
┌─────────────────┐
│     UIStore     │
│  (visual state) │
└─────────────────┘
```

### Middleware Stack

All stores use a consistent middleware configuration:

```typescript
import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Standard middleware wrapper for all stores
const createStore = <T>(
  name: string,
  initializer: StateCreator<T>,
  persistConfig?: PersistConfig<T>
) => {
  const withMiddleware = devtools(
    subscribeWithSelector(
      immer(initializer)
    ),
    { name }
  );

  return persistConfig
    ? create<T>()(persist(withMiddleware, persistConfig))
    : create<T>()(withMiddleware);
};
```

---

## Recording Store

Manages audio capture state, waveform visualization data, and recording lifecycle.

### State Definition

```typescript
// src/stores/recordingStore.ts
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

/**
 * Recording lifecycle states
 */
export type RecordingStatus =
  | 'idle'           // No recording activity
  | 'initializing'   // Setting up audio devices
  | 'listening'      // Actively capturing audio
  | 'stopping'       // Finalizing recording
  | 'error';         // Recording failed

/**
 * Waveform data point for visualization
 */
export interface WaveformPoint {
  timestamp: number;
  amplitude: number;
}

/**
 * Recording session metadata
 */
export interface RecordingSession {
  id: string;
  startedAt: number;
  duration: number;
  audioDeviceId: string | null;
}

interface RecordingState {
  // State
  status: RecordingStatus;
  currentSession: RecordingSession | null;
  waveformData: WaveformPoint[];
  peakAmplitude: number;
  averageAmplitude: number;
  error: string | null;

  // Audio device state
  audioDevices: MediaDeviceInfo[];
  selectedDeviceId: string | null;

  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  cancelRecording: () => void;
  appendWaveformData: (points: WaveformPoint[]) => void;
  clearWaveformData: () => void;
  updateAmplitude: (peak: number, average: number) => void;
  setAudioDevices: (devices: MediaDeviceInfo[]) => void;
  selectDevice: (deviceId: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  status: 'idle' as RecordingStatus,
  currentSession: null,
  waveformData: [],
  peakAmplitude: 0,
  averageAmplitude: 0,
  error: null,
  audioDevices: [],
  selectedDeviceId: null,
};

export const useRecordingStore = create<RecordingState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        ...initialState,

        startRecording: async () => {
          const { selectedDeviceId } = get();
          set((state) => {
            state.status = 'initializing';
            state.error = null;
            state.waveformData = [];
          });

          try {
            await window.api.recording.start(selectedDeviceId);
            set((state) => {
              state.status = 'listening';
              state.currentSession = {
                id: crypto.randomUUID(),
                startedAt: Date.now(),
                duration: 0,
                audioDeviceId: selectedDeviceId,
              };
            });
          } catch (error) {
            set((state) => {
              state.status = 'error';
              state.error = error instanceof Error ? error.message : 'Failed to start recording';
            });
          }
        },

        stopRecording: async () => {
          set((state) => {
            state.status = 'stopping';
          });

          try {
            const result = await window.api.recording.stop();
            set((state) => {
              state.status = 'idle';
              if (state.currentSession) {
                state.currentSession.duration = Date.now() - state.currentSession.startedAt;
              }
            });
            return result;
          } catch (error) {
            set((state) => {
              state.status = 'error';
              state.error = error instanceof Error ? error.message : 'Failed to stop recording';
            });
          }
        },

        cancelRecording: () => {
          window.api.recording.cancel();
          set((state) => {
            state.status = 'idle';
            state.currentSession = null;
            state.waveformData = [];
            state.peakAmplitude = 0;
            state.averageAmplitude = 0;
          });
        },

        appendWaveformData: (points) => set((state) => {
          // Keep last 100 points for performance
          const combined = [...state.waveformData, ...points];
          state.waveformData = combined.slice(-100);
        }),

        clearWaveformData: () => set((state) => {
          state.waveformData = [];
        }),

        updateAmplitude: (peak, average) => set((state) => {
          state.peakAmplitude = peak;
          state.averageAmplitude = average;
        }),

        setAudioDevices: (devices) => set((state) => {
          state.audioDevices = devices;
        }),

        selectDevice: (deviceId) => set((state) => {
          state.selectedDeviceId = deviceId;
        }),

        setError: (error) => set((state) => {
          state.error = error;
          if (error) state.status = 'error';
        }),

        reset: () => set(() => initialState),
      }))
    ),
    { name: 'RecordingStore' }
  )
);
```

### Recording Duration Tracking

```typescript
// Subscription for real-time duration updates
let durationInterval: NodeJS.Timeout | null = null;

useRecordingStore.subscribe(
  (state) => state.status,
  (status) => {
    if (status === 'listening') {
      durationInterval = setInterval(() => {
        useRecordingStore.setState((state) => {
          if (state.currentSession) {
            state.currentSession.duration = Date.now() - state.currentSession.startedAt;
          }
        });
      }, 100);
    } else if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }
  }
);
```

---

## Transcription Store

Manages the transcription pipeline state, from raw audio to final processed text.

### State Definition

```typescript
// src/stores/transcriptionStore.ts
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

/**
 * Transcription pipeline stages
 */
export type TranscriptionStage =
  | 'idle'            // No transcription in progress
  | 'transcribing'    // Converting audio to text (Whisper)
  | 'processing'      // Applying LLM transformations
  | 'injecting'       // Typing text into active window
  | 'completed'       // Successfully finished
  | 'failed';         // Pipeline failed

/**
 * Context modes for text transformation
 */
export type ContextMode =
  | 'standard'   // Grammar fix, proper punctuation
  | 'developer'  // Code comments, variable names
  | 'email'      // Professional prose expansion
  | 'raw';       // No transformation

/**
 * Transcription result with metadata
 */
export interface TranscriptionResult {
  id: string;
  rawText: string;
  processedText: string;
  contextMode: ContextMode;
  processingTimeMs: number;
  wordCount: number;
  confidence: number;
  createdAt: number;
}

interface TranscriptionState {
  // Pipeline state
  stage: TranscriptionStage;
  progress: number; // 0-100

  // Current transcription
  rawText: string;
  processedText: string;
  streamBuffer: string; // For streaming LLM output

  // Context mode
  contextMode: ContextMode;

  // History (recent transcriptions)
  history: TranscriptionResult[];

  // Error handling
  error: string | null;
  retryCount: number;

  // Actions
  setStage: (stage: TranscriptionStage) => void;
  setProgress: (progress: number) => void;
  setRawText: (text: string) => void;
  setProcessedText: (text: string) => void;
  appendToStream: (chunk: string) => void;
  flushStream: () => void;
  setContextMode: (mode: ContextMode) => void;
  addToHistory: (result: TranscriptionResult) => void;
  clearHistory: () => void;
  setError: (error: string | null) => void;
  retry: () => Promise<void>;
  reset: () => void;
}

const MAX_HISTORY_SIZE = 50;

const initialState = {
  stage: 'idle' as TranscriptionStage,
  progress: 0,
  rawText: '',
  processedText: '',
  streamBuffer: '',
  contextMode: 'standard' as ContextMode,
  history: [],
  error: null,
  retryCount: 0,
};

export const useTranscriptionStore = create<TranscriptionState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        ...initialState,

        setStage: (stage) => set((state) => {
          state.stage = stage;
          // Reset progress on new stage
          if (stage === 'transcribing') state.progress = 0;
          if (stage === 'processing') state.progress = 33;
          if (stage === 'injecting') state.progress = 66;
          if (stage === 'completed') state.progress = 100;
        }),

        setProgress: (progress) => set((state) => {
          state.progress = Math.min(100, Math.max(0, progress));
        }),

        setRawText: (text) => set((state) => {
          state.rawText = text;
        }),

        setProcessedText: (text) => set((state) => {
          state.processedText = text;
        }),

        appendToStream: (chunk) => set((state) => {
          state.streamBuffer += chunk;
        }),

        flushStream: () => set((state) => {
          state.processedText = state.streamBuffer;
          state.streamBuffer = '';
        }),

        setContextMode: (mode) => set((state) => {
          state.contextMode = mode;
        }),

        addToHistory: (result) => set((state) => {
          state.history.unshift(result);
          // Trim history to max size
          if (state.history.length > MAX_HISTORY_SIZE) {
            state.history = state.history.slice(0, MAX_HISTORY_SIZE);
          }
        }),

        clearHistory: () => set((state) => {
          state.history = [];
        }),

        setError: (error) => set((state) => {
          state.error = error;
          if (error) state.stage = 'failed';
        }),

        retry: async () => {
          const { rawText, contextMode, retryCount } = get();
          if (retryCount >= 3) {
            set((state) => {
              state.error = 'Max retries exceeded';
            });
            return;
          }

          set((state) => {
            state.retryCount += 1;
            state.error = null;
            state.stage = 'processing';
          });

          try {
            const result = await window.api.transcription.process(rawText, contextMode);
            set((state) => {
              state.processedText = result.text;
              state.stage = 'completed';
            });
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Retry failed';
              state.stage = 'failed';
            });
          }
        },

        reset: () => set((state) => {
          // Preserve history and contextMode
          const { history, contextMode } = state;
          return { ...initialState, history, contextMode };
        }),
      }))
    ),
    { name: 'TranscriptionStore' }
  )
);
```

---

## Settings Store

Manages user preferences, hotkey configuration, and provider selection. This store is fully persisted.

### State Definition

```typescript
// src/stores/settingsStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

/**
 * Hotkey mode configuration
 */
export type HotkeyMode = 'push-to-talk' | 'toggle';

/**
 * LLM provider options
 */
export type LLMProvider = 'ollama' | 'gemini';

/**
 * Whisper model sizes
 */
export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large';

/**
 * Hotkey configuration
 */
export interface HotkeyConfig {
  key: string | null;
  modifiers: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
  };
  mode: HotkeyMode;
}

/**
 * Provider-specific settings
 */
export interface ProviderSettings {
  ollama: {
    model: string;
    baseUrl: string;
  };
  gemini: {
    apiKey: string | null;
    model: string;
  };
}

/**
 * Audio settings
 */
export interface AudioSettings {
  inputDeviceId: string | null;
  sampleRate: number;
  silenceThreshold: number;
  maxRecordingDuration: number; // seconds
}

/**
 * Whisper settings
 */
export interface WhisperSettings {
  model: WhisperModel;
  language: string | null; // null = auto-detect
  translateToEnglish: boolean;
}

/**
 * Custom prompts per context mode
 */
export interface CustomPrompts {
  standard?: string;
  developer?: string;
  email?: string;
}

interface SettingsState {
  // Hotkey configuration
  hotkey: HotkeyConfig;

  // Provider configuration
  activeProvider: LLMProvider;
  providerSettings: ProviderSettings;

  // Audio configuration
  audio: AudioSettings;

  // Whisper configuration
  whisper: WhisperSettings;

  // Context mode defaults
  defaultContextMode: ContextMode;
  customPrompts: CustomPrompts;

  // Application behavior
  startOnBoot: boolean;
  showInTaskbar: boolean;
  minimizeToTray: boolean;
  playFeedbackSounds: boolean;

  // First run
  isFirstRun: boolean;
  hasCompletedOnboarding: boolean;

  // Actions
  setHotkey: (config: Partial<HotkeyConfig>) => void;
  setHotkeyMode: (mode: HotkeyMode) => void;
  setActiveProvider: (provider: LLMProvider) => void;
  updateProviderSettings: <K extends LLMProvider>(
    provider: K,
    settings: Partial<ProviderSettings[K]>
  ) => void;
  updateAudioSettings: (settings: Partial<AudioSettings>) => void;
  updateWhisperSettings: (settings: Partial<WhisperSettings>) => void;
  setDefaultContextMode: (mode: ContextMode) => void;
  setCustomPrompt: (mode: keyof CustomPrompts, prompt: string) => void;
  toggleStartOnBoot: () => void;
  toggleShowInTaskbar: () => void;
  toggleMinimizeToTray: () => void;
  toggleFeedbackSounds: () => void;
  completeOnboarding: () => void;
  resetToDefaults: () => void;
  importSettings: (settings: Partial<SettingsState>) => void;
  exportSettings: () => ExportableSettings;
}

type ExportableSettings = Omit<SettingsState, 'isFirstRun' | 'hasCompletedOnboarding' | keyof SettingsActions>;
type SettingsActions = Pick<SettingsState,
  | 'setHotkey' | 'setHotkeyMode' | 'setActiveProvider'
  | 'updateProviderSettings' | 'updateAudioSettings' | 'updateWhisperSettings'
  | 'setDefaultContextMode' | 'setCustomPrompt' | 'toggleStartOnBoot'
  | 'toggleShowInTaskbar' | 'toggleMinimizeToTray' | 'toggleFeedbackSounds'
  | 'completeOnboarding' | 'resetToDefaults' | 'importSettings' | 'exportSettings'
>;

const defaultSettings = {
  hotkey: {
    key: null,
    modifiers: { ctrl: false, alt: false, shift: false, meta: false },
    mode: 'push-to-talk' as HotkeyMode,
  },
  activeProvider: 'ollama' as LLMProvider,
  providerSettings: {
    ollama: {
      model: 'llama3',
      baseUrl: 'http://localhost:11434',
    },
    gemini: {
      apiKey: null,
      model: 'gemini-pro',
    },
  },
  audio: {
    inputDeviceId: null,
    sampleRate: 16000,
    silenceThreshold: 0.01,
    maxRecordingDuration: 300,
  },
  whisper: {
    model: 'medium' as WhisperModel,
    language: null,
    translateToEnglish: false,
  },
  defaultContextMode: 'standard' as ContextMode,
  customPrompts: {},
  startOnBoot: false,
  showInTaskbar: true,
  minimizeToTray: true,
  playFeedbackSounds: true,
  isFirstRun: true,
  hasCompletedOnboarding: false,
};

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...defaultSettings,

        setHotkey: (config) => set((state) => {
          Object.assign(state.hotkey, config);
        }),

        setHotkeyMode: (mode) => set((state) => {
          state.hotkey.mode = mode;
        }),

        setActiveProvider: (provider) => set((state) => {
          state.activeProvider = provider;
        }),

        updateProviderSettings: (provider, settings) => set((state) => {
          Object.assign(state.providerSettings[provider], settings);
        }),

        updateAudioSettings: (settings) => set((state) => {
          Object.assign(state.audio, settings);
        }),

        updateWhisperSettings: (settings) => set((state) => {
          Object.assign(state.whisper, settings);
        }),

        setDefaultContextMode: (mode) => set((state) => {
          state.defaultContextMode = mode;
        }),

        setCustomPrompt: (mode, prompt) => set((state) => {
          state.customPrompts[mode] = prompt;
        }),

        toggleStartOnBoot: () => set((state) => {
          state.startOnBoot = !state.startOnBoot;
        }),

        toggleShowInTaskbar: () => set((state) => {
          state.showInTaskbar = !state.showInTaskbar;
        }),

        toggleMinimizeToTray: () => set((state) => {
          state.minimizeToTray = !state.minimizeToTray;
        }),

        toggleFeedbackSounds: () => set((state) => {
          state.playFeedbackSounds = !state.playFeedbackSounds;
        }),

        completeOnboarding: () => set((state) => {
          state.isFirstRun = false;
          state.hasCompletedOnboarding = true;
        }),

        resetToDefaults: () => set(() => ({
          ...defaultSettings,
          isFirstRun: false,
          hasCompletedOnboarding: true,
        })),

        importSettings: (settings) => set((state) => {
          // Safely merge imported settings
          if (settings.hotkey) Object.assign(state.hotkey, settings.hotkey);
          if (settings.providerSettings) {
            if (settings.providerSettings.ollama) {
              Object.assign(state.providerSettings.ollama, settings.providerSettings.ollama);
            }
            if (settings.providerSettings.gemini) {
              Object.assign(state.providerSettings.gemini, settings.providerSettings.gemini);
            }
          }
          if (settings.audio) Object.assign(state.audio, settings.audio);
          if (settings.whisper) Object.assign(state.whisper, settings.whisper);
          if (settings.activeProvider) state.activeProvider = settings.activeProvider;
          if (settings.defaultContextMode) state.defaultContextMode = settings.defaultContextMode;
          if (settings.customPrompts) Object.assign(state.customPrompts, settings.customPrompts);
        }),

        exportSettings: () => {
          const state = get();
          const { isFirstRun, hasCompletedOnboarding, ...exportable } = state;
          // Remove action functions
          return Object.fromEntries(
            Object.entries(exportable).filter(([_, v]) => typeof v !== 'function')
          ) as ExportableSettings;
        },
      })),
      {
        name: 'diktate-settings',
        version: 1,
        migrate: (persisted, version) => {
          // Handle future migrations
          return persisted as SettingsState;
        },
        partialize: (state) => {
          // Exclude sensitive data from persistence if needed
          const { ...persistable } = state;
          return persistable;
        },
      }
    ),
    { name: 'SettingsStore' }
  )
);
```

---

## UI Store

Manages visual state, window configuration, theme, and panel visibility.

### State Definition

```typescript
// src/stores/uiStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

/**
 * Application theme options
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Window display mode
 */
export type WindowMode = 'floating-pill' | 'settings' | 'hidden';

/**
 * Floating pill position
 */
export interface PillPosition {
  x: number;
  y: number;
  anchor: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
}

/**
 * Notification/toast configuration
 */
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Modal state
 */
export type ModalType =
  | 'hotkey-capture'
  | 'provider-setup'
  | 'audio-test'
  | 'about'
  | 'keyboard-shortcuts'
  | null;

interface UIState {
  // Theme
  theme: Theme;
  resolvedTheme: 'light' | 'dark'; // After system resolution

  // Window state
  windowMode: WindowMode;
  pillPosition: PillPosition;
  pillScale: number; // 0.5 - 2.0
  pillOpacity: number; // 0.3 - 1.0

  // Visibility states
  isSettingsOpen: boolean;
  isPillVisible: boolean;
  isPillExpanded: boolean;

  // Modal state
  activeModal: ModalType;

  // Toasts
  toasts: Toast[];

  // Keyboard shortcuts overlay
  showKeyboardHints: boolean;

  // Loading states
  isAppLoading: boolean;
  loadingMessage: string | null;

  // Actions
  setTheme: (theme: Theme) => void;
  setResolvedTheme: (theme: 'light' | 'dark') => void;
  setWindowMode: (mode: WindowMode) => void;
  setPillPosition: (position: Partial<PillPosition>) => void;
  setPillScale: (scale: number) => void;
  setPillOpacity: (opacity: number) => void;
  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  showPill: () => void;
  hidePill: () => void;
  expandPill: () => void;
  collapsePill: () => void;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  toggleKeyboardHints: () => void;
  setAppLoading: (loading: boolean, message?: string) => void;
}

const initialState = {
  theme: 'system' as Theme,
  resolvedTheme: 'dark' as 'light' | 'dark',
  windowMode: 'floating-pill' as WindowMode,
  pillPosition: {
    x: 20,
    y: 20,
    anchor: 'top-right' as const,
  },
  pillScale: 1.0,
  pillOpacity: 0.95,
  isSettingsOpen: false,
  isPillVisible: true,
  isPillExpanded: false,
  activeModal: null as ModalType,
  toasts: [] as Toast[],
  showKeyboardHints: false,
  isAppLoading: false,
  loadingMessage: null,
};

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        setTheme: (theme) => set((state) => {
          state.theme = theme;
        }),

        setResolvedTheme: (theme) => set((state) => {
          state.resolvedTheme = theme;
        }),

        setWindowMode: (mode) => set((state) => {
          state.windowMode = mode;
        }),

        setPillPosition: (position) => set((state) => {
          Object.assign(state.pillPosition, position);
        }),

        setPillScale: (scale) => set((state) => {
          state.pillScale = Math.max(0.5, Math.min(2.0, scale));
        }),

        setPillOpacity: (opacity) => set((state) => {
          state.pillOpacity = Math.max(0.3, Math.min(1.0, opacity));
        }),

        openSettings: () => set((state) => {
          state.isSettingsOpen = true;
          state.windowMode = 'settings';
        }),

        closeSettings: () => set((state) => {
          state.isSettingsOpen = false;
          state.windowMode = 'floating-pill';
        }),

        toggleSettings: () => {
          const isOpen = get().isSettingsOpen;
          if (isOpen) {
            get().closeSettings();
          } else {
            get().openSettings();
          }
        },

        showPill: () => set((state) => {
          state.isPillVisible = true;
        }),

        hidePill: () => set((state) => {
          state.isPillVisible = false;
        }),

        expandPill: () => set((state) => {
          state.isPillExpanded = true;
        }),

        collapsePill: () => set((state) => {
          state.isPillExpanded = false;
        }),

        openModal: (modal) => set((state) => {
          state.activeModal = modal;
        }),

        closeModal: () => set((state) => {
          state.activeModal = null;
        }),

        addToast: (toast) => {
          const id = crypto.randomUUID();
          set((state) => {
            state.toasts.push({ ...toast, id });
          });

          // Auto-remove after duration
          const duration = toast.duration ?? 5000;
          if (duration > 0) {
            setTimeout(() => {
              get().removeToast(id);
            }, duration);
          }

          return id;
        },

        removeToast: (id) => set((state) => {
          state.toasts = state.toasts.filter((t) => t.id !== id);
        }),

        clearToasts: () => set((state) => {
          state.toasts = [];
        }),

        toggleKeyboardHints: () => set((state) => {
          state.showKeyboardHints = !state.showKeyboardHints;
        }),

        setAppLoading: (loading, message) => set((state) => {
          state.isAppLoading = loading;
          state.loadingMessage = loading ? (message ?? null) : null;
        }),
      })),
      {
        name: 'diktate-ui',
        partialize: (state) => ({
          theme: state.theme,
          pillPosition: state.pillPosition,
          pillScale: state.pillScale,
          pillOpacity: state.pillOpacity,
        }),
      }
    ),
    { name: 'UIStore' }
  )
);
```

---

## Provider Store

Manages LLM provider availability, health checks, and model information.

### State Definition

```typescript
// src/stores/providerStore.ts
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

/**
 * Provider health status
 */
export type ProviderHealth = 'unknown' | 'healthy' | 'degraded' | 'unavailable';

/**
 * Model information
 */
export interface ModelInfo {
  id: string;
  name: string;
  size?: string;
  quantization?: string;
  contextLength?: number;
  capabilities?: string[];
}

/**
 * Provider status
 */
export interface ProviderStatus {
  health: ProviderHealth;
  lastChecked: number | null;
  error: string | null;
  latencyMs: number | null;
  availableModels: ModelInfo[];
  currentModel: ModelInfo | null;
}

/**
 * Whisper status (separate from LLM providers)
 */
export interface WhisperStatus {
  isLoaded: boolean;
  isLoading: boolean;
  currentModel: string | null;
  vramUsageMB: number | null;
  error: string | null;
}

interface ProviderState {
  // Provider statuses
  ollama: ProviderStatus;
  gemini: ProviderStatus;

  // Whisper status
  whisper: WhisperStatus;

  // Active provider (mirrors settings but with computed availability)
  activeProvider: LLMProvider | null;
  isProviderReady: boolean;

  // Backend connection
  backendConnected: boolean;
  backendVersion: string | null;

  // Resource monitoring
  gpuMemoryUsedMB: number | null;
  gpuMemoryTotalMB: number | null;

  // Actions
  checkOllamaHealth: () => Promise<void>;
  checkGeminiHealth: () => Promise<void>;
  checkWhisperStatus: () => Promise<void>;
  checkAllProviders: () => Promise<void>;
  fetchOllamaModels: () => Promise<void>;
  setActiveProvider: (provider: LLMProvider) => void;
  selectModel: (provider: LLMProvider, modelId: string) => void;
  loadWhisperModel: (model: WhisperModel) => Promise<void>;
  unloadWhisperModel: () => Promise<void>;
  setBackendConnection: (connected: boolean, version?: string) => void;
  updateGpuMemory: (used: number, total: number) => void;
  reset: () => void;
}

const createInitialProviderStatus = (): ProviderStatus => ({
  health: 'unknown',
  lastChecked: null,
  error: null,
  latencyMs: null,
  availableModels: [],
  currentModel: null,
});

const initialState = {
  ollama: createInitialProviderStatus(),
  gemini: createInitialProviderStatus(),
  whisper: {
    isLoaded: false,
    isLoading: false,
    currentModel: null,
    vramUsageMB: null,
    error: null,
  },
  activeProvider: null as LLMProvider | null,
  isProviderReady: false,
  backendConnected: false,
  backendVersion: null,
  gpuMemoryUsedMB: null,
  gpuMemoryTotalMB: null,
};

export const useProviderStore = create<ProviderState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        ...initialState,

        checkOllamaHealth: async () => {
          const startTime = Date.now();
          try {
            const result = await window.api.providers.checkOllama();
            set((state) => {
              state.ollama.health = result.healthy ? 'healthy' : 'unavailable';
              state.ollama.lastChecked = Date.now();
              state.ollama.latencyMs = Date.now() - startTime;
              state.ollama.error = result.error ?? null;
              if (result.models) {
                state.ollama.availableModels = result.models;
              }
            });
          } catch (error) {
            set((state) => {
              state.ollama.health = 'unavailable';
              state.ollama.lastChecked = Date.now();
              state.ollama.error = error instanceof Error ? error.message : 'Health check failed';
            });
          }
        },

        checkGeminiHealth: async () => {
          const startTime = Date.now();
          try {
            const result = await window.api.providers.checkGemini();
            set((state) => {
              state.gemini.health = result.healthy ? 'healthy' : 'unavailable';
              state.gemini.lastChecked = Date.now();
              state.gemini.latencyMs = Date.now() - startTime;
              state.gemini.error = result.error ?? null;
              if (result.models) {
                state.gemini.availableModels = result.models;
              }
            });
          } catch (error) {
            set((state) => {
              state.gemini.health = 'unavailable';
              state.gemini.lastChecked = Date.now();
              state.gemini.error = error instanceof Error ? error.message : 'Health check failed';
            });
          }
        },

        checkWhisperStatus: async () => {
          try {
            const status = await window.api.whisper.getStatus();
            set((state) => {
              state.whisper.isLoaded = status.loaded;
              state.whisper.currentModel = status.model;
              state.whisper.vramUsageMB = status.vramUsage;
              state.whisper.error = null;
            });
          } catch (error) {
            set((state) => {
              state.whisper.error = error instanceof Error ? error.message : 'Status check failed';
            });
          }
        },

        checkAllProviders: async () => {
          await Promise.all([
            get().checkOllamaHealth(),
            get().checkGeminiHealth(),
            get().checkWhisperStatus(),
          ]);

          // Update provider readiness
          const state = get();
          const activeProvider = state.activeProvider;
          if (activeProvider) {
            const providerStatus = state[activeProvider];
            set((s) => {
              s.isProviderReady = providerStatus.health === 'healthy';
            });
          }
        },

        fetchOllamaModels: async () => {
          try {
            const models = await window.api.providers.listOllamaModels();
            set((state) => {
              state.ollama.availableModels = models;
            });
          } catch (error) {
            set((state) => {
              state.ollama.error = error instanceof Error ? error.message : 'Failed to fetch models';
            });
          }
        },

        setActiveProvider: (provider) => set((state) => {
          state.activeProvider = provider;
          const providerStatus = state[provider];
          state.isProviderReady = providerStatus.health === 'healthy';
        }),

        selectModel: (provider, modelId) => set((state) => {
          const providerState = state[provider];
          const model = providerState.availableModels.find((m) => m.id === modelId);
          if (model) {
            providerState.currentModel = model;
          }
        }),

        loadWhisperModel: async (model) => {
          set((state) => {
            state.whisper.isLoading = true;
            state.whisper.error = null;
          });

          try {
            await window.api.whisper.loadModel(model);
            set((state) => {
              state.whisper.isLoaded = true;
              state.whisper.isLoading = false;
              state.whisper.currentModel = model;
            });
          } catch (error) {
            set((state) => {
              state.whisper.isLoading = false;
              state.whisper.error = error instanceof Error ? error.message : 'Failed to load model';
            });
          }
        },

        unloadWhisperModel: async () => {
          try {
            await window.api.whisper.unloadModel();
            set((state) => {
              state.whisper.isLoaded = false;
              state.whisper.currentModel = null;
              state.whisper.vramUsageMB = null;
            });
          } catch (error) {
            set((state) => {
              state.whisper.error = error instanceof Error ? error.message : 'Failed to unload model';
            });
          }
        },

        setBackendConnection: (connected, version) => set((state) => {
          state.backendConnected = connected;
          if (version) state.backendVersion = version;
        }),

        updateGpuMemory: (used, total) => set((state) => {
          state.gpuMemoryUsedMB = used;
          state.gpuMemoryTotalMB = total;
        }),

        reset: () => set(() => initialState),
      }))
    ),
    { name: 'ProviderStore' }
  )
);
```

---

## Selectors

Performance-optimized selectors for each store to prevent unnecessary re-renders.

### Recording Selectors

```typescript
// src/stores/selectors/recordingSelectors.ts
import { shallow } from 'zustand/shallow';
import { useRecordingStore, RecordingState } from '../recordingStore';

// Atomic selectors (no re-render on unrelated changes)
export const selectRecordingStatus = (state: RecordingState) => state.status;
export const selectIsRecording = (state: RecordingState) => state.status === 'listening';
export const selectIsInitializing = (state: RecordingState) => state.status === 'initializing';
export const selectRecordingError = (state: RecordingState) => state.error;

// Waveform selectors (memoized array)
export const selectWaveformData = (state: RecordingState) => state.waveformData;
export const selectLatestWaveform = (state: RecordingState) =>
  state.waveformData[state.waveformData.length - 1];

// Amplitude selectors
export const selectAmplitudes = (state: RecordingState) => ({
  peak: state.peakAmplitude,
  average: state.averageAmplitude,
});

// Session selectors
export const selectCurrentSession = (state: RecordingState) => state.currentSession;
export const selectRecordingDuration = (state: RecordingState) =>
  state.currentSession?.duration ?? 0;

// Device selectors
export const selectAudioDevices = (state: RecordingState) => state.audioDevices;
export const selectSelectedDevice = (state: RecordingState) => {
  const { audioDevices, selectedDeviceId } = state;
  return audioDevices.find((d) => d.deviceId === selectedDeviceId) ?? null;
};

// Hook factories for common patterns
export const useRecordingStatus = () => useRecordingStore(selectRecordingStatus);
export const useIsRecording = () => useRecordingStore(selectIsRecording);
export const useWaveformData = () => useRecordingStore(selectWaveformData);
export const useAmplitudes = () => useRecordingStore(selectAmplitudes, shallow);
```

### Transcription Selectors

```typescript
// src/stores/selectors/transcriptionSelectors.ts
import { shallow } from 'zustand/shallow';
import { useTranscriptionStore, TranscriptionState } from '../transcriptionStore';

// Stage selectors
export const selectTranscriptionStage = (state: TranscriptionState) => state.stage;
export const selectIsProcessing = (state: TranscriptionState) =>
  ['transcribing', 'processing', 'injecting'].includes(state.stage);
export const selectIsComplete = (state: TranscriptionState) => state.stage === 'completed';
export const selectHasError = (state: TranscriptionState) => state.stage === 'failed';

// Progress selectors
export const selectProgress = (state: TranscriptionState) => state.progress;
export const selectProgressWithStage = (state: TranscriptionState) => ({
  stage: state.stage,
  progress: state.progress,
});

// Text selectors
export const selectRawText = (state: TranscriptionState) => state.rawText;
export const selectProcessedText = (state: TranscriptionState) => state.processedText;
export const selectStreamBuffer = (state: TranscriptionState) => state.streamBuffer;
export const selectDisplayText = (state: TranscriptionState) =>
  state.streamBuffer || state.processedText || state.rawText;

// History selectors
export const selectHistory = (state: TranscriptionState) => state.history;
export const selectRecentHistory = (limit: number) => (state: TranscriptionState) =>
  state.history.slice(0, limit);
export const selectHistoryById = (id: string) => (state: TranscriptionState) =>
  state.history.find((h) => h.id === id);

// Context mode selectors
export const selectContextMode = (state: TranscriptionState) => state.contextMode;

// Hook factories
export const useTranscriptionStage = () => useTranscriptionStore(selectTranscriptionStage);
export const useIsProcessing = () => useTranscriptionStore(selectIsProcessing);
export const useDisplayText = () => useTranscriptionStore(selectDisplayText);
export const useProgressWithStage = () => useTranscriptionStore(selectProgressWithStage, shallow);
```

### Settings Selectors

```typescript
// src/stores/selectors/settingsSelectors.ts
import { shallow } from 'zustand/shallow';
import { useSettingsStore, SettingsState } from '../settingsStore';

// Hotkey selectors
export const selectHotkey = (state: SettingsState) => state.hotkey;
export const selectHotkeyString = (state: SettingsState) => {
  const { key, modifiers } = state.hotkey;
  if (!key) return null;
  const parts: string[] = [];
  if (modifiers.ctrl) parts.push('Ctrl');
  if (modifiers.alt) parts.push('Alt');
  if (modifiers.shift) parts.push('Shift');
  if (modifiers.meta) parts.push('Meta');
  parts.push(key);
  return parts.join('+');
};
export const selectHotkeyMode = (state: SettingsState) => state.hotkey.mode;

// Provider selectors
export const selectActiveProvider = (state: SettingsState) => state.activeProvider;
export const selectProviderSettings = (state: SettingsState) => state.providerSettings;
export const selectOllamaSettings = (state: SettingsState) => state.providerSettings.ollama;
export const selectGeminiSettings = (state: SettingsState) => state.providerSettings.gemini;
export const selectActiveProviderSettings = (state: SettingsState) =>
  state.providerSettings[state.activeProvider];

// Audio selectors
export const selectAudioSettings = (state: SettingsState) => state.audio;
export const selectInputDeviceId = (state: SettingsState) => state.audio.inputDeviceId;

// Whisper selectors
export const selectWhisperSettings = (state: SettingsState) => state.whisper;
export const selectWhisperModel = (state: SettingsState) => state.whisper.model;

// Context mode selectors
export const selectDefaultContextMode = (state: SettingsState) => state.defaultContextMode;
export const selectCustomPrompts = (state: SettingsState) => state.customPrompts;
export const selectCustomPrompt = (mode: ContextMode) => (state: SettingsState) =>
  state.customPrompts[mode];

// Onboarding selectors
export const selectIsFirstRun = (state: SettingsState) => state.isFirstRun;
export const selectNeedsOnboarding = (state: SettingsState) =>
  state.isFirstRun || !state.hasCompletedOnboarding || !state.hotkey.key;

// Hook factories
export const useHotkey = () => useSettingsStore(selectHotkey, shallow);
export const useActiveProvider = () => useSettingsStore(selectActiveProvider);
export const useAudioSettings = () => useSettingsStore(selectAudioSettings, shallow);
export const useNeedsOnboarding = () => useSettingsStore(selectNeedsOnboarding);
```

### UI Selectors

```typescript
// src/stores/selectors/uiSelectors.ts
import { shallow } from 'zustand/shallow';
import { useUIStore, UIState } from '../uiStore';

// Theme selectors
export const selectTheme = (state: UIState) => state.theme;
export const selectResolvedTheme = (state: UIState) => state.resolvedTheme;
export const selectIsDarkMode = (state: UIState) => state.resolvedTheme === 'dark';

// Pill selectors
export const selectPillPosition = (state: UIState) => state.pillPosition;
export const selectPillStyle = (state: UIState) => ({
  position: state.pillPosition,
  scale: state.pillScale,
  opacity: state.pillOpacity,
});
export const selectIsPillVisible = (state: UIState) => state.isPillVisible;
export const selectIsPillExpanded = (state: UIState) => state.isPillExpanded;

// Modal selectors
export const selectActiveModal = (state: UIState) => state.activeModal;
export const selectIsModalOpen = (modal: ModalType) => (state: UIState) =>
  state.activeModal === modal;

// Toast selectors
export const selectToasts = (state: UIState) => state.toasts;
export const selectHasToasts = (state: UIState) => state.toasts.length > 0;

// Settings visibility
export const selectIsSettingsOpen = (state: UIState) => state.isSettingsOpen;

// Loading selectors
export const selectIsAppLoading = (state: UIState) => state.isAppLoading;
export const selectLoadingState = (state: UIState) => ({
  isLoading: state.isAppLoading,
  message: state.loadingMessage,
});

// Hook factories
export const useTheme = () => useUIStore(selectResolvedTheme);
export const usePillStyle = () => useUIStore(selectPillStyle, shallow);
export const useActiveModal = () => useUIStore(selectActiveModal);
export const useToasts = () => useUIStore(selectToasts);
```

### Provider Selectors

```typescript
// src/stores/selectors/providerSelectors.ts
import { shallow } from 'zustand/shallow';
import { useProviderStore, ProviderState } from '../providerStore';

// Health selectors
export const selectOllamaHealth = (state: ProviderState) => state.ollama.health;
export const selectGeminiHealth = (state: ProviderState) => state.gemini.health;
export const selectProviderHealth = (provider: LLMProvider) => (state: ProviderState) =>
  state[provider].health;

// Availability selectors
export const selectIsOllamaAvailable = (state: ProviderState) =>
  state.ollama.health === 'healthy';
export const selectIsGeminiAvailable = (state: ProviderState) =>
  state.gemini.health === 'healthy';
export const selectIsActiveProviderReady = (state: ProviderState) => state.isProviderReady;

// Model selectors
export const selectOllamaModels = (state: ProviderState) => state.ollama.availableModels;
export const selectGeminiModels = (state: ProviderState) => state.gemini.availableModels;
export const selectCurrentOllamaModel = (state: ProviderState) => state.ollama.currentModel;
export const selectCurrentGeminiModel = (state: ProviderState) => state.gemini.currentModel;

// Whisper selectors
export const selectWhisperStatus = (state: ProviderState) => state.whisper;
export const selectIsWhisperLoaded = (state: ProviderState) => state.whisper.isLoaded;
export const selectIsWhisperLoading = (state: ProviderState) => state.whisper.isLoading;

// Backend selectors
export const selectBackendConnected = (state: ProviderState) => state.backendConnected;
export const selectBackendVersion = (state: ProviderState) => state.backendVersion;

// GPU memory selectors
export const selectGpuMemory = (state: ProviderState) => ({
  used: state.gpuMemoryUsedMB,
  total: state.gpuMemoryTotalMB,
  percent: state.gpuMemoryTotalMB
    ? Math.round((state.gpuMemoryUsedMB ?? 0) / state.gpuMemoryTotalMB * 100)
    : null,
});

// Composite selectors
export const selectSystemStatus = (state: ProviderState) => ({
  backendConnected: state.backendConnected,
  whisperReady: state.whisper.isLoaded,
  providerReady: state.isProviderReady,
  allReady: state.backendConnected && state.whisper.isLoaded && state.isProviderReady,
});

// Hook factories
export const useIsProviderReady = () => useProviderStore(selectIsActiveProviderReady);
export const useWhisperStatus = () => useProviderStore(selectWhisperStatus, shallow);
export const useSystemStatus = () => useProviderStore(selectSystemStatus, shallow);
export const useGpuMemory = () => useProviderStore(selectGpuMemory, shallow);
```

---

## Persistence Strategy

### What to Persist

| Store | Persisted | Ephemeral | Rationale |
|-------|-----------|-----------|-----------|
| **Settings** | All preferences, hotkey config, provider settings | None | User preferences must survive restarts |
| **UI** | Theme, pill position/style | Modals, toasts, loading states | Visual preferences persist; transient states reset |
| **Recording** | Selected device ID | Recording state, waveform, sessions | Device preference persists; active state resets |
| **Transcription** | History (last 50) | Current stage, progress, buffers | History useful; pipeline state always starts fresh |
| **Provider** | None | All health checks, model lists | Always re-check on startup for accuracy |

### Persistence Configuration

```typescript
// src/stores/persistence.ts
import { PersistStorage } from 'zustand/middleware';

/**
 * Custom storage using Electron's secure storage
 * Falls back to localStorage for development
 */
export const createElectronStorage = <T>(): PersistStorage<T> => ({
  getItem: async (name) => {
    if (window.api?.storage) {
      const value = await window.api.storage.get(name);
      return value ? JSON.parse(value) : null;
    }
    const value = localStorage.getItem(name);
    return value ? JSON.parse(value) : null;
  },
  setItem: async (name, value) => {
    const serialized = JSON.stringify(value);
    if (window.api?.storage) {
      await window.api.storage.set(name, serialized);
    } else {
      localStorage.setItem(name, serialized);
    }
  },
  removeItem: async (name) => {
    if (window.api?.storage) {
      await window.api.storage.remove(name);
    } else {
      localStorage.removeItem(name);
    }
  },
});

/**
 * Settings store persistence (comprehensive)
 */
export const settingsPersistConfig = {
  name: 'diktate-settings',
  version: 1,
  storage: createElectronStorage(),
  migrate: (persisted: any, version: number) => {
    // Future migration logic
    return persisted;
  },
};

/**
 * UI store persistence (selective)
 */
export const uiPersistConfig = {
  name: 'diktate-ui',
  version: 1,
  storage: createElectronStorage(),
  partialize: (state: UIState) => ({
    theme: state.theme,
    pillPosition: state.pillPosition,
    pillScale: state.pillScale,
    pillOpacity: state.pillOpacity,
  }),
};

/**
 * Transcription store persistence (history only)
 */
export const transcriptionPersistConfig = {
  name: 'diktate-transcription',
  version: 1,
  storage: createElectronStorage(),
  partialize: (state: TranscriptionState) => ({
    history: state.history,
    contextMode: state.contextMode,
  }),
};
```

### Migration Strategy

```typescript
// src/stores/migrations.ts

/**
 * Version migration handlers
 */
export const migrations = {
  settings: {
    1: (state: any) => {
      // v0 -> v1: Add whisper settings
      return {
        ...state,
        whisper: state.whisper ?? {
          model: 'medium',
          language: null,
          translateToEnglish: false,
        },
      };
    },
    2: (state: any) => {
      // v1 -> v2: Rename contextMode to defaultContextMode
      return {
        ...state,
        defaultContextMode: state.contextMode ?? state.defaultContextMode ?? 'standard',
        contextMode: undefined,
      };
    },
  },
  ui: {
    1: (state: any) => {
      // v0 -> v1: Add pill anchor property
      return {
        ...state,
        pillPosition: {
          ...state.pillPosition,
          anchor: state.pillPosition?.anchor ?? 'top-right',
        },
      };
    },
  },
};
```

---

## IPC Integration

### Preload API Types

```typescript
// src/preload/api.d.ts

export interface DiktateAPI {
  // Recording operations
  recording: {
    start: (deviceId?: string | null) => Promise<void>;
    stop: () => Promise<{ audioPath: string; durationMs: number }>;
    cancel: () => void;
    getDevices: () => Promise<MediaDeviceInfo[]>;
  };

  // Transcription operations
  transcription: {
    transcribe: (audioPath: string) => Promise<{ text: string; confidence: number }>;
    process: (text: string, mode: ContextMode) => Promise<{ text: string }>;
    inject: (text: string) => Promise<void>;
  };

  // Provider operations
  providers: {
    checkOllama: () => Promise<{
      healthy: boolean;
      error?: string;
      models?: ModelInfo[];
    }>;
    checkGemini: () => Promise<{
      healthy: boolean;
      error?: string;
      models?: ModelInfo[];
    }>;
    listOllamaModels: () => Promise<ModelInfo[]>;
    setOllamaModel: (modelId: string) => Promise<void>;
  };

  // Whisper operations
  whisper: {
    getStatus: () => Promise<{
      loaded: boolean;
      model: string | null;
      vramUsage: number | null;
    }>;
    loadModel: (model: WhisperModel) => Promise<void>;
    unloadModel: () => Promise<void>;
  };

  // Storage operations (for persistence)
  storage: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
    remove: (key: string) => Promise<void>;
  };

  // Window operations
  window: {
    minimize: () => void;
    close: () => void;
    setAlwaysOnTop: (value: boolean) => void;
    setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
  };

  // Event subscriptions
  on: (channel: string, callback: (...args: any[]) => void) => () => void;
}

declare global {
  interface Window {
    api: DiktateAPI;
  }
}
```

### WebSocket Event Handlers

```typescript
// src/stores/ipc/websocket.ts
import { useRecordingStore } from '../recordingStore';
import { useTranscriptionStore } from '../transcriptionStore';
import { useProviderStore } from '../providerStore';

export type WebSocketMessage =
  | { type: 'recording:started' }
  | { type: 'recording:stopped'; payload: { audioPath: string } }
  | { type: 'recording:amplitude'; payload: { peak: number; average: number } }
  | { type: 'recording:waveform'; payload: { points: WaveformPoint[] } }
  | { type: 'transcription:started' }
  | { type: 'transcription:progress'; payload: { stage: TranscriptionStage; progress: number } }
  | { type: 'transcription:chunk'; payload: { text: string } }
  | { type: 'transcription:completed'; payload: TranscriptionResult }
  | { type: 'transcription:error'; payload: { error: string } }
  | { type: 'provider:status'; payload: { provider: LLMProvider; health: ProviderHealth } }
  | { type: 'gpu:memory'; payload: { used: number; total: number } }
  | { type: 'backend:connected'; payload: { version: string } }
  | { type: 'backend:disconnected' };

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 1000;

export function initializeWebSocket() {
  const connect = () => {
    ws = new WebSocket('ws://localhost:3001/ws');

    ws.onopen = () => {
      console.log('[WS] Connected to backend');
      reconnectAttempts = 0;
      useProviderStore.getState().setBackendConnection(true);
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected from backend');
      useProviderStore.getState().setBackendConnection(false);

      // Attempt reconnection
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        setTimeout(connect, RECONNECT_DELAY * reconnectAttempts);
      }
    };

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
    };

    ws.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data);
      handleMessage(message);
    };
  };

  connect();

  return () => {
    ws?.close();
    ws = null;
  };
}

function handleMessage(message: WebSocketMessage) {
  switch (message.type) {
    // Recording events
    case 'recording:amplitude':
      useRecordingStore.getState().updateAmplitude(
        message.payload.peak,
        message.payload.average
      );
      break;

    case 'recording:waveform':
      useRecordingStore.getState().appendWaveformData(message.payload.points);
      break;

    // Transcription events
    case 'transcription:progress':
      useTranscriptionStore.getState().setStage(message.payload.stage);
      useTranscriptionStore.getState().setProgress(message.payload.progress);
      break;

    case 'transcription:chunk':
      useTranscriptionStore.getState().appendToStream(message.payload.text);
      break;

    case 'transcription:completed':
      const store = useTranscriptionStore.getState();
      store.flushStream();
      store.setProcessedText(message.payload.processedText);
      store.addToHistory(message.payload);
      store.setStage('completed');
      break;

    case 'transcription:error':
      useTranscriptionStore.getState().setError(message.payload.error);
      break;

    // Provider events
    case 'provider:status':
      // Update provider health
      useProviderStore.setState((state) => {
        state[message.payload.provider].health = message.payload.health;
      });
      break;

    case 'gpu:memory':
      useProviderStore.getState().updateGpuMemory(
        message.payload.used,
        message.payload.total
      );
      break;

    case 'backend:connected':
      useProviderStore.getState().setBackendConnection(true, message.payload.version);
      break;

    case 'backend:disconnected':
      useProviderStore.getState().setBackendConnection(false);
      break;
  }
}

export function sendWebSocketMessage(message: { type: string; payload?: any }) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
```

### Store Initialization

```typescript
// src/stores/initialize.ts
import { useSettingsStore } from './settingsStore';
import { useUIStore } from './uiStore';
import { useRecordingStore } from './recordingStore';
import { useProviderStore } from './providerStore';
import { initializeWebSocket } from './ipc/websocket';

/**
 * Initialize all stores and establish backend connections
 * Called once on app startup
 */
export async function initializeStores() {
  // Initialize WebSocket connection
  const cleanupWs = initializeWebSocket();

  // Wait for settings to be hydrated from persistence
  await new Promise<void>((resolve) => {
    const unsub = useSettingsStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
    // If already hydrated
    if (useSettingsStore.persist.hasHydrated()) {
      unsub();
      resolve();
    }
  });

  // Apply settings-derived state
  const settings = useSettingsStore.getState();

  // Set provider from settings
  useProviderStore.getState().setActiveProvider(settings.activeProvider);

  // Set audio device from settings
  if (settings.audio.inputDeviceId) {
    useRecordingStore.getState().selectDevice(settings.audio.inputDeviceId);
  }

  // Resolve system theme
  if (settings.theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    useUIStore.getState().setResolvedTheme(prefersDark ? 'dark' : 'light');
  }

  // Fetch initial data
  await Promise.all([
    useRecordingStore.getState().setAudioDevices(
      await window.api.recording.getDevices()
    ),
    useProviderStore.getState().checkAllProviders(),
  ]);

  return cleanupWs;
}
```

---

## TypeScript Types

Complete type definitions for the state management system.

```typescript
// src/stores/types.ts

// ============================================
// Common Types
// ============================================

export type UUID = string;
export type Timestamp = number;

// ============================================
// Recording Types
// ============================================

export type RecordingStatus =
  | 'idle'
  | 'initializing'
  | 'listening'
  | 'stopping'
  | 'error';

export interface WaveformPoint {
  timestamp: Timestamp;
  amplitude: number;
}

export interface RecordingSession {
  id: UUID;
  startedAt: Timestamp;
  duration: number;
  audioDeviceId: string | null;
}

export interface RecordingState {
  status: RecordingStatus;
  currentSession: RecordingSession | null;
  waveformData: WaveformPoint[];
  peakAmplitude: number;
  averageAmplitude: number;
  error: string | null;
  audioDevices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
}

export interface RecordingActions {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  cancelRecording: () => void;
  appendWaveformData: (points: WaveformPoint[]) => void;
  clearWaveformData: () => void;
  updateAmplitude: (peak: number, average: number) => void;
  setAudioDevices: (devices: MediaDeviceInfo[]) => void;
  selectDevice: (deviceId: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export type RecordingStore = RecordingState & RecordingActions;

// ============================================
// Transcription Types
// ============================================

export type TranscriptionStage =
  | 'idle'
  | 'transcribing'
  | 'processing'
  | 'injecting'
  | 'completed'
  | 'failed';

export type ContextMode = 'standard' | 'developer' | 'email' | 'raw';

export interface TranscriptionResult {
  id: UUID;
  rawText: string;
  processedText: string;
  contextMode: ContextMode;
  processingTimeMs: number;
  wordCount: number;
  confidence: number;
  createdAt: Timestamp;
}

export interface TranscriptionState {
  stage: TranscriptionStage;
  progress: number;
  rawText: string;
  processedText: string;
  streamBuffer: string;
  contextMode: ContextMode;
  history: TranscriptionResult[];
  error: string | null;
  retryCount: number;
}

export interface TranscriptionActions {
  setStage: (stage: TranscriptionStage) => void;
  setProgress: (progress: number) => void;
  setRawText: (text: string) => void;
  setProcessedText: (text: string) => void;
  appendToStream: (chunk: string) => void;
  flushStream: () => void;
  setContextMode: (mode: ContextMode) => void;
  addToHistory: (result: TranscriptionResult) => void;
  clearHistory: () => void;
  setError: (error: string | null) => void;
  retry: () => Promise<void>;
  reset: () => void;
}

export type TranscriptionStore = TranscriptionState & TranscriptionActions;

// ============================================
// Settings Types
// ============================================

export type HotkeyMode = 'push-to-talk' | 'toggle';
export type LLMProvider = 'ollama' | 'gemini';
export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large';

export interface HotkeyModifiers {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export interface HotkeyConfig {
  key: string | null;
  modifiers: HotkeyModifiers;
  mode: HotkeyMode;
}

export interface OllamaSettings {
  model: string;
  baseUrl: string;
}

export interface GeminiSettings {
  apiKey: string | null;
  model: string;
}

export interface ProviderSettings {
  ollama: OllamaSettings;
  gemini: GeminiSettings;
}

export interface AudioSettings {
  inputDeviceId: string | null;
  sampleRate: number;
  silenceThreshold: number;
  maxRecordingDuration: number;
}

export interface WhisperSettings {
  model: WhisperModel;
  language: string | null;
  translateToEnglish: boolean;
}

export interface CustomPrompts {
  standard?: string;
  developer?: string;
  email?: string;
}

export interface SettingsState {
  hotkey: HotkeyConfig;
  activeProvider: LLMProvider;
  providerSettings: ProviderSettings;
  audio: AudioSettings;
  whisper: WhisperSettings;
  defaultContextMode: ContextMode;
  customPrompts: CustomPrompts;
  startOnBoot: boolean;
  showInTaskbar: boolean;
  minimizeToTray: boolean;
  playFeedbackSounds: boolean;
  isFirstRun: boolean;
  hasCompletedOnboarding: boolean;
}

export interface SettingsActions {
  setHotkey: (config: Partial<HotkeyConfig>) => void;
  setHotkeyMode: (mode: HotkeyMode) => void;
  setActiveProvider: (provider: LLMProvider) => void;
  updateProviderSettings: <K extends LLMProvider>(
    provider: K,
    settings: Partial<ProviderSettings[K]>
  ) => void;
  updateAudioSettings: (settings: Partial<AudioSettings>) => void;
  updateWhisperSettings: (settings: Partial<WhisperSettings>) => void;
  setDefaultContextMode: (mode: ContextMode) => void;
  setCustomPrompt: (mode: keyof CustomPrompts, prompt: string) => void;
  toggleStartOnBoot: () => void;
  toggleShowInTaskbar: () => void;
  toggleMinimizeToTray: () => void;
  toggleFeedbackSounds: () => void;
  completeOnboarding: () => void;
  resetToDefaults: () => void;
  importSettings: (settings: Partial<SettingsState>) => void;
  exportSettings: () => Partial<SettingsState>;
}

export type SettingsStore = SettingsState & SettingsActions;

// ============================================
// UI Types
// ============================================

export type Theme = 'light' | 'dark' | 'system';
export type WindowMode = 'floating-pill' | 'settings' | 'hidden';
export type PillAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

export type ModalType =
  | 'hotkey-capture'
  | 'provider-setup'
  | 'audio-test'
  | 'about'
  | 'keyboard-shortcuts'
  | null;

export interface PillPosition {
  x: number;
  y: number;
  anchor: PillAnchor;
}

export interface Toast {
  id: UUID;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface UIState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  windowMode: WindowMode;
  pillPosition: PillPosition;
  pillScale: number;
  pillOpacity: number;
  isSettingsOpen: boolean;
  isPillVisible: boolean;
  isPillExpanded: boolean;
  activeModal: ModalType;
  toasts: Toast[];
  showKeyboardHints: boolean;
  isAppLoading: boolean;
  loadingMessage: string | null;
}

export interface UIActions {
  setTheme: (theme: Theme) => void;
  setResolvedTheme: (theme: 'light' | 'dark') => void;
  setWindowMode: (mode: WindowMode) => void;
  setPillPosition: (position: Partial<PillPosition>) => void;
  setPillScale: (scale: number) => void;
  setPillOpacity: (opacity: number) => void;
  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  showPill: () => void;
  hidePill: () => void;
  expandPill: () => void;
  collapsePill: () => void;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => UUID;
  removeToast: (id: UUID) => void;
  clearToasts: () => void;
  toggleKeyboardHints: () => void;
  setAppLoading: (loading: boolean, message?: string) => void;
}

export type UIStore = UIState & UIActions;

// ============================================
// Provider Types
// ============================================

export type ProviderHealth = 'unknown' | 'healthy' | 'degraded' | 'unavailable';

export interface ModelInfo {
  id: string;
  name: string;
  size?: string;
  quantization?: string;
  contextLength?: number;
  capabilities?: string[];
}

export interface ProviderStatus {
  health: ProviderHealth;
  lastChecked: Timestamp | null;
  error: string | null;
  latencyMs: number | null;
  availableModels: ModelInfo[];
  currentModel: ModelInfo | null;
}

export interface WhisperStatus {
  isLoaded: boolean;
  isLoading: boolean;
  currentModel: WhisperModel | null;
  vramUsageMB: number | null;
  error: string | null;
}

export interface ProviderState {
  ollama: ProviderStatus;
  gemini: ProviderStatus;
  whisper: WhisperStatus;
  activeProvider: LLMProvider | null;
  isProviderReady: boolean;
  backendConnected: boolean;
  backendVersion: string | null;
  gpuMemoryUsedMB: number | null;
  gpuMemoryTotalMB: number | null;
}

export interface ProviderActions {
  checkOllamaHealth: () => Promise<void>;
  checkGeminiHealth: () => Promise<void>;
  checkWhisperStatus: () => Promise<void>;
  checkAllProviders: () => Promise<void>;
  fetchOllamaModels: () => Promise<void>;
  setActiveProvider: (provider: LLMProvider) => void;
  selectModel: (provider: LLMProvider, modelId: string) => void;
  loadWhisperModel: (model: WhisperModel) => Promise<void>;
  unloadWhisperModel: () => Promise<void>;
  setBackendConnection: (connected: boolean, version?: string) => void;
  updateGpuMemory: (used: number, total: number) => void;
  reset: () => void;
}

export type ProviderStore = ProviderState & ProviderActions;

// ============================================
// Store Index
// ============================================

export interface AllStores {
  recording: RecordingStore;
  transcription: TranscriptionStore;
  settings: SettingsStore;
  ui: UIStore;
  provider: ProviderStore;
}
```

---

## Best Practices Summary

1. **Separation of Concerns**: Each store manages a single domain; avoid cross-store state.

2. **Selectors for Performance**: Use atomic selectors and shallow comparison to minimize re-renders.

3. **Immer for Immutability**: All state updates use immer for readable mutations.

4. **Persist Wisely**: Only persist user preferences and history; always fetch dynamic data on startup.

5. **Type Everything**: Full TypeScript coverage prevents runtime errors.

6. **Middleware Stack**: Consistent use of devtools, immer, and subscribeWithSelector.

7. **WebSocket for Real-time**: Use WebSocket for streaming updates from Python backend.

8. **Graceful Degradation**: Handle disconnections and errors at the store level.

9. **Initialization Order**: Hydrate settings first, then derive other store states.

10. **Testing**: Reset stores between tests; use `act()` for async operations.
