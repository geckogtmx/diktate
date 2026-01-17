# AI_CODEX: Agency Governance Protocol

> **Status:** ACTIVE
> **Applies to:** All AI Agents (Gemini, Claude, et al.)
> **Project:** dIKtate (Future: Waal)

---

## 1. Prime Directive

**Ship early, iterate fast, preserve vision.**

We are building a "Department of One" ecosystem. Efficiency, clarity, and continuity are paramount. We do not just write code; we build maintainable, documented systems that survive context resetting.

## 2. Project Identity & Branding

- **Current Name:** `diktate` (Use in code, MVP release v0.1.0-v0.9.x)
- **Future Name:** `Waal` (Rebrand at v1.0.0)
- **Etymology:** *Mayan* (Breath/Speech), *Metaphorical* (Privacy Wall), *Functional* (Lubricant).
- **Reference:** See [docs/BRANDING_ROADMAP.md](./docs/BRANDING_ROADMAP.md)

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
- **Task Lists:** `TASKS.md` is the SINGLE SOURCE OF TRUTH. Do not create competing task lists.
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


## 5. Cross-Reference
- For model-specific instructions, consult:
    - [GEMINI.md](./GEMINI.md)
    - [CLAUDE.md](./CLAUDE.md)
