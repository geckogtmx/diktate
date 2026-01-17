# DEV_HANDOFF.md

> **Last Updated:** 2026-01-16T22:21:00
> **Last Model:** Gemini
> **Session Focus:** QA Audit, Security Fixes, LLM Benchmarking, Cloud Processing Mode

---

## ✅ Completed This Session

### Security Audit & Fixes
- **SEC-001 FIXED**: Added `sandbox: true`, `webSecurity: true`, `allowRunningInsecureContent: false` to `BrowserWindow` in `src/main.ts`
- **SEC-003 FIXED**: Changed `.format(text=text)` to `.replace("{text}", text)` in `processor.py` to prevent prompt injection
- **SEC-004 FIXED**: Gated `StreamHandler()` behind `DEBUG=1` env var in `ipc_server.py` to prevent transcript leaks
- **Created** `docs/SECURITY_AUDIT.md` — permanent audit log with 5 findings
- **Updated** `AI_CODEX.md` — added Section 4D (Security governance rules)

### LLM Benchmarking (Local Mode)
- Tested **Mistral** (~9s), **Llama3** (~7s), **Gemma3:4b** (~7s less accurate), **Qwen3:30b** (60s+ too slow)
- **Selected Llama3:latest** as default local model
- Updated prompt to prevent meta-commentary ("Here's the cleaned text:")

### Cloud Processing Mode (NEW)
- Created **dual-mode processor** (`python/core/processor.py`) with `LocalProcessor` and `CloudProcessor` classes
- Added `create_processor()` factory function that selects based on `PROCESSING_MODE` env var
- Created `.env` and `.env.example` for API configuration
- **Gemini 3 Flash Preview** working at ~2.5s processing (vs ~7s local)
- Model URL: `gemini-3-flash-preview:generateContent`

### UAT Results
- **Local mode**: ~7s processing, high accuracy, all criteria pass
- **Cloud mode**: ~2.5s processing, corrections removed, profanity preserved
- Long-form dictation (41s audio): ~20s total pipeline

## ⚠️ Known Issues / Broken

- **SEC-002 (Deferred)**: 2 npm vulnerabilities in `electron-builder` chain. Build-time only, no runtime impact.
- **Whisper censorship**: Whisper V3 Turbo censors profanity with asterisks (`f***ing`) — this is Whisper behavior, not LLM

## 🔄 In Progress / Pending

- [ ] **Clipboard paste injection** — Replace character-by-character typing with clipboard paste for ~500ms speedup
- [ ] **UI Polish**: Remove Status Window frame (`frame: false`)
- [ ] **README Update**: pnpm, V3 Turbo, packaging, cloud mode instructions
- [ ] **Package and Test**: Rebuild packaged exe with final config
- [ ] **Streaming transcription** — Transcribe while recording for perceived speed boost

## 📋 Instructions for Next Model

### Priority Order
1. **Quick win**: Implement clipboard paste in `python/core/injector.py` — use `pyperclip` with Ctrl+V
2. **UI Polish**: Set `frame: false` on Status Window in `src/main.ts`
3. **Documentation**: Update `README.md` with current state

### Context Needed
- `docs/SECURITY_AUDIT.md`: Full audit findings and status
- `python/core/processor.py`: Dual-mode processor implementation
- `.env`: Config for local vs cloud mode (`PROCESSING_MODE=local|cloud`)

### Do NOT
- Do not revert to `npm`. Stick to `pnpm`.
- Do not remove `sandbox: true` — critical Electron security
- Do not use `gemini-3-flash` (without `-preview`) — returns 404
- Do not change the strict prompt in `processor.py` — it prevents Llama3 meta-commentary

---

## Session Log (Last 3 Sessions)

### 2026-01-16 22:21 - Gemini
- QA Security Audit: 5 findings, 3 fixed
- LLM Benchmarking: Llama3 selected (~7s)
- Cloud Mode: Gemini 3 Flash Preview (~2.5s)
- UAT: All criteria pass (local + cloud)

### 2026-01-16 ~21:00 - Gemini (Previous)
- Resumed from pnpm migration, V3 Turbo, packaging
- Fixed Electron install.js issue

### 2026-01-15 - Claude
- Packaging with electron-builder
- Whisper V3 Turbo integration
- Model tuning for speed
