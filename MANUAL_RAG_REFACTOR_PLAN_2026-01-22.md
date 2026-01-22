# Manual RAG Architecture Refactor Plan

> **Date:** 2026-01-22
> **Status:** PLANNING (Ready for execution)
> **Project:** diktate (dikta.me)

---

## Executive Summary

This plan refactors diktate's Manual RAG (Retrieval-Augmented Generation) documentation system to improve session continuity, reduce context bloat, and standardize workflows.

**Key Problems:**
- AI_CODEX.md is bloated with operational rules and ephemeral content
- Session rituals (resume/close) exist but aren't documented or enforced
- No standardized spec lifecycle
- Dead links in DEVELOPMENT_ROADMAP.md
- No session log rotation mechanism

**Goal:** Every session starts with minimal but complete context.

---

## Priorities

| Priority | Task | Impact | Effort |
|-----------|-------|--------|---------|
| **CRITICAL** | AI_CODEX.md Purification | Every session reads this | Low |
| **HIGH** | Create DEVELOPER_SESSION_PROTOCOL.md | Standardize rituals | Low |
| **HIGH** | DEV_HANDOFF.md Format Standardization | Better handoffs | Medium |
| **MEDIUM** | Session Log Rotation Implementation | Prevent file bloat | Low |
| **LOW** | Spec Lifecycle Headers | Status tracking | Low |
| **LOW** | Fix Dead Links in ROADMAP | Correct references | Low |
| **DEFERRED** | ADR System Creation | Context cost consideration | Medium |

---

## Phase 1: AI_CODEX.md Purification (CRITICAL)

### Current State
- **Lines:** 74
- **Contains:** Operational rules, coding standards, QA procedures, known bugs, Trinity Protocol
- **Problem:** Claims "Constitution" but has ephemeral content that changes frequently

### Actions

#### 1.1 Remove Ephemeral Content
**Delete from AI_CODEX.md:**
- Section 4.A (Documentation First) - Inferred from Trinity Protocol
- Section 4.B (Task Management) - Belongs in TASKS.md
- Section 4.C (Coding Standards) - Skills exist for this
- Section 4.D (Security) - Duplicate of SECURITY_AUDIT.md
- Section 4.E (Quality Assurance) - Duplicate of QA_STRATEGY.md
- Section 4.F (Known Bugs) - Ephemeral, belongs in DEV_HANDOFF.md
- Section 5 (Cross-Reference with diagram) - Confusing, implied by protocol

#### 1.2 Keep Only Core Protocol
**Retain in AI_CODEX.md:**
- Section 1 (Prime Directive) - Keep "Ship early, iterate fast"
- Section 2 (Project Identity) - Brand: diktate, Domain: dikta.me
- Section 3 (Trinity Protocol) - GEMINI = suggest, CLAUDE = execute
- Invariant Rules summary (from current section 4)
- NEW: Section 4 (Session Protocol) - Reference to DEVELOPER_SESSION_PROTOCOL.md

#### 1.3 Add Session Protocol Reference
```markdown
## 4. Session Protocol

For how to start and end sessions, see: `DEVELOPER_SESSION_PROTOCOL.md`

- Session Start: How to read context, report tasks
- Session End: How to update DEV_HANDOFF.md, commit changes
- Git Workflow: Mandatory (except push)
- Pre-Commit Checks: Lint, test before handoff
```

### Expected Result
- **Lines:** ~30 (down from 74)
- **Content:** Pure protocol (how agents collaborate)
- **Impact:** Every session saves ~40 lines of context, faster reads

---

## Phase 2: DEVELOPER_SESSION_PROTOCOL.md Creation (HIGH)

### Current State
- Resume workflow prompt exists (not documented)
- Close session workflow prompt exists (not documented)
- No single source of truth for session rituals
- Agents don't know to read these prompts

### Actions

#### 2.1 Create DEVELOPER_SESSION_PROTOCOL.md
**File path:** `DEVELOPER_SESSION_PROTOCOL.md`
**Content structure:**

