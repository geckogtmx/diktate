# Security Audit Log

> **Last Audit:** 2026-01-16  
> **Status:** ACTIVE  
> **Auditor:** Gemini (Architect)

---

## Overview

This document tracks security audits, findings, and remediation status for dIKtate. It should be reviewed before any release.

---

## Audit: 2026-01-16

### Scope
- Electron main process (`src/main.ts`)
- Preload script (`src/preload.ts`)
- Python IPC server and pipeline (`python/`)
- Dependency audit (`pnpm audit`)

### Findings Summary

| ID | Category | Severity | Status | Description |
|----|----------|----------|--------|-------------|
| SEC-001 | Electron | **HIGH** | ✅ FIXED | Missing `sandbox: true` in BrowserWindow |
| SEC-002 | Dependencies | **HIGH** | ⚠️ DEFERRED | 2 npm vulns in transitive deps (electron-builder) |
| SEC-003 | Python | MEDIUM | ✅ FIXED | Prompt injection via `.format()` |
| SEC-004 | Logging | MEDIUM | ✅ FIXED | `StreamHandler()` gated behind DEBUG=1 |
| SEC-005 | IPC | LOW | OPEN | No Zod validation (acceptable for now) |

---

## SEC-001: Missing Electron Sandbox

**File:** `src/main.ts` (createDebugWindow)

**Issue:** `BrowserWindow` did not set `sandbox: true`, reducing Electron's security isolation.

**Fix:** Added `sandbox: true`, `webSecurity: true`, and `allowRunningInsecureContent: false` to webPreferences.

**Status:** ✅ FIXED (2026-01-16)

---

## SEC-002: npm Vulnerabilities  

**Issue:** `pnpm audit` reported 2 vulnerabilities (1 high, 1 moderate) in transitive dependencies of `electron-builder`.

**Attempted Fix:** Ran `pnpm update electron electron-builder` and `pnpm audit fix`. The vulnerabilities persist because they are deep transitive dependencies.

**Mitigation:** These vulnerabilities are in the *build toolchain*, not the runtime application. They do not affect end users. Monitor for upstream fixes.

**Status:** ⚠️ DEFERRED (Build-time only, not runtime)

---

## SEC-003: Prompt Injection Risk (Python)

**File:** `python/core/processor.py`

**Issue:** Using `.format(text=text)` could fail or produce unexpected results if user speech contains `{placeholder}` patterns.

**Fix:** Changed to `.replace("{text}", text)` which safely substitutes without interpreting the input as format string.

**Status:** ✅ FIXED (2026-01-16)

---

## SEC-004: Logger Leaks Transcripts

**File:** `python/ipc_server.py`

**Issue:** `StreamHandler()` outputs logs (including transcripts) to stderr. In production, this could leak sensitive user speech.

**Fix:** Gated `StreamHandler()` behind `DEBUG=1` environment variable. In production, logs only go to file.

**Status:** ✅ FIXED (2026-01-16)

---

## SEC-005: IPC Validation

**File:** `src/main.ts`

**Issue:** IPC handlers do not use Zod schemas for input validation.

**Risk:** Low, since current handlers are parameterless. Should be addressed if future handlers accept user data.

**Status:** OPEN (Acceptable for MVP)

---

## Security Checklist

Before each release, verify:

- [ ] `sandbox: true` is set on all BrowserWindows
- [ ] `nodeIntegration: false` and `contextIsolation: true` are set
- [ ] `pnpm audit` shows 0 high/critical vulnerabilities
- [ ] No secrets in `.env` are committed
- [ ] Python logs do not expose sensitive transcripts in production

---

*See also: [AI_CODEX.md](../AI_CODEX.md), [ARCHITECTURE.md](../ARCHITECTURE.md)*
