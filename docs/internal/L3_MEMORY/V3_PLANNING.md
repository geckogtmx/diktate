# dIKtate: The Personal Brain Strategy (V3 Planning)

**Goal**: Bridge the gap between a "Simple Voice Tool" (Casual) and a "Cognitive Engine" (LOOM), making AI agency accessible to the non-dev "Home/Personal" user.

**Philosophy**: "Complexity is opt-in. Agency is gradual."

---

## 🗣️ The Onboarding: "The First Conversation"
*Inspired by the OS setup in the movie "Her".*

Instead of a Settings Menu, the user has a **20-Minute Voice Interview** with the AI.
*   **Dynamic**: The user can "Skip" ("Just let me dictate") or "Extend" ("Let's dig deeper").
*   **Calibration**: The AI gauges your comfort level and unlocks agency accordingly.

**Example Flow:**
1.  **AI**: "Hi, I'm dIKtate. Do you want me to just type what you say, or should I help you organize things?"
    *   *User*: "Just type." -> **Level 1 (Typewriter)**. Search/Tools disabled.
    *   *User*: "Help me organize." -> **Proceeds to Q2**.
2.  **AI**: "Okay. To help with that, I can listen to your meetings and summarize them. Is that okay?"
    *   *User*: "Sure, but don't save anything permanently." -> **Level 2 (Parrot)**.
    *   *User*: "Yes, and remind me of stuff later." -> **Proceeds to Q3**.
3.  **AI**: "I can read your documents to understand your projects. Do you want to give me access to a 'Brain' folder?"
    *   *User*: "Yes, create one." -> **Level 3 (Home Brain)**. folder created.
4.  **AI**: "Last thing. I can actually *do* things, like searching the web or managing files. Do you want that power?"
    *   *User*: "Let loose. Do whatever." -> **Level 4 (Operator)**.

---

## 🏗️ The 4-Level "Spectrum of Agency"

### Level 1: The Voice Typewriter (Current MVP)
*   **Target**: The Casual User.
*   **Agency**: **L0 (None)**.
*   **Value**: "It types faster than I can."
*   **Guardrails**: Total isolation.

### Level 2: The Digital Parrot (Scribe Mode)
*   **Target**: Students, Meeting Goers.
*   **Agency**: **L2 (Read-Only Memory)**.
*   **Value**: "It remembers what I missed."
*   **Feature**: Scribe Ring Buffer (2 mins). "What did I just say?"
*   **Guardrails**: Can listen/speak, but cannot write files.

### Level 3: The Personal Assistant ("Home Brain")
*   **Target**: Life Admin / Organizers.
*   **Agency**: **L3 (Knowledge) + Safe Tools**.
*   **Value**: "It organizes my chaos."
*   **Feature**: "Remember this" (Writes to Markdown).
*   **Guardrails**: **"The Butler Protocol"**. Verbal confirmation before saving memories. Restricted file access (`/My Personal Brain` only).

### Level 4: The Operator (LOOM Mode)
*   **Target**: Power Users / Developers.
*   **Agency**: **L4 (Identity) + Full Tools**.
*   **Value**: "It does my work for me."
*   **Feature**: "Refactor code", "Search web", "Manage OS".
*   **Guardrails**: **Operator Supremacy**. Strict execution gates.

---

## 🌉 Bridging the Gap: "Invisible Complexity"

1.  **The "Default Vault"**: dIKtate auto-creates `Documents/My Personal Brain/` for Level 3 users. No config files.
2.  **Voice-Native Context**: "Hey, I'm working on my **Novel**." -> Loads context.
3.  **Local Privacy**: "The Brain in a Box". Your creative "Her", running locally.

---

## 🔬 Technical Research: The Fluid Conversation
*Critical challenges for the "Her-like" experience.*

To achieve a natural 20-minute interview flow, we must solve "The Turn-Taking Problem":

1.  **Voice Activation (VAD)**:
    *   Need low-latency local VAD (Silero VAD?) to detect speech start instantly (< 50ms).
    *   Must distinguish user voice from background noise/music (Auto-gate).

2.  **Silence vs. Pause**:
    *   **The "Thinking Pause"**: User stops for 2s to think. Agent *must not* interrupt.
    *   **The "Yielding Pause"**: User stops for 500ms expecting a reply. Agent *must* reply.
    *   *Research*: LLM-based turn-taking prediction? Or simple heuristic (Silence > 3s = Yield)?

3.  **Mid-Phrase & Cues**:
    *   **Interruptibility ("Barge-in")**: If the Agent is talking and User says "Wait—", Agent must stop instantly.
    *   **Backchanneling**: Agent providing subtle cues ("Mmhmm", "Go on") during long pauses without taking the floor.

4.  **Testing Strategy**:
    *   **Stress Test**: "The Stuttering Interview". Test against heavy disfluencies.
    *   **Noise Test**: "The Cafe Interview".

---

## 🔐 Technical Research: Activation & Safety Protocols
*How we bridge "Always Listening" with "Never Dangerous".*

### 1. The Two-Stage Wake System
Inspired by Alexa/Siri, but with a local-first safety latch.

*   **Stage 1: The "Soft Wake" (Attention)**
    *   *Trigger*: "Hey dIKtate" (or custom name).
    *   *State*: Low-power listening.
    *   *Response*: Visual cue (LED/UI Pulse). No meaningful action taken yet.
