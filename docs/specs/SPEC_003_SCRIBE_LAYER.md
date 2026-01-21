# Concept: dIKtate Scribe (The "Granola" Layer)

> **Status:** CONCEPTUAL
> **Inspiration:** Granola.ai
> **Goal:** Move beyond "Input Tool" to "Meeting Intelligence Workspace".

---

## 1. The Core Concept

Current dIKtate is **Ephemeral**: You speak, it types, it forgets.
The "Scribe" layer is **Persistent**: You record an event, you take notes, it synthesizes a permanent artifact.

### The "Magic" Workflow
1.  **Capture:** Record a long-form event (Meeting, Lecture, Brainstorm).
2.  **Context:** User creates "Rough Notes" during the event (Bullet points, key thoughts).
3.  **Synthesis:** AI combines **Audio Transcript** + **User Notes** -> **Polished Document**.

*Why this wins:* Pure transcription is too long to read. Pure notes miss details. The combination is perfect.

---

## 2. Architecture: "The Session Engine"

We need a new data structure: **The Session**.

### Data Model (SQLite + File System)
```json
{
  "session_id": "uuid",
  "timestamp": "2026-01-21T10:00:00",
  "title": "Planning Meeting v2",
  "audio_path": "data/sessions/{id}/recording.wav", // Long-form audio
  "transcript_path": "data/sessions/{id}/transcript.json", // Raw Whisper output with timestamps
  "user_notes_path": "data/sessions/{id}/notes.md", // User's rough scribbles
  "final_artifact_path": "data/sessions/{id}/output.md", // AI Synthesized result
  "template": "meeting_minutes" // The "Recipe" used
}
```

### Components needed
1.  **Long-Form Recorder:** Streaming `.wav` writer (current `pyaudio` handles memory buffers, need disk streaming for 1hr+ calls).
2.  **Post-Processor:** A background worker that runs Whisper on the full file *after* (or during) the call.
3.  **Synthesizer:** An LLM Agent that takes `(Transcript, UserNotes, Template)` and produces Markdown.

---

## 3. The User Interface (New Window)

This requires a dedicated "Workspace" window, separate from the Floating Pill.

### Layout
- **Left Pane (The Notepad):** A distraction-free Markdown editor. User types *during* the meeting.
- **Bottom Bar (Controls):** Record/Pause/Stop. Real-time duration. Waveform visualization.
- **Right Pane (AI Assistant):**
    - **Post-Meeting:** Shows the generated Summary/Action Items.
    - **Interaction:** "Chat with this meeting" (RAG over the transcript).

### "Templates" (Recipes)
- **Meeting:** Summary, Decisions, Action Items.
- **Interview:** Key insights, Quotes, Sentiment.
- **Lecture:** Outline, Key Concepts, Review Questions.
- **Code Walk:** File references, Logic flow, TODOs.

---

## 4. Implementation Strategy (Local-First)

### Phase 1: The Core (Backend)
- Implement `SessionManager` in Python.
- Add `stream_to_disk` in `AudioRecorder`.
- Create `Synthesizer` class using `gemma3:4b`.
  - *Prompt:* "You are an expert secretary. You have a raw transcript and the user's rough notes. Merge them into a structured document following this template..."

### Phase 2: The UI (Frontend)
- **Scribe Window:** Electron `BrowserWindow`.
- **Editor:** `CodeMirror` or `Monaco` for the notepad.
- **Visuals:** Audio visualizer to verify recording is active.

### Phase 3: Intelligence (RAG)
- Index the specific meeting transcript into a temporary vector store.
- Allow user to ask: "What did verified-human say about the timeline?"

---

## 5. Technical Challenges & Solutions

| Challenge | Solution |
| :--- | :--- |
| **Long Audio Files** | Stream to disk, do not hold in RAM. Use `ffmpeg` to compress to mp3 post-recording. |
| **Whisper Speed** | Run `faster-whisper` (Turbo model) on the GPU. A 1hr meeting takes ~2-3 mins to transcribe. |
| **LLM Context** | A 1hr meeting is ~10k+ tokens. `gemma3:4b` has 8k limit. **Solution:** Sliding window summarization OR Map-Reduce (Summarize chunks, then summarize summaries). |
| **Speaker Diarization** | "Who said what?" is hard locally. **Start:** No speaker ID. **Future:** Use `pyannote.audio` (heavy) or simple heuristic speaker separation. |

---

## 6. Granola Feasibility Check
Can we build this? **Yes.**
- We have the Models (Whisper/Gemma).
- We have the App Shell (Electron).
- We have the Privacy Angle (Big selling point vs Granola's cloud).

**Verdict:** This is the natural evolution of dIKtate from "Tool" to "Platform".
