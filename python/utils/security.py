"""
Security utilities for dIKtate.
Provides log redaction and sensitive data handling.
"""

import re
from typing import Optional


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
    # Redact API key patterns
    patterns = [
        (r'(sk-ant-[a-zA-Z0-9_-]+)', r'sk-ant-[REDACTED]'),  # Anthropic (must be before generic sk-)
        (r'(sk-[a-zA-Z0-9]{20,})', r'sk-[REDACTED]'),  # OpenAI
        (r'(AIza[a-zA-Z0-9_-]{30,})', r'AIza[REDACTED]'),  # Google
        (r'(Bearer\s+[a-zA-Z0-9_-]{20,})', r'Bearer [REDACTED]'),
    ]
    
    result = message
    for pattern, replacement in patterns:
        result = re.sub(pattern, replacement, result)
    
    return result
