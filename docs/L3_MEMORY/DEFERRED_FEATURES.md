# Deferred Features Catalog

**Purpose:** This document catalogs all features from the detailed documentation that are **not** included in the MVP, organized by implementation phase.

**Philosophy:** Nothing is lost—everything is phased. All detailed specifications are preserved in `L3_MEMORY/FULL_VISION/` for future implementation.

---

## Phase 2: Enhanced User Experience (Weeks 4-6)

### Context Modes
**Status:** Deferred from MVP  
**Reference:** `FULL_VISION/LLM_PROVIDERS_FULL.md` (Context Mode Prompts section)  
**Complexity:** Medium

**Features:**
- Developer mode (code comments, variable names, documentation)
- Email mode (professional prose expansion)
- Raw mode (no transformation, literal transcription)
- Mode switching via hotkey (Ctrl+Shift+M)

**Why Deferred:**
MVP proves core concept with Standard mode only. Additional modes add complexity without validating fundamental value proposition.

**Implementation Notes:**
- Requires prompt template system
- Needs UI for mode selection
- Should support custom prompts per mode

---

### Hotkey Configuration
**Status:** Deferred from MVP  
**Reference:** `FULL_VISION/STATE_MANAGEMENT_FULL.md` (Settings Store section)  
**Complexity:** Low

**Features:**
- User-configurable global hotkey
- Hotkey conflict detection
- Push-to-talk vs. toggle mode selection
- Quick mode switch hotkey

**Why Deferred:**
Hardcoded `Ctrl+Shift+Space` is sufficient for MVP. Configuration adds UI complexity.

**Implementation Notes:**
- Use Electron's globalShortcut API
- Persist to settings
- Validate no conflicts with system shortcuts

---

### Settings Window
**Status:** Deferred from MVP  
**Reference:** `FULL_VISION/DESIGN_SYSTEM_FULL.md` (Settings Window section)  
**Complexity:** Medium

**Features:**
- General settings (activation mode, context mode, launch at startup)
- Audio settings (device selection, input level, noise gate)
- Processing settings (provider selection, model selection)
- Shortcuts settings (hotkey configuration)

**Why Deferred:**
MVP uses hardcoded defaults. Settings window adds significant UI development time.

**Implementation Notes:**
- Create React-based settings UI
- Implement tabbed navigation
- Add form validation
- Persist settings to localStorage or file

---

### Audio Device Selection
**Status:** Deferred from MVP  
**Reference:** `FULL_VISION/STATE_MANAGEMENT_FULL.md` (Settings Store - Audio Settings)  
**Complexity:** Low

**Features:**
- List available audio input devices
- Select specific microphone
- Real-time input level visualization
- Noise gate threshold configuration

**Why Deferred:**
System default microphone works for most users. Device selection is "nice to have."

**Implementation Notes:**
- Use PyAudio to enumerate devices
- Add device selection to settings window
- Persist selected device ID

---

### Toggle Mode
**Status:** Deferred from MVP  
**Reference:** `FULL_VISION/STATE_MANAGEMENT_FULL.md` (Settings Store - Hotkey Config)  
**Complexity:** Low

**Features:**
- Tap hotkey to start recording
- Tap again to stop recording
- No need to hold key down

**Why Deferred:**
Push-to-talk is simpler and more predictable for MVP.

**Implementation Notes:**
- Add state tracking (recording on/off)
- Update hotkey handler logic
- Add setting to choose mode

---

## Phase 3: Advanced Features (Weeks 7-10)

### Provider Switching (Gemini Fallback)
**Status:** Deferred from MVP  
**Reference:** `FULL_VISION/LLM_PROVIDERS_FULL.md` (Provider Factory section)  
**Complexity:** High

**Features:**
- Gemini API integration
- Automatic fallback when Ollama unavailable
- Provider selection in settings
- Cost estimation for cloud providers
- API key secure storage

**Why Deferred:**
MVP is local-first. Gemini adds complexity and requires API key management.

**Implementation Notes:**
- Implement GeminiProvider class (already spec'd)
- Add provider factory with selection logic
- Use Electron safeStorage for API keys
- Add cost tracking

---

### IPC Validation (Zod Schemas)
**Status:** Deferred from MVP  
**Reference:** `FULL_VISION/IPC_DESIGN_FULL.md` (Channel Definitions section)  
**Complexity:** Medium

**Features:**
- Zod schema validation for all IPC messages
- Type-safe IPC channels
- Error sanitization
- Retry logic with exponential backoff

**Why Deferred:**
MVP trusts renderer process. Validation adds security but not core functionality.

**Implementation Notes:**
- Define Zod schemas for all IPC channels
- Wrap IPC handlers with validation
- Implement error sanitization
- Add retry logic for transient failures

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
- **Mobile app** (iOS/Android companion)
- **Browser extension** (Chrome, Firefox)
- **API/CLI** (programmatic access)
- **Plugins/extensions** (third-party integrations)
- **Voice commands** (beyond dictation)
- **Speaker diarization** (multi-speaker transcription)
- **Real-time collaboration** (shared dictation sessions)

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
