# IPC Design Document

Technical specification for inter-process communication in dIKtate.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Channel Definitions](#channel-definitions)
3. [Preload Script](#preload-script)
4. [WebSocket Protocol](#websocket-protocol)
5. [Error Handling](#error-handling)
6. [Security Checklist](#security-checklist)
7. [TypeScript Types](#typescript-types)

---

## Architecture Overview

dIKtate uses a three-layer communication architecture:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        RENDERER PROCESS (React)                          │
│                                                                          │
│  UI Components ──► window.api.recording.start() ──► State Management    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ contextBridge (isolated)
                                 │
┌────────────────────────────────▼────────────────────────────────────────┐
│                        PRELOAD SCRIPT                                    │
│                                                                          │
│  Exposes typed API via contextBridge.exposeInMainWorld()                │
│  ipcRenderer.invoke('channel', data) ──► Main Process                   │
│  ipcRenderer.on('event', handler) ◄── Main Process                      │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ IPC Channels (Zod validated)
                                 │
┌────────────────────────────────▼────────────────────────────────────────┐
│                        MAIN PROCESS (Electron)                           │
│                                                                          │
│  ipcMain.handle() ──► Services ──► State                                │
│  WebSocket Client ◄──► Python Backend                                   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ WebSocket (JSON messages)
                                 │
┌────────────────────────────────▼────────────────────────────────────────┐
│                        PYTHON BACKEND (FastAPI)                          │
│                                                                          │
│  WebSocket Server ──► Recorder ──► Transcriber ──► Processor            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Communication Patterns

| Pattern | Direction | Use Case |
|---------|-----------|----------|
| **invoke/handle** | Renderer → Main | Request/response (settings, commands) |
| **send/on** | Main → Renderer | Events (transcription results, state changes) |
| **WebSocket** | Main ↔ Python | Real-time audio pipeline control |

### Security Boundaries

1. **Renderer Process**: Sandboxed, no Node.js access, uses only exposed API
2. **Preload Script**: Bridge layer, exposes minimal surface area
3. **Main Process**: Full Node.js access, validates all renderer input
4. **Python Backend**: Trusted internal service, authenticated WebSocket

---

## Channel Definitions

### Recording Channels

#### `recording:start`

Initiates audio recording in the Python backend.

```typescript
// Schema
const RecordingStartSchema = z.object({
  contextMode: z.enum(['standard', 'developer', 'email', 'raw']).default('standard'),
  audioDeviceId: z.string().nullable().optional(),
});

// Request
window.api.recording.start({ contextMode: 'developer' });

// Response
type RecordingStartResponse = {
  success: boolean;
  sessionId: string;  // UUID for tracking this recording session
};
```

#### `recording:stop`

Stops the current recording and triggers transcription pipeline.

```typescript
// Schema
const RecordingStopSchema = z.object({
  sessionId: z.string().uuid(),
  cancelled: z.boolean().default(false),  // If true, discard recording
});

// Request
window.api.recording.stop({ sessionId: 'abc-123', cancelled: false });

// Response
type RecordingStopResponse = {
  success: boolean;
  processing: boolean;  // True if transcription started
};
```

### Transcription Channels

#### `transcription:result` (Event: Main → Renderer)

Emitted when transcription completes. This is a push event, not request/response.

```typescript
// Schema (for validation in main process before sending)
const TranscriptionResultSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.enum(['success', 'error', 'cancelled']),
  rawText: z.string().optional(),       // Original transcription
  processedText: z.string().optional(), // After LLM processing
  contextMode: z.enum(['standard', 'developer', 'email', 'raw']),
  durationMs: z.number().nonnegative(),
  error: z.string().optional(),         // Only if status === 'error'
});

// Renderer usage
window.api.on.transcriptionResult((result) => {
  if (result.status === 'success') {
    showSuccess(result.processedText);
  }
});
```

### Settings Channels

#### `settings:get`

Retrieves current application settings.

```typescript
// Schema (no input required)
const SettingsGetSchema = z.void();

// Response Schema
const SettingsSchema = z.object({
  hotkey: z.string().nullable(),
  mode: z.enum(['push-to-talk', 'toggle']),
  contextMode: z.enum(['standard', 'developer', 'email', 'raw']),
  provider: z.enum(['ollama', 'gemini']),
  ollamaModel: z.string().min(1),
  geminiApiKey: z.string().nullable(),  // Never returned to renderer, use hasGeminiKey
  audioDevice: z.string().nullable(),
  customPrompts: z.record(z.string(), z.string()),
});

// Sanitized response (sent to renderer)
const SettingsResponseSchema = SettingsSchema.omit({ geminiApiKey: true }).extend({
  hasGeminiKey: z.boolean(),
});

// Request
const settings = await window.api.settings.get();
```

#### `settings:update`

Updates one or more settings. Partial updates supported.

```typescript
// Schema
const SettingsUpdateSchema = z.object({
  hotkey: z.string().nullable().optional(),
  mode: z.enum(['push-to-talk', 'toggle']).optional(),
  contextMode: z.enum(['standard', 'developer', 'email', 'raw']).optional(),
  provider: z.enum(['ollama', 'gemini']).optional(),
  ollamaModel: z.string().min(1).optional(),
  geminiApiKey: z.string().min(1).nullable().optional(),
  audioDevice: z.string().nullable().optional(),
  customPrompts: z.record(z.string(), z.string()).optional(),
});

// Request
await window.api.settings.update({
  contextMode: 'email',
  provider: 'ollama'
});

// Response
type SettingsUpdateResponse = {
  success: boolean;
  settings: SettingsResponse;  // Updated settings (sanitized)
};
```

### Provider Channels

#### `provider:switch`

Switches between Ollama and Gemini for text processing.

```typescript
// Schema
const ProviderSwitchSchema = z.object({
  provider: z.enum(['ollama', 'gemini']),
  // Only required when switching to gemini and no key stored
  apiKey: z.string().min(1).optional(),
});

// Request
await window.api.provider.switch({ provider: 'ollama' });

// Response
type ProviderSwitchResponse = {
  success: boolean;
  provider: 'ollama' | 'gemini';
  status: ProviderStatus;
};
```

#### `provider:status`

Gets the current status of the active provider.

```typescript
// Schema (no input)
const ProviderStatusSchema = z.void();

// Response Schema
const ProviderStatusResponseSchema = z.object({
  provider: z.enum(['ollama', 'gemini']),
  status: z.enum(['connected', 'disconnected', 'error', 'initializing']),
  model: z.string().optional(),          // Current model name
  error: z.string().optional(),          // Error message if status === 'error'
  lastChecked: z.string().datetime(),    // ISO timestamp
});

// Request
const status = await window.api.provider.status();
```

#### `provider:status-changed` (Event: Main → Renderer)

Emitted when provider status changes.

```typescript
// Renderer usage
window.api.on.providerStatusChanged((status) => {
  updateProviderIndicator(status);
});
```

---

## Preload Script

Complete preload script with contextBridge API.

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

/**
 * Type-safe IPC wrapper that prevents prototype pollution
 * and ensures only serializable data crosses the bridge.
 */
function invoke<T>(channel: string, data?: unknown): Promise<T> {
  // Defensive: strip any prototype chain from data
  const sanitizedData = data !== undefined
    ? JSON.parse(JSON.stringify(data))
    : undefined;
  return ipcRenderer.invoke(channel, sanitizedData);
}

/**
 * Creates a type-safe event listener with automatic cleanup.
 */
function createListener<T>(channel: string) {
  return (callback: (data: T) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: T) => {
      // Defensive: ensure data is plain object
      const sanitizedData = JSON.parse(JSON.stringify(data));
      callback(sanitizedData);
    };
    ipcRenderer.on(channel, handler);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  };
}

const api = {
  /**
   * Recording control
   */
  recording: {
    start: (options?: {
      contextMode?: 'standard' | 'developer' | 'email' | 'raw';
      audioDeviceId?: string | null;
    }) => invoke<RecordingStartResponse>('recording:start', options),

    stop: (options: {
      sessionId: string;
      cancelled?: boolean;
    }) => invoke<RecordingStopResponse>('recording:stop', options),
  },

  /**
   * Settings management
   */
  settings: {
    get: () => invoke<SettingsResponse>('settings:get'),

    update: (settings: Partial<SettingsUpdate>) =>
      invoke<SettingsUpdateResponse>('settings:update', settings),
  },

  /**
   * Provider management
   */
  provider: {
    switch: (options: {
      provider: 'ollama' | 'gemini';
      apiKey?: string;
    }) => invoke<ProviderSwitchResponse>('provider:switch', options),

    status: () => invoke<ProviderStatusResponse>('provider:status'),
  },

  /**
   * Audio devices
   */
  audio: {
    listDevices: () => invoke<AudioDevice[]>('audio:list-devices'),
  },

  /**
   * Application state
   */
  app: {
    getVersion: () => invoke<string>('app:version'),
    quit: () => invoke<void>('app:quit'),
    minimize: () => invoke<void>('app:minimize'),
  },

  /**
   * Event listeners (Main → Renderer)
   * Each returns a cleanup function for use in useEffect
   */
  on: {
    transcriptionResult: createListener<TranscriptionResult>('transcription:result'),
    providerStatusChanged: createListener<ProviderStatus>('provider:status-changed'),
    recordingStateChanged: createListener<RecordingState>('recording:state-changed'),
    error: createListener<AppError>('app:error'),
  },
} as const;

// Expose to renderer
contextBridge.exposeInMainWorld('api', api);

// Type declarations for renderer consumption
export type DiktateAPI = typeof api;
```

### Type Declarations for Window

```typescript
// electron/preload.d.ts
import type { DiktateAPI } from './preload';

declare global {
  interface Window {
    api: DiktateAPI;
  }
}

export {};
```

---

## WebSocket Protocol

### Connection

The Electron main process establishes a WebSocket connection to the Python backend on application start.

```typescript
// Connection URL
ws://localhost:8765/ws

// Authentication (first message after connection)
{
  "type": "auth",
  "token": "<generated-session-token>"
}
```

### Message Format

All WebSocket messages follow a consistent envelope format:

```typescript
// Base message schema
const WebSocketMessageSchema = z.object({
  type: z.string(),
  id: z.string().uuid().optional(),      // Request ID for correlation
  timestamp: z.string().datetime(),
  payload: z.unknown(),
});
```

### Message Types

#### Client → Server (Electron → Python)

```typescript
// Start recording
{
  "type": "START_RECORDING",
  "id": "uuid-v4",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "payload": {
    "contextMode": "standard",
    "audioDeviceId": null
  }
}

// Stop recording
{
  "type": "STOP_RECORDING",
  "id": "uuid-v4",
  "timestamp": "2024-01-15T10:30:05.000Z",
  "payload": {
    "sessionId": "recording-session-uuid",
    "cancelled": false
  }
}

// Update settings
{
  "type": "UPDATE_SETTINGS",
  "id": "uuid-v4",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "payload": {
    "provider": "ollama",
    "ollamaModel": "llama3"
  }
}

// Health check (ping)
{
  "type": "PING",
  "id": "uuid-v4",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "payload": null
}
```

#### Server → Client (Python → Electron)

```typescript
// Recording started acknowledgment
{
  "type": "RECORDING_STARTED",
  "id": "uuid-v4",  // Correlates to request
  "timestamp": "2024-01-15T10:30:00.100Z",
  "payload": {
    "sessionId": "recording-session-uuid",
    "audioDeviceId": "device-id"
  }
}

// Recording state update (streaming)
{
  "type": "RECORDING_STATE",
  "timestamp": "2024-01-15T10:30:02.000Z",
  "payload": {
    "sessionId": "recording-session-uuid",
    "state": "recording",
    "durationMs": 2000,
    "audioLevel": 0.65  // For visualization
  }
}

// Transcription progress
{
  "type": "TRANSCRIPTION_PROGRESS",
  "timestamp": "2024-01-15T10:30:06.000Z",
  "payload": {
    "sessionId": "recording-session-uuid",
    "stage": "transcribing",  // "transcribing" | "processing" | "injecting"
    "progress": 0.5
  }
}

// Transcription completed
{
  "type": "TRANSCRIPTION_COMPLETE",
  "id": "uuid-v4",
  "timestamp": "2024-01-15T10:30:08.000Z",
  "payload": {
    "sessionId": "recording-session-uuid",
    "status": "success",
    "rawText": "hello world",
    "processedText": "Hello, world.",
    "contextMode": "standard",
    "durationMs": 3000
  }
}

// Error
{
  "type": "ERROR",
  "id": "uuid-v4",  // If correlates to request
  "timestamp": "2024-01-15T10:30:08.000Z",
  "payload": {
    "code": "TRANSCRIPTION_FAILED",
    "message": "Failed to transcribe audio",
    "sessionId": "recording-session-uuid"  // Optional context
  }
}

// Pong (health check response)
{
  "type": "PONG",
  "id": "uuid-v4",
  "timestamp": "2024-01-15T10:30:00.050Z",
  "payload": {
    "uptime": 3600000,
    "provider": "ollama",
    "providerStatus": "connected"
  }
}
```

### WebSocket Schemas (Zod)

```typescript
// schemas/websocket.ts
import { z } from 'zod';

// Outgoing message types
export const StartRecordingPayloadSchema = z.object({
  contextMode: z.enum(['standard', 'developer', 'email', 'raw']),
  audioDeviceId: z.string().nullable(),
});

export const StopRecordingPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  cancelled: z.boolean(),
});

// Incoming message types
export const RecordingStartedPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  audioDeviceId: z.string().nullable(),
});

export const RecordingStatePayloadSchema = z.object({
  sessionId: z.string().uuid(),
  state: z.enum(['recording', 'paused', 'stopped']),
  durationMs: z.number().nonnegative(),
  audioLevel: z.number().min(0).max(1),
});

export const TranscriptionProgressPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  stage: z.enum(['transcribing', 'processing', 'injecting']),
  progress: z.number().min(0).max(1),
});

export const TranscriptionCompletePayloadSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.enum(['success', 'error', 'cancelled']),
  rawText: z.string().optional(),
  processedText: z.string().optional(),
  contextMode: z.enum(['standard', 'developer', 'email', 'raw']),
  durationMs: z.number().nonnegative(),
  error: z.string().optional(),
});

export const ErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  sessionId: z.string().uuid().optional(),
});
```

---

## Error Handling

### Principles

1. **Never expose stack traces** to the renderer process
2. **Sanitize all error messages** - use predefined error codes
3. **Log full errors** in main process for debugging
4. **Implement retry logic** for transient failures
5. **Graceful degradation** when backend unavailable

### Error Codes

```typescript
// errors/codes.ts
export const ErrorCodes = {
  // Validation errors (4xx)
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_SESSION_ID: 'INVALID_SESSION_ID',
  INVALID_SETTINGS: 'INVALID_SETTINGS',

  // Recording errors
  RECORDING_ALREADY_ACTIVE: 'RECORDING_ALREADY_ACTIVE',
  RECORDING_NOT_ACTIVE: 'RECORDING_NOT_ACTIVE',
  AUDIO_DEVICE_UNAVAILABLE: 'AUDIO_DEVICE_UNAVAILABLE',
  AUDIO_CAPTURE_FAILED: 'AUDIO_CAPTURE_FAILED',

  // Transcription errors
  TRANSCRIPTION_FAILED: 'TRANSCRIPTION_FAILED',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  INJECTION_FAILED: 'INJECTION_FAILED',

  // Provider errors
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  PROVIDER_CONNECTION_FAILED: 'PROVIDER_CONNECTION_FAILED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',

  // Backend errors
  BACKEND_UNAVAILABLE: 'BACKEND_UNAVAILABLE',
  BACKEND_TIMEOUT: 'BACKEND_TIMEOUT',
  WEBSOCKET_DISCONNECTED: 'WEBSOCKET_DISCONNECTED',

  // System errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
```

### Error Schema

```typescript
// errors/schema.ts
import { z } from 'zod';

export const AppErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  recoverable: z.boolean(),
  retryable: z.boolean(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export type AppError = z.infer<typeof AppErrorSchema>;
```

### IPC Error Wrapper

```typescript
// ipc/error-handler.ts
import { ZodError } from 'zod';
import { ErrorCodes, type ErrorCode } from '../errors/codes';
import { AppError } from '../errors/schema';

/**
 * User-friendly error messages.
 * NEVER include technical details or stack traces.
 */
const ErrorMessages: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Invalid input provided',
  INVALID_SESSION_ID: 'Recording session not found',
  INVALID_SETTINGS: 'Invalid settings value',
  RECORDING_ALREADY_ACTIVE: 'A recording is already in progress',
  RECORDING_NOT_ACTIVE: 'No recording is currently active',
  AUDIO_DEVICE_UNAVAILABLE: 'Microphone is not available',
  AUDIO_CAPTURE_FAILED: 'Failed to capture audio',
  TRANSCRIPTION_FAILED: 'Failed to transcribe audio',
  PROCESSING_FAILED: 'Failed to process text',
  INJECTION_FAILED: 'Failed to type text',
  PROVIDER_UNAVAILABLE: 'AI provider is not available',
  PROVIDER_CONNECTION_FAILED: 'Failed to connect to AI provider',
  INVALID_API_KEY: 'Invalid API key',
  MODEL_NOT_FOUND: 'AI model not found',
  BACKEND_UNAVAILABLE: 'Backend service is not running',
  BACKEND_TIMEOUT: 'Backend service timed out',
  WEBSOCKET_DISCONNECTED: 'Lost connection to backend',
  UNKNOWN_ERROR: 'An unexpected error occurred',
};

/**
 * Wraps IPC handlers with error sanitization.
 */
export function wrapHandler<TInput, TOutput>(
  handler: (input: TInput) => Promise<TOutput>
): (event: Electron.IpcMainInvokeEvent, input: unknown) => Promise<TOutput> {
  return async (_event, input) => {
    try {
      return await handler(input as TInput);
    } catch (error) {
      // Log full error for debugging
      console.error('[IPC Error]', error);

      // Sanitize and rethrow
      throw sanitizeError(error);
    }
  };
}

/**
 * Converts any error to a safe, user-facing AppError.
 */
export function sanitizeError(error: unknown): AppError {
  // Zod validation errors
  if (error instanceof ZodError) {
    return {
      code: ErrorCodes.VALIDATION_FAILED,
      message: ErrorMessages.VALIDATION_FAILED,
      recoverable: true,
      retryable: false,
      context: { fields: error.errors.map(e => e.path.join('.')) },
    };
  }

  // Known application errors
  if (isAppError(error)) {
    return {
      ...error,
      message: ErrorMessages[error.code as ErrorCode] ?? error.message,
    };
  }

  // Unknown errors - never expose details
  return {
    code: ErrorCodes.UNKNOWN_ERROR,
    message: ErrorMessages.UNKNOWN_ERROR,
    recoverable: false,
    retryable: true,
  };
}

function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as AppError).code === 'string'
  );
}
```

### Retry Logic

```typescript
// utils/retry.ts
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Retries an async operation with exponential backoff.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs, backoffMultiplier } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (isAppError(error) && !error.retryable) {
        throw error;
      }

      // Last attempt - don't delay, just throw
      if (attempt === maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelayMs * Math.pow(backoffMultiplier, attempt - 1),
        maxDelayMs
      );

      console.log(`[Retry] Attempt ${attempt} failed, retrying in ${delay}ms`);
      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### WebSocket Reconnection

