# Project Structure

## Directory Layout

```
diktate/
├── .agent/             # AI Agent configuration and skills
├── dist/               # Compiled frontend assets
├── docs/               # Documentation
│   ├── developer_guide/# This guide
│   ├── internal/       # Core team docs (Specs, Roadmap)
│   └── user_guide/     # End-user manuals
├── electron/           # Electron main process source
├── src/                # Python backend source
│   ├── core/           # Core logic (audio, transcription)
│   ├── api/            # API endpoints
│   └── utils/          # Helper functions
├── ui/                 # Frontend UI source (HTML/CSS/TS)
├── package.json        # Node.js dependencies
└── requirements.txt    # Python dependencies
```

## Key Components

> *[Add Image of High-Level Architecture Diagram here]*

### Electron (Frontend)
Handles the system tray, global hotkeys, and the settings window. Communicates with the Python backend via HTTP (localhost).

### Python (Backend)
The core engine.
- **Microphone**: Captures audio.
- **Whisper**: Transcribes audio to text.
- **Ollama**: Processes text (cleanup, formatting).
- **Pynput**: Injects text into target applications.