```markdown
# DEVELOPER_SESSION_PROTOCOL

> **Purpose:** Standardized session rituals for diktate multi-model development.
> **Applies to:** All AI agents (GEMINI, CLAUDE)
> **Referenced from:** AI_CODEX.md

---

## Session Start (Resume)

### Read Order (Mandatory)

**Always read in this order, no exceptions:**

1. **AI_CODEX.md** (30 seconds)
   - Understand Trinity Protocol (GEMINI = suggest, CLAUDE = execute)
   - Check invariant rules (brand, philosophy, architecture)
   - Note session protocol reference

2. **DEV_HANDOFF.md** (1-2 minutes)
   - Check Last Updated timestamp
   - Check Last Model (who worked before you?)
   - Read Session Focus (what were they working on?)
   - Review Completed This Session
   - Review NEXT ACTION (critical path)
   - Scan Session Log (last 5 entries for patterns)

3. **Referenced Documents** (as needed, variable time)
   - **TASKS.md** - If sprint work needed
   - **DEVELOPMENT_ROADMAP.md** - If architectural questions
   - **docs/internal/specs/** - If implementing specific features
   - **docs/internal/SECURITY_AUDIT.md** - If security concerns
   - **ARCHITECTURE.md** - If technical implementation questions

### Report to Operator

**Format:**
```
Next Instruction: [Copy from DEV_HANDOFF.md "NEXT ACTION" section]

Tasks to Execute (Target: 8-10):
1. [Task - 1 line, file path if applicable]
2. [Task - 1 line]
...
8. [Task - 1 line]

Questions: [High-value questions only, or "None"]
```

**Task Count Logic:**
```
IF next_action_count >= 8:
    Report exactly what's in DEV_HANDOFF.md

ELIF next_action_count between 4 and 7:
    Report existing tasks
    Add: "Operator: This session has fewer than 8 tasks.
           Consider if this fits your time window."

ELIF next_action_count between 1 and 3:
    Report existing tasks
    Add: "Operator: Only X tasks queued.
           This is a short session (30-60 min).
           Check if you want more tasks from TASKS.md."

ELSE (no tasks in handoff):
    Add: "Operator: No tasks in handoff.
           Check TASKS.md for sprint work."
```

### Confirm Ready

**Required phrase:** "Ready to work on diktate"

**Do NOT:**
- Start working without confirmation
- Skip DEV_HANDOFF.md read
- Ask low-value questions
- Create new tasks without asking operator

---

## Session Close (Handoff)

### Update DEV_HANDOFF.md (Mandatory)

**Before ending session, update DEV_HANDOFF.md with:**

#### Header
```markdown
# DEV_HANDOFF.md

> **Last Updated:** YYYY-MM-DD HH:MM
> **Last Model:** [Claude/Gemini] [Version if known]
> **Session Focus:** [Brief 1-line description]
>
> **Rotation:** Keep last 5 sessions. Archive older to `DEV_HANDOFF_ARCHIVE_YYYY-MM.md`.
```

#### Completed Section
```markdown
## ✅ Completed This Session

### [Category: e.g., Bug Fixes / Features / Refactoring]
- [Specific task with file paths]
  - Status: Done / Partially Done
  - Reference: [commit hash if made]
```

#### Next Action Section
```markdown
## 🛑 NEXT ACTION: EXECUTION REQUIRED

> **Priority:** [Critical / High / Medium / Low]
> **Context:** [What was decided, why this matters]

### 1. [Task Title]
**Target:** `path/to/file.py`
**Est:** [5min / 15min / 30min / 1hr] - Optional
**Action:** [Specific action to take]
**Reference:** [Any specs, ADR, or roadmap sections]
```

#### Context Section
```markdown
## 🔄 Context & State