```typescript
// websocket/client.ts
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelayMs = 1000;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('ws://localhost:8765/ws');

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.authenticate();
        resolve();
      };

      this.ws.onclose = () => {
        this.handleDisconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Connection error', error);
        reject(new Error('WebSocket connection failed'));
      };
    });
  }

  private handleDisconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.reconnectDelayMs * Math.pow(2, this.reconnectAttempts);
      console.log(`[WebSocket] Reconnecting in ${delay}ms...`);

      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect().catch(() => {
          // Will retry via handleDisconnect
        });
      }, delay);
    } else {
      console.error('[WebSocket] Max reconnection attempts reached');
      // Emit event for UI to show error state
    }
  }
}
```

---

## Security Checklist

### Electron Hardening (MANDATORY)

All `BrowserWindow` instances MUST use these settings:

```typescript
// electron/main.ts
const mainWindow = new BrowserWindow({
  webPreferences: {
    // REQUIRED - Context isolation prevents prototype pollution
    contextIsolation: true,

    // REQUIRED - Disable Node.js in renderer
    nodeIntegration: false,

    // REQUIRED - Enable Chromium sandbox
    sandbox: true,

    // REQUIRED - Enable web security (same-origin policy)
    webSecurity: true,

    // REQUIRED - Block insecure content
    allowRunningInsecureContent: false,

    // REQUIRED - Use preload script for IPC
    preload: path.join(__dirname, 'preload.js'),

    // Additional hardening
    enableWebSQL: false,
    spellcheck: false,
  },
});

// Prevent navigation to external URLs
mainWindow.webContents.on('will-navigate', (event, url) => {
  const parsed = new URL(url);
  if (parsed.origin !== 'file://') {
    event.preventDefault();
    console.warn('[Security] Blocked navigation to:', url);
  }
});

// Prevent new window creation
mainWindow.webContents.setWindowOpenHandler(() => {
  return { action: 'deny' };
});
```

