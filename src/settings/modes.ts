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
    modeListItems.forEach((item) => {
      item.addEventListener('click', async () => {
        const mode = item.getAttribute('data-mode');
        if (mode) selectMode(mode);
      });
    });

    // Setup button handlers
    setupButtonHandlers();

    // Load initial mode (Standard)
    await selectMode('standard');
  } catch (error) {
    console.error('Failed to initialize mode configuration:', error);
  }
}

/**
 * Initialize the profile editor toggle (UI view switcher only)
 */
async function initializeGlobalToggle() {
  const toggle = document.getElementById('global-processing-toggle') as HTMLInputElement;

  if (!toggle) return;

  // Start with Local profile visible by default
  toggle.checked = false;
  updateProfileSections('local');

  // Toggle change handler - only switches UI view
  toggle.addEventListener('change', () => {
    const viewMode = toggle.checked ? 'cloud' : 'local';
    updateProfileSections(viewMode);
  });
}

/**
 * Update profile sections visibility based on which profile is being edited
 */
function updateProfileSections(viewMode: string) {
  const localSection = document.getElementById('local-profile-section') as HTMLElement;
  const cloudSection = document.getElementById('cloud-profile-section') as HTMLElement;

  if (!localSection || !cloudSection) return;

  if (viewMode === 'local') {
    localSection.style.display = 'block';
    cloudSection.style.display = 'none';
  } else {
    localSection.style.display = 'none';
    cloudSection.style.display = 'block';
  }
}

/**
 * Select a mode and load its dual-profile configuration
 */
export async function selectMode(mode: string) {
  state.currentSelectedMode = mode;

  // Update mode list UI
  const modeListItems = document.querySelectorAll('.mode-list-item');
  modeListItems.forEach((item) => {
    const itemMode = item.getAttribute('data-mode');
    item.classList.toggle('active', itemMode === mode);
  });

  // Update title
  const modeNames: Record<string, string> = {
    standard: 'Standard',
    prompt: 'Prompt',
    professional: 'Professional',
    raw: 'Raw',
    ask: 'Ask (Q&A)',
    refine: 'Refine',
    refine_instruction: 'Refine (Instruction)',
    note: 'Note',
  };

  const titleEl = document.getElementById('mode-detail-title');
  if (titleEl) {
    titleEl.textContent = `${modeNames[mode] || mode} Mode`;
  }

  // Handle Raw mode specially - it's Whisper-only, no profile configuration
  const modeDetailContainer = document.getElementById('mode-detail-container');
  if (!modeDetailContainer) return;

  // Save original DOM structure on first load (if not already saved)
  if (!state.originalModeDetailDOM) {
    state.originalModeDetailDOM = modeDetailContainer.cloneNode(true) as HTMLElement;
  }

  if (mode === 'raw') {
    // Show Raw mode info
    modeDetailContainer.replaceChildren();

    const rawTitle = document.createElement('h3');
    rawTitle.id = 'mode-detail-title';
    rawTitle.style.margin = '0';
    rawTitle.textContent = `${modeNames[mode] || mode} Mode`;

    const infoBox = document.createElement('div');
    infoBox.style.cssText =
      'padding: 20px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border-left: 4px solid #3b82f6;';

    const rawHeader = document.createElement('h4');
    rawHeader.style.marginTop = '0';
    rawHeader.textContent = 'Raw Mode (Whisper Only)';

    const rawDesc = document.createElement('p');
    rawDesc.style.cssText = 'margin: 8px 0; color: #ccc;';
    rawDesc.textContent =
      'Raw mode returns the literal Whisper transcription with minimal processing (punctuation only).';

    const featureList = document.createElement('ul');
    featureList.style.cssText = 'margin: 8px 0; color: #ccc; padding-left: 20px;';
    const feature1 = document.createElement('li');
    feature1.textContent = 'Adds punctuation and capitalization';
    const feature2 = document.createElement('li');
    feature2.textContent = 'No AI processing or cleanup';
    featureList.appendChild(feature1);
    featureList.appendChild(feature2);

    const rawNote = document.createElement('p');
    rawNote.style.cssText = 'margin: 8px 0; font-size: 0.9em; color: #999;';
    rawNote.textContent = 'ℹ️ This mode does not use model or prompt configuration.';

    infoBox.appendChild(rawHeader);
    infoBox.appendChild(rawDesc);
    infoBox.appendChild(featureList);
    infoBox.appendChild(rawNote);

    modeDetailContainer.appendChild(rawTitle);
    modeDetailContainer.appendChild(infoBox);
    return;
  }

  // Restore original DOM structure if it was replaced by Raw mode
  if (!document.getElementById('local-prompt-textarea')) {
    modeDetailContainer.replaceChildren();
    const cloned = state.originalModeDetailDOM!.cloneNode(true) as HTMLElement;
    Array.from(cloned.childNodes).forEach((child) => {
      modeDetailContainer.appendChild(child);
    });
    // Re-attach button event handlers after DOM restoration (cloneNode doesn't copy event listeners)
    setupButtonHandlers();
  }

  // Load both profiles for this mode
  await loadDualProfileForMode(mode);
}

