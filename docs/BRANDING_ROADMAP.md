# Branding Roadmap: diktate → Waal

> **Status:** PLANNED  
> **Timeline:** Post-MVP (v1.0+)  
> **Decision Date:** 2026-01-16

---

## 📋 Executive Summary

The project will launch as **diktate** (MVP v0.1.0 - v0.9.x) and rebrand to **Waal** at v1.0 release. This approach avoids disruption during active development while preserving the strategic rebrand decision.

### Why Rebrand?

**Phonetic Issues with "diktate":**
- "dict-" evokes "dictator" (authoritarian connotations)
- Hard "K" sound feels aggressive
- "Tate" ending sounds corporate/generic
- Mixed capitalization (dIKtate) is visually awkward

**Focus Group Feedback:** Phonetics not performing well in user testing.

---

## 🎯 New Brand: Waal

### Etymology (Triple Meaning)

1. **Mayan:** "Wa'al" = Spoken Language (preserves cultural heritage)
2. **Metaphorical:** "Wall" = Privacy protection (local-first, offline)
3. **Functional:** "Lubricant" = Smooths rough speech into polished text

### Brand Narrative

**Core Message:** Waal is the lubricant between thought and text—it takes rough, unpolished speech and makes it flow smoothly into clean, professional writing.

**Privacy Angle:** Behind the wall, your voice is free. All processing happens locally, behind the protective barrier of your own hardware.

### Rejected Alternative: Oratio

**Etymology:** Latin for "speech, oration"

**Why Rejected:**
- More formal/academic tone
- Less distinctive (similar to Oracle, Orator)
- Doesn't support privacy narrative as strongly
- Longer (6 letters vs. 4)

---

## 📅 Rebrand Timeline

### Phase 1: MVP Development (Current)
**Timeline:** v0.1.0 - v0.9.x  
**Brand:** diktate  
**Status:** In progress (Phase 4 - UAT)

**Rationale:**
- Avoid disruption during active development
- Focus on functionality, not branding
- Preserve existing documentation and code references

### Phase 2: Pre-Launch Preparation
**Timeline:** v0.9.x (2-3 weeks before v1.0)  
**Brand:** Transition planning  

**Tasks:**
- [ ] Check domain availability (waal.app, waal.io, waal.dev)
- [ ] Check NPM package name availability (`waal`)
- [ ] Check GitHub username/org availability
- [ ] Design logo and visual identity
- [ ] Create brand guidelines document
- [ ] Prepare migration scripts

### Phase 3: v1.0 Launch
**Timeline:** v1.0.0 release  
**Brand:** Waal (official rebrand)

**Tasks:**
- [ ] Rename repository (`diktate` → `waal`)
- [ ] Update all documentation
- [ ] Update package.json and Python package names
- [ ] Update code references (imports, file paths)
- [ ] Acquire domains
- [ ] Launch new website/landing page
- [ ] Announce rebrand to users

---

## 🎨 Brand Identity (Planned)

### Visual Identity

**Name:** Waal  
**Capitalization:** Standard (not WaaL or WAAL)  
**Pronunciation:** "wah-ahl" (two syllables)

**Tagline Options:**
1. "Smooth your speech" (lubricant metaphor)
2. "Your voice, your wall" (privacy metaphor)
3. "Speak freely, behind the wall" (privacy + freedom)
4. "The lubricant between thought and text" (functional)

**Recommended:** "Smooth your speech" (simple, memorable, functional)

### Color Palette (Finalized)

**Concept:** Protective, smooth, flowing
- `--ink-black`: `#002029ff` (Primary BG)
- `--jet-black`: `#00303dff` (Secondary BG)
- `--dark-teal`: `#004052ff` (Borders)
- `--dark-teal-2`: `#005066ff` (Hover/Secondary)
- `--dark-teal-3`: `#00607aff` (Accent/Lightest)