### IPC Security

- [ ] **All inputs Zod-validated**: Every `ipcMain.handle()` validates input with Zod schemas
- [ ] **No raw data passthrough**: Never pass renderer data directly to services
- [ ] **UUIDs validated**: All session IDs and identifiers validated as UUIDs
- [ ] **Errors sanitized**: Stack traces and internal errors never sent to renderer
- [ ] **Channel allowlist**: Only registered channels accepted
- [ ] **Rate limiting**: Implement rate limiting for expensive operations

```typescript
// ipc/handlers.ts
import { ipcMain } from 'electron';
import { z } from 'zod';
import { wrapHandler } from './error-handler';

// Allowlist of valid channels
const VALID_CHANNELS = new Set([
  'recording:start',
  'recording:stop',
  'settings:get',
  'settings:update',
  'provider:switch',
  'provider:status',
  'audio:list-devices',
  'app:version',
  'app:quit',
  'app:minimize',
]);

export function registerHandlers(services: Services): void {
  // Recording handlers
  ipcMain.handle('recording:start', wrapHandler(async (data: unknown) => {
    const validated = RecordingStartSchema.parse(data);
    return services.recording.start(validated);
  }));

  ipcMain.handle('recording:stop', wrapHandler(async (data: unknown) => {
    const validated = RecordingStopSchema.parse(data);
    return services.recording.stop(validated);
  }));

  // Settings handlers
  ipcMain.handle('settings:get', wrapHandler(async () => {
    const settings = await services.settings.get();
    // IMPORTANT: Never return sensitive data to renderer
    return {
      ...settings,
      geminiApiKey: undefined,
      hasGeminiKey: !!settings.geminiApiKey,
    };
  }));

  ipcMain.handle('settings:update', wrapHandler(async (data: unknown) => {
    const validated = SettingsUpdateSchema.parse(data);
    return services.settings.update(validated);
  }));
}
```

