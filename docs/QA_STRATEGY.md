# QA & Testing Strategy: The "Waal" Protocol

> **Vision:** Testing in dIKtate isn't just about finding bugs; it's about verifying **Privacy**, **Latency**, and **Architecture Integrity**.

---

## 1. The Testing Pyramid

We employ a 3-tier testing strategy tailored for the Electron + Python + AI stack.

### Tier 1: Architecture Integrity (The "Wiring")
*   **Goal:** Ensure the bridge between Electron (UI) and Python (Brain) is solid.
*   **Mechanism:**
    *   **Zod Schemas:** Strict runtime validation of all IPC messages (`src/utils/ipcSchemas.ts`). Malformed payloads are rejected *before* crossing the bridge.
    *   **Type Safety:** `Shared Types` ensure TypeScript and Python data structures remain synchronized.
    *   **Startup Smoke Test:** Automated verification of the environment (`smoke-test.cjs`). checking binary existence, port availability, and dependency health.

### Tier 2: Privacy Assurance (The "Shield")
*   **Goal:** Prove that "Private means Private".
*   **Mechanism:**
    *   **Negative Testing for Leaks:** Deliberate injection of fake API keys to verify they are **REDACTED** in logs (`docs/qa/SECURITY_VERIFICATION.md`).
    *   **Network Isolation Checks:** Verifying that `local` mode requests *never* hit external IPs.
    *   **SafeStorage Audit:** Ensuring all secrets are encrypted at rest using OS-level keychains.

### Tier 3: Performance Contracts (The "Experience")
*   **Goal:** "Thought-to-Text" must be faster than typing.
*   **Contracts:**
    *   **Latency:** < 7000ms (Total trip: Mic → Text).
    *   **UX Response:** UI must acknowledge input within < 100ms.
    *   **Injection:** Clipboard restoration must be imperceptible (< 50ms).

---

## 2. Automated Tooling

### 🛠️ The Smoke Runner
Run the full environment self-check:
```bash
node smoke-test.cjs
```
*Checks: Python Venv, Ollama Status, TypeScript Compilation, Audio Device Availability.*

### 🔍 The Log Analyzer
Verify dictation performance and privacy compliance:
```bash
/test-diktate
```
*(Uses the LLM Agent to parse logs for anomalies, leak patterns, and timing violations)*

---

## 3. Manual Verification Procedures

### Procedure A: "The Trace Probe" (Wiring Check)
1.  **Trigger:** Toggle "Cloud Mode".
2.  **Trace:**
    *   Electron: `IPC Send: settings:set { key: 'mode', value: 'cloud' }` (Validated via Zod)
    *   Python: `[CONFIG] Switching provider to: cloud`
    *   UI: Tray icon updates color.
3.  **Pass Criteria:** State consistency across all 3 layers.

### Procedure B: "The Leak Test" (Security Check)
1.  **Trigger:** Enter a fake API key `sk-TEST-LEAK-KEY` in Settings.
2.  **Action:** Force an error (Test Connection).
3.  **Audit:** Check `diktate.log`.
    *   **Fail:** "Error with key sk-TEST-LEAK-KEY"
    *   **Pass:** "Error with key sk-REDACTED..."

---

## 4. Continuous Improvement
*   **Pre-Commit (Humans):** Run `smoke-test.cjs`.
*   **Pre-Release (Agents):** Full review of `DEV_HANDOFF.md` and `AI_CODEX.md` compliance.
