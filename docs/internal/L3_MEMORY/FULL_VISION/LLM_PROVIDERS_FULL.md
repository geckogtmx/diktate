# LLM Providers Design Document

This document specifies the LLM provider architecture for dIKtate, a local-first voice dictation tool. The design prioritizes offline capability through Ollama while supporting cloud fallbacks for enhanced functionality.

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Provider Interface](#provider-interface)
3. [Ollama Provider](#ollama-provider)
4. [Gemini Provider](#gemini-provider)
5. [Provider Factory](#provider-factory)
6. [Context Mode Prompts](#context-mode-prompts)
7. [Streaming Design](#streaming-design)
8. [Offline Handling](#offline-handling)
9. [Cost Estimation](#cost-estimation)

---

## Design Philosophy

### Core Principles

1. **Local-First**: Ollama is the default for 80%+ of interactions
2. **Privacy by Default**: No data leaves the machine unless explicitly configured
3. **Graceful Degradation**: Full functionality maintained offline
4. **Cloud is Opt-In**: External APIs require explicit user choice
5. **Zero Configuration**: Works out of the box with Ollama installed

### Provider Priority Order

```
1. Ollama (local)     - Default, always preferred when available
2. Gemini (cloud)     - Fallback when local unavailable and user opts in
3. No Provider        - Graceful error with clear guidance
```

---

## Provider Interface

The abstract interface defines the contract all LLM providers must implement.

### TypeScript Interface Definition

```typescript
/**
 * Base interface for all LLM providers.
 * Providers must be stateless and thread-safe.
 */
interface LLMProvider {
  /** Unique identifier for the provider */
  readonly name: string;

  /** True if provider runs entirely on local hardware */
  readonly isLocal: boolean;

  /**
   * Send a chat completion request and receive full response.
   * Use for short interactions where streaming is unnecessary.
   */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /**
   * Stream chat completion response chunk by chunk.
   * Preferred for user-facing interactions for better perceived latency.
   */
  stream(request: ChatRequest): AsyncGenerator<StreamChunk>;

  /**
   * List available models from this provider.
   * For local providers, returns installed models.
   * For cloud providers, returns models accessible with current credentials.
   */
  listModels(): Promise<Model[]>;

  /**
   * Check if provider is currently available.
   * For local: Is the server running?
   * For cloud: Are credentials valid and quota available?
   */
  isAvailable(): Promise<boolean>;

  /**
   * Estimate cost before making a request.
   * Local providers always return $0.
   */
  estimateCost(request: ChatRequest): CostEstimate;
}
```

### Supporting Types

```typescript
interface ChatRequest {
  /** Conversation history */
  messages: Message[];

  /** Model identifier (e.g., 'llama3', 'gemini-pro') */
  model: string;

  /** Sampling temperature (0.0-2.0, default 0.7) */
  temperature?: number;

  /** Maximum tokens to generate */
  maxTokens?: number;

  /** System prompt for context mode */
  systemPrompt?: string;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatResponse {
  /** Generated text content */
  content: string;

  /** Model that generated the response */
  model: string;

  /** Token usage statistics */
  usage: TokenUsage;

  /** Why generation stopped */
  finishReason: 'stop' | 'length' | 'error';
}

interface StreamChunk {
  /** Incremental content for this chunk */
  content: string;

  /** True when stream is complete */
  done: boolean;

  /** Usage stats (only present on final chunk) */
  usage?: TokenUsage;
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface CostEstimate {
  /** Estimated cost in currency */
  estimated: number;

  /** Currency code (always 'USD') */
  currency: 'USD';

  /** Optional explanation */
  note?: string;
}

interface Model {
  /** Model identifier used in requests */
  id: string;

  /** Human-readable name */
  name: string;

  /** Provider this model belongs to */
  provider: string;

  /** Maximum context window size */
  contextLength: number;
}
```

### Python Interface Definition

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncGenerator, Optional
from enum import Enum

class FinishReason(Enum):
    STOP = "stop"
    LENGTH = "length"
    ERROR = "error"

@dataclass
class TokenUsage:
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int

@dataclass
class ChatRequest:
    messages: list[dict]
    model: str
    temperature: float = 0.7
    max_tokens: int = 2048
    system_prompt: Optional[str] = None

@dataclass
class ChatResponse:
    content: str
    model: str
    usage: TokenUsage
    finish_reason: FinishReason

@dataclass
class StreamChunk:
    content: str
    done: bool
    usage: Optional[TokenUsage] = None

@dataclass
class CostEstimate:
    estimated: float
    currency: str = "USD"
    note: Optional[str] = None

@dataclass
class Model:
    id: str
    name: str
    provider: str
    context_length: int

class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique identifier for the provider."""
        pass

    @property
    @abstractmethod
    def is_local(self) -> bool:
        """True if provider runs on local hardware."""
        pass

    @abstractmethod
    async def chat(self, request: ChatRequest) -> ChatResponse:
        """Send chat completion request."""
        pass

    @abstractmethod
    async def stream(self, request: ChatRequest) -> AsyncGenerator[StreamChunk, None]:
        """Stream chat completion response."""
        pass

    @abstractmethod
    async def list_models(self) -> list[Model]:
        """List available models."""
        pass

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if provider is currently available."""
        pass

    @abstractmethod
    def estimate_cost(self, request: ChatRequest) -> CostEstimate:
        """Estimate cost before making request."""
        pass
```

---

## Ollama Provider

Ollama is the primary local provider, running entirely on the user's machine.

### Configuration

```python
OLLAMA_CONFIG = {
    "base_url": "http://localhost:11434",
    "timeout_seconds": 120,
    "default_model": "llama3",
    "recommended_models": [
        "llama3",           # Best balance of quality/speed
        "llama3:8b-instruct-q4_K_M",  # Reduced VRAM
        "phi3:mini",        # Smallest option (~2GB)
        "mistral",          # Alternative architecture
    ]
}
```

### Python Implementation

```python
import aiohttp
import json
from typing import AsyncGenerator, Optional

class OllamaProvider(LLMProvider):
    """Local LLM provider using Ollama."""

    def __init__(self, base_url: str = "http://localhost:11434"):
        self._base_url = base_url
        self._session: Optional[aiohttp.ClientSession] = None

    @property
    def name(self) -> str:
        return "ollama"

    @property
    def is_local(self) -> bool:
        return True

    async def _get_session(self) -> aiohttp.ClientSession:
        """Lazy session initialization."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=120)
            )
        return self._session

    async def is_available(self) -> bool:
        """Check if Ollama server is running and responsive."""
        try:
            session = await self._get_session()
            async with session.get(f"{self._base_url}/api/tags") as resp:
                return resp.status == 200
        except (aiohttp.ClientError, ConnectionError):
            return False

    async def list_models(self) -> list[Model]:
        """List locally installed Ollama models."""
        session = await self._get_session()
        async with session.get(f"{self._base_url}/api/tags") as resp:
            data = await resp.json()
            return [
                Model(
                    id=m["name"],
                    name=m["name"],
                    provider="ollama",
                    context_length=m.get("details", {}).get("parameter_size", 4096)
                )
                for m in data.get("models", [])
            ]

    async def chat(self, request: ChatRequest) -> ChatResponse:
        """Non-streaming chat completion."""
        session = await self._get_session()

        messages = self._format_messages(request.messages, request.system_prompt)

        payload = {
            "model": request.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": request.temperature,
                "num_predict": request.max_tokens,
            }
        }

        async with session.post(
            f"{self._base_url}/api/chat",
            json=payload
        ) as resp:
            data = await resp.json()

            return ChatResponse(
                content=data["message"]["content"],
                model=request.model,
                usage=TokenUsage(
                    prompt_tokens=data.get("prompt_eval_count", 0),
                    completion_tokens=data.get("eval_count", 0),
                    total_tokens=(
                        data.get("prompt_eval_count", 0) +
                        data.get("eval_count", 0)
                    )
                ),
                finish_reason=FinishReason.STOP
            )

    async def stream(self, request: ChatRequest) -> AsyncGenerator[StreamChunk, None]:
        """Streaming chat completion."""
        session = await self._get_session()

        messages = self._format_messages(request.messages, request.system_prompt)

        payload = {
            "model": request.model,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": request.temperature,
                "num_predict": request.max_tokens,
            }
        }

        async with session.post(
            f"{self._base_url}/api/chat",
            json=payload
        ) as resp:
            async for line in resp.content:
                if not line:
                    continue

                try:
                    data = json.loads(line.decode("utf-8"))
                except json.JSONDecodeError:
                    continue

                usage = None
                if data.get("done", False):
                    usage = TokenUsage(
                        prompt_tokens=data.get("prompt_eval_count", 0),
                        completion_tokens=data.get("eval_count", 0),
                        total_tokens=(
                            data.get("prompt_eval_count", 0) +
                            data.get("eval_count", 0)
                        )
                    )

                yield StreamChunk(
                    content=data.get("message", {}).get("content", ""),
                    done=data.get("done", False),
                    usage=usage
                )

    def estimate_cost(self, request: ChatRequest) -> CostEstimate:
        """Local models have no cost."""
        return CostEstimate(
            estimated=0.0,
            currency="USD",
            note="Local model - no cost"
        )

    def _format_messages(
        self,
        messages: list[dict],
        system_prompt: Optional[str]
    ) -> list[dict]:
        """Format messages with optional system prompt."""
        formatted = []
        if system_prompt:
            formatted.append({"role": "system", "content": system_prompt})
        formatted.extend(messages)
        return formatted

    async def close(self) -> None:
        """Clean up resources."""
        if self._session and not self._session.closed:
            await self._session.close()
```

### Recommended Models

| Model | VRAM | Use Case | Quality |
|-------|------|----------|---------|
| `llama3:8b` | ~5.7 GB | General purpose | Best |
| `llama3:8b-instruct-q4_K_M` | ~4.5 GB | Reduced VRAM | Good |
| `phi3:mini` | ~2 GB | Low VRAM systems | Acceptable |
| `mistral:7b` | ~4.5 GB | Alternative | Good |

---

## Gemini Provider

Gemini serves as the cloud fallback when local models are unavailable or user explicitly prefers cloud.

### Configuration

```python
GEMINI_CONFIG = {
    "base_url": "https://generativelanguage.googleapis.com/v1beta",
    "default_model": "gemini-1.5-flash",
    "models": {
        "gemini-1.5-flash": {
            "context_length": 1048576,
            "input_price_per_1k": 0.000075,
            "output_price_per_1k": 0.0003
        },
        "gemini-1.5-pro": {
            "context_length": 2097152,
            "input_price_per_1k": 0.00125,
            "output_price_per_1k": 0.005
        },
        "gemini-2.0-flash-exp": {
            "context_length": 1048576,
            "input_price_per_1k": 0.0,  # Currently free during preview
            "output_price_per_1k": 0.0
        }
    }
}
```

### Python Implementation

```python
import aiohttp
import json
from typing import AsyncGenerator, Optional

class GeminiProvider(LLMProvider):
    """Google Gemini cloud LLM provider."""

    def __init__(self, api_key: str):
        self._api_key = api_key
        self._base_url = "https://generativelanguage.googleapis.com/v1beta"
        self._session: Optional[aiohttp.ClientSession] = None

    @property
    def name(self) -> str:
        return "gemini"

    @property
    def is_local(self) -> bool:
        return False

    async def _get_session(self) -> aiohttp.ClientSession:
        """Lazy session initialization."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=60)
            )
        return self._session

    async def is_available(self) -> bool:
        """Check if API key is valid and service is reachable."""
        if not self._api_key:
            return False

        try:
            session = await self._get_session()
            url = f"{self._base_url}/models?key={self._api_key}"
            async with session.get(url) as resp:
                return resp.status == 200
        except (aiohttp.ClientError, ConnectionError):
            return False

    async def list_models(self) -> list[Model]:
        """List available Gemini models."""
        session = await self._get_session()
        url = f"{self._base_url}/models?key={self._api_key}"

        async with session.get(url) as resp:
            data = await resp.json()

            return [
                Model(
                    id=m["name"].replace("models/", ""),
                    name=m.get("displayName", m["name"]),
                    provider="gemini",
                    context_length=m.get("inputTokenLimit", 32768)
                )
                for m in data.get("models", [])
                if "generateContent" in m.get("supportedGenerationMethods", [])
            ]

    async def chat(self, request: ChatRequest) -> ChatResponse:
        """Non-streaming chat completion."""
        session = await self._get_session()

        url = (
            f"{self._base_url}/models/{request.model}:generateContent"
            f"?key={self._api_key}"
        )

        payload = self._build_payload(request, stream=False)

        async with session.post(url, json=payload) as resp:
            data = await resp.json()

            if "error" in data:
                raise GeminiAPIError(data["error"]["message"])

            content = data["candidates"][0]["content"]["parts"][0]["text"]
            usage_metadata = data.get("usageMetadata", {})

            return ChatResponse(
                content=content,
                model=request.model,
                usage=TokenUsage(
                    prompt_tokens=usage_metadata.get("promptTokenCount", 0),
                    completion_tokens=usage_metadata.get("candidatesTokenCount", 0),
                    total_tokens=usage_metadata.get("totalTokenCount", 0)
                ),
                finish_reason=self._map_finish_reason(
                    data["candidates"][0].get("finishReason", "STOP")
                )
            )

    async def stream(self, request: ChatRequest) -> AsyncGenerator[StreamChunk, None]:
        """Streaming chat completion."""
        session = await self._get_session()

        url = (
            f"{self._base_url}/models/{request.model}:streamGenerateContent"
            f"?key={self._api_key}&alt=sse"
        )

        payload = self._build_payload(request, stream=True)

        async with session.post(url, json=payload) as resp:
            buffer = ""
            async for line in resp.content:
                line_str = line.decode("utf-8")

                if line_str.startswith("data: "):
                    json_str = line_str[6:].strip()
                    if not json_str:
                        continue

                    try:
                        data = json.loads(json_str)
                    except json.JSONDecodeError:
                        continue

                    if "candidates" not in data:
                        continue

                    candidate = data["candidates"][0]
                    content = ""

                    if "content" in candidate:
                        parts = candidate["content"].get("parts", [])
                        if parts:
                            content = parts[0].get("text", "")

                    done = candidate.get("finishReason") is not None
                    usage = None

                    if done and "usageMetadata" in data:
                        um = data["usageMetadata"]
                        usage = TokenUsage(
                            prompt_tokens=um.get("promptTokenCount", 0),
                            completion_tokens=um.get("candidatesTokenCount", 0),
                            total_tokens=um.get("totalTokenCount", 0)
                        )

                    yield StreamChunk(
                        content=content,
                        done=done,
                        usage=usage
                    )

    def estimate_cost(self, request: ChatRequest) -> CostEstimate:
        """Estimate cost based on Gemini pricing."""
        pricing = GEMINI_CONFIG["models"].get(request.model, {
            "input_price_per_1k": 0.000075,
            "output_price_per_1k": 0.0003
        })

        # Rough token estimation: ~4 chars per token
        input_tokens = sum(len(m.get("content", "")) for m in request.messages) // 4
        if request.system_prompt:
            input_tokens += len(request.system_prompt) // 4

        # Estimate output based on max_tokens or default
        output_tokens = min(request.max_tokens, 1000)  # Conservative estimate

        input_cost = (input_tokens / 1000) * pricing["input_price_per_1k"]
        output_cost = (output_tokens / 1000) * pricing["output_price_per_1k"]

        return CostEstimate(
            estimated=input_cost + output_cost,
            currency="USD"
        )

    def _build_payload(self, request: ChatRequest, stream: bool) -> dict:
        """Build Gemini API request payload."""
        contents = []

        # Convert messages to Gemini format
        for msg in request.messages:
            role = "user" if msg["role"] == "user" else "model"
            contents.append({
                "role": role,
                "parts": [{"text": msg["content"]}]
            })

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": request.temperature,
                "maxOutputTokens": request.max_tokens,
            }
        }

        # Add system instruction if provided
        if request.system_prompt:
            payload["systemInstruction"] = {
                "parts": [{"text": request.system_prompt}]
            }

        return payload

    def _map_finish_reason(self, gemini_reason: str) -> FinishReason:
        """Map Gemini finish reasons to our enum."""
        mapping = {
            "STOP": FinishReason.STOP,
            "MAX_TOKENS": FinishReason.LENGTH,
            "SAFETY": FinishReason.ERROR,
            "RECITATION": FinishReason.ERROR,
            "OTHER": FinishReason.ERROR,
        }
        return mapping.get(gemini_reason, FinishReason.STOP)

    async def close(self) -> None:
        """Clean up resources."""
        if self._session and not self._session.closed:
            await self._session.close()


class GeminiAPIError(Exception):
    """Raised when Gemini API returns an error."""
    pass
```

### Security Considerations

1. **API Key Storage**: Never store API keys in code; use settings.json or environment variables
2. **Key Validation**: Validate API key format before making requests
3. **Rate Limiting**: Implement client-side rate limiting to avoid quota exhaustion
4. **Error Masking**: Never expose API keys in error messages

---

## Provider Factory

The factory handles provider selection with local-first priority.

### Selection Rules

```
Priority 1: Local Preference (Default)
  - If Ollama is available -> use Ollama
  - Otherwise -> check cloud providers

Priority 2: Offline Mode
  - If no internet -> use Ollama only
  - If Ollama unavailable -> show error with guidance

Priority 3: User Override
  - If user explicitly selects cloud -> use cloud
  - Respect user preference even if local available

Priority 4: Budget Protection
  - If cloud budget exhausted -> fall back to local
  - Warn user before using paid provider
```

### Python Implementation

```python
from typing import Optional
from enum import Enum

class ProviderPreference(Enum):
    LOCAL_ONLY = "local_only"
    LOCAL_FIRST = "local_first"  # Default
    CLOUD_PREFERRED = "cloud_preferred"

class SelectionContext:
    """Context for provider selection decisions."""

    def __init__(
        self,
        preference: ProviderPreference = ProviderPreference.LOCAL_FIRST,
        budget_remaining: Optional[float] = None,
        force_provider: Optional[str] = None,
        is_offline: bool = False
    ):
        self.preference = preference
        self.budget_remaining = budget_remaining
        self.force_provider = force_provider
        self.is_offline = is_offline


class NoProviderError(Exception):
    """Raised when no suitable provider is available."""
    pass


class OfflineError(Exception):
    """Raised when offline and no local provider available."""
    pass


class ProviderFactory:
    """Factory for selecting LLM providers with local-first priority."""

    def __init__(self):
        self._ollama: Optional[OllamaProvider] = None
        self._gemini: Optional[GeminiProvider] = None
        self._providers: dict[str, LLMProvider] = {}

    def register_ollama(self, base_url: str = "http://localhost:11434") -> None:
        """Register Ollama provider."""
        self._ollama = OllamaProvider(base_url)
        self._providers["ollama"] = self._ollama

    def register_gemini(self, api_key: str) -> None:
        """Register Gemini provider."""
        if api_key:
            self._gemini = GeminiProvider(api_key)
            self._providers["gemini"] = self._gemini

    async def select_provider(
        self,
        context: Optional[SelectionContext] = None
    ) -> LLMProvider:
        """
        Select the most appropriate provider based on context.

        Selection priority:
        1. Force override (if specified and available)
        2. Local-only mode (if preference is LOCAL_ONLY)
        3. Offline mode (must use local)
        4. Budget protection (prefer local if budget low)
        5. User preference (local-first vs cloud-preferred)
        6. Default: local if available, else cloud
        """
        context = context or SelectionContext()

        # Rule 1: Force override
        if context.force_provider:
            provider = self._providers.get(context.force_provider)
            if provider and await provider.is_available():
                return provider
            raise NoProviderError(
                f"Forced provider '{context.force_provider}' is not available"
            )

        # Rule 2: Local-only mode
        if context.preference == ProviderPreference.LOCAL_ONLY:
            if self._ollama and await self._ollama.is_available():
                return self._ollama
            raise NoProviderError(
                "Local-only mode enabled but Ollama is not available. "
                "Please ensure Ollama is running: ollama serve"
            )

        # Rule 3: Offline mode
        if context.is_offline:
            if self._ollama and await self._ollama.is_available():
                return self._ollama
            raise OfflineError(
                "Offline and no local model available. "
                "Please install Ollama for offline use: https://ollama.ai"
            )

        # Rule 4: Budget protection
        if context.budget_remaining is not None and context.budget_remaining < 0.01:
            if self._ollama and await self._ollama.is_available():
                return self._ollama
            # Budget exhausted but no local - warn but allow cloud

        # Rule 5: User preference
        if context.preference == ProviderPreference.CLOUD_PREFERRED:
            if self._gemini and await self._gemini.is_available():
                return self._gemini
            # Fall through to local

        # Rule 6: Default - local first
        if self._ollama and await self._ollama.is_available():
            return self._ollama

        if self._gemini and await self._gemini.is_available():
            return self._gemini

        # No providers available
        raise NoProviderError(
            "No LLM provider available. Options:\n"
            "1. Install and run Ollama: https://ollama.ai\n"
            "2. Configure Gemini API key in settings"
        )

    async def get_all_available(self) -> list[LLMProvider]:
        """Get list of all currently available providers."""
        available = []
        for provider in self._providers.values():
            if await provider.is_available():
                available.append(provider)
        return available

    async def close(self) -> None:
        """Clean up all providers."""
        for provider in self._providers.values():
            if hasattr(provider, 'close'):
                await provider.close()
```

### Usage Example

```python
# Initialize factory
factory = ProviderFactory()
factory.register_ollama()
factory.register_gemini(settings.get("geminiApiKey"))

# Select provider (local-first by default)
provider = await factory.select_provider()

# Force cloud for specific request
cloud_context = SelectionContext(
    preference=ProviderPreference.CLOUD_PREFERRED
)
cloud_provider = await factory.select_provider(cloud_context)

# Offline mode
offline_context = SelectionContext(is_offline=True)
local_provider = await factory.select_provider(offline_context)
```

---

## Context Mode Prompts

System prompts for each dictation context mode.

### Standard Mode

**Purpose**: Clean up grammar, punctuation, and remove filler words while preserving meaning.

```python
STANDARD_PROMPT = """You are a dictation assistant that converts raw speech-to-text into clean, well-formatted text.

Your task:
1. Fix grammar and spelling errors
2. Add proper punctuation (periods, commas, question marks)
3. Remove filler words (um, uh, like, you know, basically)
4. Remove false starts and repetitions
5. Capitalize appropriately (sentences, proper nouns)
6. Preserve the speaker's intended meaning and tone

Rules:
- Do NOT change the meaning or add new content
- Do NOT make the text more formal than intended
- Do NOT expand abbreviations unless unclear
- Output ONLY the corrected text, no explanations
- Preserve paragraph breaks indicated by long pauses (marked as [PAUSE])

Example input: "so um i was thinking that maybe we could uh you know go to the store tomorrow"
Example output: "I was thinking that maybe we could go to the store tomorrow."
"""
```

### Developer Mode

**Purpose**: Format text for code comments, variable names, or technical documentation.

```python
DEVELOPER_PROMPT = """You are a developer dictation assistant that formats speech into code-appropriate text.

Context clues in speech:
- "comment" or "doc string" -> Format as code comment
- "variable" or "const" or "let" -> Format as camelCase variable name
- "function" or "method" -> Format as function signature
- "class" -> Format as PascalCase class name
- "snake case" -> Format as snake_case
- "kebab case" -> Format as kebab-case

Your task:
1. Identify the intended code element type
2. Format appropriately for the context
3. Remove filler words and speech artifacts
4. Use standard naming conventions

Output formats:
- Comments: // Clean comment text (or # for Python context)
- Variables: cleanVariableName
- Functions: cleanFunctionName(params)
- Classes: CleanClassName
- Documentation: Clean documentation paragraph

Rules:
- Output ONLY the formatted code element
- No explanations or alternatives
- Preserve technical terms and abbreviations
- Use context to infer programming language when possible

Example input: "variable user authentication status"
Example output: "userAuthenticationStatus"

Example input: "comment this function validates the user input and returns true if valid"
Example output: "// Validates user input and returns true if valid"

Example input: "function get user by id takes id as parameter"
Example output: "getUserById(id)"
"""
```

### Email Mode

**Purpose**: Expand brief notes into professional email prose.

```python
EMAIL_PROMPT = """You are an email composition assistant that expands brief dictated notes into professional email prose.

Your task:
1. Expand abbreviated thoughts into complete sentences
2. Add appropriate email conventions (greetings, closings when indicated)
3. Maintain professional but friendly tone
4. Structure content with proper paragraphs
5. Preserve all factual information exactly

Context clues:
- "subject" or "re" -> Email subject line
- "hi" or "hello" or "dear" -> Email greeting
- "thanks" or "regards" or "best" -> Email closing
- "bullet" or "list" -> Format as bullet points
- "action item" -> Highlight as action item

Rules:
- Do NOT invent facts or details not in the original
- Do NOT make promises or commitments not stated
- Match formality level to context clues
- Output ONLY the email text
- Preserve names, dates, and numbers exactly

Example input: "hi john meeting tomorrow 3pm about q4 budget need the spreadsheet before thanks"
Example output: "Hi John,

I wanted to confirm our meeting tomorrow at 3 PM to discuss the Q4 budget.

Could you please send me the spreadsheet before the meeting?

Thanks!"
"""
```

### Raw Mode

**Purpose**: No transformation, literal transcription output.

```python
RAW_PROMPT = None  # No LLM processing in raw mode
```

### Prompt Selection Function

```python
from enum import Enum
from typing import Optional

class ContextMode(Enum):
    STANDARD = "standard"
    DEVELOPER = "developer"
    EMAIL = "email"
    RAW = "raw"

CONTEXT_PROMPTS = {
    ContextMode.STANDARD: STANDARD_PROMPT,
    ContextMode.DEVELOPER: DEVELOPER_PROMPT,
    ContextMode.EMAIL: EMAIL_PROMPT,
    ContextMode.RAW: None,
}

def get_system_prompt(mode: ContextMode) -> Optional[str]:
    """Get system prompt for the specified context mode."""
    return CONTEXT_PROMPTS.get(mode)

def should_use_llm(mode: ContextMode) -> bool:
    """Check if the mode requires LLM processing."""
    return mode != ContextMode.RAW
```

---

## Streaming Design

Real-time streaming of LLM responses to the UI via WebSocket.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    LLM Provider                                  │
│                   (Ollama/Gemini)                                │
└──────────────────────┬──────────────────────────────────────────┘
                       │ AsyncGenerator<StreamChunk>
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    StreamingService                              │
│  - Buffers chunks for word-boundary delivery                     │
│  - Tracks token usage                                            │
│  - Handles cancellation                                          │
└──────────────────────┬──────────────────────────────────────────┘
                       │ WebSocket messages
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Electron (Renderer)                           │
│  - Updates UI in real-time                                       │
│  - Shows typing indicator                                        │
│  - Displays partial text                                         │
└─────────────────────────────────────────────────────────────────┘
```

### WebSocket Message Types

```python
from dataclasses import dataclass
from typing import Optional, Literal

@dataclass
class WSMessage:
    """Base WebSocket message."""
    type: str

@dataclass
class ModelSelectedMessage(WSMessage):
    """Sent when provider is selected."""
    type: Literal["model-selected"] = "model-selected"
    model: str = ""
    provider: str = ""
    is_local: bool = True

@dataclass
class StreamChunkMessage(WSMessage):
    """Sent for each chunk of streamed content."""
    type: Literal["stream-chunk"] = "stream-chunk"
    content: str = ""
    done: bool = False

@dataclass
class StreamCompleteMessage(WSMessage):
    """Sent when streaming is complete."""
    type: Literal["stream-complete"] = "stream-complete"
    full_content: str = ""
    token_usage: dict = None
    cost: Optional[float] = None

@dataclass
class StreamErrorMessage(WSMessage):
    """Sent when an error occurs."""
    type: Literal["stream-error"] = "stream-error"
    error: str = ""
    recoverable: bool = True
```

### Streaming Service Implementation

```python
import asyncio
from typing import Optional, Callable
from fastapi import WebSocket

class StreamingService:
    """Service for streaming LLM responses to WebSocket clients."""

    def __init__(self, provider_factory: ProviderFactory):
        self._factory = provider_factory
        self._active_streams: dict[str, asyncio.Task] = {}

    async def stream_to_client(
        self,
        websocket: WebSocket,
        request: ChatRequest,
        context: Optional[SelectionContext] = None,
        on_complete: Optional[Callable[[ChatResponse], None]] = None
    ) -> ChatResponse:
        """
        Stream LLM response to WebSocket client.

        Args:
            websocket: The WebSocket connection
            request: The chat request
            context: Provider selection context
            on_complete: Callback when streaming completes

        Returns:
            Complete ChatResponse with full content and usage
        """
        # Select provider
        provider = await self._factory.select_provider(context)

        # Notify client of selected model
        await websocket.send_json({
            "type": "model-selected",
            "model": request.model,
            "provider": provider.name,
            "is_local": provider.is_local
        })

        # Stream response
        full_content = ""
        usage: Optional[TokenUsage] = None

        try:
            async for chunk in provider.stream(request):
                full_content += chunk.content

                # Send chunk to client
                await websocket.send_json({
                    "type": "stream-chunk",
                    "content": chunk.content,
                    "done": chunk.done
                })

                if chunk.done and chunk.usage:
                    usage = chunk.usage

            # Calculate cost for cloud providers
            cost = None
            if not provider.is_local and usage:
                estimate = provider.estimate_cost(request)
                cost = estimate.estimated

            # Send completion message
            await websocket.send_json({
                "type": "stream-complete",
                "full_content": full_content,
                "token_usage": {
                    "prompt_tokens": usage.prompt_tokens if usage else 0,
                    "completion_tokens": usage.completion_tokens if usage else 0,
                    "total_tokens": usage.total_tokens if usage else 0
                },
                "cost": cost
            })

            response = ChatResponse(
                content=full_content,
                model=request.model,
                usage=usage or TokenUsage(0, 0, 0),
                finish_reason=FinishReason.STOP
            )

            if on_complete:
                on_complete(response)

            return response

        except Exception as e:
            await websocket.send_json({
                "type": "stream-error",
                "error": str(e),
                "recoverable": True
            })
            raise

    async def cancel_stream(self, stream_id: str) -> None:
        """Cancel an active stream."""
        task = self._active_streams.get(stream_id)
        if task and not task.done():
            task.cancel()
            del self._active_streams[stream_id]
```

### Frontend Integration (TypeScript)

```typescript
interface StreamState {
  isStreaming: boolean;
  content: string;
  model: string;
  provider: string;
  isLocal: boolean;
  error?: string;
}

class LLMStreamHandler {
  private state: StreamState = {
    isStreaming: false,
    content: '',
    model: '',
    provider: '',
    isLocal: true,
  };

  private onUpdate: (state: StreamState) => void;

  constructor(onUpdate: (state: StreamState) => void) {
    this.onUpdate = onUpdate;
  }

  handleMessage(message: any): void {
    switch (message.type) {
      case 'model-selected':
        this.state = {
          ...this.state,
          isStreaming: true,
          model: message.model,
          provider: message.provider,
          isLocal: message.is_local,
          content: '',
        };
        break;

      case 'stream-chunk':
        this.state = {
          ...this.state,
          content: this.state.content + message.content,
        };
        break;

      case 'stream-complete':
        this.state = {
          ...this.state,
          isStreaming: false,
          content: message.full_content,
        };
        break;

      case 'stream-error':
        this.state = {
          ...this.state,
          isStreaming: false,
          error: message.error,
        };
        break;
    }

    this.onUpdate(this.state);
  }

  reset(): void {
    this.state = {
      isStreaming: false,
      content: '',
      model: '',
      provider: '',
      isLocal: true,
    };
    this.onUpdate(this.state);
  }
}
```

---

## Offline Handling

Graceful degradation when providers are unavailable.

### Offline Detection

```python
import aiohttp
import asyncio
from typing import Callable

class ConnectivityMonitor:
    """Monitor network connectivity and provider availability."""

    def __init__(
        self,
        provider_factory: ProviderFactory,
        on_status_change: Callable[[bool, list[str]], None]
    ):
        self._factory = provider_factory
        self._on_status_change = on_status_change
        self._is_online = True
        self._available_providers: list[str] = []
        self._check_interval = 30  # seconds
        self._task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        """Start connectivity monitoring."""
        self._task = asyncio.create_task(self._monitor_loop())

    async def stop(self) -> None:
        """Stop connectivity monitoring."""
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _monitor_loop(self) -> None:
        """Periodically check connectivity."""
        while True:
            await self._check_connectivity()
            await asyncio.sleep(self._check_interval)

    async def _check_connectivity(self) -> None:
        """Check network and provider availability."""
        # Check internet connectivity
        is_online = await self._check_internet()

        # Check provider availability
        available = await self._factory.get_all_available()
        available_names = [p.name for p in available]

        # Notify on change
        if is_online != self._is_online or available_names != self._available_providers:
            self._is_online = is_online
            self._available_providers = available_names
            self._on_status_change(is_online, available_names)

    async def _check_internet(self) -> bool:
        """Check if internet is available."""
        try:
            async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=5)
            ) as session:
                async with session.head("https://www.google.com") as resp:
                    return resp.status == 200
        except:
            return False

    @property
    def is_online(self) -> bool:
        return self._is_online

    @property
    def available_providers(self) -> list[str]:
        return self._available_providers.copy()

    def get_selection_context(self) -> SelectionContext:
        """Get selection context based on current connectivity."""
        return SelectionContext(
            is_offline=not self._is_online,
            preference=ProviderPreference.LOCAL_FIRST
        )
```

### Offline Mode Handler

```python
class OfflineModeHandler:
    """Handle offline scenarios gracefully."""

    def __init__(
        self,
        provider_factory: ProviderFactory,
        notify_user: Callable[[str, str], None]  # (title, message)
    ):
        self._factory = provider_factory
        self._notify_user = notify_user
        self._connectivity = ConnectivityMonitor(
            provider_factory,
            self._on_connectivity_change
        )

    async def start(self) -> None:
        """Start offline mode handling."""
        await self._connectivity.start()

    async def stop(self) -> None:
        """Stop offline mode handling."""
        await self._connectivity.stop()

    def _on_connectivity_change(
        self,
        is_online: bool,
        available_providers: list[str]
    ) -> None:
        """Handle connectivity status changes."""
        if not is_online:
            if "ollama" in available_providers:
                self._notify_user(
                    "Offline Mode",
                    "Using local Ollama model. Cloud features unavailable."
                )
            else:
                self._notify_user(
                    "Limited Functionality",
                    "No network connection and Ollama not available. "
                    "LLM features disabled until connectivity is restored."
                )
        else:
            if len(available_providers) > 1:
                self._notify_user(
                    "Back Online",
                    "All LLM providers are available."
                )

    async def ensure_provider(
        self,
        context: Optional[SelectionContext] = None
    ) -> LLMProvider:
        """
        Get an available provider with offline awareness.

        Raises OfflineError with helpful message if no provider available.
        """
        if context is None:
            context = self._connectivity.get_selection_context()

        try:
            return await self._factory.select_provider(context)
        except NoProviderError:
            if not self._connectivity.is_online:
                raise OfflineError(
                    "You are offline and no local LLM is available.\n\n"
                    "To enable offline dictation:\n"
                    "1. Install Ollama: https://ollama.ai\n"
                    "2. Pull a model: ollama pull llama3\n"
                    "3. Start Ollama: ollama serve\n\n"
                    "Alternatively, connect to the internet to use Gemini."
                )
            raise
```

### Offline Fallback Behavior

| Scenario | Behavior |
|----------|----------|
| Offline + Ollama available | Use Ollama, show "Offline Mode" indicator |
| Offline + No Ollama | Show error, offer Raw mode (no LLM processing) |
| Online + No providers | Show setup instructions |
| Provider fails mid-request | Retry with fallback provider |

---

## Cost Estimation

Token tracking and cost estimation for cloud providers.

### Cost Tracking Data Model

```python
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional
import json
from pathlib import Path

@dataclass
class UsageRecord:
    """Single usage record."""
    timestamp: datetime
    provider: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    cost_usd: float
    context_mode: str

@dataclass
class DailyUsage:
    """Aggregated daily usage."""
    date: date
    total_tokens: int = 0
    total_cost_usd: float = 0.0
    requests: int = 0
    by_provider: dict = field(default_factory=dict)

@dataclass
class UsageBudget:
    """User-defined usage budget."""
    daily_limit_usd: Optional[float] = None
    monthly_limit_usd: Optional[float] = None
    warn_at_percentage: float = 80.0
```

### Cost Tracker Implementation

```python
class CostTracker:
    """Track and persist LLM usage costs."""

    def __init__(self, storage_path: Path):
        self._storage_path = storage_path
        self._records: list[UsageRecord] = []
        self._budget: UsageBudget = UsageBudget()
        self._load()

    def record_usage(
        self,
        provider: str,
        model: str,
        usage: TokenUsage,
        cost: CostEstimate,
        context_mode: str
    ) -> None:
        """Record a usage event."""
        record = UsageRecord(
            timestamp=datetime.now(),
            provider=provider,
            model=model,
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
            cost_usd=cost.estimated,
            context_mode=context_mode
        )
        self._records.append(record)
        self._save()

        # Check budget warnings
        self._check_budget_warnings()

    def get_daily_usage(self, target_date: date = None) -> DailyUsage:
        """Get usage for a specific day."""
        target_date = target_date or date.today()

        daily = DailyUsage(date=target_date)

        for record in self._records:
            if record.timestamp.date() == target_date:
                daily.total_tokens += record.prompt_tokens + record.completion_tokens
                daily.total_cost_usd += record.cost_usd
                daily.requests += 1

                if record.provider not in daily.by_provider:
                    daily.by_provider[record.provider] = {
                        "tokens": 0,
                        "cost_usd": 0.0,
                        "requests": 0
                    }
                daily.by_provider[record.provider]["tokens"] += (
                    record.prompt_tokens + record.completion_tokens
                )
                daily.by_provider[record.provider]["cost_usd"] += record.cost_usd
                daily.by_provider[record.provider]["requests"] += 1

        return daily

    def get_monthly_usage(self, year: int = None, month: int = None) -> float:
        """Get total cost for a month."""
        today = date.today()
        year = year or today.year
        month = month or today.month

        total = 0.0
        for record in self._records:
            if (record.timestamp.year == year and
                record.timestamp.month == month):
                total += record.cost_usd

        return total

    def get_budget_remaining(self) -> Optional[float]:
        """Get remaining budget for today."""
        if self._budget.daily_limit_usd is None:
            return None

        daily = self.get_daily_usage()
        return max(0, self._budget.daily_limit_usd - daily.total_cost_usd)

    def set_budget(
        self,
        daily_limit: Optional[float] = None,
        monthly_limit: Optional[float] = None
    ) -> None:
        """Set usage budget limits."""
        self._budget.daily_limit_usd = daily_limit
        self._budget.monthly_limit_usd = monthly_limit
        self._save()

    def estimate_remaining_requests(self, model: str) -> Optional[int]:
        """Estimate how many more requests fit in budget."""
        remaining = self.get_budget_remaining()
        if remaining is None:
            return None

        # Use average cost from recent requests
        recent = [r for r in self._records[-100:] if r.model == model]
        if not recent:
            return None

        avg_cost = sum(r.cost_usd for r in recent) / len(recent)
        if avg_cost == 0:
            return None

        return int(remaining / avg_cost)

    def _check_budget_warnings(self) -> None:
        """Check if budget warnings should be emitted."""
        if self._budget.daily_limit_usd:
            daily = self.get_daily_usage()
            percentage = (daily.total_cost_usd / self._budget.daily_limit_usd) * 100

            if percentage >= self._budget.warn_at_percentage:
                # Emit warning event
                pass

    def _load(self) -> None:
        """Load records from storage."""
        if self._storage_path.exists():
            with open(self._storage_path, 'r') as f:
                data = json.load(f)
                self._records = [
                    UsageRecord(
                        timestamp=datetime.fromisoformat(r["timestamp"]),
                        provider=r["provider"],
                        model=r["model"],
                        prompt_tokens=r["prompt_tokens"],
                        completion_tokens=r["completion_tokens"],
                        cost_usd=r["cost_usd"],
                        context_mode=r["context_mode"]
                    )
                    for r in data.get("records", [])
                ]
                if "budget" in data:
                    self._budget = UsageBudget(
                        daily_limit_usd=data["budget"].get("daily_limit_usd"),
                        monthly_limit_usd=data["budget"].get("monthly_limit_usd")
                    )

    def _save(self) -> None:
        """Save records to storage."""
        data = {
            "records": [
                {
                    "timestamp": r.timestamp.isoformat(),
                    "provider": r.provider,
                    "model": r.model,
                    "prompt_tokens": r.prompt_tokens,
                    "completion_tokens": r.completion_tokens,
                    "cost_usd": r.cost_usd,
                    "context_mode": r.context_mode
                }
                for r in self._records
            ],
            "budget": {
                "daily_limit_usd": self._budget.daily_limit_usd,
                "monthly_limit_usd": self._budget.monthly_limit_usd
            }
        }

        self._storage_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self._storage_path, 'w') as f:
            json.dump(data, f, indent=2)
```

### Cost Display Component

```typescript
interface UsageDisplay {
  todayTokens: number;
  todayCost: number;
  budgetRemaining: number | null;
  budgetPercentage: number | null;
  estimatedRequestsRemaining: number | null;
}

function formatCost(usd: number): string {
  if (usd < 0.01) {
    return `$${(usd * 100).toFixed(2)}c`;
  }
  return `$${usd.toFixed(2)}`;
}

function CostIndicator({ usage }: { usage: UsageDisplay }) {
  if (usage.budgetRemaining === null) {
    // No budget set, just show today's usage
    return (
      <div className="cost-indicator">
        <span>Today: {formatCost(usage.todayCost)}</span>
      </div>
    );
  }

  const isWarning = usage.budgetPercentage && usage.budgetPercentage >= 80;
  const isDanger = usage.budgetPercentage && usage.budgetPercentage >= 95;

  return (
    <div className={`cost-indicator ${isDanger ? 'danger' : isWarning ? 'warning' : ''}`}>
      <span>Budget: {formatCost(usage.budgetRemaining)} remaining</span>
      {usage.estimatedRequestsRemaining && (
        <span>~{usage.estimatedRequestsRemaining} requests left</span>
      )}
    </div>
  );
}
```

### Pricing Reference

| Provider | Model | Input (per 1K) | Output (per 1K) |
|----------|-------|----------------|-----------------|
| Ollama | Any | $0.00 | $0.00 |
| Gemini | gemini-1.5-flash | $0.000075 | $0.0003 |
| Gemini | gemini-1.5-pro | $0.00125 | $0.005 |
| Gemini | gemini-2.0-flash | $0.00 (preview) | $0.00 (preview) |

---

## Integration with dIKtate Pipeline

### Processor Module

```python
# python/core/processor.py

from typing import Optional
from .llm import (
    ProviderFactory,
    StreamingService,
    CostTracker,
    OfflineModeHandler,
    ChatRequest,
    ContextMode,
    get_system_prompt,
    should_use_llm
)

class TextProcessor:
    """Process transcribed text through LLM based on context mode."""

    def __init__(
        self,
        provider_factory: ProviderFactory,
        cost_tracker: CostTracker
    ):
        self._factory = provider_factory
        self._cost_tracker = cost_tracker
        self._offline_handler = OfflineModeHandler(
            provider_factory,
            self._notify_user
        )

    async def process(
        self,
        raw_text: str,
        mode: ContextMode,
        websocket = None
    ) -> str:
        """
        Process raw transcription through LLM.

        Args:
            raw_text: Raw text from Whisper transcription
            mode: Context mode for processing
            websocket: Optional WebSocket for streaming updates

        Returns:
            Processed text ready for injection
        """
        # Raw mode bypasses LLM entirely
        if not should_use_llm(mode):
            return raw_text

        # Get system prompt for mode
        system_prompt = get_system_prompt(mode)

        # Build request
        request = ChatRequest(
            messages=[{"role": "user", "content": raw_text}],
            model=self._get_model_for_mode(mode),
            temperature=0.3,  # Lower temperature for more consistent output
            max_tokens=len(raw_text) * 2,  # Allow for expansion
            system_prompt=system_prompt
        )

        # Get provider
        context = self._offline_handler.get_selection_context()
        provider = await self._factory.select_provider(context)

        # Stream or direct response
        if websocket:
            streaming_service = StreamingService(self._factory)
            response = await streaming_service.stream_to_client(
                websocket,
                request,
                context,
                on_complete=lambda r: self._record_usage(r, provider, mode)
            )
        else:
            response = await provider.chat(request)
            self._record_usage(response, provider, mode)

        return response.content.strip()

    def _get_model_for_mode(self, mode: ContextMode) -> str:
        """Get appropriate model for context mode."""
        # Could be configurable per mode
        return "llama3"  # Default for Ollama

    def _record_usage(self, response, provider, mode: ContextMode) -> None:
        """Record usage for cost tracking."""
        if not provider.is_local:
            cost = provider.estimate_cost(
                ChatRequest(messages=[], model=response.model)
            )
            self._cost_tracker.record_usage(
                provider=provider.name,
                model=response.model,
                usage=response.usage,
                cost=cost,
                context_mode=mode.value
            )

    def _notify_user(self, title: str, message: str) -> None:
        """Send notification to user via WebSocket."""
        # Implementation depends on notification system
        pass
```

### Settings Integration

```json
{
  "provider": "ollama",
  "ollamaModel": "llama3",
  "ollamaBaseUrl": "http://localhost:11434",
  "geminiApiKey": null,
  "llmSettings": {
    "preferLocal": true,
    "budget": {
      "dailyLimitUsd": null,
      "monthlyLimitUsd": null
    },
    "modelOverrides": {
      "standard": null,
      "developer": null,
      "email": null
    }
  }
}
```

---

## Summary

This design document establishes a local-first LLM provider architecture for dIKtate:

1. **Provider Interface**: Abstract interface supporting both local and cloud providers
2. **Ollama Provider**: Primary local implementation with streaming support
3. **Gemini Provider**: Cloud fallback with cost tracking
4. **Provider Factory**: Intelligent selection with local-first priority
5. **Context Modes**: Specialized prompts for each dictation scenario
6. **Streaming**: Real-time response delivery via WebSocket
7. **Offline Handling**: Graceful degradation with clear user guidance
8. **Cost Estimation**: Token tracking and budget management for cloud usage

The architecture ensures privacy by default while providing flexibility for users who need cloud capabilities.
