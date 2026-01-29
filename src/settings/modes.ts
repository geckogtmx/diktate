/**
 * Mode Configuration (SPEC_016, SPEC_029)
 */

import { state } from './store.js';

export async function initializeModeConfiguration() {
    try {
        const providerSelect = document.getElementById('mode-detail-model') as HTMLSelectElement;
        if (providerSelect) {
            providerSelect.innerHTML = '';

            // Add "Local (App Default)" option
            const defaultOption = document.createElement('option');
            defaultOption.value = 'local';
            defaultOption.text = 'Local (App Default)';
            providerSelect.appendChild(defaultOption);

            // Add divider
            const divider = document.createElement('option');
            divider.disabled = true;
            divider.text = '──────────';
            providerSelect.appendChild(divider);

            // Fetch API key statuses to show available cloud providers
            const apiKeys = await window.settingsAPI.getApiKeys();

            if (apiKeys.geminiApiKey) {
                const opt = document.createElement('option');
                opt.value = 'gemini';
                opt.text = 'Gemini (Cloud)';
                providerSelect.appendChild(opt);
            }
            if (apiKeys.anthropicApiKey) {
                const opt = document.createElement('option');
                opt.value = 'anthropic';
                opt.text = 'Claude (Cloud)';
                providerSelect.appendChild(opt);
            }
            if (apiKeys.openaiApiKey) {
                const opt = document.createElement('option');
                opt.value = 'openai';
                opt.text = 'OpenAI (Cloud)';
                providerSelect.appendChild(opt);
            }

            providerSelect.onchange = async () => {
                const newValue = providerSelect.value;
                if (state.currentSelectedMode && state.currentSelectedMode !== 'raw') {
                    await window.settingsAPI.set(`modeProvider_${state.currentSelectedMode}`, newValue);
                    // Legacy cleanup: remove model override if switching to cloud
                    if (newValue !== 'local') {
                        await window.settingsAPI.set(`modeModel_${state.currentSelectedMode}`, '');
                    }
                }
                updatePromptDisplay(state.currentSelectedMode, newValue);
            };
        }

        await loadPrompts();
        await selectMode('standard');
    } catch (error) {
        console.error('Failed to initialize mode configuration:', error);
    }
}

export async function loadPrompts() {
    try {
        const customPrompts = await window.settingsAPI.getCustomPrompts();
        const defaults = await window.settingsAPI.getDefaultPrompts();
        (window as any).customPrompts = customPrompts || {};
        state.defaultPrompts = defaults || {};
    } catch (error) {
        console.error('Failed to load prompts:', error);
    }
}

export async function selectMode(mode: string) {
    state.currentSelectedMode = mode;

    const modeListItems = document.querySelectorAll('.mode-list-item');
    modeListItems.forEach(item => {
        const content = item.textContent?.trim().toLowerCase();
        item.classList.toggle('active', content?.includes(mode));
    });

    const modeNames: Record<string, string> = {
        'standard': 'Standard',
        'prompt': 'Prompt',
        'professional': 'Professional',
        'raw': 'Raw',
        'ask': 'Ask (Q&A)',
        'refine': 'Refine'
    };

    const titleEl = document.getElementById('mode-detail-title');
    if (titleEl) {
        titleEl.textContent = modeNames[mode] || mode;
    }

    const providerSelect = document.getElementById('mode-detail-model') as HTMLSelectElement;
    if (providerSelect) {
        const settings = await window.settingsAPI.getAll();
        const savedProvider = settings[`modeProvider_${mode}`];
        providerSelect.value = savedProvider || 'local';
    }

    const modelSection = document.getElementById('mode-detail-model')?.parentElement;
    const promptTextarea = document.getElementById('mode-detail-prompt') as HTMLTextAreaElement;
    const promptLabel = promptTextarea?.previousElementSibling as HTMLElement;
    const buttonContainer = document.querySelector('button[onclick="window.modes.saveModeDetails()"]')?.parentElement;
    const infoEl = document.getElementById('prompt-info');

    if (mode === 'raw') {
        if (modelSection) modelSection.style.display = 'none';
        if (promptTextarea) promptTextarea.style.display = 'none';
        if (promptLabel) promptLabel.style.display = 'none';
        if (buttonContainer) buttonContainer.style.display = 'none';

        if (infoEl) {
            infoEl.style.marginTop = '0';
            infoEl.innerHTML = `
                <div style="color: #e0e0e0; font-family: sans-serif; line-height: 1.6;">
                    <p style="margin-top: 0;">Raw mode injects text directly from Whisper with <strong>zero latency</strong>.</p>
                </div>
            `;
            infoEl.style.color = 'inherit';
        }
    } else {
        if (modelSection) modelSection.style.display = 'block';
        if (promptTextarea) promptTextarea.style.display = 'block';
        if (promptLabel) promptLabel.style.display = 'block';
        if (buttonContainer) buttonContainer.style.display = 'flex';
        if (infoEl) infoEl.style.marginTop = '4px';

        await updatePromptDisplay(mode, providerSelect?.value);
    }
}

