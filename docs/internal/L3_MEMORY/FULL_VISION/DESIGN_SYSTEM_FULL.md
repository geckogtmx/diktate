# dIKtate Design System

> **Design Philosophy**: *Breath Made Visible*

The name dIKtate derives from "Ik"—the Mayan word for wind, breath, and life. This design system embodies that essence: invisible power made tangible, ephemeral voice crystallized into permanent text. The interface should feel like capturing smoke—delicate, precise, almost magical.

---

## 1. Design Philosophy

### Aesthetic Direction: **Obsidian Minimalism**

dIKtate embraces a design language we call **Obsidian Minimalism**—the luxury of volcanic glass. Deep, near-black surfaces with subtle iridescent accents that catch light like polished obsidian. Every element feels carved from darkness, revealing inner luminosity only through interaction.

**Core Principles:**

1. **Invisible Until Needed** — The interface disappears completely when not active. No persistent chrome. No visual noise. Pure presence when summoned.

2. **State Through Light, Not Shape** — Rather than changing form dramatically, the UI breathes through luminosity. Recording pulses with inner light. Processing shimmers. Success radiates briefly, then fades.

3. **Precision Over Decoration** — Every pixel serves purpose. Micro-interactions are crisp, never bouncy. Transitions are swift and intentional—silk, not rubber.

4. **Voice as Visual Metaphor** — Sound waves, breath patterns, and acoustic phenomena inform visual language. Ripples. Resonance. Amplitude.

### Color Palette

```
OBSIDIAN CORE
├── Void          #0A0A0B    — Primary background, true absence
├── Smoke         #141416    — Elevated surfaces
├── Ash           #1E1E21    — Borders, dividers
└── Ember         #2A2A2E    — Hover states

BREATH SPECTRUM (Accent Colors)
├── Whisper       #6366F1    — Primary accent (indigo)
├── Pulse         #8B5CF6    — Recording state (violet)
├── Aurora        #06B6D4    — Processing state (cyan)
└── Verdant       #10B981    — Success state (emerald)

SMOKE TONES (Text Hierarchy)
├── Bone          #F4F4F5    — Primary text
├── Chalk         #A1A1AA    — Secondary text
├── Graphite      #52525B    — Tertiary/disabled
└── Soot          #27272A    — Placeholder text

DANGER
└── Scarlet       #EF4444    — Error states
```

**Gradient Definitions:**

```css
/* Recording state - warm pulse */
--gradient-pulse: radial-gradient(
  ellipse at 50% 50%,
  rgba(139, 92, 246, 0.4) 0%,
  rgba(99, 102, 241, 0.2) 50%,
  transparent 70%
);

/* Processing state - cool shimmer */
--gradient-process: linear-gradient(
  135deg,
  rgba(6, 182, 212, 0.3) 0%,
  rgba(99, 102, 241, 0.2) 50%,
  rgba(6, 182, 212, 0.3) 100%
);

/* Success state - verdant burst */
--gradient-success: radial-gradient(
  circle at 50% 50%,
  rgba(16, 185, 129, 0.5) 0%,
  rgba(16, 185, 129, 0) 70%
);
```

### Typography

**Display Font: JetBrains Mono**
- Used for: Status text, keyboard shortcuts, technical labels
- Weight: 500 (Medium), 700 (Bold)
- Character: Monospace precision, engineered for clarity
- Rationale: Reinforces the technical/developer nature while remaining highly legible

**Body Font: Plus Jakarta Sans**
- Used for: Settings labels, descriptions, UI text
- Weights: 400 (Regular), 500 (Medium), 600 (SemiBold)
- Character: Geometric yet warm, premium feel without coldness
- Rationale: Distinctive alternative to overused Inter/Roboto, excellent at small sizes

**Type Scale:**

```
--text-xs:    0.75rem   / 12px   — Micro labels
--text-sm:    0.875rem  / 14px   — Secondary text
--text-base:  1rem      / 16px   — Body text
--text-lg:    1.125rem  / 18px   — Emphasized text
--text-xl:    1.25rem   / 20px   — Section headers
--text-2xl:   1.5rem    / 24px   — Page headers
```

**Letter Spacing:**

```
--tracking-tight:   -0.02em   — Headlines
--tracking-normal:  0         — Body
--tracking-wide:    0.05em    — All caps labels
--tracking-mono:    0.02em    — Monospace text
```

---

## 2. Floating Pill Component

The Floating Pill is the soul of dIKtate's interface—a minimal presence that communicates state through light and subtle animation rather than drastic shape changes.

### Dimensions

```
BASE MEASUREMENTS
├── Idle:       12px × 12px (dot)
├── Active:     160px × 44px (expanded pill)
├── Border:     1px
└── Corner:     22px (fully rounded)

POSITIONING
├── Default:    Center-top of screen
├── Margin:     24px from top edge
├── Z-index:    2147483647 (always on top)
└── Draggable:  Yes, position persists
```

### State: Idle