### Secret Handling

- [ ] **Use Electron safeStorage**: API keys stored encrypted
- [ ] **Never localStorage**: No sensitive data in browser storage
- [ ] **Never log secrets**: Redact API keys in logs
- [ ] **Memory cleanup**: Clear sensitive data after use

```typescript
// services/secrets.ts
import { safeStorage } from 'electron';

export class SecretStorage {
  private static readonly KEY_PREFIX = 'diktate:';

  async store(key: string, value: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption not available');
    }

    const encrypted = safeStorage.encryptString(value);
    // Store encrypted buffer in persistent storage
    await this.persistBuffer(`${SecretStorage.KEY_PREFIX}${key}`, encrypted);
  }

  async retrieve(key: string): Promise<string | null> {
    const encrypted = await this.getBuffer(`${SecretStorage.KEY_PREFIX}${key}`);
    if (!encrypted) return null;

    return safeStorage.decryptString(encrypted);
  }

  async delete(key: string): Promise<void> {
    await this.deleteBuffer(`${SecretStorage.KEY_PREFIX}${key}`);
  }
}
```

### WebSocket Security

- [ ] **Token authentication**: First message must be auth token
- [ ] **Connection timeout**: Close unauthenticated connections after 5s
- [ ] **Message validation**: Validate all incoming messages with Zod
- [ ] **Local only**: WebSocket only accepts localhost connections

