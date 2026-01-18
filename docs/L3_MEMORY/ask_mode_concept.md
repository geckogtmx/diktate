# Ask Mode Strategy: The "Quick Reference Crutch"

> **Concept:** Ask Mode is a workflow enhancer for micro-queries, not a chatbot. It aims to be faster than Google for quick facts, math, and definitions, keeping the user in their flow (email, code, docs) without app switching.

## 🎯 Core Value Proposition

**Voice vs Typing for Quick Facts**

*   **Speaking Mode (dIKtate):**
    *   "What's 150 times 234?" → **3 seconds total**
    *   Result: Natural flow, zero context switch, answer appears in-place.
*   **Traditional Path:**
    *   Open browser/calc → Type query → Read answer → Switch back → **8+ seconds**
    *   Result: Broken focus, multiple app switches.

## 💡 Why This Works (The "Crutch" Philosophy)

1.  **Fills Workflow Micro-Gaps:**
    *   Writing a document → "When was the Eiffel Tower built?" → Inject date.
    *   Coding → "What's the SQL syntax for creating an index?" → Quick reminder.
    *   Result: **Zero friction.** Keep typing.

2.  **4B Models are Adequate:**
    *   Micro-queries rely on **recall**, not reasoning.
    *   `gemma3:4b` excels at:
        *   ✅ Simple math ("15% of 340")
        *   ✅ Historical dates ("when did WW2 end")
        *   ✅ Definitions ("define heuristic")
        *   ✅ Common quotes ("quote about success from Churchill")
    *   *Complex reasoning? Toggle Cloud Mode.*

3.  **Local First, Cloud Fallback:**
    *   **dIKtate (Local):** Instant, private, offline for 90% of micro-queries.
    *   **Cloud Mode:** Gemini 2.0 Flash for reasoning-heavy questions.

## 🚀 Use Cases - Real World

*   **Writing:** "What year did Hemingway write The Old Man and the Sea?" → *Injects date, keep writing.*
*   **Email:** "What's the time difference between NYC and Tokyo?" → *Answer inline.*
*   **Spreadsheet:** "Convert 1500 euros to dollars" → *Paste result.*
*   **Coding:** "What's the python syntax for a decorator?" → *Quick reminder overlay.*
*   **Meetings:** "Who founded Microsoft?" → *Answer while documenting.*

## 🎨 Maximizing the Feature (Future Ideas)

1.  **Marketing:** Position as "faster than Google for quick facts."
2.  **Settings Examples:** Show "Good vs Bad" queries:
    *   ✓ "Capital of Azerbaijan"
    *   ✓ "234 times 56"
    *   ✗ "Explain quantum entanglement" (Use Cloud)
3.  **Smart Calculator:** Detect "15 * 234" regex and solve via Python math (skip LLM) for <100ms response.
4.  **Feedback Loop:** "Complex question detected. Try Cloud mode."

---
*Created: 2026-01-18*
