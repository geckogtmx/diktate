# AI_CODEX: Agency Governance Protocol

> **Status:** ACTIVE
> **Applies to:** All AI Agents (Gemini, Claude, et al.)
> **Project:** dIKtate

---

## 1. Prime Directive

**Ship early, iterate fast, preserve vision.**

We are building a "Department of One" ecosystem. Efficiency, clarity, and continuity are paramount. We do not just write code; we build maintainable, documented systems that survive context resetting.

## 2. Project Identity & Branding

- **Name:** `diktate`
- **Domain:** dikta.me
- **No rebrand planned** - We are running with diktate.

## 3. The Trinity Protocol

This project utilizes a multi-model collaboration strategy. Each agent has distinct roles but shares a common memory.

- **[📜 AI_CODEX](./AI_CODEX.md)**: The Constitution. Immutable rules and high-level philosophy.
- **[🧠 GEMINI.md](./GEMINI.md)**: The Architect. Context-heavy reasoning, planning, and governance.
- **[⚡ CLAUDE.md](./CLAUDE.md)**: The Builder. Precise execution, coding, and implementation.

## 4. Operational Rules

### A. Documentation First
- **Readme Sync:** `README.md` must ALWAYS reflect the current state of the project.
- **Decision Records:** Major decisions (like branding) must be documented in `docs/`.
- **Handoffs:** Never end a session without updating `DEV_HANDOFF.md`.

### B. Task Management
- **Roadmap:** `DEVELOPMENT_ROADMAP.md` is the MASTER PLAN for development direction.
- **Task Lists:** `TASKS.md` contains current sprint tasks (derived from roadmap).
- **Granularity:** Tasks should be small, verifiable steps.

### C. Coding Standards
- **Local-First:** No cloud dependencies for core functionality.
- **Types:** Strict TypeScript. No `any`.
- **Comments:** Explain *why*, not just *what*.

### D. Security
- **Audit Log:** All security findings MUST be documented in [docs/SECURITY_AUDIT.md](./docs/SECURITY_AUDIT.md).
- **Electron Hardening:** All `BrowserWindow` instances require `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`.
- **Pre-Release:** Run `pnpm audit` and resolve HIGH/CRITICAL before any release.
    
### E. Quality Assurance
- **Manual Testing:** All core changes (processor/transcriber) REQUIRE a run of the [Standard Manual Test](./docs/qa/TEST_PROCEDURE.md).
- **Performance:** Latency must remain < 7s for standard hardware.
- **Verification:** Use the `/test-diktate` workflow to verify logs.

### F. Known Bugs
- **Mode Dropdown Bug:** Mode-specific model dropdowns not populating (Settings → Modes tab)
  - **Documentation:** [docs/BUG_MODE_MODEL_DROPDOWNS.md](./docs/BUG_MODE_MODEL_DROPDOWNS.md)
  - **Priority:** Medium
  - **Workaround:** Use default model


## 5. Cross-Reference

### Document Hierarchy
```
DEVELOPMENT_ROADMAP.md  ← Master plan (development direction)
    ↓
TASKS.md                ← Current sprint tasks
DEV_HANDOFF.md          ← Session notes (ephemeral)
AI_CODEX.md             ← Governance rules (stable)
```

### Model-Specific Instructions
- [GEMINI.md](./GEMINI.md) - Architect role
- [CLAUDE.md](./CLAUDE.md) - Builder role
