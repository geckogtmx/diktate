# 🚀 Commercial Launch Sprint Plan

> **Goal:** Ship dikta.me V1.0 commercial release
> **Timeline:** 3-4 weeks
> **Created:** 2026-01-17

---

## Sprint 1: Core UX (Week 1)

### P0 - Settings Window
- [x] Create settings window component (Vanilla JS/HTML)
- [x] Add hotkey configuration UI
- [x] Add audio device selector (UI only)
- [x] Add processing mode selector (Cloud/Local toggle UI)
- [x] Wire up IPC for settings persistence
- [x] Store settings in electron-store

### P0 - Instant Text Injection
- [x] Implement clipboard paste in `injector.py`
- [x] Replace character-by-character with Ctrl+V (Wrapper implemented)
- [x] Restore original clipboard after paste
- [ ] Test in 5+ applications

### P0 - Cloud/Local Toggle
- [ ] Add toggle switch in status window
- [ ] Connect to `PROCESSING_MODE` env/config
- [ ] Show current mode in system tray tooltip
- [ ] Persist preference

---

## Sprint 2: Modes & Translation (Week 2)

### P1 - Personality Modes
- [ ] Implement mode prompts in `processor.py`
  - [ ] Standard (clean, professional)
  - [ ] Developer (technical, precise)
  - [ ] Email (formal, polished)
  - [ ] Prompt (LLM-ready formatting)
  - [ ] Raw (literal transcription)
  - [ ] Casual (friendly)
- [ ] Add mode selector in settings
- [ ] Add mode indicator in status window
- [ ] Persist mode preference

### P1 - Translation Modes
- [ ] Add ES→EN translation mode
- [ ] Add EN→ES translation mode
- [ ] Test with bilingual dictation
- [ ] Add language selector in settings

### P1 - Google OAuth Integration
- [ ] Research Gemini CLI OAuth flow
- [ ] Implement Google login button
- [ ] Store OAuth tokens securely
- [ ] Connect to Gemini API with user quota
- [ ] Test with free/Pro tier accounts

---

## Sprint 3: Polish & i18n (Week 3)

### P1 - Spanish UI Translation
- [ ] Set up react-i18next
- [ ] Extract all UI strings
- [ ] Create es.json translation file
- [ ] Add language switcher
- [ ] Test all UI in Spanish

### P2 - UI Polish
- [ ] Refine status window design
- [ ] Add mode indicators
- [ ] Improve error messages
- [ ] Add processing animations
- [ ] Test accessibility (keyboard navigation)

### P2 - Snippets (Basic)
- [ ] Create snippets data structure
- [ ] Add snippets management in settings
- [ ] Implement trigger phrase detection
- [ ] Test expansion in dictation flow

---

## Sprint 4: Packaging & Launch (Week 4)

### P2 - Installer
- [ ] Configure electron-builder for Windows
- [ ] Create NSIS installer
- [ ] Bundle Python backend (PyInstaller)
- [ ] Test clean install on fresh Windows
- [ ] Code sign (if certificate available)

### P3 - Website
- [ ] Create parallax landing page (HTML/Tailwind)
- [ ] Add download button
- [ ] Add pricing section
- [ ] Deploy to Cloudflare Pages
- [ ] Set up dikta.me domain

### P3 - Ko-fi Setup
- [ ] Create Ko-fi page
- [ ] Configure membership tiers (Starter, Pro)
- [ ] Configure shop items (Lifetime, Lifetime+)
- [ ] Write product descriptions
- [ ] Link from website

### P3 - Launch Prep
- [ ] Update README for users
- [ ] Create demo video/GIF
- [ ] Write Product Hunt listing
- [ ] Prep Reddit/HN posts
- [ ] Final UAT on installer

---

## 🔥 Today's Focus (Immediate)

1. [x] **Clipboard paste injection** - biggest UX win
2. [x] **Settings window skeleton** - foundation for all config
3. [x] **Mode selector** - ready for prompt mode

---

## Dependencies / Blockers

| Item | Dependency | Status |
|------|------------|--------|
| Google OAuth | Gemini CLI research | ✅ Confirmed works |
| Installer | electron-builder setup | ⏳ Needs work |
| Website | Domain (dikta.me) | ⏳ Need to purchase |
| Ko-fi | Page creation | ⏳ Not started |

---

## Success Criteria for V1.0

- [ ] Works on clean Windows install
- [ ] Cloud mode works out of box (no setup)
- [ ] Local mode works with Ollama guide
- [ ] Settings persist across restarts
- [ ] 5+ modes available
- [ ] ES/EN translation works
- [ ] Installer < 100MB (without bundled models)
- [ ] No crashes in 1-hour session

---

*This is a living document. Update as tasks complete.*
