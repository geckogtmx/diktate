# Concept: The "Visionary" Module (Multimodal Agent)

> **Status:** CONCEPTUAL
> **Target:** v2.0
> **Goal:** Give dIKtate "Eyes" to understand the user's screen context.

---

## 1. The Core Concept

**"You talk, dIKtate looks."**
Currently, dIKtate is blind. It hears you, but it can't see what you are looking at.
The Visionary Module allows you to trigger a "Visual Query" on your active window or a selected region.

### The Workflow
1.  **Trigger:** `Ctrl+Alt+V` (Vision Hotkey).
2.  **Capture:** App takes a screenshot of the active window.
3.  **Query:** You speak: *"What does this error mean?"* or *"Extract the table from this image."*
4.  **Response:** AI sees the image + hears your text -> Types the answer.

---

## 2. Architecture: Hybrid Vision

We need a stack that is **Fast (Local)** for simple tasks but **Powerful (Cloud)** for complex ones. We use the **Moondream 2B** model locally because it fits in 8GB VRAM alongside Whisper+Gemma.

### Path A: Local (Privacy First)
*   **Model:** `moondream:2b` (via Ollama).
*   **VRAM Cost:** ~2.4GB (Quantized).
*   **Best For:**
    *   OCR (Extracting text).
    *   UI Description ("What button should I click?").
    *   Privacy-sensitive screenshots (Email, Code).
*   **Latency:** Fast (1-3s).

### Path B: Cloud (Intelligence First)
*   **Model:** `gemini-1.5-flash` (via API).
*   **Cost:** Low / Free Tier.
*   **Best For:**
    *   Complex Reasoning ("Solve this math problem").
    *   Creative Writing based on image.
    *   Coding from screenshots ("Turn this mockup into HTML").
*   **Latency:** Medium (2-5s).

---

## 3. User Interface

### The "Snipping" Overlay
When `Ctrl+Alt+V` is pressed:
1.  Screen dims slightly.
2.  User sees crosshair cursor.
3.  **Click:** Caputre Active Window.
4.  **Drag:** Capture Region.

### The "Vision Pill"
The status pill changes to a **Purple Eye** icon to indicate "Analysis Mode".

---

## 4. Implementation Strategy

### Phase 1: Local Setup (Moondream)
1.  Verify `ollama pull moondream`.
2.  Test concurrent VRAM usage (Whisper + Gemma + Moondream).
3.  Implement screenshot utility in Python (`pyautogui` or `mss`).

### Phase 2: Pipeline Integration
1.  New IPC Command: `vision:analyze(image_base64, prompt)`.
2.  Update `processor.py` to route to the Vision Model.

### Phase 3: Cloud Fallback
1.  Implement Gemini API client in `ipc_server.py`.
2.  Add toggle in Settings: "Allow Cloud Vision for complex tasks?"

---

## 5. Feasibility Check (8GB VRAM)

**Budget:**
- **System/Display:** ~1GB
- **Whisper (Turbo):** ~1.5GB
- **Gemma 3 (4B):** ~3.5GB
- **Moondream (2B):** ~2.0GB
-------------------------
**Total:** ~8.0GB

**Verdict:** It is TIGHT.
**Optimization:** We may need to unload Gemma while Moondream is running, or vice-versa. Or use `whisper-small` when Vision is active.

---

## 6. Use Cases

| Query | Routing |
| :--- | :--- |
| "Copy this text" | **Local (Moondream)** |
| "What app is this?" | **Local (Moondream)** |
| "Explain this chart" | **Local (Moondream)** |
| "Write a python script to scrape this site" | **Cloud (Gemini)** |
| "Who is this person?" | **Cloud (Gemini)** |

