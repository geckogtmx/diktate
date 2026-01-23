# Fix: Cloud/Local Switch Badge Not Updating in UI
> **Status:** COMPLETED ✅ (Verified by user)
> **Date:** 2026-01-22


## Problem
When user switches from Local → Cloud (or other providers) in settings, the backend successfully switches to the correct provider (Gemini API, Claude API, etc.). However, **the UI badge in the top-right doesn't update** to reflect the change.

Currently shows: Ollama model name (e.g., "gemma3:4b") regardless of actual processor
Should show: The active processor name (e.g., "Gemini Flash", "Claude Haiku", etc.)

## Root Cause
In `src/main.ts` line 647, the `badge-update` event always sends the Ollama model name:
```typescript
debugWindow.webContents.send('badge-update', { processor: config.defaultModel });
```

This doesn't account for which provider is actually active.

## Solution
Update `syncPythonConfig()` function in `src/main.ts` to send the correct processor name based on the active provider.

### Implementation Details

**File:** `src/main.ts`
**Function:** `syncPythonConfig()` (around line 594-654)
**Change:** Replace line 647 with logic that determines the processor name:

```typescript
// Determine what to show in the badge based on provider
let processorDisplay = config.defaultModel; // Default to Ollama model

if (config.provider === 'cloud' || config.provider === 'gemini') {
  processorDisplay = 'Gemini 1.5 Flash';
} else if (config.provider === 'anthropic') {
  processorDisplay = 'Claude 3.5 Haiku';
} else if (config.provider === 'openai') {
  processorDisplay = 'GPT-4o Mini';
}
// else: use Ollama model name (config.defaultModel)

// Send badge update with correct processor name
debugWindow.webContents.send('badge-update', { processor: processorDisplay });
```

## Verification
1. Start app with Local mode
2. Badge shows: "gemma3:4b" (or whatever Ollama model is set)
3. Switch to Cloud in settings
4. Badge immediately updates to: "Gemini 1.5 Flash"
5. Switch to Anthropic
6. Badge updates to: "Claude 3.5 Haiku"
7. Switch back to Local
8. Badge shows Ollama model name again
