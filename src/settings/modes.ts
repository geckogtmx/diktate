/**
 * Mode Configuration - Dual-Profile System (SPEC_034_EXTRAS)
 * Manages Local and Cloud profiles for each mode with a unified toggle
 */

import { state } from './store.js';

/**
 * Initialize the dual-profile mode configuration system
 */
export async function initializeModeConfiguration() {
    try {
        // Initialize global processing mode toggle
        await initializeGlobalToggle();

        // Setup mode list click handlers
        const modeListItems = document.querySelectorAll('.mode-list-item');
        modeListItems.forEach(item => {
            item.addEventListener('click', async () => {
                const mode = item.getAttribute('data-mode');
                if (mode) selectMode(mode);
            });
        });

        // Setup button handlers
        setupButtonHandlers();

        // Setup listener for external toggle changes (from Control Panel)
        setupToggleChangeListener();

        // Load initial mode (Standard)
        await selectMode('standard');
    } catch (error) {
        console.error('Failed to initialize mode configuration:', error);
    }
}

/**
 * Initialize the global processing mode toggle
 */
async function initializeGlobalToggle() {
    const toggle = document.getElementById('global-processing-toggle') as HTMLInputElement;
    const statusText = document.getElementById('processing-mode-status');

    if (!toggle) return;

    // Load current processing mode
    const settings = await window.settingsAPI.getAll();
    const processingMode = settings.processingMode || 'local';
    toggle.checked = processingMode === 'cloud';
    updateProcessingModeStatus(processingMode);
    updateProfileSections(processingMode);

    // Toggle change handler
    toggle.addEventListener('change', async () => {
        const newMode = toggle.checked ? 'cloud' : 'local';
        await window.settingsAPI.set('processingMode', newMode);
        updateProcessingModeStatus(newMode);
        updateProfileSections(newMode);

        // Show feedback
        if (statusText) {
            const message = newMode === 'local' ? 'Saved! Now using: Local' : 'Saved! Now using: Cloud';
            statusText.textContent = message;
            setTimeout(() => updateProcessingModeStatus(newMode), 2000);
        }
    });
}

/**
 * Update the status text display
 */
function updateProcessingModeStatus(mode: string) {
    const statusText = document.getElementById('processing-mode-status');
    if (!statusText) return;

    if (mode === 'local') {
        statusText.textContent = 'Currently using: Local (Offline, Confidential)';
        statusText.style.color = '#4ade80';
    } else {
        statusText.textContent = 'Currently using: Cloud (Faster, Paid)';
        statusText.style.color = '#60a5fa';
    }
}

/**
 * Update profile sections visibility and styling based on active mode
 */
function updateProfileSections(mode: string) {
    const localSection = document.getElementById('local-profile-section');
    const cloudSection = document.getElementById('cloud-profile-section');
    const localBadge = localSection?.querySelector('.profile-badge');
    const cloudBadge = cloudSection?.querySelector('.profile-badge');

    if (mode === 'local') {
        localSection?.setAttribute('data-active', 'true');
        cloudSection?.setAttribute('data-active', 'false');
        if (localBadge) {
            localBadge.textContent = 'Active';
            localBadge.className = 'profile-badge active-badge';
        }
        if (cloudBadge) {
            cloudBadge.textContent = 'Inactive';
            cloudBadge.className = 'profile-badge inactive-badge';
        }
    } else {
        localSection?.setAttribute('data-active', 'false');
        cloudSection?.setAttribute('data-active', 'true');
        if (localBadge) {
            localBadge.textContent = 'Inactive';
            localBadge.className = 'profile-badge inactive-badge';
        }
        if (cloudBadge) {
            cloudBadge.textContent = 'Active';
            cloudBadge.className = 'profile-badge active-badge';
        }
    }
}

/**
 * Select a mode and load its dual-profile configuration
 */
