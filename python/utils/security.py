"""
Security utilities for dIKtate.
Provides log redaction and sensitive data handling.
"""

import re
from typing import Optional


# Sensitive data patterns for log redaction (SPEC_030)
patterns = [
    # API Keys (Gemini, OpenAI, Anthropic)
    (r'AIza[0-9A-Za-z-_]{35}', '[GEMINI_KEY]'),
    (r'sk-[a-zA-Z0-9]{20,}', '[OPENAI_KEY]'),
    (r'sk-ant-[a-zA-Z0-9\-_]{20,}', '[CLAUDE_KEY]'),
    # OAuth Tokens
    (r'ya29\.[a-zA-Z0-9\-_]{50,}', '[OAUTH_TOKEN]'),
    # Emails
    (r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '[EMAIL]'),
]


def redact_text(text: str, max_visible: int = 20, show_length: bool = True) -> str:
    """
    Redact sensitive text for logging.
    Shows first N characters and hides the rest.
    
    Args:
        text: Text to redact
        max_visible: Maximum characters to show
        show_length: Whether to show total length
    
    Returns:
        Redacted string like "Hello world...[REDACTED 150 chars]"
    """
    import os
    if os.environ.get("DIKTATE_DEBUG_UNSAFE") == "1":
        return text

    if not text:
        return "[EMPTY]"
    
    if len(text) <= max_visible:
        return "[REDACTED]"
    
    visible = text[:max_visible]
    hidden_count = len(text) - max_visible
    
    if show_length:
        return f"{visible}...[REDACTED {hidden_count} chars]"
    return f"{visible}...[REDACTED]"


def redact_api_key(key: str) -> str:
    """Redact API key, showing only first 4 and last 4 characters."""
    if not key or len(key) < 12:
        return "[REDACTED]"
    return f"{key[:4]}...{key[-4:]}"


def sanitize_log_message(message: str) -> str:
    """
    Sanitize log message by redacting potential sensitive patterns.
    - API keys (patterns like sk-, AIza, etc.)
    - Email addresses
    - Long text blocks
    """
    msg = message
    for pattern, replacement in patterns:
        msg = re.sub(pattern, replacement, msg)
    
    return msg


def scrub_pii(text: str) -> str:
    """
    Mask emails, phone numbers and other PII from text.
    Used for privacy levels where metrics are saved but identifying content is not.
    """
    if not text:
        return text
    
    # Emails
    text = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '[EMAIL]', text)
    
    # Phone numbers (common formats: +1-234-567-8901, (123) 456-7890, etc.)
    text = re.sub(r'\+?\d{1,4}[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}', '[PHONE]', text)
    
    # Sanitize known API key patterns too
    text = sanitize_log_message(text)
    
    return text
