# Prompt Engineering Analysis: Refine Mode

> **Context**: Evolution of the System Prompt for the "Refine Selection" feature (v1.0).
> **Model**: Gemma 3 (4b)

## Prompt Comparison Table

| Metric | Prompt 1: Baseline | Prompt 2: Surgical | Prompt 3: Final (Optimal) |
| :--- | :--- | :--- | :--- |
| **The Prompt** | *"Fix grammar. Improve clarity. Output only."* | *"Fix all grammar, spelling, and punctuation. Resolve logical ambiguities and improve clarity. Output only."* | *"Fix all grammar, spelling, and punctuation. Resolve logical ambiguities, verify subjects, and ensure concise phrasing. Output only."* |
| **Word Count** | 6 words | 14 words | 16 words |
| **Size Increase** | 0% (Base) | +133% | +166% |
| **Primary Focus** | Surface-level mechanics. | Context and logical flow. | Structural integrity and brevity. |
| **Logic Handling** | **Poor**: Often misses dangling modifiers and pronouns. | **Good**: Successfully maps pronouns to nouns. | **Excellent**: Corrects subject-action relationships. |
| **Tone/Style** | **Literal**: Keeps fluff if it is grammatically correct. | **Passive**: Cleans up slang but may remain wordy. | **Aggressive**: Actively trims redundant phrases. |
| **Overall Score** | 42/100 | 88/100 | 95/100 |

## Key Insights from the Evolution

1.  **The "Logic" Jump**
    The move from Prompt 1 to Prompt 2 was the most significant. Adding *"Resolve logical ambiguities"* provided the highest **Return on Instruction (ROI)**, taking the model from a basic spellchecker to a reasoning editor.

2.  **Subject Verification**
    Prompt 3's addition of *"verify subjects"* was the "silver bullet" for **Test #9 (Referent Riddle)**. It forced the 4b model to track who was doing what across multiple sentences, resolving ambiguous "he/she/it" pronouns.

3.  **Conciseness Trigger**
    By specifically requesting *"concise phrasing,"* we overcame the small model's tendency to be "over-polite" and preserve unnecessary padding words, solving **Test #4 (Fluff)**.