```typescript
// python/main.py (conceptual)
# WebSocket authentication
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    # Require authentication within 5 seconds
    try:
        auth_message = await asyncio.wait_for(
            websocket.receive_json(),
            timeout=5.0
        )

        if not validate_auth_token(auth_message.get('token')):
            await websocket.close(code=4001, reason='Invalid token')
            return

    except asyncio.TimeoutError:
        await websocket.close(code=4000, reason='Authentication timeout')
        return
```

### Data Classification

- [ ] **No external transmission**: Audio and transcriptions stay local
- [ ] **Gemini API exception**: Only send text to Gemini when provider selected
- [ ] **Clear data consent**: User explicitly chooses external provider

```typescript
// Data classification labels
type DataClassification =
  | 'PRIVATE_LOCAL'      // Never leaves device
  | 'EXTERNAL_OK'        // Can be sent to API
  | 'USER_CONTENT';      // User controls destination

// All audio data is PRIVATE_LOCAL
// Transcription text classification depends on provider setting
```

### Audit Checklist

Before each release, verify:

- [ ] `nodeIntegration: false` in all BrowserWindow configs
- [ ] `contextIsolation: true` in all BrowserWindow configs
- [ ] `sandbox: true` in all BrowserWindow configs
- [ ] No `shell.openExternal()` with user-controlled URLs
- [ ] No `eval()` or `new Function()` anywhere in codebase
- [ ] All IPC handlers use Zod validation
- [ ] No secrets in logs or error messages
- [ ] `pnpm audit --audit-level=high` passes
- [ ] No `.env` files committed to repository