- **Status:** [e.g., Investigation Complete, Execution Pending, Blocked]
- **Blockers:** [What's preventing progress, if any]
- **Dependencies:** [What needs to be done first]
- **Artifacts:** [Any files created during session]
```

#### Session Log (Rotate to 5 max)
```markdown
## Session Log (Last 5 Sessions)

### [DATE] - [Model] - [Session Focus]
- Summary (2-3 lines max)
- Key outcomes
- Tests status (passing/failing/not run)
```

### Git Workflow (Mandatory Except Push)

#### Pre-Flight Check
```bash
# Check git state
git status
git diff --stat
```

**Decision:**
- If clean: Skip git workflow, just update DEV_HANDOFF.md
- If dirty: Proceed to Pre-Commit Validation

#### Pre-Commit Validation
```bash
# Run quality checks
npm run lint          # or project-specific equivalent
pytest tests/           # or project-specific equivalent
```

**Decision point:**
- If tests pass: Proceed to commit
- If tests fail: Document in DEV_HANDOFF.md under "Context & State" → "Blockers"
  - Decision: Fix now or document for later?
  - Add to Next Actions if fixing later

#### Atomic Commit
```bash
# Stage everything including handoff doc
git add .
git add DEV_HANDOFF.md  # Explicitly ensure handoff is included

# Commit with context-rich message
git commit -m "session: [brief summary of work]
- [Key change 1 - file, component]
- [Key change 2]
- [Key change 3]

See DEV_HANDOFF.md for detailed context and next steps."
```

#### Final Verification
```bash
# Verify commit
git status           # Should show "working tree clean"
git log -1 --stat    # Verify commit contents
cat DEV_HANDOFF.md | head -n 20  # Quick review of handoff header
```

### Emergency Handoff

**Use when:**
- Token limit reached
- Session must stop unexpectedly
- Critical interruption

**Format:**
```markdown
## ⚠️ EMERGENCY HANDOFF

**Reason:** [Why stopping abruptly]
**Timestamp:** YYYY-MM-DD HH:MM

### Critical State
- **File last edited:** `path/to/file.ts`
- **Was in middle of:** [What exactly]
- **Tests:** [Passing / Failing / Not run]
- **Uncommitted changes:** [Brief description]

### To Resume
1. Read this handoff section first
2. The function/class/component was half-written
3. Next step was: [Specific next action]
```

---

## Session Boundaries

**When to switch sessions:**
- Model change (Claude ↔ Gemini)
- Platform change (Desktop ↔ CLI ↔ IDE)
- Token emergency (only exception - use Emergency Handoff)

**Never mix models in one session.**

**Operator decision:** Close session = Handoff ritual. Same ritual for end-of-day or model switch.

---

## Integration Points

| Referenced From | To This File |
|-----------------|---------------|
| AI_CODEX.md | Section 4: Session Protocol |
| .agent/skills/handoff-writer/SKILL.md | Ritual format |
| Resume workflow prompt | Read Order + Report Format |
| Close session workflow prompt | Git Workflow + Update Format |

---

## Quality Checklist

Before ending session, verify:

- [ ] Read AI_CODEX.md at start
- [ ] Read DEV_HANDOFF.md at start
- [ ] Reported 8-10 tasks (or explained why fewer)
- [ ] Updated DEV_HANDOFF.md header
- [ ] Updated "Completed This Session"
- [ ] Updated "NEXT ACTION"
- [ ] Updated "Session Log" (rotated to 5 max)
- [ ] Ran git status
- [ ] Ran pre-commit checks (if code changed)
- [ ] Created atomic commit (if code changed)
- [ ] Verified git log -1
```

### Expected Result
- Single source of truth for session rituals
- Agents know exactly how to start/end sessions
- Git workflow enforced (except push)
- Operator gets visual checklist for time management

---

## Phase 3: DEV_HANDOFF.md Format Standardization (HIGH)

### Current State
- Format evolved organically
- Works but lacks consistency
- No rotation rule documented
- No time estimation support

### Actions

#### 3.1 Standardize Header
**Current header:**
```markdown
# DEV_HANDOFF.md

> **Last Updated:** 2026-01-22 12:35
> **Last Model:** Gemini (Antigravity)
> **Session Focus:** Debugging Recording & Cloud Issues
```

**Add rotation rule:**
```markdown
> **Rotation:** Keep last 5 sessions. Archive older to `DEV_HANDOFF_ARCHIVE_YYYY-MM.md`.
```

#### 3.2 Clarify Section Purposes

**Add to each section header:**

**✅ Completed This Session:**
```markdown
> **Purpose:** Document what was finished in this session.
> **Format:** Group by category (Bug Fixes, Features, Refactoring, Documentation)
```

**🛑 NEXT ACTION: EXECUTION REQUIRED:**
```markdown
> **Purpose:** Critical path for next agent.
> **Priority:** Mark as Critical / High / Medium / Low
> **Include:** Target file, specific action, context, references
```

**🔄 Context & State:**
```markdown
> **Purpose:** Blockers, dependencies, current status.
> **Include:** Technical findings, decisions needed, artifacts created.
```

**Session Log:**
```markdown
> **Purpose:** History for pattern recognition.
> **Rotation:** Keep last 5 sessions. Archive older.
```

#### 3.3 Optional: Add Time Estimates

**Support operator time management:**

```markdown
### 1. Fix Silence Hallucinations
**Target:** `python/core/recorder.py`
**Est:** 5min
**Action:** Implement RMS amplitude check...
```

**Benefits:**
- Operator can gauge if session fits time window
- Visual cue for short vs long sessions
- Helps with "8-10 tasks" targeting

### Expected Result
- Consistent handoff format
- Clear rotation rule documented
- Optional time estimation support
- Better operator time management

---

## Phase 4: Session Log Rotation Implementation (MEDIUM)

### Current State
- Session Log has 4 entries
- No rotation mechanism
- File grows indefinitely over time

### Actions

#### 4.1 Add Rotation Trigger to DEV_HANDOFF.md

**Header:**
```markdown
> **Rotation:** Keep last 5 sessions. Archive older to `DEV_HANDOFF_ARCHIVE_YYYY-MM.md`.
> **Archive location:** Root directory, one file per month.
```

#### 4.2 Create Rotation Logic

**When Session Log reaches 6 entries:**

1. **Identify oldest session** (6th entry)
2. **Extract session data** (date, model, focus, summary)
3. **Create archive entry** in `DEV_HANDOFF_ARCHIVE_YYYY-MM.md`
4. **Remove from DEV_HANDOFF.md**
5. **Add archive reference** to DEV_HANDOFF.md header:
   ```markdown
   > **Archived Sessions:** See `DEV_HANDOFF_ARCHIVE_2026-01.md`
   ```

#### 4.3 Archive Format

**File:** `DEV_HANDOFF_ARCHIVE_2026-01.md`
```markdown
# DEV_HANDOFF_ARCHIVE_2026-01

> **Purpose:** Archived sessions from January 2026.
> **Rotated from:** DEV_HANDOFF.md
> **Retention:** Keep for historical reference, not active read path.

---

## Session: 2026-01-15 10:00
**Model:** Claude (Haiku)
**Focus:** Bug fixes for recording issues
**Duration:** ~90 minutes
**Completed:**
- Fixed mute detection in recorder.py
- Added safety filters for silence hallucinations
**Outcome:** Core pipeline stable, ready for testing

---

## Session: 2026-01-14 14:30
**Model:** Gemini (Antigravity)
**Focus:** Architectural review
**Duration:** ~45 minutes
**Completed:**
- Reviewed architecture docs
- Identified redundancy in specs
**Outcome:** Refactor plan created

---
```

#### 4.4 Monthly Archive Rotation

**At month boundary:**
1. Create new archive file: `DEV_HANDOFF_ARCHIVE_2026-02.md`
2. Clear archive reference in DEV_HANDOFF.md
3. Old archive files remain in root for historical reference

### Expected Result
- DEV_HANDOFF.md stays lean (~150 lines max)
- 5 recent sessions in active read path
- Older sessions archived monthly
- Full history preserved but not clogging context

---

## Phase 5: Spec Lifecycle Headers (LOW)

### Current State
- Specs in `docs/internal/specs/` have no status tracking
- Dead links in DEVELOPMENT_ROADMAP.md (`docs/specs/` instead of `docs/internal/specs/`)
- No lifecycle management (Draft → Review → Approved → Implemented)

### Actions

#### 5.1 Add Status Header to All Specs

**Files:**
- `docs/internal/specs/SPEC_001_TTS_AND_REINJECT.md`
- `docs/internal/specs/SPEC_002_DOCS_CHATBOT.md`
- `docs/internal/specs/SPEC_002_AUDIO_FEEDER.md`
- `docs/internal/specs/SPEC_003_SCRIBE_LAYER.md`
- `docs/internal/specs/SPEC_004_VISIONARY_MODULE.md`

**Header format:**
```markdown
# SPEC_XXX: [Title]

> **Status:** Draft | Review | Approved | Implemented | Deprecated
> **Current:** [current status value]
> **Owner:** [unassigned - project-wide]
> **Milestone:** [v1.X-Y or TBD]
> **Last Updated:** YYYY-MM-DD
```

**Status definitions:**
- **Draft:** Initial spec, not reviewed
- **Review:** Ready for team review
- **Approved:** Spec accepted, implementation ready
- **Implemented:** Feature built, spec complete
- **Deprecated:** Spec no longer relevant

#### 5.2 Fix Dead Links in DEVELOPMENT_ROADMAP.md

**Search:** `docs/specs/`
**Replace with:** `docs/internal/specs/`

**Affected locations:**
- Section B.1 (Automated Tests) - references `tests/`
- Section F.1 (Backend Setup) - references `docs/qa/`
- Any other broken links discovered

### Expected Result
- Clear spec status at a glance
- No broken links in roadmap
- Agents know where to find specs
- Project-wide spec ownership (no maintainers)

---

## Phase 6: ADR System Creation (DEFERRED)

### Recommendation

**Do NOT create ADRs yet.**

### Reasoning

1. **Context Cost:** Each ADR adds ~50-100 lines that agents must read
2. **Sufficient Coverage:** Major decisions already documented:
   - Branding: `COMMERCIAL_LAUNCH_STRATEGY.md`
   - Design: `DESIGN_SYSTEM.md`
   - Architecture: `ARCHITECTURE.md`
3. **Low Decision Volume:** Architecture is stable, major changes rare
4. **Over-engineering Risk:** Creating ADRs for past decisions creates documentation debt without clear ROI

### Future Trigger

**Create ADRs when:**
- Major architectural change is proposed (e.g., switch from Electron to Tauri)
- Technology stack changes (e.g., Python → Rust for backend)
- Breaking API changes (e.g., IPC protocol redesign)
- Decision volume justifies dedicated format (>5 major decisions/year)

### Future ADR Format (If Needed)

```markdown
# ADR-XXX: [Title]

## Status
Accepted / Proposed / Deprecated

## Context
[What problem needed solving?]

## Decision
[What was decided?]

## Alternatives Considered
[What other options were evaluated?]

## Consequences
- Positive: [Benefits]
- Negative: [Drawbacks]

## Implementation
[Where is this implemented?]

## References
- Related specs
- Related code
- Related docs
```

### Expected Result
- Deferred until justified
- Avoids unnecessary context bloat
- Major decisions remain in existing docs

---

## Decision Log (For This Plan)

### 2026-01-22: Session Log Rotation
**Decision:** Keep 5 sessions in DEV_HANDOFF.md, archive older monthly
**Rationale:** Balances pattern recognition (5 sessions) with file size (~150 lines max)
**Alternatives considered:**
- 3 sessions: Too short, lose patterns
- Full history: File becomes unmanageable
- 4 sessions (current): Good balance, but 5 gives better pattern recognition

### 2026-01-22: Resume Task Count Logic
**Decision:** Target 8-10 tasks, provide operator feedback if fewer
**Rationale:** Gives operator visual time management cue without hard rules
**Implementation:** Decision tree in DEVELOPER_SESSION_PROTOCOL.md

### 2026-01-22: Git Workflow Mandatory
**Decision:** Git workflow mandatory except push
**Rationale:** Ensures code changes are tracked, handoff preserved in git
**Exception:** Push is optional (operator controls when to push)

---

## Files to Create/Modify

| File | Action | Lines Changed | Priority |
|------|---------|----------------|-----------|
| **AI_CODEX.md** | Purify to ~30 lines, remove operational rules | -44 lines | CRITICAL |
| **DEVELOPER_SESSION_PROTOCOL.md** | Create new (session rituals) | +300 lines | HIGH |
| **DEV_HANDOFF.md** | Add rotation rule header, clarify sections | +15 lines | HIGH |
| **All docs/internal/specs/** | Add status header | +5 lines each | LOW |
| **DEVELOPMENT_ROADMAP.md** | Fix dead links (`docs/specs/` → `docs/internal/specs/`) | -5 lines | LOW |
| **DEV_HANDOFF_ARCHIVE_2026-01.md** | Create (when rotation triggers) | Variable | MEDIUM |

---

## Implementation Order

### Session 1: Critical Fixes
1. AI_CODEX.md purification (Phase 1)
2. Create DEVELOPER_SESSION_PROTOCOL.md (Phase 2)
3. Update DEV_HANDOFF.md header with rotation rule (Phase 3.1)

### Session 2: Standardization
1. DEV_HANDOFF.md format standardization (Phase 3.2-3.3)
2. Test session start/end rituals with new protocol
3. Verify agents read protocol correctly

### Session 3: Maintenance
1. Implement session log rotation (Phase 4) - wait until 6 entries exist
2. Add spec lifecycle headers (Phase 5)
3. Fix dead links in roadmap (Phase 5.2)

### Ongoing: ADR Monitoring
- Defer ADR system (Phase 6) until major architectural decision is needed
- Track decision volume to determine when to revisit

---

## Success Criteria

### Session Start (Before)
- **Time to ready:** <3 minutes from "I'm resuming" to "Ready to work"
- **Context read:** AI_CODEX.md + DEV_HANDOFF.md mandatory, others as needed
- **Task reporting:** 8-10 tasks or explanation for fewer

### Session End (After)
- **DEV_HANDOFF.md updated:** Header + Completed + Next Action + Session Log
- **Git workflow followed:** Pre-commit checks run, commit made if dirty
- **Rotation enforced:** Session log at 5 entries max

### Overall
- **AI_CODEX.md size:** ~30 lines (down from 74)
- **DEV_HANDOFF.md size:** ~150 lines max (with rotation)
- **Handoff quality:** Next agent can resume without questions
- **Context savings:** ~40 lines per session (AI_CODEX.md reduction)

---

## Risks and Mitigations

### Risk: Agents don't read DEVELOPER_SESSION_PROTOCOL.md
**Mitigation:**
- Reference from AI_CODEX.md (mandatory read)
- Reference from handoff-writer skill
- Update prompts to reference protocol file

### Risk: Session log rotation loses context
**Mitigation:**
- Archive files preserve full history
- Archive location documented in DEV_HANDOFF.md header
- Operator can review archives if needed

### Risk: Operator forgets git workflow
**Mitigation:**
- Documented in DEVELOPER_SESSION_PROTOCOL.md
- Pre-commit checks explicitly required
- Verify step included (git log -1 --stat)

### Risk: Too many files created (context bloat)
**Mitigation:**
- ADRs deferred until justified
- Specs only get headers, not rewrites
- Archive files don't clog active read path

---

## Questions for Next Session

Before executing this plan, confirm:

1. **AI_CODEX.md target length:** ~30 lines acceptable, or keep ~50 with minimal operational rules?

2. **Time estimates in DEV_HANDOFF.md:** Add "Est: 5min" to next actions, or skip (noise)?

3. **Archive trigger:** Monthly rotation or file size (>200 lines)?

4. **Spec status transitions:** Who changes status (Draft → Review → Approved)? Document or manual?

5. **Priority order:** Does this order match your needs, or reorder?

---

## Appendix: Document Relationships

### Before Refactor

```
AI_CODEX.md (74 lines, bloated)
    ↓ (references everything)
GEMINI.md + CLAUDE.md
    ↓ (handoff to)
DEV_HANDOFF.md (no rotation rule)
```

### After Refactor

```
AI_CODEX.md (~30 lines, pure protocol)
    ↓ (references)
DEVELOPER_SESSION_PROTOCOL.md (rituals)
    ↓ (references)
DEV_HANDOFF.md (with rotation, standardized)

GEMINI.md + CLAUDE.md (agent roles)
    ↓ (reference)
docs/internal/specs/ (with status headers)
    ↓ (referenced from)
DEVELOPMENT_ROADMAP.md (fixed links)
```

---

**End of Plan**

Ready for implementation in next session.
