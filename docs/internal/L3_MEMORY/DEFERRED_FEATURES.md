# Deferred Features Catalog

**Purpose:** This document catalogs all features from the detailed documentation that are **not** included in the MVP, organized by implementation phase.

**Philosophy:** Nothing is lost—everything is phased. All detailed specifications are preserved in `L3_MEMORY/FULL_VISION/` for future implementation.

**Master Plan:** See [DEVELOPMENT_ROADMAP.md](../../DEVELOPMENT_ROADMAP.md) for current development direction.

---

> **UPDATE 2026-01-17:** Many Phase 2-3 features are now COMPLETE. Items marked with ✅ COMPLETE have been implemented. Remaining items are tracked in DEVELOPMENT_ROADMAP.md Phase E.

---

## Phase 2: Enhanced User Experience (Weeks 4-6)

### Context Modes
**Status:** ✅ COMPLETE (Personality Modes in settings)
**Reference:** `FULL_VISION/LLM_PROVIDERS_FULL.md` (Context Mode Prompts section)
**Complexity:** Medium

**Features:**
- ✅ Standard mode (general purpose)
- ✅ Professional mode (business-ready)
- ✅ Prompt mode (for LLM prompts)
- ✅ Raw mode (literal transcription)
- Mode switching via hotkey - NOT IMPLEMENTED

---

### Hotkey Configuration
**Status:** ✅ COMPLETE
**Reference:** `FULL_VISION/STATE_MANAGEMENT_FULL.md` (Settings Store section)
**Complexity:** Low

**Features:**
- ✅ User-configurable global hotkey
- ✅ Persist to settings
- Hotkey conflict detection - NOT IMPLEMENTED

---

### Settings Window
**Status:** ✅ COMPLETE
**Reference:** `FULL_VISION/DESIGN_SYSTEM_FULL.md` (Settings Window section)
**Complexity:** Medium

**Features:**
- ✅ General settings (activation mode, context mode)
- ✅ Audio settings (device selection)
- ✅ Processing settings (provider selection, cloud/local toggle)
- ✅ API key management (Gemini, Anthropic, OpenAI)
- ✅ Persist settings to electron-store

---

### Audio Device Selection
**Status:** ✅ COMPLETE
**Reference:** `FULL_VISION/STATE_MANAGEMENT_FULL.md` (Settings Store - Audio Settings)
**Complexity:** Low

**Features:**
- ✅ List available audio input devices
- ✅ Select specific microphone
- Real-time input level visualization - NOT IMPLEMENTED
- Noise gate threshold - NOT IMPLEMENTED

---

### Toggle Mode
**Status:** ✅ COMPLETE (Push-to-talk is default, toggle available)
**Reference:** `FULL_VISION/STATE_MANAGEMENT_FULL.md` (Settings Store - Hotkey Config)
**Complexity:** Low

---

## Phase 3: Advanced Features (Weeks 7-10)

### Provider Switching (Gemini Fallback)
**Status:** ✅ COMPLETE
**Reference:** `FULL_VISION/LLM_PROVIDERS_FULL.md` (Provider Factory section)
**Complexity:** High

**Features:**
- ✅ Gemini API integration
- ✅ Anthropic Claude API integration
- ✅ OpenAI API integration
- ✅ Provider selection in settings (cloud/local toggle)
- ✅ API key secure storage (Electron safeStorage)
- ✅ Hot-swap between providers
- Automatic fallback - NOT IMPLEMENTED
- Cost estimation - NOT IMPLEMENTED

---

### IPC Validation (Zod Schemas)
**Status:** ✅ COMPLETE
**Reference:** `FULL_VISION/IPC_DESIGN_FULL.md` (Channel Definitions section)
**Complexity:** Medium

**Features:**
- ✅ Zod schema validation for IPC messages
- ✅ Type-safe IPC channels
- Error sanitization - PARTIAL
- Retry logic - NOT IMPLEMENTED

---

### State Management (Zustand)
**Status:** Deferred from MVP  
**Reference:** `FULL_VISION/STATE_MANAGEMENT_FULL.md` (entire document)  
**Complexity:** High

**Features:**
- 5 domain-driven stores (Recording, Transcription, Settings, UI, Provider)
- Middleware stack (devtools, persist, immer, subscribeWithSelector)
- Memoized selectors
- State persistence
- Subscriptions for real-time updates

**Why Deferred:**
MVP uses simple React useState. Zustand adds complexity without immediate benefit.

