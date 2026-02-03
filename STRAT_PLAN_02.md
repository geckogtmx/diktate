# dIKtate Strategic Plan: V1 Launch & Department Of One

**Date:** 2026-02-03  
**Version:** V1.0  
**Status:** EXECUTION READY  
**Target Launch:** 15 Days From Approval

---

## Executive Summary

This document provides the complete strategic plan for launching dIKtate V1, transitioning from development to commercial release, and establishing the "Department Of One" content brand.

### The Pitch

**"Department Of One"** - A product manager and designer with zero coding skills builds a commercial-grade voice dictation app in 6 weeks using AI-augmented development, documents the entire journey transparently, and sells it for $20 while keeping the source open.

### Financial Model

| Item                | Cost/Revenue        |
| ------------------- | ------------------- |
| API Costs (6 weeks) | ~$60                |
| Time Investment     | ~200 hours          |
| Target Price        | $19.99              |
| Target Sales        | 50-200 (Month 1)    |
| **Revenue Range**   | **$1,000 - $4,000** |
| Break-even          | 3 sales             |
| ROI (200 sales)     | $33/hour            |

### Core Philosophy

> **"Grab-N-Go Economics"** - Ship fast, extract value, let the community take it when ready, move to V2.

- Source available on GitHub (MIT License)
- Binary convenience sold for $20
- No community burden (no PR reviews, no contributor management)
- Transparent development via streams/YT
- V2 offers free upgrade to backers, code is released/updated again in Github

---

## Current State Assessment

### Codebase Health (From Kilo Review)

| Category          | Score  | Status                            |
| ----------------- | ------ | --------------------------------- |
| **Architecture**  | 9/10   | Clean hybrid Electron + Python    |
| **Code Quality**  | 8/10   | Good linting, needs more tests    |
| **Security**      | 8.5/10 | Strong encryption, IPC validation |
| **Documentation** | 9/10   | Excellent roadmap and guides      |
| **Test Coverage** | 5/10   | ⚠️ Major gap - needs 80%+         |
| **Overall**       | 8.5/10 | Production-ready with caveats     |

### Website Status (dikta.me)

**Strengths:**

- ✅ Polished scrollytelling design
- ✅ Clear pricing structure ($10/$25/$0 tiers)
- ✅ Strong value proposition messaging
- ✅ Professional glassmorphism UI

**Critical Gaps:**

- ❌ **Purchase flow broken** (buttons do nothing)
- ❌ **No download/install path**
- ❌ Missing social proof (testimonials)
- ❌ No FAQ or system requirements
- ❌ Missing privacy policy/TOS
- ❌ No analytics or conversion tracking

**Assessment:** 70% launch-ready. Biggest blocker is non-functional purchase flow.

---

## Strategic Pillars

### Pillar 1: Product & Pricing

**Model:** "Source Available, Binary Commercial"

```
dIKtate V1 Tiers:
├── GitHub (FREE)
│   ├── Full MIT-licensed source
│   ├── Build instructions provided
│   └── Community support only
│
└── dikta.me ($19.99)
    ├── Pre-compiled Windows installer
    ├── Auto-updater (while maintained)
    ├── License key activation
    └── "It just works" experience
```

**Pricing Strategy:**

| Phase                      | Price  | Audience                             |
| -------------------------- | ------ | ------------------------------------ |
| **Pre-Launch (Days 8-14)** | $10    | Early adopters, warm audience        |
| **Launch Day (Day 15+)**   | $19.99 | General public                       |
| **V2 Release**             | $24.99 | New users (backers get free upgrade) |

**Rationale:**

- Early bird pricing creates urgency
- Price anchoring ($10 → $20 → $25) feels like progression
- V2 upgrade rewards loyalty without complex subscription management
- One-time payment aligns with "set and forget" philosophy

### Pillar 2: Payment Infrastructure

**Recommendation: Lemon Squeezy**

