# DEV_HANDOFF.md

> **Last Updated:** 2026-01-21 22:58
> **Last Model:** Gemini (Antigravity)
> **Session Focus:** Commercial Launch & Licensing Strategy (Lemon Squeezy Pivot)

---

## ✅ Completed This Session

- **Licensing & Protection Strategy**:
    - Integrated **Lemon Squeezy** as the Merchant of Record in both `DEVELOPMENT_ROADMAP.md` and `docs/internal/COMMERCIAL_LAUNCH_STRATEGY.md`.
    - Adopted a **"Pay What You Want"** model (Min $20, Suggested $25) to replace the previous fixed tiers.
    - Documented the **"Soft-DRM"** technical logic: `node-machine-id` fingerprinting + Lemon Squeezy License API + Local Activation Tokens.
    - Updated the roadmap to include **Azure Trusted Signing** for Windows SmartScreen clearance.
- **Roadmap Refinement**:
    - Re-organized Phase D (Distribution) to prioritize Protection & Licensing ahead of the "Ollama Sidecar" logic.
- **Commercial Strategy Alignment**:
    - Simplified the pricing section in `COMMERCIAL_LAUNCH_STRATEGY.md` to reflect the MoR benefits (automated tax handling for international/MX sales).

## 📋 Instructions for Next Model

### 🚀 Next Milestone: Licensing Implementation (Section D.2)
We have a clear technical checklist in `DEVELOPMENT_ROADMAP.md` for app protection.

### Priority Order
1. **`node-machine-id` Integration**: Add `node-machine-id` to the Electron project and verify it generates a consistent unique fingerprint on Windows.
2. **Activation UI**: Propose/build a simple splash screen or settings section where users can enter their license key.
3. **Lemon Squeezy API Logic**: Implement the `/v1/licenses/activate` call in the Electron main process.
4. **Local Persistence**: Securely store the activation token locally (e.g., in `electron-store`).

### 🔄 Context & State
- **Status**: Strategy is locked. Business logic (Tax/MoR) is offloaded to Lemon Squeezy.
- **Architecture**: Protection will be "Soft-DRM" (device-locked licenses).
- **Target**: Release v1.0 on Windows with a seamless "Pay What You Want" activation flow.

---

## Session Log (Last 3 Sessions)

### 2026-01-21 22:58 - Gemini (Antigravity)
- **Licensing**: Pivoted to Lemon Squeezy + PWYW model.
- **DRM**: Documented Soft-DRM strategy using machine fingerprinting.
- **Roadmap**: Updated Phase D with app protection checklist.

### 2026-01-21 22:35 - Gemini (Antigravity)
- **Website**: Integrated "Your Tokens" section and refined comparison benchmarks.
- **Fix**: Resolved scrollytelling highlight bug.
- **Roadmap**: Formalized the website repo split and Vercel deployment in Phase D.

### 2026-01-21 21:15 - Gemini (Antigravity)
- **Refactor**: Simplified `PROMPT_GEMMA_STANDARD` for more reliable and concise output.
- **Benchmarks**: Verified 3x speedup of local vs cloud.
- **Hardware**: Documented VRAM overflow issue on 8GB cards with multi-monitors.