**Implementation Notes:**
- Migrate from useState to Zustand incrementally
- Implement stores one at a time
- Add persistence for settings store
- Use selectors to optimize re-renders

---

### WebSocket Communication
**Status:** Deferred from MVP  
**Reference:** `FULL_VISION/IPC_DESIGN_FULL.md` (WebSocket Protocol section)  
**Complexity:** High

**Features:**
- Real-time bidirectional communication
- Streaming transcription progress
- Audio level visualization
- Connection health monitoring

**Why Deferred:**
MVP uses simple stdin/stdout. WebSocket adds complexity for real-time features.

**Implementation Notes:**
- Replace subprocess stdio with WebSocket
- Implement message protocol (JSON envelope)
- Add connection lifecycle management
- Stream progress updates to UI

---

## Phase 4: Premium UI/UX (Weeks 11-14)

### Floating Pill UI
**Status:** Deferred from MVP  
**Reference:** `FULL_VISION/DESIGN_SYSTEM_FULL.md` (Floating Pill Component section)  
**Complexity:** High

**Features:**
- Minimal presence (12px dot when idle)
- Expands to pill when recording (160px × 44px)
- State-based animations (breath pulse, shimmer, success burst)
- Waveform visualization (5 bars)
- Draggable, position persists
- Success state with text preview

**Why Deferred:**
MVP uses system tray only. Floating pill is premium UX, not core functionality.