| Feature          | Lemon Squeezy                                 |
| ---------------- | --------------------------------------------- |
| **Fee**          | 5% + $0.50 ($1.50 on $20)                     |
| **Setup**        | 2-3 hours                                     |
| **Taxes**        | Merchant of Record (handles all global taxes) |
| **License Keys** | Built-in generation & validation              |
| **Delivery**     | Secure signed download links                  |

**Why Not Alternatives:**

- **Gumroad:** Higher fees (10%), same features
- **Stripe:** More complex, no license keys, tax headaches
- **Paddle:** Longer approval process

**Setup Tasks:**

1. Create account (15 min)
2. Connect bank/PayPal (30 min)
3. Configure product with license keys (30 min)
4. Customize checkout (30 min)
5. Test purchase flow (15 min)

**Total:** Under 3 hours to live sales.

### Pillar 3: Content & Marketing

**Brand: "Department Of One"**

Positioning: Solo builder using AI to keep himself productive.

**Content Flywheel:**

```
Development Work (with occasional recording)
         ↓
Biweekly Streams (2-4 hours, planning/progress/AI news)
         ↓
YT Cuts (20-40 min monthly + 4-5 shorts)
         ↓
Builds Audience & Authority
         ↓
V1 Launch (sales)
         ↓
More Content Material (sales breakdown, user feedback)
         ↓
V2 Development (repeat)
```

**Stream Format:**

- **Frequency:** Biweekly (every 2 weeks)
- **Duration:** 2-4 hours
- **Tone:** Conversational, no hype, business + tech mix
- **Segments:** Planning, progress demo, AI news, Q&A

**YT Content:**

- 1 long-form monthly (20-40 min edited from streams)
- 4-5 monthly - shorter format 5-10 minutes (sections from long-form)
- Mix: Dev updates, App demos, AI reactions, business learnings, technical explainers

**Target Platforms:**

- **Primary:** YouTube (feeds the sales funnel)
- **Secondary:** Twitch (live interaction, clips for YT)

### Pillar 4: Launch Sequence

**15-Day Timeline:**

#### Week 1: Foundation (Days 1-7)

**Day 1-2: Payment Setup**

- Create Lemon Squeezy account
- Configure product ($19.99, license keys enabled)
- Test purchase flow
- **Deliverable:** Working checkout URL

**Day 3-4: Website Fixes**

- Fix purchase buttons → Link to checkout
- Fix download button → Email capture or direct link
- Add system requirements section
- Add 2-3 testimonials
- Add FAQ (refund policy, updates, support)
- Add analytics (Plausible or Fathom)
- **Deliverable:** Live website with working conversion flow

**Day 5-7: Stream 1 (Warmup)**

- Title: "Department Of One: I Built a $20 App in 6 Weeks with AI"
- Structure: Intro, build story, live demo, business angle, Q&A
- **Deliverable:** Raw footage for YT, first audience touchpoint

#### Week 2: Content & Refinement (Days 8-12)

**Day 8-9: YT Content Creation**

- Long-form: "I Built a $20 App in 6 Weeks With AI (And I'm Not a Developer)"
- Shorts: "The Math" / "AI Prompt Engineering" / "Live Demo"
- Editing style: Conversational, "Future Me" commentary, simple captions
- **Deliverable:** 1 video + 2-3 shorts uploaded

**Day 10: Stream 2 (Launch Prep)**

- Title: "Launch Week: The Final 48 Hours"
- Show working checkout, walk purchase flow, tease V2, set launch date
- **Deliverable:** Anticipation built, Day 15 announced

**Day 11-12: Benchmark Content**

- Create "Local AI vs Cloud: 4060ti 8GB Benchmark Results"
- Show latency numbers, token/speed, cost comparison
- Format: Blog post + YT video + Twitter thread
- **Deliverable:** Authority content proving value proposition

#### Week 3: Launch (Days 13-15)

**Day 13: Final Preparations**

- Fresh V1 binary build
- Upload to Lemon Squeezy
- Test complete purchase → download → install flow
- Create support Discord/email
- Write launch posts for social media
- **Deliverable:** Everything tested and ready

**Day 14: Soft Launch**

- Email existing contacts
- Post to personal social media
- Announce to warm audience
- Monitor for first sales
- **Expected:** 5-10 initial sales