**Visual Specification:**
- **Shape**: Perfect circle, 12px diameter
- **Background**: `#141416` (Smoke) with 80% opacity
- **Border**: 1px `#2A2A2E` (Ember)
- **Shadow**: `0 2px 8px rgba(0, 0, 0, 0.4)`
- **Opacity**: 60% (subtle presence)

**Behavior:**
- Fades in 200ms after app launch
- On hover: Opacity increases to 100%, subtle glow appears
- Click opens quick menu (mode selection)
- Drag to reposition

```css
.floating-pill--idle {
  width: 12px;
  height: 12px;
  background: rgba(20, 20, 22, 0.8);
  border: 1px solid var(--ember);
  border-radius: 50%;
  opacity: 0.6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.floating-pill--idle:hover {
  opacity: 1;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.4),
    0 0 20px rgba(99, 102, 241, 0.15);
}
```

### State: Listening (Recording)

**Visual Specification:**
- **Shape**: Pill, 160px × 44px
- **Background**: `#141416` (Smoke)
- **Border**: 1px with animated gradient (Whisper → Pulse)
- **Inner Glow**: Pulsing radial gradient from center
- **Shadow**: `0 4px 24px rgba(139, 92, 246, 0.3)`

**Content:**
- Waveform visualization (5 bars, center-weighted)
- Status text: "Listening..." in JetBrains Mono
- Duration counter: "0:03" format

**Animation - Breath Pulse:**
```css
@keyframes breath-pulse {
  0%, 100% {
    box-shadow:
      0 4px 24px rgba(139, 92, 246, 0.2),
      inset 0 0 30px rgba(139, 92, 246, 0.05);
  }
  50% {
    box-shadow:
      0 4px 24px rgba(139, 92, 246, 0.4),
      inset 0 0 40px rgba(139, 92, 246, 0.15);
  }
}

.floating-pill--listening {
  width: 160px;
  height: 44px;
  background: var(--smoke);
  border: 1px solid var(--pulse);
  border-radius: 22px;
  animation: breath-pulse 2s ease-in-out infinite;
}
```

**Animation - Waveform Bars:**
```css
@keyframes wave-bar {
  0%, 100% { transform: scaleY(0.3); }
  50% { transform: scaleY(1); }
}

.waveform-bar {
  width: 3px;
  height: 20px;
  background: var(--pulse);
  border-radius: 1.5px;
  transform-origin: center;
}

.waveform-bar:nth-child(1) { animation: wave-bar 0.8s ease-in-out infinite; }
.waveform-bar:nth-child(2) { animation: wave-bar 0.6s ease-in-out infinite 0.1s; }
.waveform-bar:nth-child(3) { animation: wave-bar 0.5s ease-in-out infinite 0.05s; }
.waveform-bar:nth-child(4) { animation: wave-bar 0.6s ease-in-out infinite 0.15s; }
.waveform-bar:nth-child(5) { animation: wave-bar 0.8s ease-in-out infinite 0.1s; }
```

**Transition (Idle → Listening):**
- Duration: 300ms
- Easing: `cubic-bezier(0.34, 1.56, 0.64, 1)` (slight overshoot)
- Sequence: Scale up → Fade in content → Start animations

### State: Processing

**Visual Specification:**
- **Shape**: Pill, 160px × 44px (maintains size from Listening)
- **Background**: `#141416` with shimmer overlay
- **Border**: Animated gradient rotation (Aurora → Whisper → Aurora)
- **Shadow**: `0 4px 24px rgba(6, 182, 212, 0.25)`

**Content:**
- Circular spinner (16px) with segmented arc
- Status text: "Processing..." in JetBrains Mono
- Shimmer effect across entire surface

**Animation - Border Rotation:**
```css
@keyframes border-rotate {
  0% { --border-angle: 0deg; }
  100% { --border-angle: 360deg; }
}

.floating-pill--processing {
  background: var(--smoke);
  border: 1px solid transparent;
  background-image:
    linear-gradient(var(--smoke), var(--smoke)),
    conic-gradient(
      from var(--border-angle),
      var(--aurora) 0%,
      var(--whisper) 50%,
      var(--aurora) 100%
    );
  background-origin: border-box;
  background-clip: padding-box, border-box;
  animation: border-rotate 2s linear infinite;
}
```

**Animation - Shimmer:**
```css
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.floating-pill--processing::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(6, 182, 212, 0.1) 50%,
    transparent 100%
  );
  animation: shimmer 1.5s ease-in-out infinite;
}
```

**Transition (Listening → Processing):**
- Duration: 200ms
- Waveform fades out (100ms), spinner fades in (100ms)
- Border color shifts smoothly to cyan

### State: Success

**Visual Specification:**
- **Shape**: Pill, expands to fit text preview (max 280px × 44px)
- **Background**: `#141416` with verdant inner glow
- **Border**: 1px `#10B981` (Verdant)
- **Shadow**: `0 4px 24px rgba(16, 185, 129, 0.3)`

**Content:**
- Checkmark icon (16px, animated stroke)
- Text preview: Truncated to ~30 chars with ellipsis
- Character count: "142 chars" in secondary text