---

## TypeScript Types

Complete type definitions for the IPC API.

```typescript
// types/ipc.ts
import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export const ContextMode = z.enum(['standard', 'developer', 'email', 'raw']);
export type ContextMode = z.infer<typeof ContextMode>;

export const RecordingMode = z.enum(['push-to-talk', 'toggle']);
export type RecordingMode = z.infer<typeof RecordingMode>;

export const Provider = z.enum(['ollama', 'gemini']);
export type Provider = z.infer<typeof Provider>;

export const ProviderStatus = z.enum(['connected', 'disconnected', 'error', 'initializing']);
export type ProviderStatus = z.infer<typeof ProviderStatus>;

export const TranscriptionStatus = z.enum(['success', 'error', 'cancelled']);
export type TranscriptionStatus = z.infer<typeof TranscriptionStatus>;

export const RecordingState = z.enum(['idle', 'recording', 'processing']);
export type RecordingState = z.infer<typeof RecordingState>;

// ============================================
// RECORDING TYPES
// ============================================

export const RecordingStartRequestSchema = z.object({
  contextMode: ContextMode.optional().default('standard'),
  audioDeviceId: z.string().nullable().optional(),
});
export type RecordingStartRequest = z.infer<typeof RecordingStartRequestSchema>;

export const RecordingStartResponseSchema = z.object({
  success: z.boolean(),
  sessionId: z.string().uuid(),
});
export type RecordingStartResponse = z.infer<typeof RecordingStartResponseSchema>;

export const RecordingStopRequestSchema = z.object({
  sessionId: z.string().uuid(),
  cancelled: z.boolean().optional().default(false),
});
export type RecordingStopRequest = z.infer<typeof RecordingStopRequestSchema>;

export const RecordingStopResponseSchema = z.object({
  success: z.boolean(),
  processing: z.boolean(),
});
export type RecordingStopResponse = z.infer<typeof RecordingStopResponseSchema>;

export const RecordingStateEventSchema = z.object({
  sessionId: z.string().uuid(),
  state: RecordingState,
  durationMs: z.number().nonnegative().optional(),
  audioLevel: z.number().min(0).max(1).optional(),
});
export type RecordingStateEvent = z.infer<typeof RecordingStateEventSchema>;

// ============================================
// TRANSCRIPTION TYPES
// ============================================

export const TranscriptionResultSchema = z.object({
  sessionId: z.string().uuid(),
  status: TranscriptionStatus,
  rawText: z.string().optional(),
  processedText: z.string().optional(),
  contextMode: ContextMode,
  durationMs: z.number().nonnegative(),
  error: z.string().optional(),
});
export type TranscriptionResult = z.infer<typeof TranscriptionResultSchema>;

// ============================================
// SETTINGS TYPES
// ============================================

export const SettingsSchema = z.object({
  hotkey: z.string().nullable(),
  mode: RecordingMode,
  contextMode: ContextMode,
  provider: Provider,
  ollamaModel: z.string().min(1),
  geminiApiKey: z.string().nullable(),
  audioDevice: z.string().nullable(),
  customPrompts: z.record(z.string(), z.string()),
});
export type Settings = z.infer<typeof SettingsSchema>;

// Settings response (sanitized - no API key)
export const SettingsResponseSchema = SettingsSchema.omit({ geminiApiKey: true }).extend({
  hasGeminiKey: z.boolean(),
});
export type SettingsResponse = z.infer<typeof SettingsResponseSchema>;

export const SettingsUpdateRequestSchema = SettingsSchema.partial();
export type SettingsUpdateRequest = z.infer<typeof SettingsUpdateRequestSchema>;

export const SettingsUpdateResponseSchema = z.object({
  success: z.boolean(),
  settings: SettingsResponseSchema,
});
export type SettingsUpdateResponse = z.infer<typeof SettingsUpdateResponseSchema>;

// ============================================
// PROVIDER TYPES
// ============================================

export const ProviderSwitchRequestSchema = z.object({
  provider: Provider,
  apiKey: z.string().min(1).optional(),
});
export type ProviderSwitchRequest = z.infer<typeof ProviderSwitchRequestSchema>;

export const ProviderStatusResponseSchema = z.object({
  provider: Provider,
  status: ProviderStatus,
  model: z.string().optional(),
  error: z.string().optional(),
  lastChecked: z.string().datetime(),
});
export type ProviderStatusResponse = z.infer<typeof ProviderStatusResponseSchema>;

export const ProviderSwitchResponseSchema = z.object({
  success: z.boolean(),
  provider: Provider,
  status: ProviderStatusResponseSchema,
});
export type ProviderSwitchResponse = z.infer<typeof ProviderSwitchResponseSchema>;

// ============================================
// AUDIO TYPES
// ============================================

export const AudioDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
});
export type AudioDevice = z.infer<typeof AudioDeviceSchema>;

// ============================================
// ERROR TYPES
// ============================================

export const AppErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  recoverable: z.boolean(),
  retryable: z.boolean(),
  context: z.record(z.string(), z.unknown()).optional(),
});
export type AppError = z.infer<typeof AppErrorSchema>;

// ============================================
// WEBSOCKET MESSAGE TYPES
// ============================================

export const WebSocketMessageSchema = z.object({
  type: z.string(),
  id: z.string().uuid().optional(),
  timestamp: z.string().datetime(),
  payload: z.unknown(),
});
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

// Outgoing message types (Electron → Python)
export type OutgoingMessageType =
  | 'START_RECORDING'
  | 'STOP_RECORDING'
  | 'UPDATE_SETTINGS'
  | 'PING';

// Incoming message types (Python → Electron)
export type IncomingMessageType =
  | 'RECORDING_STARTED'
  | 'RECORDING_STATE'
  | 'TRANSCRIPTION_PROGRESS'
  | 'TRANSCRIPTION_COMPLETE'
  | 'ERROR'
  | 'PONG';

// ============================================
// API TYPE (for window.api)
// ============================================

export interface DiktateAPI {
  recording: {
    start: (options?: RecordingStartRequest) => Promise<RecordingStartResponse>;
    stop: (options: RecordingStopRequest) => Promise<RecordingStopResponse>;
  };
  settings: {
    get: () => Promise<SettingsResponse>;
    update: (settings: SettingsUpdateRequest) => Promise<SettingsUpdateResponse>;
  };
  provider: {
    switch: (options: ProviderSwitchRequest) => Promise<ProviderSwitchResponse>;
    status: () => Promise<ProviderStatusResponse>;
  };
  audio: {
    listDevices: () => Promise<AudioDevice[]>;
  };
  app: {
    getVersion: () => Promise<string>;
    quit: () => Promise<void>;
    minimize: () => Promise<void>;
  };
  on: {
    transcriptionResult: (callback: (result: TranscriptionResult) => void) => () => void;
    providerStatusChanged: (callback: (status: ProviderStatusResponse) => void) => () => void;
    recordingStateChanged: (callback: (state: RecordingStateEvent) => void) => () => void;
    error: (callback: (error: AppError) => void) => () => void;
  };
}

// ============================================
// GLOBAL WINDOW AUGMENTATION
// ============================================

declare global {
  interface Window {
    api: DiktateAPI;
  }
}
```

