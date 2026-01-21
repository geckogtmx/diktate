# DEV_HANDOFF.md

> **Last Updated:** 2026-01-21 09:55
> **Last Model:** Gemini (Antigravity)
> **Session Focus:** V2.0 Brainstorming & Roadmap Expansion

---

## ✅ Completed This Session

### 🧠 Roadmap & Planning
- **Updated `DEVELOPMENT_ROADMAP.md`**:
  - Added **v1.1 Phase F**: Docs Chatbot ("Neural Help").
  - Added **v2.0 Phase**: Scribe Layer ("Granola") & Visionary Module.
- **Updated `AI_CODEX.md`**:
  - Removed "Department of One" / strict "No Rebrand" language per user request.

### 📝 New Specifications
- **[SPEC_002_DOCS_CHATBOT.md](docs/specs/SPEC_002_DOCS_CHATBOT.md)**: 
  - Dual Deployment Strategy (Local + Cloud).
  - RAG Architecture for app vs website.
- **[SPEC_003_SCRIBE_LAYER.md](docs/specs/SPEC_003_SCRIBE_LAYER.md)**: 
  - "Granola-like" meeting intelligence.
  - Concept for Persistent Session Engine (Audio + Notes -> AI Artifact).
- **[SPEC_004_VISIONARY_MODULE.md](docs/specs/SPEC_004_VISIONARY_MODULE.md)**: 
  - Hybrid Vision Architecture.
  - **Local:** Moondream 2B (<2.4GB VRAM) for privacy/speed.
  - **Cloud:** Gemini Flash for complex reasoning.

---

## 📋 Instructions for Next Model

### Priority Order
1.  **EXECUTE v1.0 Mandate (Highest Priority)**:
    - We paused v1.0 execution to brainstorm. Now we must return.
    - **Goal:** Implement **TTS for Ask Mode** & **Injection Recall**.
    - **Ref:** `docs/specs/SPEC_001_TTS_AND_REINJECT.md`.
    - **Tasks:**
        - Install `pyttsx3`.
        - Implement `dictate:speak` in Python.
        - Implement `dictate:reinject-last` logic.

2.  **Verify docs/specs/**:
    - Ensure the 3 new specs are correctly linked in the roadmap.

---

## 🔄 Context & State
- **Repo State:** Roadmap is now very ambitious (v2.0 is huge). Focus MUST remain on stabilizing v1.0 first.
- **Architecture:** We have committed to a "Hybrid" future (Local Default + Cloud Optional). This justifies the v1.1 Wallet infrastructure.
- **VRAM Constraints:** Determined that Moondream 2B fits in 8GB alongside Whisper/Gemma.

---

## Session Log (Last 3 Sessions)

### 2026-01-21 09:55 - Gemini
- **Planning:** Created detailed specs for Chatbot, Scribe, Visionary.
- **Roadmap:** Officially mapped out v1.1 and v2.0.

### 2026-01-20 11:35 - Gemini
- **UI/UX**: Unified header across site, standardized height/padding.
- **Docs**: Defined Documentation Master Plan.

### 2026-01-20 11:05 - Gemini
- **UI/UX:** Massive overhaul of marketing site scrollytelling.