export async function updatePromptDisplay(mode: string, model: string) {
    const promptTextarea = document.getElementById('mode-detail-prompt') as HTMLTextAreaElement;
    if (!promptTextarea) return;

    const customPrompts = (window as any).customPrompts || {};
    const customPrompt = customPrompts[mode];

    if (customPrompt && customPrompt.length > 0) {
        promptTextarea.value = customPrompt;
    } else {
        try {
            const defaultPrompt = await window.settingsAPI.getDefaultPrompt(mode, model);
            promptTextarea.value = defaultPrompt;
        } catch (e) {
            promptTextarea.value = '';
        }
    }

    const infoEl = document.getElementById('prompt-info');
    if (infoEl) {
        const hasCustom = customPrompt && customPrompt.length > 0;
        infoEl.textContent = hasCustom ? `✓ Custom prompt in use` : 'No custom prompt';
        infoEl.style.color = hasCustom ? '#4ade80' : '#888';
    }
}

export async function saveModeDetails() {
    const promptTextarea = document.getElementById('mode-detail-prompt') as HTMLTextAreaElement;
    const providerSelect = document.getElementById('mode-detail-model') as HTMLSelectElement;
    let promptText = promptTextarea?.value?.trim() || '';

    const currentDefaultPrompt = await window.settingsAPI.getDefaultPrompt(state.currentSelectedMode, providerSelect?.value || '');
    if (promptText === currentDefaultPrompt) {
        promptText = '';
    }

    if (promptText && !promptText.includes('{text}')) {
        alert('❌ Prompt must include {text} placeholder');
        return;
    }

    try {
        await window.settingsAPI.saveCustomPrompt(state.currentSelectedMode, promptText);
        if (providerSelect && state.currentSelectedMode !== 'raw') {
            await window.settingsAPI.set(`modeProvider_${state.currentSelectedMode}`, providerSelect.value);
        }

        // feedback
        const saveBtn = document.getElementById('save-mode-btn');
        if (saveBtn) {
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saved!';
            saveBtn.style.backgroundColor = '#22c55e'; // Green
            setTimeout(() => {
                if (saveBtn) {
                    saveBtn.textContent = originalText;
                    saveBtn.style.backgroundColor = ''; // Revert to default
                }
            }, 2000);
        }

        await loadPrompts();
        selectMode(state.currentSelectedMode);
    } catch (error) {
        alert(`❌ Error: ${error}`);
    }
}

export async function resetModeToDefault() {
    if (!confirm(`Reset ${state.currentSelectedMode} mode to default?`)) return;
    try {
        const result = await window.settingsAPI.resetCustomPrompt(state.currentSelectedMode);
        if (result.success) {
            await loadPrompts();
            selectMode(state.currentSelectedMode);
        }
    } catch (error) {
        alert(`❌ Error: ${error}`);
    }
}