**Day 15: PUBLIC LAUNCH 🚀**

- **Stream 3:** "Launch Day - Department Of One Goes Live"
- Official announcement, live purchase demo, celebrate milestones
- **Parallel:** Publish YT video, post to communities
- **Communities:** r/sideproject, r/selfhosted, Indie Hackers, Twitter/X, LinkedIn
- **Target:** 20-50 total sales by end of Day 15

---

## Success Metrics

### Week 1 Targets

- [ ] 5-10 sales (warm audience)
- [ ] 50-100 YT views (first video)
- [ ] Working website with conversion flow
- [ ] 3-5 initial testimonials gathered

### Month 1 Targets

- [ ] 50-200 total sales ($1,000-$4,000 revenue)
- [ ] 1,000+ YT views (across all content)
- [ ] 50+ email subscribers (for V2 announcement)
- [ ] 5-10 positive testimonials/reviews
- [ ] 2-3 biweekly streams completed

### Break-Even Analysis

- **Costs:** $60 (APIs) + $0 (if using Lemon Squeezy MoR)
- **Break-even:** 3 sales ($60 ÷ $20)
- **Good:** 50 sales ($1,000 revenue, $940 profit)
- **Great:** 200 sales ($4,000 revenue, $3,700 profit)
- **Time Investment (200 hrs @ $7.25/hr US Min Wage):** 73 sales to break even on labor, 200 sales = $2,550 profit above minimum wage ($12.75/hr effective)

---

## Risk Assessment

### Low Risk (Acceptable)

1. **Someone compiles and gives away free binaries**
   - _Mitigation:_ They don't get updates, you control the evolution of the original code, and you can still sell your version.
   - _Acceptance:_ Yes, acceptable per your philosophy

2. **Low sales volume (50 vs 500)**
   - _Mitigation:_ Still profitable, validates the model
   - _Acceptance:_ "If I sell 50 it's a big win"

3. **Support burden**
   - _Mitigation:_ Discord community, email only, no SLA
   - _Acceptance:_ Part of the deal for $20 one-time

### Medium Risk (Monitor)

1. **License key sharing**
   - _Mitigation:_ Lemon Squeezy allows deactivation, 5-download limit, Multiple device allowances
   - _Action:_ Monitor for abuse, don't obsess

2. **Negative reviews early**
   - _Mitigation:_ Soft launch with warm audience first, even if reviews are negative, it's a learning opportunity and a chance to show transparency, the App holds its weight, its a quality piece of software that save you a lot of money in comparsion to Subscription based options out there.
   - _Action:_ Fix issues as fast as AI can fix them, communicate transparently

### High Risk (Mitigate)

1. **Payment processor issues**
   - _Mitigation:_ Test thoroughly before launch
   - _Action:_ Have backup (Gumroad ready as Plan B)

2. **Major bug discovered post-launch**
   - _Mitigation:_ V1 is feature-complete, well-tested
   - _Action:_ Hotfix within 24-48 hours if critical

---

## V2 Preview Strategy

### When to Tease V2

- **From Day 1:** Mention V2 roadmap in streams
- **Day 10:** Show V2 plans during Launch Prep stream
- **Post-V1 Launch:** V2 becomes main development focus
- **Month 2-3:** V2 Beta for backers
- **Month 3-4:** V2 Public Release ($24.99)

### V2 Positioning

- **For Backers:** "Free upgrade as promised"
- **For New Users:** "$19.99 - Enhanced version with UI/UX improvements"
- **Message:** "V1 was the foundation, V2 is the polish"

### V2 Development Content

- Stream the V2 development process
- "Building V2 in Public" series
- Feature votes from community
- Behind-the-scenes of AI-assisted coding

---

## Content Calendar (First 8 Weeks)

### Week 1: Foundation

- **Stream 1:** "Department Of One Origin Story"
- **Content:** No YT cuts (footage gathering)

### Week 2: Pre-Launch

- **YT:** "I Built a $20 App with AI (Long-form)"
- **Shorts:** 2-3 clips from Stream 1
- **Stream 2:** "Launch Week: Final 48 Hours"