**Animation - Check Stroke:**
```css
@keyframes check-stroke {
  0% { stroke-dashoffset: 24; }
  100% { stroke-dashoffset: 0; }
}

.success-check {
  stroke: var(--verdant);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 24;
  stroke-dashoffset: 24;
  animation: check-stroke 300ms ease-out forwards;
}
```

**Animation - Success Burst:**
```css
@keyframes success-burst {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

.floating-pill--success::after {
  content: '';
  position: absolute;
  inset: -10px;
  border-radius: 32px;
  background: var(--gradient-success);
  animation: success-burst 400ms ease-out forwards;
  pointer-events: none;
}
```

**Transition (Processing → Success → Idle):**
- Processing → Success: 150ms crossfade
- Success holds for 2000ms (configurable)
- Success → Idle: 400ms scale down + fade

```css
@keyframes success-to-idle {
  0% {
    width: var(--current-width);
    height: 44px;
    opacity: 1;
  }
  100% {
    width: 12px;
    height: 12px;
    opacity: 0.6;
  }
}
```

### Component Structure (React)

```tsx
// FloatingPill.tsx
interface FloatingPillProps {
  state: 'idle' | 'listening' | 'processing' | 'success';
  duration?: number;      // Recording duration in seconds
  previewText?: string;   // Success state text preview
  charCount?: number;     // Character count for success
  onModeChange?: (mode: ContextMode) => void;
}

// Internal state machine handles transitions
// All animations are CSS-driven for performance
// Position persisted to localStorage
```

---

## 3. Settings Window

The Settings window is a frameless, dark interface that feels like a premium control panel. It should communicate power and precision.

### Window Properties

```
DIMENSIONS
├── Width:      480px
├── Height:     600px (expandable to 720px)
├── Min Width:  400px
├── Min Height: 500px

APPEARANCE
├── Background: #0A0A0B (Void)
├── Border:     1px #1E1E21 (Ash)
├── Radius:     12px
├── Shadow:     0 25px 50px rgba(0, 0, 0, 0.5)

BEHAVIOR
├── Frameless:  Yes
├── Draggable:  Title bar region
├── Resizable:  Vertical only
└── Position:   Centered on primary display
```

### Layout Structure

```
┌──────────────────────────────────────────────────────────────┐
│  ● ● ●                    dIKtate Settings                   │ ← Title Bar (32px)
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ Navigation ──────────────────────────────────────────┐   │
│  │  [General]  [Audio]  [Processing]  [Shortcuts]        │   │ ← Tab Bar (48px)
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Content Area ────────────────────────────────────────┐   │
│  │                                                       │   │
│  │  SECTION HEADER                                       │   │
│  │  ─────────────────────────────────────────────────    │   │
│  │                                                       │   │
│  │  Setting Label                                        │   │
│  │  Description text here                                │   │
│  │  [  Control Component  ]                              │   │
│  │                                                       │   │
│  │  ─────────────────────────────────────────────────    │   │
│  │                                                       │   │ ← Scrollable (Variable)
│  │  Setting Label                                        │   │
│  │  Description text here                                │   │
│  │  [  Control Component  ]                              │   │
│  │                                                       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Footer ──────────────────────────────────────────────┐   │
│  │  v0.1.0         [Reset Defaults]      [Save & Close]  │   │ ← Footer (56px)
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Section: General

```
GENERAL SETTINGS

Activation Mode
Choose how you want to trigger dictation
┌──────────────────────────────────────────────────────────┐
│  ○ Push-to-Talk    Hold hotkey while speaking            │
│  ● Toggle          Press to start, press again to stop   │
└──────────────────────────────────────────────────────────┘

Context Mode
How your speech is processed and formatted
┌──────────────────────────────────────────────────────────┐
│  ▼ Standard                                              │
│    ├── Standard — Fix grammar, punctuation               │
│    ├── Developer — Code-friendly formatting              │
│    ├── Email — Professional prose expansion              │
│    └── Raw — Literal transcription only                  │
└──────────────────────────────────────────────────────────┘

Launch at Startup
Start dIKtate when Windows starts
┌──────────────────────────────────────────────────────────┐
│  [ ● ]  Enabled                                          │
└──────────────────────────────────────────────────────────┘
```

### Section: Audio

```
AUDIO SETTINGS

Input Device
Select your microphone
┌──────────────────────────────────────────────────────────┐
│  ▼ Blue Yeti X (USB Audio)                               │
│    ├── System Default                                     │
│    ├── Blue Yeti X (USB Audio)                           │
│    ├── Webcam Microphone (HD Pro)                        │
│    └── Realtek Audio                                      │
└──────────────────────────────────────────────────────────┘

Input Level
Real-time visualization of microphone input
┌──────────────────────────────────────────────────────────┐
│  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  -12dB  │
└──────────────────────────────────────────────────────────┘

Noise Gate Threshold
Minimum level to start recording (reduces background noise)
┌──────────────────────────────────────────────────────────┐
│  ●────────────────────○                           -40dB  │
└──────────────────────────────────────────────────────────┘

[Test Microphone]
```

### Section: Processing

```
PROCESSING SETTINGS

