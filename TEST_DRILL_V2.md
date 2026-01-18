# 🎯 Focus Drill V2: Gemma 3 with Enhanced Prompt

This drill tests the **new per-model prompt** which includes explicit instructions for:
- Applying self-corrections ("X, no sorry Y" -> Y)
- Converting verbal quotes ("quote unquote X" -> "X")

## Drill A: The "Apple Correction" (Intention: Replacement)
*Goal: The output should DELETE "pineapples" using the correction logic.*
**Phrase:**
> "This thing is working well but we need to check if the pineapples (sorry, the ideas) work."

**Scorecard (Mark X):**
1. [This thing is working well, but we need to check if the ideas work. ] Correct 
2. [This thing is working well, but we need to check if the ideas work. ] Correct 
3. [This thing is working well, but we need to check if the ideas work. ] Correct 
4. [This thing is working well, but we need to check if the ideas work. ] Correct 
5. [This thing is working well, but we need to check if the ideas work. ] Correct 

---

## Drill B: The "Profanity Cleaning" (Intention: Filtering)
*Goal: The output should REMOVE the f-words entirely.*
**Phrase:**
> "Let's (fucking) see if it's still (fucking) deleting the (fucking) unwanted words."

**Scorecard (Mark X):**
1. [ Let’s see if this is still deleting unwanted words.] Clean
2. [ Let’s see if this is still deleting unwanted words.] Clean
3. [ Let’s see if this thing is still deleting unwanted words.] Clean
4. [ Let’s see if they’re still deleting unwanted words.] Clean
5. [ Let’s see if this is still deleting unwanted words.] Clean

---

## Drill C: "Verbal Quotes" (Intention: Formatting)
*Goal: The output should use "quotation marks" not words.*
**Phrase:**
> "He looked at me and said quote unquote this is amazing."

**Scorecard (Mark X):**
1. [ He looked at me and said “this is amazing.”] Formatted
2. [ He looked at me and said, “This is brutally handsome.”] Formatted
3. [ He looked at me and said this is hilarious.] Formatted
4. [ He looked at me and said, “This is amazing.”] Formatted
5. [ He looked at me and said, “This is wonderful.”] Formatted
