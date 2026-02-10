/**
 * Type definitions for Python IPC event payloads
 * These events are emitted by the Python subprocess via ipc_server.py
 */

/**
 * Emitted during Python subprocess startup (model loading, device detection)
 */
export interface StartupProgressEvent {
  step: string;
  progress: number;
  total: number;
}

/**
 * Performance metrics from transcription/processing pipeline
 */
export interface PerformanceMetricsEvent {
  transcription_time?: number;
  processing_time?: number;
  total_time?: number;
  tokens_per_sec?: number;
  start_time?: number;
  end_time?: number;
  recording?: number;
  transcription?: number;
  processing?: number;
  injection?: number;
  total?: number;
  wordCount?: number;
  charCount?: number;
}

/**
 * Successful dictation result with transcribed/processed text
 */
export interface DictationSuccessEvent {
  transcription: string;
  processed_text: string;
  mode: string;
  duration?: number;
  char_count?: number;
  word_count?: number;
}

/**
 * System-level metrics (CPU, memory, GPU usage)
 */
export interface SystemMetricsEvent {
  phase?: string;
  activity_count?: number;
  metrics?: {
    cpu_percent?: number;
    memory_percent?: number;
    gpu_available?: boolean;
    gpu_device_name?: string;
    gpu_memory_percent?: number;
  };
}

/**
 * Status check response from Python subprocess
 */
export interface StatusCheckEvent {
  status?: 'idle' | 'recording' | 'processing' | 'error';
  recording?: boolean;
  ollama_running?: boolean;
  models?: string[];
  transcriber?: unknown;
  processor?: unknown;
}

/**
 * Note successfully saved to history database
 */
export interface NoteSavedEvent {
  filepath?: string;
  filePath?: string;
  session_id?: string;
  mode: string;
}

/**
 * Response to Ask Claude command
 */
export interface AskResponseEvent {
  success?: boolean;
  error?: string;
  question?: string;
  answer?: string;
  response?: string;
  mode: string;
}

/**
 * Processor fell back to raw transcription (Ollama failure)
 */
export interface ProcessorFallbackEvent {
  reason: string;
  transcription: string;
  consecutive_failures?: number;
  using_raw?: boolean;
}

/**
 * Recording auto-stopped due to silence detection
 */
export interface RecordingAutoStoppedEvent {
  reason: 'silence_detected' | 'max_duration';
  duration_seconds?: number;
  max_duration?: number;
}

/**
 * Microphone mute state detected
 */
export interface MicMutedEvent {
  muted: boolean;
  device?: string;
  message?: string;
}

/**
 * Microphone status update (device availability, mute state)
 */
export interface MicStatusEvent {
  available: boolean;
  muted: boolean;
  device?: string;
  message?: string;
}

/**
 * API error from cloud processor (OAuth, rate limit, etc.)
 */
export interface ApiErrorEvent {
  error_type: 'oauth_token_invalid' | 'rate_limit' | 'api_error' | 'trial_quota_exceeded';
  message: string;
  error_message?: string;
  provider?: 'gemini' | 'anthropic' | 'openai' | 'trial';
}

/**
 * Refine command successful
 */
export interface RefineSuccessEvent {
  original_text: string;
  refined_text: string;
  mode: string;
  charCount?: number;
  total?: number;
  capture?: number;
  processing?: number;
  injection?: number;
}

/**
 * Refine command error
 */
export interface RefineErrorEvent {
  error: string;
  message?: string;
  code?: string;
  original_text?: string;
}

/**
 * Refine with custom instruction successful
 */
export interface RefineInstructionSuccessEvent {
  original_text: string;
  refined_text: string;
  instruction: string;
  mode: string;
  original_length?: number;
  refined_length?: number;
  metrics?: unknown;
}

/**
 * Refine with custom instruction fell back to raw (processor failure)
 */
export interface RefineInstructionFallbackEvent {
  reason: string;
  original_text: string;
  instruction: string;
  answer?: string;
}

/**
 * Refine with custom instruction error
 */
export interface RefineInstructionErrorEvent {
  error: string;
  code?: string;
  original_text?: string;
  instruction?: string;
}