LLM Provider
Choose your text processing backend
┌──────────────────────────────────────────────────────────┐
│  ○ Ollama (Local)     Private, requires GPU              │
│  ● Gemini (Cloud)     Fast, requires API key             │
└──────────────────────────────────────────────────────────┘

── Ollama Settings ────────────────────────────────────────

Model
┌──────────────────────────────────────────────────────────┐
│  ▼ llama3:8b                                             │
│    ├── llama3:8b — Balanced performance                  │
│    ├── llama3:70b — Higher quality (slow)                │
│    ├── phi3:mini — Fast, lower VRAM                      │
│    └── mistral:7b — Good for prose                       │
└──────────────────────────────────────────────────────────┘

Status: ● Connected  |  [Refresh Models]

── OR ─────────────────────────────────────────────────────

── Gemini Settings ────────────────────────────────────────

API Key
┌──────────────────────────────────────────────────────────┐
│  ●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●          [Show] [?]  │
└──────────────────────────────────────────────────────────┘

Status: ● Valid  |  [Test Connection]
```

### Section: Shortcuts

```
KEYBOARD SHORTCUTS

Global Hotkey
Activates dictation from any application
┌──────────────────────────────────────────────────────────┐
│  [ Ctrl + Shift + Space ]              [Record New]      │
└──────────────────────────────────────────────────────────┘
Press any key combination to set...

Quick Mode Switch
Cycle through context modes
┌──────────────────────────────────────────────────────────┐
│  [ Ctrl + Shift + M ]                  [Record New]      │
└──────────────────────────────────────────────────────────┘

Cancel Recording
Abort current recording without processing
┌──────────────────────────────────────────────────────────┐
│  [ Escape ]                            [Record New]      │
└──────────────────────────────────────────────────────────┘
```

### Component Specifications

**Tab Button:**
```css
.tab-button {
  padding: 12px 20px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: var(--chalk);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  transition: all 150ms ease;
}

.tab-button:hover {
  color: var(--bone);
}

.tab-button--active {
  color: var(--whisper);
  border-bottom-color: var(--whisper);
}
```

**Select Dropdown:**
```css
.select {
  width: 100%;
  padding: 12px 16px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 14px;
  color: var(--bone);
  background: var(--smoke);
  border: 1px solid var(--ash);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 150ms ease;
}

.select:hover {
  border-color: var(--ember);
}

.select:focus {
  border-color: var(--whisper);
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}
```

**Toggle Switch:**
```css
.toggle {
  width: 44px;
  height: 24px;
  background: var(--ash);
  border-radius: 12px;
  padding: 2px;
  cursor: pointer;
  transition: background 200ms ease;
}

.toggle--active {
  background: var(--whisper);
}

.toggle-knob {
  width: 20px;
  height: 20px;
  background: var(--bone);
  border-radius: 50%;
  transform: translateX(0);
  transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle--active .toggle-knob {
  transform: translateX(20px);
}
```

**Radio Group:**
```css
.radio {
  width: 18px;
  height: 18px;
  border: 2px solid var(--ash);
  border-radius: 50%;
  position: relative;
  cursor: pointer;
  transition: border-color 150ms ease;
}

.radio:hover {
  border-color: var(--chalk);
}

.radio--checked {
  border-color: var(--whisper);
}

.radio--checked::after {
  content: '';
  position: absolute;
  inset: 3px;
  background: var(--whisper);
  border-radius: 50%;
  animation: radio-fill 150ms ease-out;
}

@keyframes radio-fill {
  from { transform: scale(0); }
  to { transform: scale(1); }
}
```

**Button - Primary:**
```css
.button-primary {
  padding: 12px 24px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--void);
  background: var(--whisper);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 150ms ease;
}

.button-primary:hover {
  background: #7c7ff5;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.button-primary:active {
  transform: translateY(0);
}
```

**Button - Secondary:**
```css
.button-secondary {
  padding: 12px 24px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: var(--chalk);
  background: transparent;
  border: 1px solid var(--ash);
  border-radius: 8px;
  cursor: pointer;
  transition: all 150ms ease;
}

.button-secondary:hover {
  border-color: var(--chalk);
  color: var(--bone);
}
```

**Hotkey Capture Field:**
```css
.hotkey-field {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  letter-spacing: 0.02em;
  color: var(--whisper);
  background: var(--smoke);
  border: 1px solid var(--ash);
  border-radius: 8px;
  transition: all 150ms ease;
}

.hotkey-field--recording {
  border-color: var(--pulse);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
  animation: hotkey-pulse 1s ease-in-out infinite;
}

