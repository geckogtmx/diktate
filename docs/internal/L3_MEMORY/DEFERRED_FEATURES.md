# Deferred Features Catalog

**Purpose:** This document catalogs all features that are **not** currently in the core production branch, organized by implementation priority and value.

**Philosophy:** Nothing is lost—everything is phased. All detailed specifications are preserved in `L3_MEMORY/FULL_VISION/` for future implementation.

**Master Plan:** See [DEVELOPMENT_ROADMAP.md](../../DEVELOPMENT_ROADMAP.md) for the live feature lock.

---

> [!NOTE]
> **UPDATE 2026-01-22:** Re-organized by **Value vs. Complexity**. Items moved from "Phases" into "Priority Groups" to better reflect the v1.0 Lock.

---

## 🎓 1. Graduated / Implemented (The Victory Lap)
*These features were once deferred but are now fully functional in the current build.*

### Context Modes & Personality
- ✅ **Standard Mode**: General purpose dictation.
- ✅ **Professional Mode**: Business-ready formatting.
- ✅ **Prompt Mode**: Optimized for LLM prompting.
- ✅ **Raw Mode**: True passthrough (LLM bypass).
- ✅ **Custom Prompts**: Full UI for per-mode prompt editing.

### Quality & Performance
- ✅ **Auto-Fallback**: Reverts to raw transcription if Ollama/Cloud fails.
- ✅ **Cost Tracking**: Dashboard integration for tokens saved and estimated costs.
- ✅ **Performance Metrics**: Latency tracking and history charts.
- ✅ **Model Selection**: Live hot-swapping for Whisper and LLM models.

### System Integration
- ✅ **System Tray**: Quick shortcuts for Force Restart, Logs, and Updates.
- ✅ **Secure Storage**: API keys encrypted via Electron safeStorage.
- ✅ **Zod Validation**: Type-safe IPC channels for stability.

---

## 🎯 2. Active Horizon: v1.0 "The Lock"
*High-value features currently being pulled forward into the initial release.*

### Mini Mode (Compact Control Panel)
**Priority**: 🏆 High (User Sentimental Favorite)
**Value**: High (Compact "Pill-like" experience for existing window).
**Status**: 🚀 PLANNED FOR v1.0

### Oops Feature (Re-inject Last)
**Priority**: 🏆 High (ROI Winner)
**Value**: Essential UX (Allows re-pasting last dictation if window focus was lost).
**Status**: 🚀 PLANNED FOR v1.0 (`Ctrl+Alt+V`)

### Hardware Auto-Tiering
**Priority**: ⭐ High
**Value**: Technical (Automatically optimizes Whisper/LLM choices based on user VRAM).
**Status**: 🚀 PLANNED FOR v1.0

### Web Assistant (Conversational CRM)
**Priority**: ⭐ High
**Value**: Business (FAQ + Lead capture on `dikta.me`).
**Status**: 🚀 PLANNED FOR v1.0

---

## 💎 3. High Priority: v1.1 "The Premium Expansion"
*The "Cherries on Top" scheduled for post-v1.0 release.*

### Cloud Wallet & Multimodal Proxy (The Fuel)
**Status**: 💎 HIGH PRIORITY (v1.1)
**Vision**: Anti-subscription "Pay-as-you-go" credits with 20% margin. 
**Complexity**: High (Backend + Stripe + Edge API).
**Value**: Maximum (Monetization + Low-friction cloud access).

### Google OAuth / Quota Passthrough
**Status**: 💎 HIGH PRIORITY (v1.1)
**Vision**: Allow users to log in with Google to use their existing Gemini/Google AI Sub token quotas.
**Complexity**: Medium (OAuth 2.0 + Token management).
**Value**: High (Free alternative for Pro users with Google accounts).

---

### The Floating Pill UI
**Status**: Deferred to v1.1
**Vision**: The full animated, independent, draggable floating window. 
**Complexity**: High (Sentimental favorite, but high implementation cost).

### Text-to-Speech (Ask Mode)
**Status**: Deferred to v1.1
**Vision**: Audio delivery for LLM answers using `pyttsx3`.
**Complexity**: Medium-High (Requires delicate thread management).

### Design System (Obsidian Minimalism)
**Status**: Deferred from MVP
**Vision**: Comprehensive UI overhaul with custom component library (1,691 lines of spec).

---

## 🛠️ 4. Medium Priority: Power Features
*Optimization and advanced customization.*

### Advanced Audio Settings
- ⏳ **Voice Activity Detection (VAD)**: Auto-stop recording when user stops talking.
- ⏳ **Sample Rate Config**: Manual tuning for high-fidelity setups.
- ⏳ **Noise Gate**: Software-level audio cleaning.

### Extended History
- ⏳ **Persistent Storage**: Save dictations across app restarts (SQLite).
- ⏳ **Search & Filter**: Find previous thoughts within the dashboard.

---

## 🏗️ 5. Technical Backlog (Low ROI / Future)
*Architecture improvements with low immediate user impact.*

### WebSocket & Zustand
- **WebSocket Protocol**: Replace stdio with real-time bidirectional streaming.
- **Zustand State**: Migrate from React state to 5 domain-driven stores.
- **Enhanced IPC**: Structured logging, request/response correlation IDs, error sanitization.
- **Diarization**: Multi-speaker detection (Out of Scope).

---

## 🚀 6. Future Vision (v2.0+)
*Long-term research initiatives.*

### Scribe Mode (Meeting Intelligence)
**Vision**: Transform dIKtate into an intelligent meeting assistant (Granola-style).
**Focus**: Long-form recording (60m+), action item extraction, note-syncing.

### Docs Chatbot (App-Native RAG)
**Vision**: RAG-based local help system using Gemma + SQLite.
**Focus**: Local App Integration (Deferred to v1.1+).

### Visionary Module (Multimodal Eyes)
**Vision**: "You talk, dIKtate looks." Screenshot Q&A and OCR.
**Focus**: Hybrid stack (Local Moondream 2B + Cloud Gemini Flash).

### Mobile & Companion
- **Mobile App**: Cloud-first companion for remote dictation.
- **Browser Agent**: "Pill" integration for web-native navigation.

---

## 🏗️ 7. Architecture & Ecosystem Strategy
*Long-term distribution and business models.*

### Open Core Strategy
**Focus:** Splitting the "Engine" (MIT) from the "Pro" Apps (Source Available).
**Tiers:** Libre (FOSS), Pro (Productivity), Streamer (Studio).

### Satellite Product: Streamer AI Co-Host
**Vision:** Repurpose local voice + LLM for streamers (Twitch/OBS integration).
**Features:** AI Chat Responder, Sound Board AI, Local Moderation.

---

## Reference Map

| Feature | Full Spec Location | Priority Group | Complexity |
|:---|:---|:---|:---|
| Custom Prompts | STATE_MANAGEMENT_FULL.md | 1. Graduated | Medium |
| Mini Mode | index.html / CSS | 2. v1.0 Horizon | Medium |
| Floating Pill | DESIGN_SYSTEM_FULL.md | 3. Premium | High |
| TTS | SPEC_001_TTS_AND_REINJECT.md | 3. Premium | Med-High |
| Zustand Stores | STATE_MANAGEMENT_FULL.md | 5. Technical | High |
| Scribe Layer | SPEC_003_SCRIBE_LAYER.md | 6. Future | Very High |
| Visionary | SPEC_004_VISIONARY_MODULE.md | 6. Future | High |
| Cloud Wallet | ROADMAP: Phase F | 3. Premium | High |
| Google OAuth | OAuth Docs (Pending) | 3. Premium | Medium |
