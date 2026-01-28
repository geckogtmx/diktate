# dIKtate

> **"Ik"** *(Mayan)*: Wind, Breath, Life.

A high-performance, **local-first** AI voice dictation tool for Windows. Speak naturally, get polished, professional text—instantly typed into any application. No cloud, no lag, no compromise.

[dikta.me](https://dikta.me)

---

## 🎯 Project Status: v1.0 Feature Complete 🔒

**Current Phase:** Phase F - Methodical Validation 🧪
**Status:** All core v1.0 features (Refining, Security, **Google Hub Integration**) are **Implemented and Verified**. We are performing final stress-testing of the OAuth fallback mechanisms.

### Core 1.0 Experience
1. **Push-to-Talk**: Hold or toggle `Ctrl+Alt+D` to record.
2. **AI Transformation**: Your voice is cleaned up using **Gemma 3 4B** (Filler removal, grammar correction, formatting).
3. **Auto-Injection**: The result is typed instantly into the active window.

---

## 🚀 Why dIKtate?

*   **Privacy First**: 100% offline. Your audio and text never leave your machine.
*   **Extreme Speed**: Local GPU inference (~3s) is often **4x faster** than Cloud APIs.
*   **Intelligent Refinement**: Don't just dictate—edit. Use voice commands to "Make it formal" or "Turn this into a bullet list."
*   **Deterministic Stability**: No peak-hour slowdowns or API outages.

---

## 🔥 v1.0 Key Features

### 🎙️ Advanced Workflow Modes
| Hotkey | Mode | Action |
|:---|:---|:---|
| `Ctrl+Alt+D` | **Dictate** | The standard pipeline: Transcribe → Clean → Type. |
| `Ctrl+Alt+R` | **Refine** | **Dual-Action**: Tap for **Auto-Fix** (standard cleanup) or toggle for **Open Prompt** (dictate instructions like "Make it a list"). |
| `Ctrl+Alt+A` | **Ask** | Voice Q&A with your local AI. Answers are typed or copied to clipboard. |
| `Ctrl+Alt+V` | **Oops** | Misclicked or deleted? Instantly re-inject the last successfully processed text. |
| `Ctrl+Alt+T` | **Translate** | Bidirectional EN ↔ ES translation: speak one, get the other. |

### 🧠 Intelligence & Performance
*   **Hybrid Intelligence**: Seamlessly switch between local **Gemma 3 4B** and cloud-based **Gemini 2.5 Flash** (via Google Hub OAuth).
*   **Whisper V3 Turbo**: State-of-the-art speech-to-text accuracy.
*   **Bilingual Bridge**: Real-time translation between English and Spanish.
*   **+Key (Auto-Action)**: Automatically trigger `Enter`, `Tab`, or a `Space` after injection.
*   **Auto-Tiering**: Automatically selects the best models based on your detected GPU VRAM.


---

## 🛠️ Tech Stack

*   **Frontend**: Electron (System Tray & Settings UI)
*   **Backend**: Python 3.11 + FastAPI + ZeroMQ
*   **Intelligence**: Ollama (Gemma 3) & faster-whisper (CUDA)
*   **Storage**: SQLite & safeStorage (API Keys)

---

## ⚙️ Prerequisites & Installation

### System Requirements
*   **OS**: Windows 10/11
*   **Hardware**: NVIDIA GPU with 6GB+ VRAM (Recommended for 1.0 stability).
*   **Drivers**: Latest NVIDIA CUDA drivers installed.
*   **Ollama**: Automatically detected or bundled as a sidecar.

### Installation
```bash
# v1.0 Installer coming soon to dikta.me
# For developers:
git clone https://github.com/geckogtmx/diktate
pnpm install
pnpm dev
```

## 🚀 Comprehensive Feature List

### Core Functionality
- **Push-to-Talk Recording** - Global hotkey (Ctrl+Alt+D) toggles recording instantly.
- **Whisper V3 Turbo** - State-of-the-art speech-to-text running 100% locally on your GPU.
- **Local Intelligence** - Integrated Gemma 3 4B model for intelligent text cleanup and formatting.
- **Auto-Injection** - Automatically types transcribed text into any active application window.
- **Offline Operation** - Functions completely without an internet connection or cloud dependency.
- **Status Window** - Visual dashboard providing real-time feedback on recording and processing.
- **System Tray Icon** - Minimal background presence with access to quick actions and settings.
- **Smart Fallback** - Automatically switches to raw transcription if the LLM processing hangs or fails.

### Workflow & Intelligence
- **Ask Mode** - Voice Q&A with the LLM using a dedicated hotkey (Ctrl+Alt+A).
- **Google Hub (SPEC_016)** - Integrated Google Account Gemini support with OAuth 2.0 and local **Usage Tracking** (Daily Character Counter).
- **Context Modes** - Switchable prompts for different output styles (Standard, Developer, Email, Creative).
- **Prompt Helper Mode** - Automatically structures voice input into clear, formatted LLM prompts.
- **Bilingual Bridge** - Real-time translation between English and Spanish during dictation.
- **Refine Mode** - Two-stage editing: Select text and auto-fix, or dictate specific implementation commands ("Make formal").
- **Snippets** (Coming v2.0) - Voice macros that expand short phrases into blocks.
- **Post-it Notes Mode** (Coming v2.0) - Dictation mode for appending timestamps to a file.

### Performance & Tech
- **Speed Advantage** - Low-latency processing (350-750ms) significantly faster than cloud APIs.
- **Unlimited Dictation** - No artificial word limits, usage caps, or throttling.
- **Model Agnostic** - Support for switching between various local LLMs (Llama, Mistral, Gemma).
- **Hardware Auto-Detection** - Automatically selects optimized models based on detected GPU VRAM.
- **Low Latency Architecture** - Optimized ZeroMQ pipeline for maximum throughput.
- **Single Binary Deployment** - Self-contained executable including Python environment and Ollama sidecar.

### Privacy & Security
- **Air-Gap Guarantee** - Architectural assurance that user audio never leaves the local machine.
- **SafeStorage** - Platform-encrypted local management for API keys and sensitive secrets.
- **Log Redaction** - Automatic scrubbing of PII and API keys from all application logs.
- **Telemetry-Free** - No usage analytics, tracking, or data reporting sent to the developer.
- **Clean Uninstall** - Complete removal of all application data and traces from the system.

### Commercial & Licensing
- **TBD** - Pricing and licensing details are currently being finalized.

---



---

---

## 🤖 AI-Augmented Development

This project demonstrates the power of modern AI-augmented development. It was built using a high-bandwidth collaborative workflow involving human developers and agentic systems, such as Google Antigravity, Claude Code, Kilo Code, and OpenCode, alongside a diverse range of local and cloud-based models.

---

## License
MIT

---
**Ship early, iterate quickly, preserve your vision. Coding is cheap, ideas are paramount.** 🎯