@keyframes hotkey-pulse {
  0%, 100% { border-color: var(--pulse); }
  50% { border-color: var(--whisper); }
}
```

---

## 4. System Tray

### Icon States

All icons are 16x16px with 32x32px retina variants. Icons use a single-weight line style (1.5px stroke) on transparent background.

**Icon: Idle**
```
Design: Stylized soundwave forming the letter "d"
Color: #A1A1AA (Chalk)
State: Static
```

**Icon: Listening**
```
Design: Same soundwave, animated pulse
Color: #8B5CF6 (Pulse)
Animation: 3-frame pulse loop at 500ms interval
```

**Icon: Processing**
```
Design: Circular arrows forming refresh symbol
Color: #06B6D4 (Aurora)
Animation: Continuous rotation, 1 revolution per 1.5s
```

**Icon: Error**
```
Design: Soundwave with X overlay
Color: #EF4444 (Scarlet)
State: Static with brief flash on error
```

**Icon: Disabled**
```
Design: Soundwave with slash through
Color: #52525B (Graphite)
State: Static
```

### Context Menu Structure

```
┌────────────────────────────────────────┐
│  dIKtate                               │  ← Header (disabled, info only)
│  ──────────────────────────────────    │
│  ● Standard Mode                       │  ← Radio group
│  ○ Developer Mode                      │     (current mode checked)
│  ○ Email Mode                          │
│  ○ Raw Mode                            │
│  ──────────────────────────────────    │
│  ◷ Last: "The quick brown fox..."      │  ← Last dictation preview
│  ──────────────────────────────────    │
│  ⚙ Settings...            Ctrl+,       │  ← Opens settings window
│  ──────────────────────────────────    │
│  ⏸ Pause dIKtate                       │  ← Toggles disable state
│  ──────────────────────────────────    │
│  ✕ Quit                   Ctrl+Q       │
└────────────────────────────────────────┘
```

### Menu Styling

```css
/* System tray menu follows OS conventions but with custom colors where supported */

.tray-menu {
  background: var(--smoke);
  border: 1px solid var(--ash);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  padding: 4px 0;
  min-width: 220px;
}

.tray-menu-item {
  padding: 8px 16px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 13px;
  color: var(--bone);
  cursor: default;
}

.tray-menu-item:hover {
  background: var(--ember);
}

.tray-menu-item--checked::before {
  content: '●';
  color: var(--whisper);
  margin-right: 8px;
}

.tray-menu-separator {
  height: 1px;
  background: var(--ash);
  margin: 4px 12px;
}

.tray-menu-shortcut {
  float: right;
  color: var(--graphite);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
```

---

## 5. Micro-interactions

### Hover States

**Elevation on Hover:**
```css
/* Cards, buttons, and interactive elements lift subtly on hover */
.hoverable {
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.hoverable:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}
```

**Glow on Hover:**
```css
/* Primary interactive elements gain subtle glow */
.glow-hover {
  transition: box-shadow 200ms ease;
}

.glow-hover:hover {
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);
}
```

**Border Highlight:**
```css
/* Form fields and containers brighten border on hover */
.border-hover {
  border-color: var(--ash);
  transition: border-color 150ms ease;
}

.border-hover:hover {
  border-color: var(--ember);
}
```

### Focus States

**Focus Ring:**
```css
/* Keyboard focus shows clear ring without affecting layout */
.focusable:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--void), 0 0 0 4px var(--whisper);
}