*   **Stage 2: The "Hard Wake" (Action)**
    *   *Trigger*: "Take a note", "Write this", "Search for".
    *   *State*: Full L2/L3 recording and processing.

### 2. The "Safe Word" Protocol (Critical Actions)
For Level 4 (Operator) actions—like deleting files, sending emails, or executing code—we need a cryptographic-strength verbal confirmation.

*   **The Problem**: Passive listening might misinterpret "Delete that" (referring to text) as "Delete file".
*   **The Solution**: A user-defined, distinct **Safe Word** or **Action Phrase** required for state-changing operations.
    *   *Example*:
        *   User: "Delete all files in this folder."
        *   AI: "Confirm deletion of 12 files."
        *   User: **"Override Alpha"** (or custom safe phrase).
    *   *Why*: It breaks the "conversational flow" intentionally to force cognitive engagement from the user.

### 3. The "Voice Latch" Idea
*   **Concept**: A specific robust sound or phrase that acts as a hardware-level toggle.
*   *Idea*: A "Click-click" tongue sound (detectable by simple DSP) or a specific whistle?
*   *Software*: A global hotkey is the physical latch; we need a verbal equivalent.

---

## 🔱 Vertical Strategy: "The Trinity"
*One Engine, Three Expressions.*

We are not building one app. We are building a Core Engine (`diktate-core`) that powers three distinct verticals.

### 1. dIKtate Core (Libre Edition)
*   **Target**: FOSS Community / Linux Users.
*   **Focus**: "The best local voice typewriter."
*   **Scope**: Pure dictation, 100% offline, privacy-first.
*   **License**: MIT.

### 2. dIKtate Brain (Pro Edition)
*   **Target**: Knowledge Workers / Life Organizers.
*   **Focus**: "The Personal Cognitive Engine" (This Plan).
*   **Scope**: Scribe Mode, Memory, File Management, "Her-like" Interface.
*   **Ref**: `DEFERRED_FEATURES.md` (Cloud Wallet, Visionary Module).

### 3. dIKtate Broadcast (Content Creator Edition)
*   **Target**: Broadcasters, Podcasters, & Live Streamers.
*   **Focus**: "The Automated Co-Host and Producer"
*   **Scope**:
    *   **Voice-to-Action**: "Switch scene", "Clip that".
    *   **Automated Moderation**: Local LLM toxicity filtering.
    *   **Co-Host Persona**: An AI that talks to audience via TTS.
    *   **Show Runner Mode**: Automated checklists, segment timing tracking ("You're 2 mins over"), and cue management.
    *   **Backstage Comms**: Private TTS whisper channel for producer-to-host notes ("Fix your mic", "Wrap it up").
    *   **Asset Commander**: "Pull up the Q3 Graph" -> Searches and projects image to OBS source.
*   **Integration**: Direct WebSocket bridge to **Streamer.bot**.
    *   **The "Universal Actuator" Strategy**: We use Streamer.bot not just for streaming, but as our **"Operating System Driver"**.
    *   **Capabilities**: It handles C#/PowerShell scripting, MIDI control, Home Assistant (IoT), and Global Hotkeys.
    *   **Benefit**: dIKtate doesn't need to learn how to turn off your lights. It just tells Streamer.bot `{"action": "lights_off"}`.
    *   **Post-Production (VOD)**: Integrated **[Remotion](https://github.com/remotion-dev/remotion)** pipeline.
        *   *Concept*: "Clip that and post to TikTok."
        *   *Flow*: Voice Command -> Timestamp marking -> Streamer.bot export -> Remotion renders vertical video with subtitles -> Auto-upload.
    *   **Dual-PC Architecture**:
        *   *Concept*: "The dedicated AI Box."
        *   *Benefit*: Many broadcasters use a 2-PC setup. dIKtate runs on the "Stream/Encoding PC" (using its beefy GPU/RAM), keeping the "Game PC" 100% focused on FPS.
        *   *Network*: Zero-latency control via LAN WebSocket.
    *   **Adaptive Compute ("The Good Assistant Protocol")**:
        *   **Off-Air ("The Factory")**: When stream is offline, dIKtate devours 100% of unused GPU/RAM for heavy production (rendering videos, indexing logs).
        *   **On-Air ("The Shadow")**: When OBS is streaming, dIKtate minimizes footprint, sacrificing its own speed/quality to ensure **zero impact** on game/stream stability.
        *   **On-Air ("The Shadow")**: When OBS is streaming, dIKtate minimizes footprint, sacrificing its own speed/quality to ensure **zero impact** on game/stream stability.
*   **Ref**: [`STREAMER_SATELLITE.md`](./STREAMER_SATELLITE.md)

---

## 🏗️ Architecture Bridge: "The Hybrid Processor"
*How we get V3 reliability without a full rewrite.*

We identified that **Smart Failover** does not need to wait for the final V3 architecture. We can implement a **Hybrid Bridge** immediately:

*   **Current State (V1)**: The code chooses `LocalProcessor` OR `CloudProcessor` at startup.
*   **The Bridge Strategy**: Create a `HybridProcessor` class that wraps both.
    *   **Logic**:
        ```python
        def process(text):
            try:
                return local.process(text) # Try free/private first
            except (ConnectionError, Timeout):
                if has_gemini_key:
                    log("Failover triggered: Switching to Cloud")
                    return cloud.process(text) # Saving throw
                raise
        ```
    *   **Value**: Immediate >99% reliability enhancement for "Pro" users with API keys, without needing the complex Event Bus or Provider Factory of the final V3 spec.

