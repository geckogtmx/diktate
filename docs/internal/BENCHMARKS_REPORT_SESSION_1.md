# Benchmark Report: Group A (Gemma 3 4B)

**Date:** 2026-01-18
**Model:** `gemma3:4b` (Ollama)
**Hardware:** Local CPU/GPU Mix

## 📊 Executive Summary
**"The Speed Demon with a Literal Mind."**
Gemma 3 is exceptionally fast, making it perfect for raw dictation where latency is king. However, it fails significantly at "Smart Processing" tasks (corrections, formatting, cleanup), often behaving more like a high-quality transcriber than an intelligent editor.

## ⏱️ Quantitative: Speed Performance
*Consistently under 1.2 seconds, even for long inputs.*

| Run Type | Avg Latency | Comparison (Est.) |
|:---|:---|:---|
| **Short Command** | **~300ms** | ⚡ Instant |
| **Standard Sentence** | **~600ms** | ⚡ Instant |
| **Long Prose (40s+)** | **~1.1s** | 🚀 3x Faster than Real-time |

**Verdict:** ✅ **PASSED**. Latency is negligible. It feels native.

## 🧠 Qualitative: Intelligence & Formatting
*Struggles with complex instructions and context.*

| Test | Output | Result | Analysis |
|:---|:---|:---|:---|
| **Run 05 (Profanity)** | "...has even more **fucking** issues..." | ❌ **FAIL** | Failed to filter standard profanity. |
| **Run 06 (Correction)** | "Actually, **no, sorry,** make that..." | ❌ **FAIL** | Transcribed the correction literally instead of applying it. |
| **Run 09 (Coding)** | "...calculate velocity..." | ⚠️ **WEAK** | Lowercase, run-on sentence. Did not format as code snippet. |
| **Run 10 (Quotes)** | "...said, **“quote unquote,** this..." | ❌ **FAIL** | Transcribed the instruction literal words instead of converting to punctuation. |


## 🎯 Focus Drill: Consistency Check (N=5)
*We ran 15 rapid-fire tests to verify the initial failures. The results were surprising.*
**Note:** User reported being closer to the mic and speaking louder for these drills, effectively increasing Signal-to-Noise Ratio (SNR).

| Feature | Success Rate | Analysis |
|:---|:---|:---|
| **Verbal Quotes** | **100% (5/5)** | 🟢 **PASSED.** Initial failure was an anomaly. Gemma 3 handles quotes perfectly well. |
| **Profanity Filter** | **80% (4/5)** | 🟡 **GOOD.** It works most of the time. Only 1/5 runs leaked a "shit". |
| **Correction Logic** | **20% (1/5)** | 🔴 **FAILED.** It consistently fails to perform "search and replace" logic. |

## 🎯 Focus Drill V2: Enhanced Prompt Test (N=5)
*After implementing `PROMPT_GEMMA_STANDARD` with explicit correction/quote rules.*

| Feature | V1 Rate | V2 Rate | Change |
|:---|:---|:---|:---|
| **Correction (apples->ideas)** | 20% | **100%** | 🟢 **+80%** |
| **Profanity Filter** | 80% | **100%** | 🟢 **+20%** |
| **Verbal Quotes** | 100% | **80%** | 🟡 **-20%** (Run 3 missed) |

**Processing Time (V2):** Avg ~430ms (No latency penalty from longer prompt)


## 🏁 Conclusion for Group A
**Revised Verdict:** Gemma 3 is **better than initially thought**.
- Speed is world-class (<500ms for short phrases).
- Formatting (quotes, punctuation) is reliable upon repetition.
- **BUT:** It is not a "smart editor." Do not expect it to rewrite sentences based on parenthetical commands.

**Recommendation:** Default model for standard users. Switch to Llama 3 only for "Power Editing."