*See [docs/DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for full implementation details.*

### Logo Concept (TBD)

**Ideas:**
- Abstract wall/barrier with sound waves
- Flowing liquid/lubricant imagery
- Minimalist "W" lettermark
- Combination mark (icon + wordmark)

---

## 🔧 Technical Migration Plan

### Scope of Changes

#### High Priority (User-Facing)
- [ ] Repository name: `diktate` → `waal`
- [ ] README.md: All references to diktate/dIKtate
- [ ] package.json: `name` field
- [ ] Python package name: `diktate` → `waal`
- [ ] Documentation: 25+ files with name references
- [ ] Logo/icon assets
- [ ] System tray application name
- [ ] Windows notifications (app name)

#### Medium Priority (Technical)
- [ ] Import statements in TypeScript/Python
- [ ] File paths and directory names
- [ ] Environment variables (if any)
- [ ] Configuration files
- [ ] Log file paths (`%APPDATA%/diktate` → `%APPDATA%/waal`)
- [ ] Python venv references

#### Low Priority (Historical)
- [ ] Git commit history (can remain as-is)
- [ ] Old documentation archives
- [ ] Phase completion reports (historical context)

### Migration Script (Planned)

```bash
# Automated rename script (to be created)
# - Find/replace all "diktate" → "waal"
# - Find/replace all "dIKtate" → "Waal"
# - Update package.json, requirements.txt
# - Rename directories
# - Update import statements
# - Preserve git history
```

**Estimated Effort:** 2-3 hours for complete migration

---

## 📊 Brand Comparison Matrix

| Criterion | diktate | Waal | Oratio |
|-----------|---------|------|--------|
| **Phonetic Appeal** | ⚠️ Harsh | ✅ Soft | ✅ Smooth |
| **Memorability** | ✅ Unique | ✅ Short | ⚠️ Generic |
| **Technical Compatibility** | ✅ Clean | ✅ Clean | ✅ Clean |
| **Privacy Messaging** | ⚠️ Neutral | ✅ "Wall" | ⚠️ Neutral |
| **Voice Connection** | ✅ Direct | ⚠️ Indirect | ✅ Direct |
| **International** | ⚠️ Awkward | ✅ Simple | ✅ Latin |
| **Uniqueness** | ✅ Very | ✅ Very | ⚠️ Moderate |
| **Length** | 7 letters | 4 letters | 6 letters |
| **Cultural Heritage** | ✅ Mayan | ✅ Mayan | ⚠️ Latin |

**Winner:** Waal (6/8 advantages)

---

## 🎯 Brand Messaging Framework

### Target Audience

**Primary:** Knowledge workers, writers, developers, content creators  
**Secondary:** Accessibility users, privacy-conscious professionals

### Value Propositions

1. **Privacy:** "Your voice never leaves your machine"
2. **Speed:** "Speak naturally, get polished text instantly"
3. **Intelligence:** "Not just transcription—transformation"
4. **Freedom:** "No subscriptions, no cloud, no compromises"

### Positioning Statement

> Waal is the local-first voice dictation tool that smooths rough speech into polished text—instantly, privately, and intelligently. Behind the wall, your voice is free.

### Competitive Differentiation

**vs. Cloud Services (Dragon, Otter.ai):**
- 100% local processing (privacy)
- No subscription fees (freedom)
- Works offline (reliability)

**vs. Local Tools (Whisper, Talon):**
- Intelligent cleanup (not just transcription)
- One-click simplicity (no configuration)
- Professional polish (grammar, filler removal)

---

## 📝 Documentation Strategy

### During MVP (diktate)

**Current State:**
- All docs reference "diktate" or "dIKtate"
- Etymology explained in README.md
- No branding guidelines

**Maintain:**
- Keep current naming for consistency
- Focus on functionality documentation
- Avoid investing in diktate branding assets

### Post-Rebrand (Waal)

**Update Strategy:**
- Global find/replace in all documentation
- Create BRANDING.md with guidelines
- Update README.md with new etymology
- Create visual identity guide
- Update all screenshots/recordings

---

## ✅ Decision Record

**Date:** 2026-01-16  
**Decision Maker:** User (gecko)  
**Rationale:** Phonetic issues with "diktate" identified in focus groups; "Waal" offers superior brand narrative (privacy + lubricant metaphor) while preserving Mayan cultural heritage.

**Approved Approach:**
- ✅ Keep "diktate" for MVP development (v0.1.0 - v0.9.x)
- ✅ Rebrand to "Waal" at v1.0 launch
- ✅ Use standard capitalization (Waal, not WaaL)
- ✅ Emphasize triple meaning (Mayan + wall + lubricant)
- ❌ Rejected "Oratio" (too formal, less distinctive)

---

## 🔗 Related Documents

- **README.md** - Current project overview (diktate branding)
- **MONETIZATION_STRATEGY.md** - Pricing tiers (will need rebrand update)
- **docs/BUSINESS_CONTEXT.md** - Market positioning (will need rebrand update)
- **ARCHITECTURE.md** - Technical docs (minimal branding impact)

---

## 📋 Pre-Launch Checklist (v1.0)

### Legal & Administrative
- [ ] Domain registration (waal.app, waal.io)
- [ ] Trademark search (US, EU)
- [ ] NPM package name reservation
- [ ] GitHub org/username acquisition
- [ ] Social media handles (@waal, @waalapp)

### Technical
- [ ] Migration script tested
- [ ] All code references updated
- [ ] Package names updated
- [ ] Log paths updated
- [ ] Configuration files updated

### Design
- [ ] Logo designed
- [ ] Icon set created (16x16, 32x32, 256x256)
- [ ] Color palette finalized
- [ ] Typography selected
- [ ] Brand guidelines documented

### Marketing
- [ ] Landing page created
- [ ] Announcement blog post written
- [ ] Social media graphics prepared
- [ ] Press kit assembled
- [ ] Migration guide for early adopters

---

## 🎯 Success Metrics (Post-Rebrand)

**Brand Recognition:**
- [ ] 80%+ of users correctly pronounce "Waal"
- [ ] 90%+ associate Waal with privacy/local-first

**Technical Migration:**
- [ ] Zero breaking changes for existing users
- [ ] Migration completed in \<1 week
- [ ] All documentation updated

**Market Reception:**
- [ ] Positive sentiment in user feedback
- [ ] Improved brand recall vs. "diktate"
- [ ] Stronger privacy messaging resonance

---

## Notes

**Apostrophe Decision:** Use "Waal" (no apostrophe) for technical simplicity
- Avoids URL/file path issues
- Cleaner package naming
- Easier to type and remember
- Still honors Mayan etymology

**Pronunciation Guide:** "wah-ahl" (two syllables, soft 'a' sounds)

**Cultural Sensitivity:** Mayan heritage preserved and honored; etymology clearly documented and attributed.

---

**Last Updated:** 2026-01-16  
**Next Review:** Pre-v1.0 launch (estimated 2-3 months)
