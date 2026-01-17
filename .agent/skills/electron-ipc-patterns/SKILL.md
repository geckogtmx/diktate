---
name: electron-ipc-patterns
description: Secure IPC patterns for Electron Main ↔ Renderer ↔ Python communication.
---

# Electron IPC Patterns

This skill defines the communication patterns for dIKtate's tripartite architecture:
1.  **Renderer** (UI)
2.  **Main** (Electron Controller)
3.  **Python** (Backend Engine)

## 🔄 Architecture Overview

```
┌──────────────┐     IPC (Invoke)     ┌──────────────┐     stdio (JSON)     ┌──────────────┐
│   Renderer   │ ───────────────────> │     Main     │ ───────────────────> │    Python    │
│  (React UI)  │ <─────────────────── │   Process    │ <─────────────────── │    Engine    │
└──────────────┘     IPC (Event)      └──────────────┘     stdio (JSON)     └──────────────┘
```

## 1. Renderer ↔ Main (Standard Electron IPC)

Use `contextBridge` to expose safe APIs.

```typescript
// preload.ts
contextBridge.exposeInMainWorld('api', {
  status: {
    get: () => ipcRenderer.invoke('status:get'),
  },
  on: {
    stateChange: (cb) => {
      const handler = (_, data) => cb(data);
      ipcRenderer.on('state:change', handler);
      return () => ipcRenderer.removeListener('state:change', handler);
    }
  }
});
```

## 2. Main ↔ Python (The Bridge)

Communication uses standard input/output streams.

**PythonManager Service:**
```typescript
class PythonManager {
  private pythonProcess: ChildProcess;

  sendCommand(cmd: string, payload: any) {
    const message = JSON.stringify({ id: uuid(), command: cmd, payload });
    this.pythonProcess.stdin.write(message + '\n');
  }

  // Handle stdout
  private onData(data: string) {
    const events = data.split('\n').filter(Boolean);
    for (const event of events) {
      try {
        const json = JSON.parse(event);
        this.emit('message', json);
      } catch (e) {
        console.error('Failed to parse Python message', e);
      }
    }
  }
}
```

## 3. Channel Naming Conventions

- **Main/Renderer:** `domain:action` (e.g., `status:get`, `recording:start`)
- **Main/Python:** `command_name` (snake_case, e.g., `start_recording`, `process_audio`)

## 4. Security Checklist

- [ ] Validated Zod schemas for all Renderer inputs
- [ ] No `nodeIntegration` in Renderer
- [ ] Python input sanitized (no shell injection)
- [ ] `contextIsolation: true` mandated
