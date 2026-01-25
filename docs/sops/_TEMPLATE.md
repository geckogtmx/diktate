---
id: SOP_000_TEMPLATE
title: [Verb] [Object] (e.g., Add New Voice Provider)
slug: [kebab-case-slug] (e.g., add-new-voice-provider)
type: [coding | process | debugging]
complexity: [low | medium | high]
author: [Your Name/AI]
last_updated: YYYY-MM-DD
tags: [template, maintenance, extension]
---

# SOP: [Task Title]

## 1. Objective
*Briefly describe the "Definition of Done". What does the world look like after this SOP is completed?*
> Example: A new TTS provider is registered in the voice factory, has a corresponding settings UI entry, and can be selected by the user to generate speech.

## 2. AI Context Instructions
*Specific instructions for an AI agent reading this file. Remove this section if not applicable or keep generic.*
> **Attention AI Agent**: When executing this SOP, strictly follow the file paths provided. Do not invent new architectural patterns. If a verification step fails, stop immediately and report the error.

## 3. Prerequisites
*   [ ] Repository is cloned and `pnpm install` has been run.
*   [ ] You have an API key for the service (if applicable).
*   [ ] Branch is clean: `git status` shows no uncommitted changes.

## 4. Execution Steps

### Step 1: [Name of Logical Step]
**Context**: *Why are we doing this?*
> Example: We need to define the interface for the new provider so TypeScript accepts it.

**Action**:
*   Target File: `src/path/to/file.ts`
*   Operation: [Create | Modify | Delete]

**Code Pattern / Instruction**:
```typescript
// Add this to the 'Providers' enum
export enum VoiceProviders {
  // ... existing
  NEW_PROVIDER = 'new_provider',
}
```

**Verification**:
*   [ ] Run `pnpm type-check` (or relevant command).
*   [ ] Ensure no red squiggles in your IDE.

---

### Step 2: [Next Step]
**Context**: *Explain the logic.*
**Action**:
*   Target File: `...`

**Code Pattern / Instruction**:
```typescript
// Code here
```

**Verification**:
*   [ ] Check...

## 5. Final Verification & Test
*How do we prove the entire feature works?*
1.  Start the app: `pnpm dev`
2.  Navigate to...
3.  Perform action...
4.  Success criteria: The app reads the text using the new voice.

## 6. Troubleshooting
| Symptom | Probable Cause | Fix |
| :--- | :--- | :--- |
| Error X | You forgot step 1 | Go back and add the enum value |