.focusable:focus:not(:focus-visible) {
  box-shadow: none;
}
```

### Click/Press Feedback

**Button Press:**
```css
.button:active {
  transform: scale(0.98);
  transition: transform 50ms ease;
}
```

**Toggle Snap:**
```css
/* Toggle switch has satisfying snap with micro-bounce */
.toggle-knob {
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### State Transitions

**Loading Shimmer:**
```css
@keyframes shimmer-loading {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.loading-shimmer {
  background: linear-gradient(
    90deg,
    var(--smoke) 0%,
    var(--ash) 50%,
    var(--smoke) 100%
  );
  background-size: 200% 100%;
  animation: shimmer-loading 1.5s ease-in-out infinite;
}
```

**Error Shake:**
```css
@keyframes error-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

.error-shake {
  animation: error-shake 400ms ease-out;
}
```

**Success Pulse:**
```css
@keyframes success-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
  }
  70% {
    box-shadow: 0 0 0 12px rgba(16, 185, 129, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
  }
}

.success-pulse {
  animation: success-pulse 600ms ease-out;
}
```

**Fade In/Out:**
```css
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

.fade-in { animation: fade-in 200ms ease-out; }
.fade-out { animation: fade-out 200ms ease-in; }
```

**Scale In (for modals, tooltips):**
```css
@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.scale-in {
  animation: scale-in 200ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Notification Toast

**Visual Specification:**
```
DIMENSIONS
├── Width:      320px (max)
├── Height:     Auto (min 56px)
├── Padding:    16px
├── Radius:     10px

POSITIONING
├── Location:   Bottom-right of screen
├── Margin:     24px from edges
├── Stack:      Multiple toasts stack upward
```

**Animation:**
```css
@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(100%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes toast-out {
  from {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateX(100%) scale(0.9);
  }
}

.toast {
  animation: toast-in 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast--exiting {
  animation: toast-out 200ms ease-in forwards;
}
```

---

## 6. Accessibility

### Keyboard Navigation

**Global Shortcuts:**
| Action | Default Shortcut | Customizable |
|--------|------------------|--------------|
| Activate Dictation | `Ctrl + Shift + Space` | Yes |
| Cancel Recording | `Escape` | Yes |
| Cycle Context Mode | `Ctrl + Shift + M` | Yes |
| Open Settings | `Ctrl + ,` | No |
| Quit Application | `Ctrl + Q` | No |

**Settings Window Navigation:**
| Action | Shortcut |
|--------|----------|
| Next Tab | `Ctrl + Tab` |
| Previous Tab | `Ctrl + Shift + Tab` |
| Save & Close | `Ctrl + S` |
| Cancel & Close | `Escape` |
| Navigate Fields | `Tab` / `Shift + Tab` |
| Toggle/Select | `Space` / `Enter` |

**Focus Order:**
1. All interactive elements must be reachable via Tab
2. Focus order follows visual layout (top-to-bottom, left-to-right)
3. Modal dialogs trap focus within until dismissed
4. Focus returns to trigger element when modal closes

**Focus Indicators:**
```css
/* Always visible focus ring for keyboard navigation */
:focus-visible {
  outline: 2px solid var(--whisper);
  outline-offset: 2px;
}

/* Remove default browser outline */
:focus:not(:focus-visible) {
  outline: none;
}
```

### Screen Reader Support

**ARIA Labels:**
```tsx
// Floating Pill
<div
  role="status"
  aria-live="polite"
  aria-label={`dIKtate is ${state}`}
  aria-describedby={state === 'listening' ? 'recording-duration' : undefined}
>
  {state === 'listening' && (
    <span id="recording-duration" className="sr-only">
      Recording for {duration} seconds
    </span>
  )}
</div>

// Toggle Switch
<button
  role="switch"
  aria-checked={enabled}
  aria-label="Launch at startup"
>
  <span className="sr-only">
    {enabled ? 'Enabled' : 'Disabled'}
  </span>
</button>

// Dropdown
<select
  aria-label="Context mode"
  aria-describedby="context-mode-description"
>
  <option value="standard">Standard - Fix grammar and punctuation</option>
  ...
</select>
<span id="context-mode-description" className="sr-only">
  Choose how your speech is processed and formatted
</span>
```

**Status Announcements:**
```tsx
// Announce state changes to screen readers
const announcements = {
  listening: 'Recording started. Speak now.',
  processing: 'Processing your speech.',
  success: (chars: number) => `Done. ${chars} characters typed.`,
  error: (msg: string) => `Error: ${msg}`,
};

// Use aria-live region for dynamic updates
<div aria-live="assertive" aria-atomic="true" className="sr-only">
  {announcement}
</div>
```

**Screen Reader Only Class:**
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### High Contrast Mode

**Detection:**
```css
@media (prefers-contrast: more) {
  :root {
    --void: #000000;
    --smoke: #0a0a0a;
    --ash: #333333;
    --ember: #555555;
    --bone: #ffffff;
    --chalk: #e0e0e0;
    --graphite: #808080;
    --whisper: #6699ff;
    --pulse: #cc66ff;
    --aurora: #00cccc;
    --verdant: #00cc66;
    --scarlet: #ff3333;
  }

  /* Increase border widths */
  .button, .input, .select, .toggle {
    border-width: 2px;
  }

  /* Ensure 4.5:1 contrast ratio minimum */
  .floating-pill {
    border-width: 2px;
  }
}
```

**Forced Colors Mode (Windows High Contrast):**
```css
@media (forced-colors: active) {
  .button-primary {
    background: ButtonFace;
    color: ButtonText;
    border: 2px solid ButtonText;
    forced-color-adjust: none;
  }

  .toggle--active {
    background: Highlight;
  }

  .floating-pill {
    border: 2px solid CanvasText;
  }

  /* Ensure icons remain visible */
  .icon {
    forced-color-adjust: auto;
  }
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  /* Keep essential state indicators */
  .floating-pill--listening {
    border-color: var(--pulse);
    /* No animation, static border shows state */
  }

  .floating-pill--processing {
    border-color: var(--aurora);
    /* Static shimmer background instead of animation */
    background: linear-gradient(
      135deg,
      var(--smoke) 0%,
      rgba(6, 182, 212, 0.1) 50%,
      var(--smoke) 100%
    );
  }
}
```

### Minimum Touch/Click Targets

```css
/* All interactive elements must be at least 44x44px for touch accessibility */
.touch-target {
  min-width: 44px;
  min-height: 44px;
  /* Visual size can be smaller, but click area must meet minimum */
}

/* For visually smaller elements, extend click area with pseudo-element */
.small-button {
  position: relative;
}

.small-button::after {
  content: '';
  position: absolute;
  inset: -8px; /* Extend click area */
}
```

---

## 7. CSS Variables

Complete theme system for consistent styling across all components.

```css
:root {
  /* ══════════════════════════════════════════════════════════════
     COLOR TOKENS
     ══════════════════════════════════════════════════════════════ */

  /* Obsidian Core - Backgrounds & Surfaces */
  --color-void: #0A0A0B;
  --color-smoke: #141416;
  --color-ash: #1E1E21;
  --color-ember: #2A2A2E;

  /* Breath Spectrum - Accent Colors */
  --color-whisper: #6366F1;
  --color-whisper-hover: #7C7FF5;
  --color-whisper-muted: rgba(99, 102, 241, 0.15);
  --color-pulse: #8B5CF6;
  --color-pulse-muted: rgba(139, 92, 246, 0.15);
  --color-aurora: #06B6D4;
  --color-aurora-muted: rgba(6, 182, 212, 0.15);
  --color-verdant: #10B981;
  --color-verdant-muted: rgba(16, 185, 129, 0.15);

  /* Smoke Tones - Text Hierarchy */
  --color-bone: #F4F4F5;
  --color-chalk: #A1A1AA;
  --color-graphite: #52525B;
  --color-soot: #27272A;

  /* Danger */
  --color-scarlet: #EF4444;
  --color-scarlet-muted: rgba(239, 68, 68, 0.15);

  /* ══════════════════════════════════════════════════════════════
     SEMANTIC COLOR ALIASES
     ══════════════════════════════════════════════════════════════ */

  --bg-primary: var(--color-void);
  --bg-secondary: var(--color-smoke);
  --bg-elevated: var(--color-ash);
  --bg-hover: var(--color-ember);

  --text-primary: var(--color-bone);
  --text-secondary: var(--color-chalk);
  --text-tertiary: var(--color-graphite);
  --text-placeholder: var(--color-soot);

  --border-default: var(--color-ash);
  --border-hover: var(--color-ember);
  --border-focus: var(--color-whisper);

  --accent-primary: var(--color-whisper);
  --accent-success: var(--color-verdant);
  --accent-warning: #F59E0B;
  --accent-error: var(--color-scarlet);

  /* State-specific accents */
  --state-idle: var(--color-chalk);
  --state-listening: var(--color-pulse);
  --state-processing: var(--color-aurora);
  --state-success: var(--color-verdant);
  --state-error: var(--color-scarlet);

  /* ══════════════════════════════════════════════════════════════
     GRADIENTS
     ══════════════════════════════════════════════════════════════ */

  --gradient-pulse: radial-gradient(
    ellipse at 50% 50%,
    rgba(139, 92, 246, 0.4) 0%,
    rgba(99, 102, 241, 0.2) 50%,
    transparent 70%
  );

  --gradient-process: linear-gradient(
    135deg,
    rgba(6, 182, 212, 0.3) 0%,
    rgba(99, 102, 241, 0.2) 50%,
    rgba(6, 182, 212, 0.3) 100%
  );

  --gradient-success: radial-gradient(
    circle at 50% 50%,
    rgba(16, 185, 129, 0.5) 0%,
    rgba(16, 185, 129, 0) 70%
  );

  --gradient-shimmer: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.05) 50%,
    transparent 100%
  );

  /* ══════════════════════════════════════════════════════════════
     TYPOGRAPHY
     ══════════════════════════════════════════════════════════════ */

  --font-display: 'JetBrains Mono', 'Fira Code', monospace;
  --font-body: 'Plus Jakarta Sans', 'Segoe UI', sans-serif;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;

  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  --tracking-tight: -0.02em;
  --tracking-normal: 0;
  --tracking-wide: 0.05em;
  --tracking-mono: 0.02em;

  /* ══════════════════════════════════════════════════════════════
     SPACING
     ══════════════════════════════════════════════════════════════ */

  --space-0: 0;
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */

  /* ══════════════════════════════════════════════════════════════
     BORDER RADIUS
     ══════════════════════════════════════════════════════════════ */

  --radius-none: 0;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;

  /* ══════════════════════════════════════════════════════════════
     SHADOWS
     ══════════════════════════════════════════════════════════════ */

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.4);
  --shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.5);

  --shadow-glow-whisper: 0 0 20px rgba(99, 102, 241, 0.2);
  --shadow-glow-pulse: 0 0 20px rgba(139, 92, 246, 0.3);
  --shadow-glow-aurora: 0 0 20px rgba(6, 182, 212, 0.25);
  --shadow-glow-verdant: 0 0 20px rgba(16, 185, 129, 0.3);

  /* Floating pill shadows by state */
  --shadow-pill-idle: 0 2px 8px rgba(0, 0, 0, 0.4);
  --shadow-pill-listening: 0 4px 24px rgba(139, 92, 246, 0.3);
  --shadow-pill-processing: 0 4px 24px rgba(6, 182, 212, 0.25);
  --shadow-pill-success: 0 4px 24px rgba(16, 185, 129, 0.3);

  /* ══════════════════════════════════════════════════════════════
     TRANSITIONS
     ══════════════════════════════════════════════════════════════ */

  --duration-instant: 50ms;
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --duration-slower: 400ms;

  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);

  --transition-colors: color var(--duration-fast) var(--ease-default),
                       background-color var(--duration-fast) var(--ease-default),
                       border-color var(--duration-fast) var(--ease-default);
  --transition-transform: transform var(--duration-fast) var(--ease-default);
  --transition-shadow: box-shadow var(--duration-normal) var(--ease-default);
  --transition-all: all var(--duration-normal) var(--ease-default);

  /* ══════════════════════════════════════════════════════════════
     Z-INDEX SCALE
     ══════════════════════════════════════════════════════════════ */

  --z-below: -1;
  --z-base: 0;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-modal: 300;
  --z-popover: 400;
  --z-tooltip: 500;
  --z-toast: 600;
  --z-floating-pill: 2147483647; /* Maximum, always on top */

  /* ══════════════════════════════════════════════════════════════
     COMPONENT-SPECIFIC TOKENS
     ══════════════════════════════════════════════════════════════ */

  /* Floating Pill */
  --pill-idle-size: 12px;
  --pill-active-width: 160px;
  --pill-active-height: 44px;
  --pill-success-max-width: 280px;
  --pill-border-radius: 22px;
  --pill-top-offset: 24px;

  /* Settings Window */
  --settings-width: 480px;
  --settings-height: 600px;
  --settings-min-width: 400px;
  --settings-min-height: 500px;
  --settings-header-height: 32px;
  --settings-tabs-height: 48px;
  --settings-footer-height: 56px;

  /* Form Controls */
  --input-height: 44px;
  --input-padding-x: 16px;
  --input-padding-y: 12px;
  --button-padding-x: 24px;
  --button-padding-y: 12px;
  --toggle-width: 44px;
  --toggle-height: 24px;
  --toggle-knob-size: 20px;
  --radio-size: 18px;
  --checkbox-size: 18px;

  /* ══════════════════════════════════════════════════════════════
     BREAKPOINTS (for responsive settings window)
     ══════════════════════════════════════════════════════════════ */

  --breakpoint-sm: 480px;
  --breakpoint-md: 640px;
  --breakpoint-lg: 800px;
}