export async function selectMode(mode: string) {
    state.currentSelectedMode = mode;

    // Update mode list UI
    const modeListItems = document.querySelectorAll('.mode-list-item');
    modeListItems.forEach(item => {
        const content = item.textContent?.trim().toLowerCase();
        item.classList.toggle('active', content?.includes(mode));
    });

    // Update title
    const modeNames: Record<string, string> = {
        'standard': 'Standard',
        'prompt': 'Prompt',
        'professional': 'Professional',
        'raw': 'Raw',
        'ask': 'Ask (Q&A)',
        'refine': 'Refine',
        'refine_instruction': 'Refine (Instruction)',
        'note': 'Note'
    };

    const titleEl = document.getElementById('mode-detail-title');
    if (titleEl) {
        titleEl.textContent = `${modeNames[mode] || mode} Mode`;
    }

    // Load both profiles for this mode
    await loadDualProfileForMode(mode);
}

/**
 * Load both local and cloud profiles for a mode
 */
async function loadDualProfileForMode(mode: string) {
    const settings = await window.settingsAPI.getAll();

    // Load Local Profile
    const localModel = settings[`localModel_${mode}`] || '';
    const localPrompt = settings[`localPrompt_${mode}`] || '';

    const localModelSelect = document.getElementById('local-model-select') as HTMLSelectElement;
    const localPromptTextarea = document.getElementById('local-prompt-textarea') as HTMLTextAreaElement;
    const localPromptInfo = document.getElementById('local-prompt-info');

    if (localModelSelect) {
        await loadOllamaModels(localModelSelect, mode);
        if (localModel) localModelSelect.value = localModel;
    }

    if (localPromptTextarea) {
        localPromptTextarea.value = localPrompt;
    }

    if (localPromptInfo) {
        localPromptInfo.textContent = localPrompt ? '✓ Custom prompt in use' : 'No custom prompt';
        localPromptInfo.style.color = localPrompt ? '#4ade80' : '#888';
    }

    // Load Cloud Profile
    const cloudProvider = settings[`cloudProvider_${mode}`] || 'gemini';
    const cloudModel = settings[`cloudModel_${mode}`] || '';
    const cloudPrompt = settings[`cloudPrompt_${mode}`] || '';

    const cloudProviderSelect = document.getElementById('cloud-provider-select') as HTMLSelectElement;
    const cloudModelSelect = document.getElementById('cloud-model-select') as HTMLSelectElement;
    const cloudPromptTextarea = document.getElementById('cloud-prompt-textarea') as HTMLTextAreaElement;
    const cloudPromptInfo = document.getElementById('cloud-prompt-info');

    if (cloudProviderSelect) {
        cloudProviderSelect.value = cloudProvider;
        // Trigger model load for selected provider
        await loadCloudModels(cloudModelSelect, cloudProvider, mode);
    }

    if (cloudModelSelect && cloudModel) {
        cloudModelSelect.value = cloudModel;
    }

    if (cloudPromptTextarea) {
        cloudPromptTextarea.value = cloudPrompt;
    }

    if (cloudPromptInfo) {
        cloudPromptInfo.textContent = cloudPrompt ? '✓ Custom prompt in use' : 'No custom prompt';
        cloudPromptInfo.style.color = cloudPrompt ? '#4ade80' : '#888';
    }

    // Setup provider change handler
    if (cloudProviderSelect) {
        cloudProviderSelect.onchange = async () => {
            const newProvider = cloudProviderSelect.value;
            await loadCloudModels(cloudModelSelect, newProvider, mode);
        };
    }
}

/**
 * Setup all button event handlers
 */
