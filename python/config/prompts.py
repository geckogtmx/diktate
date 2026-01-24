"""
System prompts for different processing modes.

Modes:
- Standard: General-purpose, preserves casual tone, fixes grammar
- Prompt: Optimized for LLM prompts, structured and clear
- Professional: Business-ready, polite, removes slang/profanity
- Raw (Literal): Minimal changes, just punctuation
"""

# STANDARD: Preserves casual tone, fixes grammar, keeps slang/emphasis.
PROMPT_STANDARD = """You are a text cleanup tool. Fix punctuation and capitalization. Remove filler words (um, uh) only if hesitations. PRESERVE slang/emphasis. Return ONLY cleaned text. Do not include introductory text.

Input: {text}
Cleaned text:"""

# PROMPT: Optimized for LLM prompting, structured and clear.
PROMPT_PROMPT = """You are a prompt engineer. Your job is to clean up spoken text into a clear, structured prompt for an AI model.

Rules:
1. Remove ALL filler words, hesitations, and false starts.
2. Fix punctuation, capitalization, and grammar.
3. Preserve technical terms and specific instructions exactly.
4. Structure the output clearly (use bullet points if appropriate).
5. Return ONLY the cleaned prompt text.

Input: {text}
Cleaned text:"""

# PROFESSIONAL: Removes slang, profanity, and makes it business-ready.
PROMPT_PROFESSIONAL = """You are a professional editor. Your job is to polish the text for a business context.

Rules:
1. Remove ALL filler words, hesitations, and false starts.
2. Fix punctuation, capitalization, and grammar.
3. Remove profanity.
4. Ensure the tone is polite and clear.
5. Return ONLY the cleaned text.

Input: {text}
Cleaned text:"""

# RAW (LITERAL): Minimal changes, just punctuation.
PROMPT_RAW = """You are a transcriber. Your job is to format the text with punctuation while changing as little as possible.

Rules:
1. Preserve ALL words, including fillers and stutters.
2. Add necessary punctuation and capitalization.
3. DO NOT remove profanity or slang.
4. Return ONLY the processed text.

Input: {text}
Cleaned text:"""

# REFINE: In-place text improvement (for Refine Mode)
PROMPT_REFINE = """Fix grammar, improve clarity. Return only refined text.

Input: {text}
Cleaned text:"""

# BACKWARD COMPATIBILITY
DEFAULT_CLEANUP_PROMPT = PROMPT_STANDARD
PROMPT_LITERAL = PROMPT_RAW  # Alias for backward compatibility

# --- MODEL-SPECIFIC OVERRIDES ---
# Gemma 3 (4B) needs stricter instructions due to smaller capacity.
PROMPT_GEMMA_STANDARD = """Dictation cleanup. Fix punctuation, remove fillers, apply corrections. Nothing else added.

Input: {text}
Cleaned text:"""

PROMPT_GEMMA_REFINE = """Fix grammar. Improve clarity. Output only.

Input: {text}
Cleaned text:"""

PROMPT_MAP = {
    "standard": PROMPT_STANDARD,
    "prompt": PROMPT_PROMPT,
    "professional": PROMPT_PROFESSIONAL,
    "raw": PROMPT_RAW,
    "literal": PROMPT_RAW,  # Alias
    "refine": PROMPT_REFINE,  # Refine Mode
}

# Per-model overrides: model_name -> { mode -> prompt }
MODEL_PROMPT_OVERRIDES = {
    "gemma3:4b": {
        "standard": PROMPT_GEMMA_STANDARD,
        "refine": PROMPT_GEMMA_REFINE,
    },
    # Add other model-specific prompts here as needed
}

# --- TRANSLATION PROMPTS ---

# Spanish to English
PROMPT_TRANSLATE_ES_EN = """You are a translator. Translate the following Spanish text to English.

Rules:
1. Preserve the original meaning and tone.
2. Keep technical terms accurate.
3. Return ONLY the English translation.

Spanish: {text}
English:"""

# English to Spanish
PROMPT_TRANSLATE_EN_ES = """You are a translator. Translate the following English text to Spanish.

Rules:
1. Preserve the original meaning and tone.
2. Keep technical terms accurate.
3. Return ONLY the Spanish translation.

English: {text}
Spanish:"""

TRANSLATION_MAP = {
    "es-en": PROMPT_TRANSLATE_ES_EN,
    "en-es": PROMPT_TRANSLATE_EN_ES,
    "none": None,
}

def get_prompt(mode_name: str, model: str = None) -> str:
    """Get prompt by mode and optionally model. Model overrides take priority."""
    mode_lower = mode_name.lower()
    
    # Check for model-specific override first
    if model and model in MODEL_PROMPT_OVERRIDES:
        model_overrides = MODEL_PROMPT_OVERRIDES[model]
        if mode_lower in model_overrides:
            return model_overrides[mode_lower]
    
    # Fall back to default mode prompt
    return PROMPT_MAP.get(mode_lower, PROMPT_STANDARD)

def get_translation_prompt(trans_mode: str) -> str | None:
    """Get translation prompt by mode. Returns None if 'none' or invalid."""
    return TRANSLATION_MAP.get(trans_mode.lower(), None)