### Usage Examples

```typescript
// React component example
import { useEffect, useState } from 'react';

function RecordingButton() {
  const [state, setState] = useState<RecordingState>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to recording state changes
    const unsubscribe = window.api.on.recordingStateChanged((event) => {
      setState(event.state);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    // Subscribe to transcription results
    const unsubscribe = window.api.on.transcriptionResult((result) => {
      if (result.status === 'success') {
        console.log('Transcribed:', result.processedText);
      }
      setState('idle');
      setSessionId(null);
    });

    return unsubscribe;
  }, []);

  const handleStart = async () => {
    try {
      const response = await window.api.recording.start({
        contextMode: 'standard',
      });
      setSessionId(response.sessionId);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const handleStop = async () => {
    if (!sessionId) return;

    try {
      await window.api.recording.stop({ sessionId });
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  return (
    <button
      onClick={state === 'idle' ? handleStart : handleStop}
      disabled={state === 'processing'}
    >
      {state === 'idle' && 'Start Recording'}
      {state === 'recording' && 'Stop Recording'}
      {state === 'processing' && 'Processing...'}
    </button>
  );
}
```

---

## Summary

This IPC design provides:

1. **Type Safety**: Full Zod schema validation at every boundary
2. **Security**: Mandatory Electron hardening, input validation, error sanitization
3. **Reliability**: Retry logic, WebSocket reconnection, graceful degradation
4. **Developer Experience**: Complete TypeScript types, clear channel naming
5. **Maintainability**: Centralized schemas, consistent patterns, clear separation of concerns

All implementations MUST follow the security checklist before deployment.
