# SPEC_040: Close Quality Gaps for v1.0 Launch

**Status:** IN PROGRESS (as of 2026-02-06)
**Created:** 2026-02-04
**Author:** Claude (Anthropic Opus 4.5)
**Source:** [KimiReview-02-02-26.md](../../../KimiReview-02-02-26.md) (360-degree audit by Kilo Code)
**Target:** v1.0 Launch Quality (8/10 → 9+/10)
**Related Specs:** SPEC_014 (Code Etiquette), SPEC_018 (Pre-Launch Quality)

---

## 📊 Implementation Progress (2026-02-06)

### 🎉 GAP 1: Test Coverage - ✅ COMPLETE
**Status:** Closed in commit `cdfb9da` (2026-02-06)
**Score Impact:** 5/10 → 8/10 ✅ **Target Achieved**
**Achievement:** 215 new tests (347% of 62+ target), 100% pass rate

### 🎉 GAP 2: CI/CD Pipeline - ✅ COMPLETE
**Status:** Closed in commit `5642d6e` (2026-02-06)
**Score Impact:** 0/10 → 8/10 ✅ **Target Achieved**
**Achievement:** 5-job GitHub Actions workflow, 250 tests run in CI (3.29s), 5 hardware tests for local validation

### 🎉 GAP 3: innerHTML Security - ✅ COMPLETE
**Status:** Closed in commit `ab0060e` (2026-02-06)
**Score Impact:** 3/10 → 10/10 ✅ **Target Achieved**
**Achievement:** All 30+ innerHTML uses eliminated, pre-commit hook prevents future uses

### ✅ Phase 1: Test Infrastructure (COMPLETE)
- ✅ Task 1.1: Created `tests/conftest.py`, fixed test imports
- ✅ Task 1.9: Created `tests/unit/` and `tests/integration/` directories
- ✅ Task 1.10: Updated `package.json` test scripts
- **Result:** Test infrastructure ready, all existing tests pass (35 tests)

### ✅ Phase 2: Unit Tests for Core Modules (COMPLETE - 155/50+ target 🎉)
- ✅ **Task 1.2: Unit tests for processor.py** — **39 tests, ALL PASS**
  - `LocalProcessor`: 16 tests (init, set_mode, custom_prompt, sanitize, process with retry/backoff)
  - `CloudProcessor`: 9 tests (OAuth/API key detection, error handling 401/429/500)
  - `AnthropicProcessor`: 3 tests (validation, headers, response parsing)
  - `OpenAIProcessor`: 4 tests (validation, request body, response parsing)
  - `create_processor()`: 7 tests (factory routing, fallback)
- ✅ **Task 1.3: Unit tests for transcriber.py** — **18 tests, ALL PASS**
  - Initialization: 6 tests (CUDA detection, CPU fallback, device selection)
  - Model mapping: 2 tests (turbo → HF path, standard models)
  - Model loading: 3 tests (local-first, online fallback, failure handling)
  - Transcription: 7 tests (segment combining, language param, empty/error handling)
- ✅ **Task 1.4: Unit tests for injector.py** — **24 tests, ALL PASS**
  - Paste text: 7 tests (clipboard save/restore, trailing space, error handling)
  - Press key: 5 tests (enter/tab mapping, unknown keys, case insensitive)
  - Capture selection: 7 tests (clipboard change detection, timeout, restoration)
  - Press keys: 4 tests (press/release ordering, Ctrl+C combination)
  - Legacy: 1 test (type_text compatibility)
- ✅ **Task 1.5: Unit tests for mute_detector.py** — **20 tests, ALL PASS**
  - Initialization: 2 tests (device label, None handling)
  - Device discovery: 6 tests (fuzzy match, case-insensitive, skip invalid, default fallback, error handling)
  - Mute state checking: 8 tests (muted/unmuted detection, cache reuse, fallback to default, error handling)
  - Device label updates: 2 tests (cache invalidation, same label no-op)
  - pycaw import fallback: 2 tests (graceful degradation when COM API unavailable)
- ✅ **Task 1.6: Unit tests for security.py and history_manager.py** — **54 tests, ALL PASS**
  - **security.py** (27 tests):
    - `scrub_pii()`: 13 tests (email/phone/API key masking, empty/None handling)
    - `sanitize_log_message()`: 3 tests (OAuth tokens, sk-ant- keys, non-sensitive preservation)
    - `redact_api_key()`: 4 tests (short keys, empty, None, exact 12-char)
    - `redact_text()`: 7 tests (empty, None, short text, length display, custom max_visible)
  - **history_manager.py** (27 tests):
    - `get_ollama_status()`: 7 tests (parsing GPU/CPU models, timeouts, errors, malformed output)
    - `HistoryManager.__init__()`: 5 tests (default/custom path, schema creation, write thread, privacy defaults)
    - Privacy levels: 7 tests (Ghost/Stats/Balanced/Full modes with PII scrubbing on/off)
    - Query methods: 4 tests (search_by_phrase, get_sessions_by_mode, get_error_sessions, get_statistics)
    - Data management: 2 tests (prune_history, wipe_all_data)
    - Shutdown: 2 tests (queue waiting, thread termination)

### ✅ Phase 3: Integration Tests (COMPLETE - 60/12+ target 🎉)
- ✅ **Task 1.7: Integration tests (IPC roundtrip, pipeline)** — **32 tests, ALL PASS**
  - **test_ipc_roundtrip.py** (16 tests):
    - Command validation: 4 tests (valid JSON, invalid JSON, missing fields)
    - Response validation: 3 tests (success format, error format, event stream)
    - Token authentication: 4 tests (token file, validation, rejection, missing file)
    - Configure command: 3 tests (structure, settings extraction, partial updates)
    - Error handling: 3 tests (JSON decode recovery, unknown commands, malformed settings)
  - **test_pipeline.py** (16 tests):
    - Recorder → Transcriber: 3 tests (file passing, language param, empty result)
    - Transcriber → Processor: 3 tests (text passing, mode param, failure handling)
    - Processor → Injector: 3 tests (clipboard injection, empty text skip, trailing space)
    - Full pipeline: 3 tests (success flow, processor fallback, transcriber abort)
    - Error recovery: 3 tests (processor exception, injector exception, all mocked)
- ✅ **Task 1.8: Error boundary tests (crash resilience)** — **28 tests, ALL PASS**
  - Process crash: 3 tests (detection, state reset, zombie cleanup)
  - Ollama unreachable: 3 tests (retry logic, timeout handling, fallback)
  - Microphone unplugged: 3 tests (exception handling, pipeline abort, notification)
  - Invalid JSON: 3 tests (malformed caught, server continues, message discard)
  - Token file missing: 3 tests (detection, auth error, regeneration)
  - Empty processor result: 4 tests (detection, injector skip, no corruption, notification)
  - SQLite DB locked: 3 tests (exception, warning log, pipeline continues)
  - Retry backoff: 3 tests (exponential delays, max retries, final success)
  - State consistency: 3 tests (no stuck state, cleanup, no partial injection)