/* ════════════════════════════════════════════════════════════════
   HIGH CONTRAST MODE OVERRIDES
   ════════════════════════════════════════════════════════════════ */

@media (prefers-contrast: more) {
  :root {
    --color-void: #000000;
    --color-smoke: #0a0a0a;
    --color-ash: #333333;
    --color-ember: #555555;
    --color-bone: #ffffff;
    --color-chalk: #e0e0e0;
    --color-graphite: #808080;
    --color-whisper: #6699ff;
    --color-pulse: #cc66ff;
    --color-aurora: #00cccc;
    --color-verdant: #00cc66;
    --color-scarlet: #ff3333;
  }
}

/* ════════════════════════════════════════════════════════════════
   REDUCED MOTION OVERRIDES
   ════════════════════════════════════════════════════════════════ */

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-instant: 0ms;
    --duration-fast: 0ms;
    --duration-normal: 0ms;
    --duration-slow: 0ms;
    --duration-slower: 0ms;
  }
}
```

---

## Appendix A: Font Loading

```html
<!-- Preconnect for performance -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- Font imports -->
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
```

```css
/* Fallback font stacks */
@font-face {
  font-family: 'Plus Jakarta Sans';
  font-display: swap;
  src: local('Plus Jakarta Sans'),
       local('PlusJakartaSans'),
       url('/fonts/PlusJakartaSans-Variable.woff2') format('woff2');
}

