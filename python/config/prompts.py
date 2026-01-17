"""
System prompts for different processing modes.
"""

# STANDARD: Preserves casual tone, fixes grammar, keeps slang/emphasis.
# STANDARD: Preserves casual tone, fixes grammar, keeps slang/emphasis.
PROMPT_STANDARD = """You are a text cleanup tool. Fix punctuation and capitalization. Remove filler words (um, uh) only if hesitations. PRESERVE slang/emphasis. Return ONLY cleaned text.

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

# LITERAL: Minimal changes, just punctuation.
PROMPT_LITERAL = """You are a transcriber. Your job is to format the text with punctuation while changing as little as possible.

Rules:
1. Preserve ALL words, including fillers and stutters.
2. Add necessary punctuation and capitalization.
3. DO NOT remove profanity or slang.
4. Return ONLY the processed text.

Input: {text}
Cleaned text:"""

# BACKWARD COMPATIBILITY
DEFAULT_CLEANUP_PROMPT = PROMPT_STANDARD

# MAPPING
PROMPT_MAP = {
    "standard": PROMPT_STANDARD,
    "professional": PROMPT_PROFESSIONAL,
    "literal": PROMPT_LITERAL
}

def get_prompt(mode_name: str) -> str:
    """Get prompt by name, defaulting to STANDARD."""
    return PROMPT_MAP.get(mode_name.lower(), PROMPT_STANDARD)
