# Quick Start: Your First 5 Minutes with dIKtate

This guide is designed to get you to your first successful local dictation in under two minutes. For a full list of features, tech stack, and roadmap, see the [README.md](./README.md).

---

## 🛠️ Step 0: Choose Your Path

- **Users**: Ensure **Ollama** is installed and running (`ollama serve`).
- **Developers**: From the root directory, run `pnpm install` then `pnpm dev`.

## 🚀 Step 1: Launch & Warmup

1.  **Start the Application**: Launch dIKtate. It will initialize in your system tray.
2.  **Observe the Warmup**: dIKtate performs a parallel load of the Whisper (Audio) and LLM (Intelligence) models. This takes **10–12 seconds**.
3.  **Wait for the Dashboard**: The **Control Panel** (Status Window) will automatically appear once the system transitions from `Warmup` to `Ready`.

## 🎙️ Step 2: Your First Dictation

1.  Open **Notepad**, a browser address bar, or any text editor.
2.  Click to ensure the cursor is active.
3.  **Press and hold `Ctrl+Alt+D`**.
4.  Speak clearly: *"Hello world, this is my first local dictation using dIKtate."*
5.  **Release** the keys.

## ✅ Step 3: Verify Success

- You should see the Status Window transition to **Processing**.
- Polished, formatted text will be typed into your active application instantly.

---

## 🔍 Common "First Run" Hurdles

| Issue | Quick Fix |
| :--- | :--- |
| **No Dashboard Appears** | Check the system tray. If the icon is gray, models are still loading. |
| **Nothing is Typed** | Ensure the cursor was active in your text field *before* you released the keys. |
| **Ollama Error** | Ensure you have pulled your configured model (Default: `gemma3:4b`). |
| **Microphone Muted** | dIKtate will notify you if your hardware mute is active. |

---

## 📚 Deep Dive

- **Full Mode Guide**: Learn about Refine, Ask, and Note modes in the [README](./README.md).
- **Configuration**: Right-click the Tray icon and select **Settings** to change models or hotkeys.
- **Source Code**: See the [Developer Guide](./docs/developer_guide/index.md) for architecture and testing depth.
