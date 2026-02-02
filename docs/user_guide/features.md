# Features Guide

## Core Capabilities

### 🎙️ Push-to-Talk Dictation
- **Hotkey**: `Ctrl+Alt+D` (Default)
- **Behavior**: Hold to record, release to stop (or toggle, depending on settings).
- **Auto-Injection**: The text is automatically typed into your active window.
- **Mute Detection**: dIKtate automatically detects if your microphone is muted and prevents wasted recordings.

### 🧠 Ask Mode
- **Hotkey**: `Ctrl+Alt+A`
- **Behavior**: Ask a question, and the local AI will answer.
- **Output**: Answers are copied to your clipboard automatically.

### 📝 Refine Mode (AI Editor)
- **Hotkey**: `Ctrl+Alt+R`
- **Behavior**: Instantly polish email drafts, fix grammar, and professionally rewrite text in any application.
- **Usage**: Select text -> Press `Ctrl+Alt+R` -> Watch it transform.
- **Tip**: Works best on 1-3 sentences. Great for Slack messages and quick emails.

### ⚡ Performance Dashboard
The Status Window (visible during recording) shows real-time metrics:
- **Latency**: How fast your speech is converted.
- **Confidence**: The model's certainty.

## Advanced Features

### 🎭 Context Modes
Switch between different "personas" for the AI to adjust the output style:
- **Standard**: General purpose cleanup.
- **Prompt**: Optimized for structuring text as an LLM prompt.
- **Professional**: Business-ready, removes slang and polishes tone.
- **Raw**: Whisper-only mode - preserves all words (including fillers), just adds punctuation. No AI processing.

**Note:** All local modes use the same Ollama model (for VRAM optimization), but each mode can have custom prompts for different output styles. Cloud providers (Gemini, Claude, GPT) still support per-mode model selection. Raw mode does not use AI processing—it's pure transcription.

### 🌐 Bilingual Bridge
dIKtate can automatically handle switching between **English** and **Spanish** during the same dictation session.

### 🧩 Prompt Helper
(Advanced) Automatically structures your rambling thoughts into a clear, concise AI prompt.
