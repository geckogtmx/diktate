/**
 * Settings Page Constants
 */

export const STATUS_UPDATE_INTERVAL = 100; // Update text max 10 times/sec

export const DEFAULT_SETTINGS: Record<string, any> = {
  processingMode: 'local',
  autoStart: false,
  whisperModel: 'turbo', // SPEC_041: Default to current behavior (best quality)
  startSound: 'a',
  stopSound: 'a',
  askSound: 'c',
  maxRecordingDuration: 60,
  defaultOllamaModel: '', // DEPRECATED: Use localModel instead (SPEC_038)
  defaultMode: 'standard',
  askOutputMode: 'type',
  trailingSpaceEnabled: true,
  additionalKeyEnabled: false,
  additionalKey: 'none',
};

export const HOTKEY_DEFAULTS = {
  dictate: 'Ctrl+Alt+D',
  ask: 'Ctrl+Alt+A',
  translate: 'Ctrl+Alt+T',
  refine: 'Ctrl+Alt+R',
  oops: 'Ctrl+Alt+V',
};

export const VERIFIED_MODELS = [
  {
    id: 'gemma2:2b',
    name: 'Google Gemma 2 (2B)',
    description: 'Fast, efficient, great for older PCs.',
    sizeGb: 1.6,
    vramParams: '2gb',
  },
  {
    id: 'phi3:mini',
    name: 'Microsoft Phi-3 Mini',
    description: 'Very smart for its size. Balanced choice.',
    sizeGb: 2.3,
    vramParams: '4gb',
  },
  {
    id: 'llama3.2:3b',
    name: 'Meta Llama 3.2 (3B)',
    description: 'Latest lightweight model from Meta.',
    sizeGb: 2.0,
    vramParams: '4gb',
  },
  {
    id: 'qwen2.5:3b',
    name: 'Qwen 2.5 (3B)',
    description: 'Excellent reasoning capabilities.',
    sizeGb: 1.9,
    vramParams: '4gb',
  },
  {
    id: 'gemma2:9b',
    name: 'Google Gemma 2 (9B)',
    description: 'High intelligence, requires good GPU.',
    sizeGb: 5.4,
    vramParams: '8gb',
  },
  {
    id: 'llama3.1:8b',
    name: 'Meta Llama 3.1 (8B)',
    description: 'Standard industrial grade model.',
    sizeGb: 4.7,
    vramParams: '8gb',
  },
  {
    id: 'mistral:7b',
    name: 'Mistral (7B)',
    description: 'Reliable general purpose model.',
    sizeGb: 4.1,
    vramParams: '6gb',
  },
  // Large models for power users
  {
    id: 'llama3.1:70b',
    name: 'Meta Llama 3.1 (70B)',
    description: 'SOTA intelligence. Requires massive VRAM.',
    sizeGb: 40,
    vramParams: '48gb',
  },
];
