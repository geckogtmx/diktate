# Benchmark Test Scripts

**Ramp Up Strategy:** We start simple and increase complexity.
For multi-line tests, make a distinct **2-second pause** where indicated `[PAUSE]`.

## Group A: Gemma 3 Baseline (Speed & Variation)

**Run 01 (Warmup - Simple)**
> "This is test run 1 for dIKta.me app."

**Run 02 (Short Command)**
> "New paragraph."

**Run 03 (Standard Sentence)**
> "This is test run 3 for dIKta.me app. The quick brown fox jumps over the lazy dog."

**Run 04 (Multi-Line - 2 Segments)**
> "This is test run 4 for dIKta.me app. We are starting to ramp up complexity."
> `[PAUSE 2s]`
> "This second sentence should flow naturally after the pause."

**Run 05 (Dirty Input - Multi-Line)**
> "This is test run 5 for dIKta.me app. This contains (um) errors."
> `[PAUSE 2s]`
> "And this second part (ahhh) has even more (fucking) issues that need cleaning."

**Run 06 (Correction - Multi-Line)**
> "This is test run 6 for dIKta.me app. I would like to order apples."
> `[PAUSE 2s]`
> "Actually (no sorry) make that bananas and strawberries."

**Run 07 (Long Prose - Paragraph)**
> "This is test run 7 for dIKta.me app. We are testing the capability of the local model to handle longer streams of continuous speech without hallucinating or losing context."
> `[PAUSE 2s]`
> "It is critical that the model maintains the thread of the conversation even when I pause to think, ensuring that the final output is a cohesive paragraph rather than fragmented sentences."

**Run 08 (Long Prose - Complex)**
> "This is test run 8 for dIKta.me app. In this test, we are evaluating three things: speed, accuracy, and flow."
> `[PAUSE 2s]`
> "First, the latency must remain under one second. Second, the transcription must be literal but clean. Third, the punctuation should be automatic and natural."

**Run 09 (Code/Tech - Structured)**
> "This is test run 9 for dIKta.me app. Import numpy as np."
> `[PAUSE 2s]`
> "Define a function called calculate_velocity that takes distance and time as arguments and returns the result."

**Run 10 (Verbal Punctuation)**
> "This is test run 10 for dIKta.me app. He looked at me and said quote unquote this is amazing."
> `[PAUSE 2s]`
> "I replied quote unquote yes indeed."

---

## Group B: Alternative Model (Llama 3)
*Switch model to `llama3:latest` before starting.*

**Run 11 (Standard)**
> "This is test run 11 for dIKta.me app. The quick brown fox jumps over the lazy dog."

**Run 12 (Dirty Multi-Line)**
> "This is test run 12. I am (um) making mistakes."
> `[PAUSE 2s]`
> "Please clean this (fucking) mess up for me."

**Run 13 (Correction Multi-Line)**
> "This is test run 13. I am going to Paris."
> `[PAUSE 2s]`
> "No wait (sorry) I meant to say London."

**Run 14 (Long Prose)**
> "This is test run 14 for dIKta.me app. We are now testing the Llama 3 model to see if it handles pauses better or worse than Gemma."
> `[PAUSE 2s]`
> "The larger parameter count might help with context, but we are worried about the latency penalty."

**Run 15 (Verbal Punctuation)**
> "This is test run 15. She said quote unquote goodbye."

---

## Group C: Stress Testing

**Run 16 (Rapid Fire)**
> "This is test run 16." (Stop) "And 17." (Stop) "And 18."

**Run 17 (Switching)**
> "This is test run 17. Switching windows now." (Alt+Tab immediately)

**Run 18 (Background Noise)**
> "This is test run 18 with music playing in the background."

**Run 19 (Prompting Mode)**
> "System. You are a helpful assistant. User. Explain quantum physics."

**Run 20 (Final)**
> "This is test run 20. Benchmark complete."