**Implementation Notes:**
- Create frameless, transparent Electron window
- Implement CSS animations (already spec'd)
- Add drag-and-drop positioning
- Persist position to settings

---

### Design System
**Status:** Deferred from MVP  
**Reference:** `FULL_VISION/DESIGN_SYSTEM_FULL.md` (entire document - 1,691 lines)  
**Complexity:** Very High

**Features:**
- Obsidian Minimalism aesthetic
- Custom color palette (Void, Smoke, Ash, Ember, Breath Spectrum)
- Typography system (JetBrains Mono + Plus Jakarta Sans)
- Component library (buttons, toggles, selects, radios)
- Animation library (breath pulse, shimmer, success burst)
- Micro-interactions

**Why Deferred:**
MVP uses basic HTML/CSS. Design system is polish, not functionality.

**Implementation Notes:**
- Implement CSS custom properties for colors
- Create component library in React
- Add animation keyframes
- Build Storybook for component showcase

---

### Waveform Visualization
**Status:** Deferred from MVP  
**Reference:** `FULL_VISION/DESIGN_SYSTEM_FULL.md` (Floating Pill - Listening State)  
**Complexity:** Medium

**Features:**
- Real-time audio level display
- 5-bar waveform with center weighting
- Animated bars (wave-bar keyframes)
- Audio level normalization

**Why Deferred:**
Visual feedback is "nice to have." MVP focuses on core functionality.

**Implementation Notes:**
- Stream audio levels from Python to Electron
- Implement waveform bars in React
- Add CSS animations
- Normalize audio levels for consistent display

---

### System Tray Enhancements
**Status:** Deferred from MVP  
**Reference:** `FULL_VISION/DESIGN_SYSTEM_FULL.md` (System Tray section)  
**Complexity:** Low

**Features:**
- Animated tray icons (pulse, rotation)
- Rich context menu
- Notification balloons
- Quick actions menu

**Why Deferred:**
MVP has basic tray icon. Enhancements are polish.

**Implementation Notes:**
- Create animated icon frames
- Implement frame cycling
- Add menu items for quick actions
- Use Electron notifications API

---

## Phase 5: Customization & Power Features (Weeks 15+)

### Custom Prompts
**Status:** Deferred from MVP  
**Reference:** `FULL_VISION/STATE_MANAGEMENT_FULL.md` (Settings Store - Custom Prompts)  
**Complexity:** Medium

**Features:**
- User-defined prompts per context mode
- Prompt template editor
- Prompt variables (e.g., {raw_text})
- Prompt library/sharing

**Why Deferred:**
Default prompts work for most users. Custom prompts are power-user feature.

**Implementation Notes:**
- Add prompt editor to settings window
- Implement template variable substitution
- Validate prompts before saving
- Add prompt reset to defaults

---

### Model Selection
**Status:** Deferred from MVP  
**Reference:** `FULL_VISION/LLM_PROVIDERS_FULL.md` (Ollama Provider - Recommended Models)  
**Complexity:** Low

**Features:**
- List installed Ollama models
- Select model per provider
- Model size/performance info
- Auto-download models

**Why Deferred:**
MVP uses hardcoded llama3:8b. Model selection is optimization.

**Implementation Notes:**
- Call Ollama API to list models
- Add model dropdown to settings
- Display model metadata (size, context length)
- Implement model download UI

---

### Whisper Model Selection
**Status:** Deferred from MVP  
**Reference:** `FULL_VISION/STATE_MANAGEMENT_FULL.md` (Settings Store - Whisper Settings)  
**Complexity:** Low

**Features:**
- Choose Whisper model size (tiny, base, small, medium, large)
- Language selection (auto-detect or specific)
- Translate to English option

**Why Deferred:**
MVP uses medium model with auto-detect. Selection is optimization.

**Implementation Notes:**
- Add Whisper settings to settings window
- Implement model switching
- Add language dropdown
- Persist settings

---

### Advanced Audio Settings
**Status:** Deferred from MVP  
**Reference:** `FULL_VISION/STATE_MANAGEMENT_FULL.md` (Settings Store - Audio Settings)  
**Complexity:** Medium

**Features:**
- Sample rate configuration
- Silence threshold tuning
- Max recording duration limit
- Voice activity detection (VAD)

**Why Deferred:**
Default settings work for most users. Advanced settings are power-user feature.

**Implementation Notes:**
- Add advanced audio settings panel
- Implement VAD for auto-stop
- Add real-time audio level meter
- Persist settings

---

### History & Clipboard
**Status:** Deferred from MVP  
**Reference:** `FULL_VISION/STATE_MANAGEMENT_FULL.md` (Transcription Store - History)  
**Complexity:** Medium

**Features:**
- Recent transcriptions history (last 50)
- Copy to clipboard
- Re-inject previous transcription
- Search history

**Why Deferred:**
MVP focuses on real-time dictation. History is convenience feature.

**Implementation Notes:**
- Store transcriptions in memory (max 50)
- Add history panel to UI
- Implement clipboard copy
- Add search/filter

---

### Performance Metrics & Monitoring
**Status:** Deferred from MVP  
**Reference:** `FULL_VISION/IPC_DESIGN_FULL.md` (Error Handling section)  
**Complexity:** Low

**Features:**
- Latency tracking per pipeline stage
- Token usage statistics
- Cost tracking (for cloud providers)
- Performance dashboard

**Why Deferred:**
MVP focuses on functionality. Metrics are optimization.

**Implementation Notes:**
- Add timing to each pipeline stage
- Log metrics to file
- Create performance dashboard
- Add cost calculator for Gemini

---

## Out of Scope (Future Consideration)

These features were mentioned in detailed docs but are not planned for any near-term phase:

- **Multi-language support** (UI localization)
- **Cloud sync** (settings, history)
- **Team features** (shared prompts, admin dashboard)
- **API/CLI** (programmatic access)
- **Plugins/extensions** (third-party integrations)
- **Speaker diarization** (multi-speaker transcription)

### Moved to V2.0 (See DEVELOPMENT_ROADMAP.md)
- **Mobile app** (iOS/Android companion - *Cloud Strategy*)
- **Browser Agent** (Hands-free navigation)

---

## V2.0: Meeting Intelligence & Long-Form Processing

> **UPDATE 2026-01-21:** This research initiative has been moved to the master roadmap.
> **See:** [DEVELOPMENT_ROADMAP.md](../../DEVELOPMENT_ROADMAP.md) Section 2.5 for complete details.

**Status:** Research Queue (Post-v1.0)
**Reference:** Granola.ai-style meeting intelligence
**Complexity:** Very High

### Concept: Meeting Companion Mode

Transform dIKtate from real-time dictation tool to intelligent meeting assistant that can:
1. Record entire meetings (30-60 minutes continuous)
2. Generate accurate transcripts
3. Cross-reference with user notes
4. Execute automated workflows based on meeting content

**Key Technical Challenges:**

#### Long-Duration Recording Stress Testing
**Status:** Infrastructure Ready (2026-01-21)
**Action Required:** Leverage automated stress test suite to validate long-form scenarios

The current stress test infrastructure (`audio_feeder.py`) can now simulate extended recordings:

```bash
# Test 30-minute meeting simulation
python python/tools/audio_feeder.py --file meeting.wav --no-simpleaudio

# Test 60-minute continuous recording
python python/tools/audio_feeder.py --last-download --no-simpleaudio --count 200
```

**Research Questions:**
1. **Model Capacity**: Can Gemma 3:4b handle 30-60 minute context windows?
   - Current: ~18s per phrase (8-10s audio chunks)
   - Meeting: Need to process 180-360 chunks
   - Test: Does the model choke on cumulative context?

2. **Memory Management**: Does Python backend maintain stability over extended sessions?
   - Current: Tested up to 100 phrases successfully
   - Meeting: Need 200-400 phrase capacity
   - Test: Monitor memory usage during extended runs

3. **Model Fallback Strategy**: When to switch from local (Gemma) to cloud (GPT-4, Claude)?
   - Hypothesis: Local models may struggle with long-context reasoning
   - Test: Compare output quality at 5min, 15min, 30min, 60min marks
   - Decision: Define threshold for automatic cloud fallback

4. **Workflow Automation**: Post-meeting action items
   - Parse meeting transcript for action items
   - Cross-reference with user notes (priority markers)
   - Generate follow-up emails, calendar events, task tickets
   - Integration: Granola-style "smart summaries"

**Proposed Testing Strategy:**
- [ ] Use existing YouTube videos (1-hour conference talks) as test data
- [ ] Run stress tests measuring: transcription quality, processing latency, memory usage
- [ ] Compare local (Gemma) vs cloud (GPT-4/Claude) on same content
- [ ] Document performance degradation thresholds
- [ ] Define when local → cloud fallback is necessary

**Dependencies:**
- ✅ Automated stress test infrastructure (RESOLVED 2026-01-21)
- ✅ TCP control protocol with state synchronization
- ⏳ Extended context window support in processing layer
- ⏳ Action item extraction pipeline
- ⏳ Workflow orchestration system

**Timeline:** Post-v1.0 launch, research phase

---

## Migration Strategy

### From MVP to Phase 2
1. Add settings window (basic)
2. Implement context mode switching
3. Add hotkey configuration
4. Enable audio device selection

### From Phase 2 to Phase 3
1. Implement Gemini provider
2. Add IPC validation (Zod)
3. Migrate to Zustand state management
4. Replace stdio with WebSocket

### From Phase 3 to Phase 4
1. Implement floating pill UI
2. Apply design system
3. Add waveform visualization
4. Enhance tray icon

### From Phase 4 to Phase 5
1. Add custom prompts
2. Implement model selection
3. Add advanced settings
4. Create history panel

---

## Reference Map

| Feature | Full Spec Location | Phase | Complexity |
|---------|-------------------|-------|------------|
| Context Modes | LLM_PROVIDERS_FULL.md | 2 | Medium |
| Hotkey Config | STATE_MANAGEMENT_FULL.md | 2 | Low |
| Settings Window | DESIGN_SYSTEM_FULL.md | 2 | Medium |
| Audio Device Selection | STATE_MANAGEMENT_FULL.md | 2 | Low |
| Toggle Mode | STATE_MANAGEMENT_FULL.md | 2 | Low |
| Gemini Provider | LLM_PROVIDERS_FULL.md | 3 | High |
| IPC Validation | IPC_DESIGN_FULL.md | 3 | Medium |
| Zustand Stores | STATE_MANAGEMENT_FULL.md | 3 | High |
| WebSocket | IPC_DESIGN_FULL.md | 3 | High |
| Floating Pill | DESIGN_SYSTEM_FULL.md | 4 | High |
| Design System | DESIGN_SYSTEM_FULL.md | 4 | Very High |
| Waveform Viz | DESIGN_SYSTEM_FULL.md | 4 | Medium |
| Custom Prompts | STATE_MANAGEMENT_FULL.md | 5 | Medium |
| Model Selection | LLM_PROVIDERS_FULL.md | 5 | Low |

---

**Total Deferred Features:** 25+  
**Total Preserved Documentation:** ~220KB of detailed specs  
**Nothing Lost:** All features planned and documented for future phases

---

## Phase 6+: Experimental Research Candidates

### Model Candidates (To Be Evaluated)
**Status:** Research Queue
**Reference:** User Request (2026-01-16)

**Candidates:**
1.  **NVIDIA Canary Qwen 2.5B**:
    -   Potential high-performance audio-understanding model.
    -   Need to evaluate: Latency vs. Accuracy on consumer hardware.
    -   Integration path: Replacement for Whisper? Or end-to-end speech-to-intent?
2.  **Granite Speech 3.3 (IBM)**:
    -   Recently released open weights.
    -   Claimed enterprise-grade performance.
    -   Need to evaluate: License compatibility and resource usage.

**Action Item:** Create a benchmarking script comparison against Whisper V3 Turbo once the MVP is stable.
