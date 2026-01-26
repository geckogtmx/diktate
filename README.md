# dIKtate

> **"Ik"** *(Mayan)*: Wind, Breath, Life.

A high-performance, **local-first** AI voice dictation tool for Windows. Speak naturally, get polished, professional text—instantly typed into any application. No cloud, no lag, no compromise.

[dikta.me](https://dikta.me)

---

## 🎯 Project Status: v1.0 Feature Complete 🔒

**Current Phase:** Phase F - Methodical Validation 🧪
**Status:** All core v1.0 features (Refining, Security) are **Implemented and Verified**. We are currently in the final "stress-test" period before public release.

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
*   **Gemma 3 4B Integration**: High-quality local reasoning for professional text formatting.
*   **Whisper V3 Turbo**: State-of-the-art speech-to-text accuracy.
*   **Bilingual Bridge**: Real-time translation between English and Spanish.
*   **+Key (Auto-Action)**: Automatically trigger `Enter`, `Tab`, or a `Space` after injection for seamless workflow.
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

---


---

---

## 🤖 AI-Co-Authored
This project is a testament to modern AI-augmented development. It was built using a high-bandwidth collaborative workflow between a human developer and agentic systems including **Google Gemini 2.0**, **Antigravity**, and **Claude Code**.

---

## License
MIT

---
**Ship early, iterate fast, preserve vision.** 🎯
