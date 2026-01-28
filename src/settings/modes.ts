/**
 * Mode Configuration (SPEC_016, SPEC_029)
 */

import { state } from './store';

export async function initializeModeConfiguration() {
    try {
        const response = await fetch('http://localhost:11434/api/tags').catch(() => null);
        if (response && response.ok) {
            const data = await response.json();
            state.availableModels = data.models || [];
        }

        const modelSelect = document.getElementById('mode-detail-model') as HTMLSelectElement;
        if (modelSelect) {
            modelSelect.innerHTML = '';
            state.availableModels.forEach((model: any) => {
                const option = document.createElement('option');
                option.value = model.name;
                option.text = model.name;
                modelSelect.appendChild(option);
            });

            modelSelect.onchange = () => {
                updatePromptDisplay(state.currentSelectedMode, modelSelect.value);
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
        'raw': 'Raw'
    };

    const titleEl = document.getElementById('mode-detail-title');
    if (titleEl) {
        titleEl.textContent = modeNames[mode] || mode;
    }

    const modelSelect = document.getElementById('mode-detail-model') as HTMLSelectElement;
    if (modelSelect) {
        const settings = await window.settingsAPI.getAll();
        const savedModel = settings[`modeModel_${mode}`];
        modelSelect.value = savedModel || settings.defaultOllamaModel || 'gemma3:4b';
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

        await updatePromptDisplay(mode, modelSelect?.value);
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
    const modelSelect = document.getElementById('mode-detail-model') as HTMLSelectElement;
    let promptText = promptTextarea?.value?.trim() || '';

    const currentDefaultPrompt = await window.settingsAPI.getDefaultPrompt(state.currentSelectedMode, modelSelect?.value || '');
    if (promptText === currentDefaultPrompt) {
        promptText = '';
    }

    if (promptText && !promptText.includes('{text}')) {
        alert('❌ Prompt must include {text} placeholder');
        return;
    }

    try {
        await window.settingsAPI.saveCustomPrompt(state.currentSelectedMode, promptText);
        if (modelSelect && state.currentSelectedMode !== 'raw') {
            await window.settingsAPI.set(`modeModel_${state.currentSelectedMode}`, modelSelect.value);
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