/**
 * Load both local and cloud profiles for a mode
 */
async function loadDualProfileForMode(mode: string) {
  const settings = await window.settingsAPI.getAll();

  // SPEC_038: Local profiles now only contain per-mode prompts (no model selection)
  // Global local model is set in General Settings via the "Default Model" dropdown
  const localPrompt = settings[`localPrompt_${mode}`] || '';

  const localPromptTextarea = document.getElementById(
    'local-prompt-textarea'
  ) as HTMLTextAreaElement;
  const localPromptInfo = document.getElementById('local-prompt-info');

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

  let displayPrompt = cloudPrompt;
  if (!displayPrompt) {
    try {
      const defaults = await window.settingsAPI.getDefaultPrompts();
      displayPrompt = defaults[mode] || defaults['standard'] || '';
    } catch (err) {
      console.error('Failed to load default prompts', err);
    }
  }

  const cloudProviderSelect = document.getElementById('cloud-provider-select') as HTMLSelectElement;
  const cloudModelSelect = document.getElementById('cloud-model-select') as HTMLSelectElement;
  const cloudPromptTextarea = document.getElementById(
    'cloud-prompt-textarea'
  ) as HTMLTextAreaElement;
  const cloudPromptInfo = document.getElementById('cloud-prompt-info');

  if (cloudProviderSelect) {
    // Dynamic Provider Population based on API Keys
    try {
      const apiKeys = await window.settingsAPI.getApiKeys();
      cloudProviderSelect.replaceChildren(); // Clear "Loading..."

      const providers = [
        { id: 'gemini', name: 'Google Gemini', hasKey: apiKeys.geminiApiKey },
        { id: 'anthropic', name: 'Anthropic Claude', hasKey: apiKeys.anthropicApiKey },
        { id: 'openai', name: 'OpenAI GPT', hasKey: apiKeys.openaiApiKey },
      ];

      const availableProviders = providers.filter((p) => p.hasKey);

      if (availableProviders.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.text = 'No providers configured (check API Keys)';
        cloudProviderSelect.appendChild(opt);
        cloudProviderSelect.disabled = true;
      } else {
        cloudProviderSelect.disabled = false;
        availableProviders.forEach((p) => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.text = p.name;
          cloudProviderSelect.appendChild(opt);
        });
      }

      // Determine which provider to select
      let providerToSelect = cloudProvider;

      // If the saved provider is not in the available list, default to the first available one
      const isSavedProviderAvailable = availableProviders.some((p) => p.id === cloudProvider);
      if (!isSavedProviderAvailable && availableProviders.length > 0) {
        providerToSelect = availableProviders[0].id;
      } else if (!isSavedProviderAvailable) {
        providerToSelect = '';
      }

      cloudProviderSelect.value = providerToSelect;

      // Trigger model load for selected provider (if any)
      if (providerToSelect) {
        await loadCloudModels(cloudModelSelect, providerToSelect, mode);
      } else {
        if (cloudModelSelect) {
          cloudModelSelect.replaceChildren();
          const opt = document.createElement('option');
          opt.value = '';
          opt.text = 'No provider selected';
          cloudModelSelect.appendChild(opt);
        }
      }
    } catch (err) {
      console.error('Failed to load API keys for provider dropdown:', err);
      cloudProviderSelect.replaceChildren();
      const opt = document.createElement('option');
      opt.value = '';
      opt.text = 'Error loading providers';
      cloudProviderSelect.appendChild(opt);
    }
  }

  if (cloudModelSelect && cloudModel) {
    cloudModelSelect.value = cloudModel;
  }

  if (cloudPromptTextarea) {
    cloudPromptTextarea.value = displayPrompt;
  }

  if (cloudPromptInfo) {
    if (cloudPrompt) {
      cloudPromptInfo.textContent = '✓ Custom prompt in use';
      cloudPromptInfo.style.color = '#4ade80';
    } else if (displayPrompt) {
      cloudPromptInfo.textContent = 'ℹ️ Using default prompt';
      cloudPromptInfo.style.color = '#94a3b8'; // Slate-400
    } else {
      cloudPromptInfo.textContent = 'No custom prompt';
      cloudPromptInfo.style.color = '#888';
    }
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
  // SPEC_038: No local model refresh button (removed per-mode local model selection)
  const cloudRefreshBtn = document.getElementById('cloud-model-refresh');

  if (saveLocalBtn) saveLocalBtn.onclick = () => saveLocalProfile();
  if (saveCloudBtn) saveCloudBtn.onclick = () => saveCloudProfile();
  if (resetLocalBtn) resetLocalBtn.onclick = () => resetLocalProfile();
  if (resetCloudBtn) resetCloudBtn.onclick = () => resetCloudProfile();

  // SPEC_038: No local model refresh needed (removed per-mode local model selection)

  if (cloudRefreshBtn) {
    cloudRefreshBtn.onclick = async () => {
      const providerSelect = document.getElementById('cloud-provider-select') as HTMLSelectElement;
      const modelSelect = document.getElementById('cloud-model-select') as HTMLSelectElement;
      await loadCloudModels(modelSelect, providerSelect.value, state.currentSelectedMode);
    };
  }
}

