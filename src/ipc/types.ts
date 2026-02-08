/**
 * API Response Types for Cloud Provider Model Listings
 * Extracted from main.ts as part of GAP 5 (main.ts Monolith Decomposition)
 */

// Gemini
export interface GeminiModelInfo {
  name: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

export interface GeminiModelsResponse {
  models?: GeminiModelInfo[];
}

// Anthropic
export interface AnthropicModelInfo {
  id: string;
  display_name?: string;
}

export interface AnthropicModelsResponse {
  data?: AnthropicModelInfo[];
}

// OpenAI
export interface OpenAIModelInfo {
  id: string;
  deprecated?: boolean;
}

export interface OpenAIModelsResponse {
  data?: OpenAIModelInfo[];
}

// Ollama
export interface OllamaModelInfo {
  name: string;
  size?: number;
}

export interface OllamaModelsResponse {
  models?: OllamaModelInfo[];
}
