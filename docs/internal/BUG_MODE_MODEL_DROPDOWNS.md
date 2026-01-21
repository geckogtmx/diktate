# BUG: Mode-Specific Model Dropdowns Not Populating

> **Reported:** 2026-01-19 19:27
> **Severity:** Medium
> **Status:** RESOLVED
> **Resolution Date:** 2026-01-19 19:47
> **Root Cause:** Script was being compiled as a CommonJS module due to 'export {}' statement, causing "exports is not defined" error in browser.
> **Fix:** Removed 'export {}' to keep script as a plain browser script + updated IPC validation schemas.
> **Affects:** Settings UI → Modes Tab → Mode-Specific Models section

---

## Problem Description

The dropdown menus for mode-specific model selection (Standard, Prompt, Professional) only show "Use default model" and do not populate with available Ollama models.

**Expected Behavior:**
- Dropdowns should show all installed Ollama models (e.g., gemma3:4b, phi3:mini, mistral:latest)
- User can select different models for each mode

**Actual Behavior:**
- Dropdowns only show "Use default model"
- No models are listed

**Screenshot:**
![Bug Screenshot](../../../.gemini/antigravity/brain/2603af31-b08e-4f64-9401-a947d7ad1105/uploaded_image_1768872421426.png)

---

## Environment

- **OS:** Windows
- **Ollama:** Running (verified with `ollama ps`)
- **Models Installed:** gemma3:4b, phi3:mini, mistral:latest (verified with `Invoke-RestMethod http://localhost:11434/api/tags`)
- **App Mode:** Dev (`pnpm dev`)

---

## Investigation Summary

### What Was Tried

1. **Added retry logic** - Function retries 3 times with 1s delay
2. **Fixed AbortSignal.timeout** - Replaced with manual AbortController for Electron compatibility
3. **Added debug logging** - Added `console.log('🔍 [DEBUG] populateModeModelDropdowns called')` at line 607

### Key Finding

**The debug message never appears in terminal output**, which means:
- Either the function is never being called
- Or there's an error earlier in the initialization chain that prevents execution

### Verified Working

- ✅ Ollama is running and responding
- ✅ Ollama API returns models correctly (`/api/tags` endpoint)
- ✅ Function is called in `DOMContentLoaded` handler (line 47)
- ✅ Other Ollama-dependent features work (General tab model dropdown works)

---

## Code Location

**File:** `src/settings.ts`

**Function:** `populateModeModelDropdowns()` (line 606)

**Called From:** `DOMContentLoaded` event listener (line 47)

```typescript
// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Settings window loaded');
    try {
        const settings = await window.settingsAPI.getAll();
        loadSettings(settings);
        // Refresh devices initially
        await refreshAudioDevices(settings.audioDeviceId);
        // Load Ollama models
        await loadOllamaModels();  // ← This works (General tab)
        // Check Ollama status
        await checkOllamaStatus();
        // Populate per-mode model dropdowns
        await populateModeModelDropdowns();  // ← This doesn't work
        // Load API key statuses
        await loadApiKeyStatuses();
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
});
```

**Function Code:**
```typescript
async function populateModeModelDropdowns() {
    console.log('🔍 [DEBUG] populateModeModelDropdowns called');  // ← Never appears
    const modes = ['standard', 'prompt', 'professional'];

    try {
        // Retry up to 3 times with 1 second delay (Ollama might be starting up)
        let response;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                // Manual timeout using AbortController for compatibility
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                
                response = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (response.ok) break;
            } catch (e) {
                attempts++;
                if (attempts < maxAttempts) {
                    console.log(`Ollama not ready, retrying (${attempts}/${maxAttempts})...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        if (!response || !response.ok) {
            console.warn('Ollama not available for model dropdowns');
            return;
        }

        const data = await response.json();
        const models = data.models || [];

        if (models.length === 0) {
            console.warn('No Ollama models found');
            return;
        }

        for (const mode of modes) {
            const select = document.getElementById(`model-${mode}`) as HTMLSelectElement;
            if (!select) continue;

            // Clear and add default option
            select.innerHTML = '<option value="">Use default model</option>';

            // Add all models
            models.forEach((model: any) => {
                const option = document.createElement('option');
                option.value = model.name;
                option.text = `${model.name} (${formatBytes(model.size)})`;
                select.appendChild(option);
            });

            // Restore saved value
            const settings = await window.settingsAPI.getAll();
            const savedModel = settings[`modeModel_${mode}`];
            if (savedModel) {
                select.value = savedModel;
            }
        }

        console.log(`Populated mode dropdowns with ${models.length} models`);
    } catch (e) {
        console.error('Failed to populate mode model dropdowns:', e);
    }
}
```

---

## Debugging Steps for Next Developer

### 1. Enable DevTools in Settings Window

The Settings window doesn't have DevTools enabled. Add this to the window creation:

```typescript
// In main.ts, find where settingsWindow is created
settingsWindow.webContents.openDevTools(); // Add this line
```

### 2. Check Console for Errors

Once DevTools is enabled:
- Open Settings → Modes tab
- Check Console tab for errors
- Look for the debug message `🔍 [DEBUG] populateModeModelDropdowns called`

### 3. Check if Earlier Function Fails

Add debug logs to the functions called before `populateModeModelDropdowns`:

```typescript
await loadOllamaModels();  // Add console.log here
await checkOllamaStatus(); // Add console.log here
await populateModeModelDropdowns(); // Already has debug log
```

### 4. Verify HTML Element IDs

Check if the dropdown elements exist:

```typescript
console.log('Standard dropdown:', document.getElementById('model-standard'));
console.log('Prompt dropdown:', document.getElementById('model-prompt'));
console.log('Professional dropdown:', document.getElementById('model-professional'));
```

**Expected IDs (from settings.html):**
- `model-standard` (line 523)
- `model-prompt` (line 538)
- `model-professional` (line 553)

### 5. Check for Async/Await Issues

The function might be throwing an error that's being caught by the outer try-catch. Add more granular error handling:

```typescript
try {
    await populateModeModelDropdowns();
} catch (e) {
    console.error('❌ populateModeModelDropdowns failed:', e);
    throw e; // Re-throw to see full stack trace
}
```

---

## Workaround

**None currently.** Users can still use the default model, but cannot assign different models to different modes.

---

## Related Code

- **General tab model dropdown:** Works correctly (uses `loadOllamaModels()` function)
- **Ollama tab:** Works correctly (shows models list)
- **Mode-specific dropdowns:** Broken

**Comparison:**

| Feature | Function | Status |
|---------|----------|--------|
| General → Default AI Model | `loadOllamaModels()` | ✅ Works |
| Ollama → Installed Models | `loadOllamaModelsList()` | ✅ Works |
| Modes → Mode-Specific Models | `populateModeModelDropdowns()` | ❌ Broken |

---

## Next Steps

1. Enable DevTools in Settings window
2. Check browser console for errors
3. Verify function is actually being called
4. Check if HTML elements exist
5. Add more granular error logging
6. Compare with working `loadOllamaModels()` function

---

## Files to Review

- `src/settings.ts` (line 606-670)
- `src/settings.html` (line 515-572 - Mode-Specific Models section)
- `src/main.ts` (Settings window creation)