function setupButtonHandlers() {
    const saveLocalBtn = document.getElementById('save-local-profile');
    const saveCloudBtn = document.getElementById('save-cloud-profile');
    const resetLocalBtn = document.getElementById('reset-local-profile');
    const resetCloudBtn = document.getElementById('reset-cloud-profile');
    const localRefreshBtn = document.getElementById('local-model-refresh');
    const cloudRefreshBtn = document.getElementById('cloud-model-refresh');

    if (saveLocalBtn) saveLocalBtn.onclick = () => saveLocalProfile();
    if (saveCloudBtn) saveCloudBtn.onclick = () => saveCloudProfile();
    if (resetLocalBtn) resetLocalBtn.onclick = () => resetLocalProfile();
    if (resetCloudBtn) resetCloudBtn.onclick = () => resetCloudProfile();

    if (localRefreshBtn) {
        localRefreshBtn.onclick = async () => {
            const select = document.getElementById('local-model-select') as HTMLSelectElement;
            await loadOllamaModels(select, state.currentSelectedMode);
        };
    }

    if (cloudRefreshBtn) {
        cloudRefreshBtn.onclick = async () => {
            const providerSelect = document.getElementById('cloud-provider-select') as HTMLSelectElement;
            const modelSelect = document.getElementById('cloud-model-select') as HTMLSelectElement;
            await loadCloudModels(modelSelect, providerSelect.value, state.currentSelectedMode);
        };
    }
}

/**
 * Setup listener for toggle changes from other windows (Control Panel, etc)
 * Listens for 'setting-changed' IPC event from main process
 */
function setupToggleChangeListener() {
    // Try to listen via electronAPI if available
    if ((window as any).electronAPI?.on) {
        (window as any).electronAPI.on('setting-changed', (key: string, value: any) => {
            if (key === 'processingMode') {
                const toggle = document.getElementById('global-processing-toggle') as HTMLInputElement;
                if (toggle) {
                    toggle.checked = value === 'cloud';
                    updateProcessingModeStatus(value);
                    updateProfileSections(value);
                }
            }
        });
    }
}

/**
 * Save local profile
 */
async function saveLocalProfile() {
    const mode = state.currentSelectedMode;
    const modelSelect = document.getElementById('local-model-select') as HTMLSelectElement;
    const promptTextarea = document.getElementById('local-prompt-textarea') as HTMLTextAreaElement;

    if (!modelSelect || !promptTextarea) return;

    const model = modelSelect.value;
    const prompt = promptTextarea.value.trim();

    // Validate prompt if provided
    if (prompt && !prompt.includes('{text}')) {
        alert('❌ Prompt must include {text} placeholder');
        return;
    }

    try {
        await window.settingsAPI.set(`localModel_${mode}`, model);
        await window.settingsAPI.set(`localPrompt_${mode}`, prompt);

        // Show success feedback
        const saveBtn = document.getElementById('save-local-profile');
        if (saveBtn) {
            const originalText = saveBtn.textContent;
            saveBtn.textContent = '✓ Saved!';
            saveBtn.style.backgroundColor = '#22c55e';
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.style.backgroundColor = '';
            }, 2000);
        }

        // Update prompt info
        const promptInfo = document.getElementById('local-prompt-info');
        if (promptInfo) {
            promptInfo.textContent = prompt ? '✓ Custom prompt in use' : 'No custom prompt';
            promptInfo.style.color = prompt ? '#4ade80' : '#888';
        }
    } catch (error) {
        alert(`❌ Error: ${error}`);
    }
}

/**
 * Save cloud profile
 */
async function saveCloudProfile() {
    const mode = state.currentSelectedMode;
    const providerSelect = document.getElementById('cloud-provider-select') as HTMLSelectElement;
    const modelSelect = document.getElementById('cloud-model-select') as HTMLSelectElement;
    const promptTextarea = document.getElementById('cloud-prompt-textarea') as HTMLTextAreaElement;

    if (!providerSelect || !modelSelect || !promptTextarea) return;

    const provider = providerSelect.value;
    const model = modelSelect.value;
    const prompt = promptTextarea.value.trim();

    // Validate prompt if provided
    if (prompt && !prompt.includes('{text}')) {
        alert('❌ Prompt must include {text} placeholder');
        return;
    }

    try {
        await window.settingsAPI.set(`cloudProvider_${mode}`, provider);
        await window.settingsAPI.set(`cloudModel_${mode}`, model);
        await window.settingsAPI.set(`cloudPrompt_${mode}`, prompt);

        // Show success feedback
        const saveBtn = document.getElementById('save-cloud-profile');
        if (saveBtn) {
            const originalText = saveBtn.textContent;
            saveBtn.textContent = '✓ Saved!';
            saveBtn.style.backgroundColor = '#22c55e';
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.style.backgroundColor = '';
            }, 2000);
        }

        // Update prompt info
        const promptInfo = document.getElementById('cloud-prompt-info');
        if (promptInfo) {
            promptInfo.textContent = prompt ? '✓ Custom prompt in use' : 'No custom prompt';
            promptInfo.style.color = prompt ? '#4ade80' : '#888';
        }
    } catch (error) {
        alert(`❌ Error: ${error}`);
    }
}