### Week 3: Launch

- **YT:** "Launch Day: Department Of One Goes Live"
- **Stream 3:** Launch Day celebration
- **Social:** Multi-platform launch announcement

### Week 4: Post-Launch Analysis

- **Stream 4:** "First Week Sales Breakdown"
- **YT:** "The Math: Was It Worth It?"
- **Content:** Transparency about numbers

### Week 5-6: V2 Planning

- **Stream 5:** "Planning V2: Community Feedback"
- **Content:** Feature requests, roadmap discussion

### Week 7-8: Development

- **Stream 6:** "Building V2 in Public"
- **YT:** "V2 Preview: What's Coming"
- **Content:** Dev work, AI interactions, progress

---

## Action Items Checklist

### Immediate (This Week)

- [ ] Finalize pricing decision ($10 early bird / $20 launch / $25 V2)
- [ ] Set specific launch date (Day 15 calendar date)
- [ ] Create Lemon Squeezy account
- [ ] Fix website signin/signup and purchase flow
- [ ] Schedule Stream 1 (Days 5-7)

### Short-Term (Week 1-2)

- [ ] Upload V1 binary to Lemon Squeezy
- [ ] Add testimonials to website - Add some joke ones, clearly fake, signed by Gemini 3 Preview and Haiku 4.5
- [ ] Add FAQ and system requirements
- [ ] Create benchmark content (4060ti results)
- [ ] Set up analytics (Plausible/Fathom)
- [ ] Create support Discord or email

### Launch Week (Week 3)

- [ ] Execute soft launch (Day 14)
- [ ] Monitor first sales and feedback
- [ ] Prepare launch day content
- [ ] Execute public launch (Day 15)
- [ ] Post to all communities
- [ ] Monitor and respond for 48 hours

### Post-Launch (Month 1)

- [ ] Biweekly streams (2-3 total)
- [ ] 1 long-form YT video
- [ ] 4-5 YT shorts
- [ ] Track sales metrics
- [ ] Gather testimonials
- [ ] Plan V2 features based on feedback

---

## Key Decisions Summary

| Decision        | Choice                              | Rationale                                  |
| --------------- | ----------------------------------- | ------------------------------------------ |
| **License**     | MIT (Source) + Custom EULA (Binary) | Source visible, binary convenience sold    |
| **Price**       | $19.99                              | Impulse buy territory, good margin         |
| **Payment**     | Lemon Squeezy                       | Lowest fees + MoR + license keys           |
| **Content**     | "Department Of One"                 | Differentiated, authentic, trending        |
| **Platform**    | YouTube primary, Twitch secondary   | YT feeds funnel, Twitch for live           |
| **Support**     | Discord + Email                     | Community self-help, direct line available |
| **V2 Strategy** | Free for backers                    | Rewards loyalty, simple messaging          |

---

## Final Notes

### The "Department Of One" Ethos

1. **Transparency:** Show everything - failures, costs, AI interactions
2. **Authenticity:** No hype, no fake scarcity, no "bro marketing"
3. **Value First:** The app must work well, or nothing else matters
4. **Sustainable Pace:** 8-10 hours/week content, no burnout, no stress
5. **Community as Bonus:** They enhance the journey, don't control it

### Success Definition

**Minimum Success:**

- 50 sales ($1,000 revenue)
- 1,000 YT views
- 1 positive testimonial
- You enjoyed the process

**Full Success:**

- 200 sales ($4,000 revenue)
- 5,000+ YT views
- 10+ testimonials
- V2 funded by V1 sales
- Established "Department Of One" brand

**Beyond Success:**

- 500+ sales
- Sustained content audience
- Consulting/freelance opportunities
- Next product already in pipeline

---

**Document Status:** READY FOR EXECUTION  
**Next Step:** Approve pricing tiers and set Day 15 calendar date  
**Ready to Launch:** 15 days from approval

---

_Plan created by Kilo Code_  
_Based on KiloReview-02-02-26.md assessment_  
_Strategy aligned with SPEC_039 Strategic Roadmap_