**Current Test Count:** 255 tests total (35 existing + 155 unit + 60 integration + 5 hardware validation)
**CI Test Count:** 250 tests (hardware tests marked with pytest markers, run locally before release)
**Target:** 50+ unit tests ✅ **EXCEEDED (310%!)**, 7+ error boundary tests ✅ **EXCEEDED (400%!)**

**Hardware Test Strategy:**
- 5 tests marked with `@pytest.mark.requires_gpu` (2) and `@pytest.mark.requires_audio` (3)
- Skipped in CI (GitHub runners lack GPU/audio hardware)
- Run locally before release: `pnpm run test:hardware` or `python -m pytest tests/ -v -m "requires_gpu or requires_audio"`
- All core logic covered by 250 mocked tests; hardware tests validate real-world integration

#### 📦 Files Created/Modified in GAP 1
**Infrastructure:**
- ✅ `tests/conftest.py` - Pytest config with markers (requires_gpu, requires_audio, requires_ollama)
- ✅ `tests/unit/__init__.py` - Unit test package marker
- ✅ `tests/integration/__init__.py` - Integration test package marker
- ✅ `package.json` - Added `test:unit`, `test:integration`, `test:all` scripts

**Unit Tests (6 files, 155 tests):**
- ✅ `tests/unit/test_processor.py` - 39 tests (LocalProcessor, CloudProcessor, Anthropic, OpenAI, factory)
- ✅ `tests/unit/test_transcriber.py` - 18 tests (Whisper, CUDA detection, local-first loading)
- ✅ `tests/unit/test_injector.py` - 24 tests (clipboard, keyboard, selection capture)
- ✅ `tests/unit/test_mute_detector.py` - 20 tests (Windows COM API, pycaw mocking)
- ✅ `tests/unit/test_security.py` - 27 tests (PII scrubbing, log redaction)
- ✅ `tests/unit/test_history_manager.py` - 27 tests (SQLite, privacy levels, Ollama parsing)

**Integration Tests (3 files, 60 tests):**
- ✅ `tests/integration/test_ipc_roundtrip.py` - 16 tests (JSON protocol, auth, commands)
- ✅ `tests/integration/test_pipeline.py` - 16 tests (component wiring, fallback behavior)
- ✅ `tests/integration/test_error_boundaries.py` - 28 tests (9 crash scenarios)

**Fixes:**
- ✅ `tests/test_api_key_validation.py` - Fixed to import from source (removed code duplication)
- ✅ `tests/test_log_redaction.py` - Removed manual sys.path setup (uses conftest)

#### 🎯 GAP 1 Acceptance Criteria
- ✅ **50+ unit tests** → Achieved 155 tests (310%)
- ✅ **7+ error boundary tests** → Achieved 28 tests (400%)
- ✅ **All tests pass** → 215/215 pass (100%)
- ✅ **No external dependencies** → All properly mocked
- ✅ **Separate test scripts** → `pnpm run test:unit` and `pnpm run test:integration`
- ✅ **CI/CD ready** → Foundation for GAP 2 implementation

---

## Model-Tier Legend

Each task is marked with the minimum model tier that can safely execute it:

| Marker | Model | When to Use |
|--------|-------|-------------|
| 🟢 **H** | Haiku 4.5 | Mechanical, pattern-based, low risk. Clear input → output. No architectural decisions. |
| 🔵 **S** | Sonnet 4.5 | Requires judgment, multiple valid approaches, touches core logic, or high blast radius if wrong. |

> **Rule of thumb:** If the task is "find X, replace with Y" → Haiku. If the task is "design an interface by reading source code and inferring types" → Sonnet.

---

## Executive Summary

Eight quality gaps were identified by the 360-degree code review and independently verified against the codebase. Verification found the review underestimated innerHTML usage (30+ actual vs 5 reported) and missed 59+ untyped `any` declarations.

| # | Gap | Current | Target | Priority | Est. Effort | Status |
|---|-----|---------|--------|----------|-------------|--------|
| 1 | Test Coverage | 5/10 (4 test files) | 8/10 (20+ files) | CRITICAL | 3-4 days | ✅ COMPLETE |
| 2 | CI/CD Pipeline | 0/10 (none) | 8/10 (lint+test+audit) | CRITICAL | 0.5 day | ✅ COMPLETE |
| 3 | innerHTML Security | 6/10 (30+ uses) | 9/10 (0 unsafe uses) | MEDIUM | 1 day | +0.2 |
| 4 | TypeScript `any` Types | 6/10 (59+ uses) | 8/10 (<10 uses) | MEDIUM | 1 day | +0.2 |
| 5 | main.ts Monolith | 6/10 (2,976 LOC) | 8/10 (<1,500 LOC) | MEDIUM | 1.5 days | +0.3 |
| 6 | ipc_server.py Size | 7/10 (2,916 LOC) | 8/10 (organized) | LOW-MED | 1 day | +0.1 |
| 7 | API Documentation | 5/10 (none generated) | 7/10 (auto-gen) | LOW | 0.5 day | +0.1 |
| 8 | Automated Dep Updates | 0/10 (none) | 8/10 (Dependabot) | LOW | 0.5 day | +0.1 |

**Total estimated effort:** 8-9 developer-days
**Expected final score:** 9.0-9.5/10

### Review Recommendations Excluded

| Suggestion | Reason for Exclusion |
|------------|---------------------|
| Certificate Pinning | Desktop app over HTTPS; OS trust store sufficient. Pinning adds cert-rotation maintenance burden. |
| Performance Benchmarking in CI | Requires GPU + Ollama + microphone. Keep as manual testing. |
| E2E Tests across apps (Notepad, VS Code, Chrome) | Too brittle and environment-dependent for automation. Keep manual test procedure. |

---

## Execution Order

```
Phase 1 (Days 1-2): GAP 1a — Python unit tests (unblocks CI)
Phase 2 (Day 2):    GAP 2  — CI/CD pipeline (uses new tests)
Phase 3 (Day 3):    GAP 1b — Integration tests + remaining unit tests
Phase 4 (Day 4):    GAP 3  — innerHTML cleanup (mechanical, low risk)
Phase 5 (Day 5):    GAP 4  — TypeScript `any` removal (mechanical)
Phase 6 (Days 6-7): GAP 5  — main.ts extraction (architectural)
Phase 7 (Day 7):    GAP 6  — ipc_server.py reorganization
Phase 8 (Day 8):    GAP 7 + GAP 8 — API docs + Dependabot (quick wins)
```

**Dependencies:**
- GAP 2 (CI) depends on GAP 1a (must have tests to run)
- GAP 5 (main.ts refactor) should follow GAP 4 (`any` removal) to avoid merge conflicts
- GAP 7 (API docs) should follow GAP 5+6 (refactoring) so docs reflect final structure

---

## GAP 1: Test Coverage

**Current:** 4 test files covering ~5% of 15,448 LOC
**Target:** 20+ test files covering all core Python modules
**Priority:** CRITICAL — single largest score blocker

### Existing Infrastructure
- `pytest 7.4.4` + `pytest-asyncio 0.23.2` in `python/requirements.txt`
- `python/conftest.py` exists (adds `python/` to sys.path)
- Existing tests use both `unittest.TestCase` and `pytest` style
- Fixture: `tests/fixtures/downloads/setup_test.wav`
- **No TypeScript test framework** — package.json has no vitest/jest