/**
 * Reset local profile to defaults
 */
async function resetLocalProfile() {
    const mode = state.currentSelectedMode;
    if (!confirm(`Reset Local profile for ${mode} mode to default?`)) return;

    try {
        await window.settingsAPI.set(`localModel_${mode}`, '');
        await window.settingsAPI.set(`localPrompt_${mode}`, '');
        await selectMode(mode); // Reload
    } catch (error) {
        alert(`❌ Error: ${error}`);
    }
}

/**
 * Reset cloud profile to defaults
 */
async function resetCloudProfile() {
    const mode = state.currentSelectedMode;
    if (!confirm(`Reset Cloud profile for ${mode} mode to default?`)) return;

    try {
        await window.settingsAPI.set(`cloudProvider_${mode}`, '');
        await window.settingsAPI.set(`cloudModel_${mode}`, '');
        await window.settingsAPI.set(`cloudPrompt_${mode}`, '');
        await selectMode(mode); // Reload
    } catch (error) {
        alert(`❌ Error: ${error}`);
    }
}

/**
 * Load Ollama models into a select element
 */
async function loadOllamaModels(selectElement: HTMLSelectElement, mode: string) {
    selectElement.innerHTML = '<option value="">Loading...</option>';

    try {
        const result = await window.settingsAPI.getModels('local');

        if (!result.success) {
            selectElement.innerHTML = '<option value="">Ollama not running</option>';
            return;
        }

        selectElement.innerHTML = '';

        // Add default option
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.text = 'gemma3:4b (default)';
        selectElement.appendChild(defaultOpt);

        // Add installed models
        if (result.models && result.models.length > 0) {
            result.models.forEach((model: any) => {
                const opt = document.createElement('option');
                opt.value = model.id;
                opt.text = `${model.name}${model.size ? ` (${model.size})` : ''}`;
                selectElement.appendChild(opt);
            });
        }

        // Load saved value
        const settings = await window.settingsAPI.getAll();
        const savedModel = settings[`localModel_${mode}`];
        if (savedModel) {
            selectElement.value = savedModel;
        }
    } catch (error) {
        console.error('Failed to load Ollama models:', error);
        selectElement.innerHTML = '<option value="">Error loading models</option>';
    }
}

/**
 * Load cloud provider models into a select element
 */
async function loadCloudModels(selectElement: HTMLSelectElement, provider: string, mode: string) {
    selectElement.innerHTML = '<option value="">Loading...</option>';

    try {
        const result = await window.settingsAPI.getModels(provider);

        if (!result.success) {
            selectElement.innerHTML = '<option value="">Failed to load models</option>';
            return;
        }

        selectElement.innerHTML = '';

        // Add default option
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.text = 'Use provider default';
        selectElement.appendChild(defaultOpt);

        // Add fetched models
        if (result.models && result.models.length > 0) {
            result.models.forEach((model: any) => {
                const opt = document.createElement('option');
                opt.value = model.id;
                opt.text = model.name + (model.tier ? ` (${model.tier})` : '');
                selectElement.appendChild(opt);
            });
        }

        // Load saved value
        const settings = await window.settingsAPI.getAll();
        const savedModel = settings[`cloudModel_${mode}`];
        if (savedModel) {
            selectElement.value = savedModel;
        }
    } catch (error) {
        console.error(`Failed to load ${provider} models:`, error);
        selectElement.innerHTML = '<option value="">Error loading models</option>';
    }
}
