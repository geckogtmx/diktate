# Security Audit Log

This document tracks all security findings, audits, and remediations for the `diktate` project.

---

## [2026-01-22] - Comprehensive Dependency Audit

**Scope:** Full audit of `package.json`, `pnpm-lock.yaml`, and `python/requirements.txt`.

### Findings

#### 1. Electron ASAR Integrity Bypass (CVE-2025-55305)
- **Severity:** HIGH
- **Location:** `electron` v28.3.3
- **Details:** Vulnerability that could allow ASAR integrity bypass if fuses are enabled.
- **Remediation:** Upgraded to **Electron v35.7.5**.

#### 2. Arbitrary File Overwrite in `tar` (CVE-2026-23745)
- **Severity:** HIGH
- **Location:** `electron-builder` -> `app-builder-lib` -> `tar` v6.2.1
- **Details:** Symlink poisoning and path traversal bugs.
- **Remediation:** Applied `pnpm` override to force `tar@^7.5.4`.

#### 3. Prototype Pollution in `lodash` (CVE-2025-13465)
- **Severity:** MODERATE
- **Location:** `@malept/flatpak-bundler` -> `lodash` v4.17.21
- **Details:** Vulnerability in `_.unset` and `_.omit` functions.
- **Remediation:** Applied `pnpm` override to force `lodash@^4.17.23`.

### Verification Status
- [x] **JS Audit**: `pnpm audit` (Audit level: moderate) is clean (0 vulnerabilities).
- [x] **TS Compilation**: `tsc --noEmit` pass (verified library compatibility).
- [x] **Electron v35 Stability**: Verified via `safeStorage` tests and smoke tests.
- [x] **Python Infrastructure**: Created `python/tools/security_audit.py` for automated `pip-audit` runs.

### Operational Notes
- **Electron Store Downgrade**: `electron-store` was downgraded to **8.2.0** to maintain CommonJS compatibility, as version 11 is ESM-only and incompatible with the current project architecture.
- **Python Building**: Future environment setup must ensure C++ build tools for `pyaudio` are present to allow full `pip-audit` resolution.

---