/**
 * Save local profile
 */
async function saveLocalProfile() {
  const mode = state.currentSelectedMode;
  const promptTextarea = document.getElementById('local-prompt-textarea') as HTMLTextAreaElement;

  if (!promptTextarea) return;

  const prompt = promptTextarea.value.trim();

  // Validate prompt if provided
  if (prompt && !prompt.includes('{text}')) {
    alert('❌ Prompt must include {text} placeholder');
    return;
  }

  try {
    // SPEC_038: Only save per-mode prompt (model is now global)
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

    // Reload profile to confirm save
    await loadDualProfileForMode(mode);
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

    // Reload profile to confirm save
    await loadDualProfileForMode(mode);
  } catch (error) {
    alert(`❌ Error: ${error}`);
  }
}

/**
 * Reset local profile to defaults
 */
async function resetLocalProfile() {
  const mode = state.currentSelectedMode;
  if (!confirm(`Reset Local prompt for ${mode} mode to default?`)) return;

  try {
    // SPEC_038: Only reset per-mode prompt (model is now global)
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
  selectElement.replaceChildren();
  const loadingOpt = document.createElement('option');
  loadingOpt.value = '';
  loadingOpt.text = 'Loading...';
  selectElement.appendChild(loadingOpt);

  try {
    const result = await window.settingsAPI.getModels('local');

    if (!result.success) {
      selectElement.replaceChildren();
      const errorOpt = document.createElement('option');
      errorOpt.value = '';
      errorOpt.text = 'Ollama not running';
      selectElement.appendChild(errorOpt);
      return;
    }

    selectElement.replaceChildren();

    // Add default option (empty = use global setting)
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.text = 'Use Global Default';
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
    selectElement.replaceChildren();
    const errorOpt = document.createElement('option');
    errorOpt.value = '';
    errorOpt.text = 'Error loading models';
    selectElement.appendChild(errorOpt);
  }
}

/**
 * Load cloud provider models into a select element
 */
async function loadCloudModels(selectElement: HTMLSelectElement, provider: string, mode: string) {
  selectElement.replaceChildren();
  const loadingOpt = document.createElement('option');
  loadingOpt.value = '';
  loadingOpt.text = 'Loading...';
  selectElement.appendChild(loadingOpt);

  try {
    const result = await window.settingsAPI.getModels(provider);

    if (!result.success) {
      selectElement.replaceChildren();
      const errorOpt = document.createElement('option');
      errorOpt.value = '';
      errorOpt.text = 'Failed to load models';
      selectElement.appendChild(errorOpt);
      return;
    }

    selectElement.replaceChildren();

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

    // Load saved value with fuzzy matching
    const settings = await window.settingsAPI.getAll();
    const savedModel = settings[`cloudModel_${mode}`];

    if (savedModel) {
      // 1. Try exact match
      let optionToSelect = Array.from(selectElement.options).find(
        (opt) => opt.value === savedModel
      );

      // 2. Try adding 'models/' prefix (for Gemini legacy data)
      if (!optionToSelect && !savedModel.startsWith('models/')) {
        const prefixed = `models/${savedModel}`;
        optionToSelect = Array.from(selectElement.options).find((opt) => opt.value === prefixed);
      }

      // 3. Try removing 'models/' prefix (if API returns without it but we stored with it)
      if (!optionToSelect && savedModel.startsWith('models/')) {
        const stripped = savedModel.replace('models/', '');
        optionToSelect = Array.from(selectElement.options).find((opt) => opt.value === stripped);
      }

      if (optionToSelect) {
        selectElement.value = optionToSelect.value;
        // Auto-heal: Update the stored setting if we had to fuzzy match
        if (optionToSelect.value !== savedModel) {
          console.log(
            `[Modes] Auto-healing model setting from '${savedModel}' to '${optionToSelect.value}'`
          );
          window.settingsAPI.set(`cloudModel_${mode}`, optionToSelect.value);
        }
      } else {
        // Fallback: If saved model is totally invalid for this provider, stay on default or pick first
        console.warn(`[Modes] Saved model '${savedModel}' not found for provider ${provider}`);
        selectElement.selectedIndex = 0; // "Use provider default"
      }
    }
  } catch (error) {
    console.error(`Failed to load ${provider} models:`, error);
    selectElement.replaceChildren();
    const errorOpt = document.createElement('option');
    errorOpt.value = '';
    errorOpt.text = 'Error loading models';
    selectElement.appendChild(errorOpt);
  }
}