@font-face {
  font-family: 'JetBrains Mono';
  font-display: swap;
  src: local('JetBrains Mono'),
       local('JetBrainsMono'),
       url('/fonts/JetBrainsMono-Variable.woff2') format('woff2');
}
```

---

## Appendix B: Icon Set

All icons should be sourced from [Lucide](https://lucide.dev/) or custom-designed to match the following specifications:

| Icon | Usage | Size |
|------|-------|------|
| `mic` | Recording indicator | 16px |
| `mic-off` | Muted/disabled | 16px |
| `loader-2` | Processing spinner | 16px |
| `check` | Success confirmation | 16px |
| `x` | Close, cancel, error | 16px |
| `settings` | Settings button | 16px |
| `chevron-down` | Dropdown indicator | 12px |
| `keyboard` | Shortcut indicator | 14px |

**Icon Style:**
- Stroke width: 1.5px
- Line cap: Round
- Line join: Round
- Color: Inherit from parent (uses currentColor)

---

## Appendix C: Animation Timing Reference

| Animation | Duration | Easing | Use Case |
|-----------|----------|--------|----------|
| Hover state | 150ms | ease-default | Button, link hover |
| Focus ring | 150ms | ease-default | Keyboard focus |
| Button press | 50ms | ease-out | Click feedback |
| Toggle snap | 200ms | ease-bounce | Switch toggle |
| Pill expand | 300ms | ease-bounce | Idle → Active |
| Pill contract | 400ms | ease-default | Success → Idle |
| Modal appear | 200ms | ease-default | Settings open |
| Toast slide | 300ms | ease-bounce | Notification |
| Fade in/out | 200ms | ease-default | General transitions |
| Breath pulse | 2000ms | ease-in-out | Recording state |
| Border rotate | 2000ms | linear | Processing state |
| Shimmer | 1500ms | ease-in-out | Loading states |

---

*This design system is a living document. As dIKtate evolves, update this specification to maintain consistency across all interface elements.*