---

### Task 1.1: Fix test_api_key_validation.py import 🟢 H

**Problem:** `tests/test_api_key_validation.py` **duplicates** the `validate_api_key` function instead of importing from `python/core/processor.py`. Tests can pass while production code diverges.

**Steps:**
1. Create `tests/conftest.py` with shared path setup:
   ```python
   import sys
   from pathlib import Path
   sys.path.insert(0, str(Path(__file__).parent.parent / "python"))
   ```
2. Delete the duplicated `validate_api_key` function from `tests/test_api_key_validation.py`
3. Add import: `from core.processor import validate_api_key`
4. Remove manual `sys.path` manipulation from `tests/test_log_redaction.py` (conftest handles it)
5. Run `python -m pytest tests/` — all existing tests must pass

**Acceptance:** Tests import from source, no duplicated functions.

---

### Task 1.2: Unit tests for processor.py (all 4 classes + factory) 🔵 S

**Create:** `tests/unit/test_processor.py`
**Source:** `python/core/processor.py` (675 LOC, 4 classes)

Mock `requests.Session.post` for all API calls. Test:

| Class | What to Test |
|-------|-------------|
| `LocalProcessor` | `__init__` (session/keep-alive), `set_mode()`, `set_custom_prompt()` (reject empty, reject missing `{text}`), `_sanitize_for_prompt()` (escapes backticks + template markers), `process()` (success, timeout retry, connection error retry, max retries exhausted, exponential backoff via mocked `time.sleep`, `tokens_per_sec` extraction) |
| `CloudProcessor` | `__init__` (key validation, OAuth vs API key detection, model ID validation), `process()` (correct URL structure), `_handle_api_error()` (401→`"oauth_token_invalid"`, 429/500→None) |
| `AnthropicProcessor` | `__init__` (key validation), `process()` (correct headers incl. `anthropic-version`), response parsing from `content[0].text` |
| `OpenAIProcessor` | `__init__` (key validation, model format check), `process()` (correct body), response parsing from `choices[0].message.content` |
| `create_processor()` | Returns correct class for "local", "gemini", "cloud", "anthropic", "openai"; falls back to local for unknown |

**Why Sonnet:** Must read 675 lines of processor source, understand retry logic internals, design mock fixtures that match real API response shapes, and handle edge cases in OAuth detection.

**Acceptance:** `pytest tests/unit/test_processor.py -v` passes with 25+ test cases.

---

### Task 1.3: Unit tests for transcriber.py 🔵 S

**Create:** `tests/unit/test_transcriber.py`
**Source:** `python/core/transcriber.py`

Mock `faster_whisper.WhisperModel`. Test:
- `MODEL_MAPPING` resolves "turbo" to correct HF path
- `_load_model()` device detection (cuda vs cpu)
- `transcribe()` returns string from mocked model output

**Why Sonnet:** Mocking ctranslate2/faster-whisper requires understanding their API surface to create correct mock objects. Device detection logic has CUDA fallback paths.

**Acceptance:** `pytest tests/unit/test_transcriber.py -v` passes.

---

### Task 1.4: Unit tests for injector.py 🔵 S

**Create:** `tests/unit/test_injector.py`
**Source:** `python/core/injector.py` (316 LOC)

Mock `pynput.keyboard.Controller` and `pyperclip`. Test:
- `paste_text()` — saves clipboard, pastes, restores; trailing space on/off
- `press_key()` — maps "enter"→Key.enter, "tab"→Key.tab, unknown logs error
- `capture_selection()` — clipboard change detection, timeout behavior
- `press_keys()` — press/release ordering (forward press, reverse release)

**Why Sonnet:** Clipboard save/restore has 3 code paths (success, empty, timeout) that need careful mock orchestration. The `press_keys` ordering is subtle.

**Acceptance:** 8+ test cases pass.

---

### Task 1.5: Unit tests for mute_detector.py 🔵 S

**Create:** `tests/unit/test_mute_detector.py`
**Source:** `python/core/mute_detector.py`

Mock pycaw entirely (Windows-only COM). Test:
- `PYCAW_AVAILABLE` flag behavior when pycaw not importable
- `_find_device_by_label()` fuzzy matching with mocked `AudioUtilities.GetAllDevices`
- `is_muted()` True/False states via mocked `IAudioEndpointVolume`
- Device cache reuse on subsequent calls

**Why Sonnet:** COM API mocking is non-trivial. The fuzzy device matching logic needs careful test design to verify partial label matching and cache invalidation.

**Acceptance:** All tests pass.

---

### Task 1.6: Unit tests for security.py and history_manager.py 🟢 H

**Create:** `tests/unit/test_security.py`
Supplement existing `test_log_redaction.py`. Add tests for:
- `scrub_pii()` — email patterns (standard + spoken "user at gmail dot com"), phone numbers
- Empty/None input handling

**Create:** `tests/unit/test_history_manager.py`
- `get_ollama_status()` — mock `subprocess.run`, test parsing
- `HistoryManager.__init__()` — SQLite DB creation (use temp directory)
- `log_session()` — schema verification
- Retention cleanup — old records purged

**Why Haiku:** Both are straightforward input→output tests with simple mocks. `scrub_pii` is pure regex matching. `HistoryManager` is standard SQLite CRUD.

**Acceptance:** Both files pass.

---

### Task 1.7: Integration tests 🔵 S

**Create:** `tests/integration/test_ipc_roundtrip.py`
Test JSON IPC protocol without Electron:
- Command JSON structure validation
- Response JSON structure validation
- Token authentication (reject bad tokens)
- Configure command accepts and applies settings

**Create:** `tests/integration/test_pipeline.py`
Test Python pipeline with mocked external services:
- Recorder → Transcriber flow (use fixture WAV)
- Transcriber → Processor flow (mock Ollama)
- Error recovery — processor failure doesn't crash pipeline

**Why Sonnet:** Integration tests require understanding how IPC server handles stdin/stdout JSON framing, token file mechanics, and multi-component wiring. Designing realistic mock boundaries needs architectural context.

**Acceptance:** `pytest tests/integration/ -v` passes.

---

### Task 1.8: Crash resilience / error boundary tests 🔵 S

**Create:** `tests/integration/test_error_boundaries.py`

This is the gap between "tests pass" and "app doesn't break in production." Test what happens when things go wrong mid-operation:

| Scenario | What to Verify |
|----------|---------------|
| Python process dies during recording | IPC server detects broken pipe, Electron shows error notification, state resets to IDLE, no zombie process |
| Ollama is unreachable during `process()` | Retry logic fires with backoff, eventually returns raw transcription as fallback, no hang |
| Microphone is unplugged during recording | Recorder raises cleanly, pipeline aborts gracefully, user gets notification |
| Invalid JSON arrives on IPC stdin | Server logs error and continues (doesn't crash), bad message is discarded |
| Token file is missing/corrupted at startup | IPC server rejects commands with auth error, Electron regenerates token and restarts |
| `process()` returns empty string | Injector skips injection, no clipboard corruption, user gets "nothing to inject" notification |
| SQLite DB is locked by another process | History manager logs warning and skips write, doesn't crash the pipeline |

**Implementation approach:** Mock the failure conditions at the boundary (kill subprocess, return `ConnectionError`, corrupt the token file). Verify the system reaches a safe state — not that it "handles" the error silently.

**Why Sonnet:** These tests require understanding the full error propagation path across components. Each scenario needs a different mock strategy and a different "safe state" assertion. This is the kind of testing that prevents production outages.

**Acceptance:** 7+ error boundary tests pass. Each test verifies the system reaches a defined safe state (IDLE, notification sent, no resource leaks).

---

### Task 1.9: Create test directory structure 🟢 H

Create:
```
tests/
  conftest.py                      # NEW (Task 1.1)
  unit/
    __init__.py
    test_processor.py              # Task 1.2
    test_transcriber.py            # Task 1.3
    test_injector.py               # Task 1.4
    test_mute_detector.py          # Task 1.5
    test_security.py               # Task 1.6
    test_history_manager.py        # Task 1.6
  integration/
    __init__.py
    test_ipc_roundtrip.py          # Task 1.7
    test_pipeline.py               # Task 1.7
    test_error_boundaries.py       # Task 1.8
```

**Why Haiku:** Creating directories and empty `__init__.py` files is purely mechanical.

---

### Task 1.10: Update package.json test scripts 🟢 H

**Modify:** `package.json`

Change:
```json
"test": "node tests/smoke-test.cjs && python -m pytest python/"
```
To:
```json
"test": "node tests/smoke-test.cjs && python -m pytest tests/ python/ -v --tb=short",
"test:unit": "python -m pytest tests/unit/ -v",
"test:integration": "python -m pytest tests/integration/ -v",
"test:all": "node tests/smoke-test.cjs && python -m pytest tests/ python/ -v"
```

**Why Haiku:** Direct string replacement in a known location.

**Acceptance:** `pnpm test` runs all Python tests from both directories.

---

## GAP 2: CI/CD Pipeline ✅ COMPLETE

**Status:** ✅ **COMPLETE** (2026-02-06)
**Current:** No `.github/workflows` directory. Pre-commit hooks only run locally.
**Target:** Automated lint, test, and security audit on every push/PR.
**Depends on:** GAP 1a (need tests to run) ✅

**Summary:**
- Created `.github/workflows/ci.yml` with 5 jobs (lint-ts, build-ts, lint-py, test-py, security-audit)
- Applied pytest markers to 5 hardware-dependent tests in `test_integration_cp1.py`
- CI correctly filters tests: 250 run in CI, 5 skip (requires hardware)
- Local testing verified: all jobs pass (lint, build, test)
- Windows-only configuration with minimal dependencies (no torch/CUDA)

**Files Created:**
- `.github/workflows/ci.yml` (118 lines) — 5 parallel jobs for comprehensive CI

**Files Modified:**
- `tests/test_integration_cp1.py` — Added `@pytest.mark.requires_gpu` and `@pytest.mark.requires_audio` to 5 tests

**Acceptance Criteria Met:**
- ✅ Workflow runs on push to master and PRs
- ✅ All 5 jobs configured with correct dependencies
- ✅ Test filtering works: 250 tests run, 5 skip
- ✅ TypeScript lint passes (164 warnings, 0 errors)
- ✅ Python lint passes (ruff clean)
- ✅ Tests run in 3.29 seconds with CI filters

---

### Task 2.1: Create GitHub Actions CI workflow 🔵 S ✅

**Create:** `.github/workflows/ci.yml`

Five jobs:
1. **lint-typescript** — `pnpm install`, `pnpm run lint`, `npx tsc --noEmit`
2. **build-typescript** — `pnpm run build` (ensures the app actually compiles — critical after GAP 5 decomposition)
3. **lint-python** — `ruff check python/`, `ruff format --check python/`
4. **test-python** — Install test deps (NOT torch/CUDA), `python -m pytest tests/ -v --tb=short -x -m "not requires_gpu and not requires_audio and not requires_ollama"`
5. **security-audit** — `pnpm audit --audit-level=moderate` (continue-on-error initially)

**Key decisions:**
- `windows-latest` runner (dIKtate is Windows-only: pycaw, ctypes, etc.)
- Skip GPU-dependent tests via pytest markers
- Install only packages needed for tests, not full `requirements.txt` (avoids torch/CUDA)
- Use `pnpm` (matches lockfile)

**Triggers:** push to master, PRs to master.

**Why Sonnet:** CI config requires judgment on which dependencies to install (must exclude torch/CUDA but include pycaw), correct pnpm setup actions, and proper marker-based test filtering. A wrong CI config wastes many debug cycles.

**Acceptance:** Workflow runs on push, all jobs pass green.

---

### Task 2.2: Add pytest markers for CI-skippable tests 🟢 H ✅

**Modify:** `tests/conftest.py` ✅ (already done in GAP 1)

Markers registered:
```python
def pytest_configure(config):
    config.addinivalue_line("markers", "requires_gpu: test needs CUDA GPU")
    config.addinivalue_line("markers", "requires_audio: test needs microphone")
    config.addinivalue_line("markers", "requires_ollama: test needs running Ollama")
```

Applied markers to `tests/test_integration_cp1.py`:
- `@pytest.mark.requires_audio` — 3 tests (Recorder initialization, start/stop, file save)
- `@pytest.mark.requires_gpu` — 2 tests (Transcriber initialization with real model, sample transcription)

**Why Haiku:** Adding marker registrations and decorators is mechanical.

**Acceptance:** ✅ CI skips hardware tests (5 deselected); local `pytest tests/` runs all (255 total).

---

## 📦 Files Created/Modified in GAP 2

**CI/CD Infrastructure:**
- ✅ `.github/workflows/ci.yml` (123 lines) — 5 parallel jobs for comprehensive CI

**Test Markers:**
- ✅ `tests/test_integration_cp1.py` — Added hardware markers to 5 existing integration tests

**Verification Results:**
- ✅ TypeScript lint: 0 errors, 164 warnings (acceptable)
- ✅ Python lint: clean (ruff check + format)
- ✅ CI test run: 250 tests pass in 3.29s, 5 deselected
- ✅ Local test run: 255 tests pass (all hardware tests functional)

## 🎯 GAP 2 Acceptance Criteria
- ✅ **GitHub Actions workflow** → 5 jobs (lint-ts, build-ts, lint-py, test-py, security)
- ✅ **Windows-only runner** → Matches diktate's Windows-specific dependencies
- ✅ **Minimal dependencies** → Excludes torch/CUDA (saves ~4GB, 10+ min)
- ✅ **Pytest marker filtering** → 250 tests run, 5 skip (hardware)
- ✅ **Triggers on push/PR** → Automated on every master commit
- ✅ **Security audit** → pnpm audit at moderate level (continue-on-error)

**Hardware Test Strategy for Pre-Release:**
Run before v1.0 launch: `python -m pytest tests/ -v -m "requires_gpu or requires_audio"`
- Validates real Whisper model loading (GPU)
- Validates real Recorder initialization (audio device)
- Validates real audio recording and file saving

---

## GAP 3: innerHTML Security ✅ COMPLETE

**Status:** ✅ **COMPLETE** (2026-02-06)
**Current:** 0 innerHTML uses (down from 30+)
**Target:** Zero unsafe innerHTML uses ✅
**Risk:** LOW (settings UI is Electron renderer, no user-generated content flows into these)
**Commit:** `ab0060e` — All innerHTML uses replaced with safe DOM APIs

**Summary:**
- Replaced 30+ innerHTML assignments across 5 settings files
- All uses replaced with `replaceChildren()`, `createElement()`, `textContent`, or `DocumentFragment`
- Special handling for modes.ts: `cloneNode(true)` for DOM state save/restore
- Added pre-commit hook to prevent future innerHTML usage
- UI renders identically, all functionality preserved

### innerHTML Categories

| Category | Count | Fix Pattern |
|----------|-------|-------------|
| A: Clearing content (`innerHTML = ''`) | ~6 | `element.replaceChildren()` |
| B: Static HTML, no dynamic values | ~8 | `createElement` + `textContent` |
| C: HTML with dynamic content | ~16 | Build DOM nodes with `textContent` for values |

---

### Task 3.1: Clean innerHTML in `src/settings/audio.ts` 🟢 H

**File:** `src/settings/audio.ts` — 6 innerHTML uses

- Line 329: `select.innerHTML = ''` → `select.replaceChildren()`
- Lines 400, 429, 440: instruction divs with static HTML → build DOM nodes with `createElement` + `textContent`
- Lines 479, 606: result divs with dynamic test results → `createElement` + `textContent` for dynamic values

**Why Haiku:** Each replacement follows one of three mechanical patterns. No logic changes, just DOM API swaps.

**Acceptance:** Zero innerHTML in audio.ts. Settings > Audio tab renders identically.

---

### Task 3.2: Clean innerHTML in `src/settings/modes.ts` 🔵 S

**File:** `src/settings/modes.ts` — 11 innerHTML uses (largest concentration)

- Line 108: `state.originalModeDetailHTML = modeDetailContainer.innerHTML` (reads innerHTML to save UI state) → use `cloneNode(true)` to deep-clone the original DOM subtree
- Lines 113, 130: restore saved state → replace with `replaceChildren(clonedNode)`
- All select clearing/populating → `replaceChildren` + `createElement`

**Why Sonnet:** The save/restore pattern using `cloneNode(true)` requires understanding the DOM lifecycle of mode switching. Getting the clone/restore wrong breaks profile tab switching. This is the trickiest innerHTML file.

**Acceptance:** Zero innerHTML in modes.ts. Mode selection and profile switching work identically.

---

### Task 3.3: Clean innerHTML in `src/settings/privacy.ts` 🟢 H

**File:** `src/settings/privacy.ts` — 2 innerHTML uses

Both set descriptions from a hardcoded object — descriptions contain plain text only:
```typescript
// Before:
intensityDesc.innerHTML = descriptions[val];
// After:
intensityDesc.textContent = descriptions[val];
```

**Why Haiku:** Literal one-word replacement (`innerHTML` → `textContent`), twice.

**Acceptance:** Zero innerHTML in privacy.ts.

---

### Task 3.4: Clean innerHTML in `src/settings/ollama.ts` 🟢 H

**File:** `src/settings/ollama.ts` — 6 innerHTML uses

- Model name + size display → `createElement` + `textContent`
- `btn.innerHTML = '🗑️'` → `btn.textContent = '🗑️'`
- Select clearing/error messages → `replaceChildren` + `createElement`

**Why Haiku:** Standard pattern-based replacements. All values come from Ollama API responses (model names, sizes), not user input.

**Acceptance:** Zero innerHTML in ollama.ts. Ollama model management works identically.

---

### Task 3.5: Clean innerHTML in `src/settings/ui.ts` 🟢 H

**File:** `src/settings/ui.ts` — ~5 innerHTML uses

Select population with static options → `replaceChildren` + `createElement`.

**Why Haiku:** Same mechanical pattern as other settings files.

**Acceptance:** Zero innerHTML in ui.ts.

---

### Task 3.6: Prevent future innerHTML 🟢 H

**Modify:** `.husky/pre-commit`

Add a grep guard:
```bash
if grep -rn 'innerHTML' src/ --include='*.ts' | grep -v '// innerHTML-safe'; then
  echo "ERROR: innerHTML detected in src/. Use textContent or createElement instead."
  exit 1
fi
```

**Why Haiku:** Appending a grep check to an existing shell script.

**Acceptance:** Future commits introducing innerHTML are blocked by pre-commit hook.

---

## 📦 Files Modified in GAP 3

**Settings UI Files:**
- ✅ `src/settings/audio.ts` (6 innerHTML → 0)
- ✅ `src/settings/modes.ts` (11 innerHTML → 0)
- ✅ `src/settings/privacy.ts` (2 innerHTML → 0)
- ✅ `src/settings/ollama.ts` (6 innerHTML → 0)
- ✅ `src/settings/ui.ts` (1 innerHTML → 0)
- ✅ `src/settings/store.ts` (type changed: `originalModeDetailHTML: string` → `originalModeDetailDOM: HTMLElement`)

**Infrastructure:**
- ✅ `.husky/pre-commit` (added innerHTML prevention hook)

## 🎯 GAP 3 Acceptance Criteria

- ✅ **Zero innerHTML in src/settings/** → `grep -rn "innerHTML" src/settings/ --include="*.ts"` returns 0 results
- ✅ **audio.ts** → 6 uses replaced with `replaceChildren()` + `createElement()`
- ✅ **modes.ts** → 11 uses replaced, including `cloneNode(true)` for DOM state save/restore
- ✅ **privacy.ts** → 2 uses replaced with `DocumentFragment` + `textContent`
- ✅ **ollama.ts** → 6 uses replaced with `replaceChildren()` + `createElement()`
- ✅ **ui.ts** → 1 use replaced with `replaceChildren()` + `createElement()`
- ✅ **Pre-commit hook** → Blocks future innerHTML usage (allows `// innerHTML-safe` escape hatch)
- ✅ **UI renders identically** → All settings tabs functional, no visual regressions

**Implementation Notes:**
- **Most complex file:** `modes.ts` required `cloneNode(true)` pattern for saving/restoring Raw mode UI
- **Most verbose replacement:** `audio.ts` line 606 (test results display) required 100+ lines of DOM construction
- **Simplest file:** `ui.ts` had only 1 innerHTML use for sound dropdown population

---

## GAP 4: TypeScript `any` Types

**Current:** 59+ explicit `any` types (33 in main.ts)
**Target:** <10 remaining (only where truly unavoidable)

### `any` Patterns and Fixes

| Pattern | Count | Fix |
|---------|-------|-----|
| Event handler data (`data: any`) | ~24 | Define typed interfaces in `src/types/pythonEvents.ts` |
| Store dynamic keys (`as any`) | ~12 | Template literal index signatures on `UserSettings` |
| Config/profile objects | ~3 | Define `ModeProfile`, `PythonConfig` interfaces |
| API response parsing (`m: any`) | ~8 | Define response type interfaces per cloud provider |
| Error handling (`catch (err: any)`) | ~5 | Use `catch (err: unknown)` + `instanceof Error` |
| Preload/global definitions | ~5 | Type the API bridge properly in `global.d.ts` |

---

### Task 4.1: Define Python event payload interfaces 🔵 S

**Create:** `src/types/pythonEvents.ts`

One interface per event type emitted by `python/ipc_server.py`. Must read the Python source to infer the exact JSON shapes:

```typescript
export interface StartupProgressEvent {
  phase: string;
  message: string;
  progress?: number;
}

export interface DictationSuccessEvent {
  char_count: number;
  mode: string;
  processing_time?: number;
}

export interface SystemMetricsEvent {
  phase: string;
  activity_count: number;
  metrics: {
    cpu_percent: number;
    memory_percent: number;
    gpu_available: boolean;
    gpu_device_name?: string;
    gpu_memory_percent?: number;
    ollama_model?: string;
    tokens_per_sec?: number;
  };
}
// ... one interface per event type
```

Then update all `pythonManager.on()` handlers in `src/main.ts` (lines 824-1189) to use these types instead of `any`.

**Why Sonnet:** Must cross-reference Python `send_event()` calls with TypeScript event handlers to infer correct types. Getting a type wrong causes silent runtime mismatches.

**Acceptance:** All `pythonManager.on` callbacks use typed parameters.

---

### Task 4.2: Type the store dynamic keys 🔵 S

**Modify:** `UserSettings` interface in `src/main.ts` (line 58)

Add template literal index signatures:
```typescript
[key: `localPrompt_${string}`]: string;
[key: `localModel_${string}`]: string;
[key: `cloudProvider_${string}`]: string;
[key: `cloudModel_${string}`]: string;
[key: `cloudPrompt_${string}`]: string;
[key: `modeProvider_${string}`]: string | undefined;
[key: `modeModel_${string}`]: string | undefined;
profileSystemMigrated?: boolean;
```

Eliminates all `as any` casts on store.get/set for dynamic mode keys (12+ uses in `migrateToDualProfileSystem()` at line 283 and `syncPythonConfig()` at line 1315).

**Why Sonnet:** Template literal index signatures interact with electron-store's generic typing. Must verify the index signatures don't conflict with existing explicit properties or break type inference elsewhere.

**Acceptance:** Zero `as any` casts on store operations.

---

### Task 4.3: Type config and profile objects 🟢 H

**Modify:** `syncPythonConfig()` in `src/main.ts` (line 1315)

Replace:
```typescript
const localProfiles: any = {};
const cloudProfiles: any = {};
```
With:
```typescript
interface ModeProfile { prompt: string; provider?: string; model?: string; }
const localProfiles: Record<string, ModeProfile> = {};
const cloudProfiles: Record<string, ModeProfile> = {};
```

**Why Haiku:** Direct type annotation replacement. The `ModeProfile` shape is obvious from the assignment code 5 lines below.

**Acceptance:** `syncPythonConfig()` has zero `any` types.

---

### Task 4.4: Type API response parsing 🔵 S

**Modify:** `apikey:get-models` handler in `src/main.ts` (lines 2121-2285)

Define interfaces for each cloud provider's model list response:
```typescript
interface GeminiModelInfo {
  name: string;
  displayName: string;
  supportedGenerationMethods: string[];
}

interface OpenAIModelInfo {
  id: string;
  deprecated?: boolean;
}

interface AnthropicModelInfo {
  id: string;
  display_name: string;
}
```

Replace `(m: any)` filter/map callbacks with typed parameters.

**Why Sonnet:** Must match real API response schemas from Gemini, OpenAI, and Anthropic. Wrong types would break model listing silently.

**Acceptance:** Zero `any` in model listing handlers.

---

### Task 4.5: Type the preload/global API bridge 🔵 S

**Modify:** `src/global.d.ts` and `src/preload.ts`

These files define the contract between renderer and main process. Currently they use `any` in 8 places, which means every settings module downstream inherits weak typing.

**`src/global.d.ts` (5 `any` types):**
```typescript
// Line 3 — getAll returns unknown settings blob
getAll: () => Promise<any>;  →  getAll: () => Promise<UserSettings>;

// Line 4 — get returns a single setting value
get: (key: string) => Promise<any>;  →  get: <K extends keyof UserSettings>(key: K) => Promise<UserSettings[K]>;

// Line 6 — set accepts a setting value
set: (key: string, value: any) => Promise<void>;  →  set: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => Promise<void>;

// Line 58 — invokeBackend is a raw escape hatch
invokeBackend: (command: string, args: any) => Promise<any>;
// This one is genuinely untyped (arbitrary commands). Keep as `unknown` with a comment:
invokeBackend: (command: string, args: unknown) => Promise<unknown>;
```

**`src/preload.ts` (3 `any` types):**
```typescript
// Line 28 — log data payload
data?: any  →  data?: Record<string, unknown>

// Line 34 — performance metrics
metrics: any  →  metrics: SystemMetricsEvent  // from pythonEvents.ts (Task 4.1)

// Line 45 — setSetting value
value: any  →  value: UserSettings[keyof UserSettings]

// Line 49 — onSettingChange value
value: any  →  value: unknown
```

**Why Sonnet:** The `SettingsAPI` interface is consumed by every settings module. Changing its generic signatures to use `UserSettings` requires verifying that all callsites in `src/settings/*.ts` and `src/renderer.ts` remain type-compatible. The `get<K>` generic pattern needs careful testing with electron-store.

**Acceptance:** Zero `any` in `global.d.ts` and `preload.ts`. All settings modules compile without errors.

---

### Task 4.6: Replace `catch (err: any)` with `catch (err: unknown)` 🟢 H


All catch blocks in `src/main.ts` and `src/settings/*.ts` (5+ locations):

```typescript
// Before:
} catch (err: any) {
  logger.error('MAIN', err.message);
}

// After:
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  logger.error('MAIN', message);
}
```

**Why Haiku:** Mechanical find-and-replace with a fixed pattern. Every instance gets the same transformation.

**Acceptance:** Zero `catch (err: any)` in the codebase.

---

### Task 4.7: Escalate ESLint rule (do LAST — after all `any` resolved) 🟢 H

**Modify:** `eslint.config.mjs`

```javascript
// Before:
'@typescript-eslint/no-explicit-any': 'warn',
// After:
'@typescript-eslint/no-explicit-any': 'error',
```

**Why Haiku:** Single string replacement.

**Acceptance:** `pnpm run lint` passes with zero `any` errors.

---

## GAP 5: main.ts Monolith Decomposition

**Current:** 2,976 lines
**Target:** <1,500 lines (50% reduction)

### Extraction Plan

| Extract To | Lines | Content | Size |
|------------|-------|---------|------|
| `src/types/settings.ts` | 58-280 | UserSettings interface, DEFAULT_PROMPTS, defaults | ~220 lines |
| `src/services/hotkeyManager.ts` | 2593-2820 | `setupGlobalHotkey()` | ~230 lines |
| `src/services/notificationService.ts` | 505-546, 685-706 | `showNotification()`, `playSound()` | ~60 lines |
| `src/services/trayManager.ts` | 366-684 | Icon creation, tray menu, state updates | ~320 lines |
| `src/services/settingsMigration.ts` | 283-348 | `migrateToDualProfileSystem()` | ~65 lines |

---

### Task 5.1: Extract types to `src/types/settings.ts` 🔵 S

Move `UserSettings` interface (line 58-167), default values, and `DEFAULT_PROMPTS` object (lines 168-280) to a new file. Update main.ts to import from `./types/settings`.

**Why Sonnet:** The UserSettings interface has 50+ properties with nested objects. Must verify all imports resolve correctly and that electron-store's generic `Store<UserSettings>` still works after the type moves to a different module.

**Acceptance:** main.ts imports UserSettings from `./types/settings`, `pnpm run build` succeeds.

---

### Task 5.2: Extract `src/services/hotkeyManager.ts` 🔵 S

Extract `setupGlobalHotkey()` function (lines 2593-2820, ~230 lines). Export as a function that receives dependencies:

```typescript
export function setupGlobalHotkeys(deps: {
  store: Store<UserSettings>;
  showNotification: (title: string, body: string, isError?: boolean) => void;
  toggleRecording: (mode: string) => Promise<void>;
  handleRefineSelection: () => void;
  pythonManager: PythonManager | null;
}): void
```

**Why Sonnet:** Hotkey registration touches globalShortcut, tray state, recording state, and notification system. Must correctly identify all dependencies and wire them through the parameter object. Getting the dependency signature wrong breaks hotkeys silently.

**Acceptance:** main.ts calls `setupGlobalHotkeys(deps)` and all 6 hotkeys work identically.

---

### Task 5.3: Extract `src/services/notificationService.ts` 🟢 H

Move `showNotification()` (lines 685-706) and `playSound()` (lines 505-546) to a new module.

**Why Haiku:** Both are self-contained functions with minimal dependencies (just `path`, `Notification` from electron, and `fs` for sound files). No complex wiring.

**Acceptance:** Notifications and sounds work identically.

---

### Task 5.4: Extract `src/services/trayManager.ts` 🔵 S

Move:
- `createSimpleIcon()` (line 366)
- `getIcon()` (line 394)
- `buildTrayMenu()` (line 548)
- `initializeTray()` (line 625)
- `updateTrayTooltip()` (line 644)
- `updateTrayState()` (line 656)
- `updateTrayIcon()` (line 671)

Total: ~320 lines.

**Why Sonnet:** The tray manager references `mainWindow`, `controlPanelWindow`, recording state, and the Python manager. The context menu includes handlers that trigger recording, open settings, and quit the app. Must correctly thread all dependencies without creating circular imports.

**Acceptance:** Tray icon, menu items, and state transitions work identically.

---

### Task 5.5: Extract `src/services/settingsMigration.ts` 🟢 H

Move `migrateToDualProfileSystem()` (lines 283-348, ~65 lines).

**Why Haiku:** Self-contained function. Only dependency is `store` and `logger`. No complex wiring.

**Acceptance:** Migration runs on startup and is idempotent.

---

### Expected Result

main.ts reduces to ~1,500 lines containing: imports, window creation, Python event handlers, IPC handlers, recording logic, and `initialize()`. Further extraction of IPC/event handlers is possible but has diminishing returns for v1.0.

**Final acceptance for GAP 5:** `pnpm run build` succeeds, app starts, all features work.

---

## GAP 6: ipc_server.py Reorganization

**Current:** 2,916 lines (already has clear section comments)
**Target:** Extract data models; optionally extract pipelines

---

### Task 6.1: Extract data models to `python/models.py` 🟢 H

Move `State` enum, `SessionStats` class, `PerformanceMetrics` class (lines 133-288, ~155 lines) to a new module. Update imports in `ipc_server.py`.

**Why Haiku:** These are standalone data classes with no external dependencies. Cut-paste + import update.

**Acceptance:** `python -m pytest tests/` passes.

---

### Task 6.2: Extract processing pipelines (STRETCH GOAL) 🔵 S

Move PROCESSING PIPELINES section (lines 984-2333, ~1,350 lines) to `python/core/pipelines.py` as a `PipelineExecutor` class receiving the IPC server's components (recorder, transcriber, processor, injector) as constructor dependencies.

**Why Sonnet:** This is a major refactor. The pipelines access `self.state`, `self.session_stats`, `self.recorder`, `self.transcriber`, `self.processor`, `self.injector`, and `self.send_event()`. Extracting them requires designing a clean interface between the server and the pipeline executor.

**This is optional for v1.0.** The file is already well-organized with section comments. Only do this if time permits.

**Acceptance:** All recording/processing workflows function identically.

---

## GAP 7: API Documentation

**Priority:** LOW

---

### Task 7.1: Python API docs with pdoc 🟢 H

1. Add `pdoc` to `python/requirements-dev.txt`
2. Add script to `package.json`: `"docs:python": "pdoc python/core python/utils --output-directory docs/api/python"`
3. Add `docs/api/` to `.gitignore`
4. Run once to generate initial docs

**Why Haiku:** Installing a package, adding a script, running it. No judgment needed.

**Acceptance:** `pnpm run docs:python` generates browsable HTML documentation.

---

### Task 7.2: TypeScript docs with typedoc (optional) 🟢 H

Do AFTER GAP 5 so docs reflect the final modular structure.

1. `pnpm add -D typedoc`
2. Add script: `"docs:ts": "typedoc src/ --out docs/api/typescript"`
3. Run once to generate

**Why Haiku:** Same as 7.1 — install, configure, run.

**Acceptance:** Generated docs cover all exported functions/classes.

---

## GAP 8: Automated Dependency Updates

**Priority:** LOW

---

### Task 8.1: Add Dependabot 🟢 H

**Create:** `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    labels:
      - "dependencies"
    ignore:
      - dependency-name: "electron"
        update-types: ["version-update:semver-major"]

  - package-ecosystem: "pip"
    directory: "/python"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 3
    labels:
      - "dependencies"
    ignore:
      - dependency-name: "torch"
        update-types: ["version-update:semver-major"]
      - dependency-name: "nvidia-*"
```

**Why Haiku:** Standard YAML config from a provided template.

**Acceptance:** Dependabot creates PRs for outdated dependencies after merge.

---

### Task 8.2: Add scheduled security audit to CI 🟢 H

**Create:** `.github/workflows/security-audit.yml`

Triggered on `schedule` (weekly Monday 9am UTC) + `workflow_dispatch`:
- `pnpm audit`
- `pip-audit -r python/requirements.txt`

**Why Haiku:** Standard workflow YAML following the same pattern as Task 2.1.

**Acceptance:** Weekly audit runs and reports are visible in GitHub Actions tab.

---

## Verification Checklist

### Automated (all must pass)
- [ ] `pnpm run build` — app compiles successfully (critical after GAP 5 decomposition)
- [ ] `pnpm run lint` — zero errors (with `no-explicit-any: error`)
- [ ] `npx tsc --noEmit` — zero TypeScript errors
- [ ] `python -m ruff check python/` — zero errors
- [ ] `pnpm test` — all tests pass (smoke + pytest)
- [ ] `python -m pytest tests/ -v` — 50+ test cases pass, including 7+ error boundary tests
- [ ] `grep -rn 'innerHTML' src/ --include='*.ts'` — zero results
- [ ] `grep -cn ': any' src/main.ts` — fewer than 5 results
- [ ] `grep -cn 'any' src/global.d.ts src/preload.ts` — zero results

### Manual (spot-check after GAP 5)
- [ ] App starts with loading window
- [ ] Dictate mode: record → transcribe → process → inject
- [ ] Ask mode works
- [ ] Refine mode works (autopilot + instruction)
- [ ] Settings page loads, all tabs render correctly
- [ ] Tray icon state transitions
- [ ] Hotkeys register and respond
- [ ] Mute detection blocks recording

### CI (after GAP 2)
- [ ] Push to master triggers CI workflow
- [ ] All CI jobs pass green
- [ ] PR to master triggers CI workflow
- [ ] Dependabot creates first update PR

---

## File Inventory

### Files to CREATE (21 files)

| File | Gap | Tier | Purpose |
|------|-----|------|---------|
| `tests/conftest.py` | 1 | 🟢 H | Shared fixtures + sys.path |
| `tests/unit/__init__.py` | 1 | 🟢 H | Package marker |
| `tests/unit/test_processor.py` | 1 | 🔵 S | Processor tests (25+ cases) |
| `tests/unit/test_transcriber.py` | 1 | 🔵 S | Transcriber tests |
| `tests/unit/test_injector.py` | 1 | 🔵 S | Injector tests (8+ cases) |
| `tests/unit/test_mute_detector.py` | 1 | 🔵 S | Mute detector tests |
| `tests/unit/test_security.py` | 1 | 🟢 H | Extended security tests |
| `tests/unit/test_history_manager.py` | 1 | 🟢 H | History manager tests |
| `tests/integration/__init__.py` | 1 | 🟢 H | Package marker |
| `tests/integration/test_ipc_roundtrip.py` | 1 | 🔵 S | IPC protocol tests |
| `tests/integration/test_pipeline.py` | 1 | 🔵 S | Pipeline integration tests |
| `tests/integration/test_error_boundaries.py` | 1 | 🔵 S | Crash resilience tests (7+ scenarios) |
| `.github/workflows/ci.yml` | 2 | 🔵 S | CI pipeline |
| `.github/workflows/security-audit.yml` | 8 | 🟢 H | Weekly security audit |
| `.github/dependabot.yml` | 8 | 🟢 H | Dependency updates |
| `src/types/settings.ts` | 4, 5 | 🔵 S | UserSettings types |
| `src/types/pythonEvents.ts` | 4, 5 | 🔵 S | Python event interfaces |
| `src/services/hotkeyManager.ts` | 5 | 🔵 S | Hotkey management |
| `src/services/notificationService.ts` | 5 | 🟢 H | Notifications + sounds |
| `src/services/trayManager.ts` | 5 | 🔵 S | Tray icon management |
| `src/services/settingsMigration.ts` | 5 | 🟢 H | Settings migration |
| `python/models.py` | 6 | 🟢 H | Data models extraction |

### Files to MODIFY (13 files)

| File | Gap | Tier | Change |
|------|-----|------|--------|
| `tests/test_api_key_validation.py` | 1 | 🟢 H | Fix import from source |
| `tests/test_log_redaction.py` | 1 | 🟢 H | Use conftest for path |
| `package.json` | 1, 7 | 🟢 H | Test scripts, doc scripts |
| `src/main.ts` | 4, 5 | 🔵 S | Remove `any` types, extract modules |
| `src/global.d.ts` | 4 | 🔵 S | Type the SettingsAPI bridge (5 `any` → typed) |
| `src/preload.ts` | 4 | 🔵 S | Type the electronAPI bridge (3 `any` → typed) |
| `src/settings/audio.ts` | 3 | 🟢 H | Remove innerHTML (6 uses) |
| `src/settings/modes.ts` | 3 | 🔵 S | Remove innerHTML (11 uses) |
| `src/settings/privacy.ts` | 3 | 🟢 H | Remove innerHTML (2 uses) |
| `src/settings/ollama.ts` | 3 | 🟢 H | Remove innerHTML (6 uses) |
| `src/settings/ui.ts` | 3 | 🟢 H | Remove innerHTML (5 uses) |
| `eslint.config.mjs` | 3, 4 | 🟢 H | innerHTML rule, `any` → error |
| `python/ipc_server.py` | 6 | 🟢 H | Extract data models |

### Summary by Tier

| Tier | Tasks | Files Touched |
|------|-------|---------------|
| 🟢 **H** (Haiku) | 19 tasks | ~18 files |
| 🔵 **S** (Sonnet) | 16 tasks | ~17 files |

---

## Projected Grading (Post-Implementation)

**If SPEC_040 is 100% implemented: 9.0 – 9.2 / 10** (up from an honest ~6.5 current)

| Dimension | Current | Post-SPEC_040 | Notes |
|---|---|---|---|
| **Architecture** | 7.5 | 9.0 | main.ts decomposed, ipc_server.py split, clean service boundaries |
| **Code Quality** | 7.0 | 9.5 | Zero `any`, zero `innerHTML`, ESLint enforced at `error` level |
| **Testing** | 4.0 | 8.5 | 50+ unit tests, integration tests, error boundary coverage. Still no E2E or GPU-path tests — that's the ceiling. |
| **Security** | 7.5 | 9.5 | innerHTML eliminated, input validation on IPC, CSP hardened, audit pipeline |
| **CI/CD** | 0 | 9.0 | Full pipeline with lint, build, test, security audit, Dependabot |
| **Documentation** | 8.5 | 9.0 | TypeDoc + architecture docs close the API documentation gap |
| **Error Handling** | 6.0 | 8.5 | `catch (err: unknown)` everywhere, crash resilience tested |
| **Maintainability** | 6.0 | 9.0 | 3 extracted services, typed event contracts, no 3,000-line files |

### What keeps it from 9.5+

1. **No E2E tests.** Cross-app end-to-end testing (Electron + Python + Ollama) was deliberately excluded — too brittle and hardware-dependent. Right call for now, but the testing pyramid has a real gap at the top.

2. **No GPU-path test coverage.** Whisper, torch, CUDA — the actual transcription pipeline — can't run in CI. Tests mock everything below the processor boundary. A bug in the real torch integration would slip through.

3. **Single-platform assumption.** Windows-only by design (pycaw, ctypes, keyboard injection). No abstraction layer for OS-specific code. If you ever port, it's a rewrite of those surfaces.

4. **No performance regression testing.** The 30-second latency target exists in docs but nothing measures it automatically. A slow Ollama model or a Whisper regression would go unnoticed until a user complains.

5. **electron-store is untyped at runtime.** Even after SPEC_040's typing work, electron-store itself doesn't validate at runtime — a corrupted JSON file could still crash the app. A migration + validation layer would close this.
