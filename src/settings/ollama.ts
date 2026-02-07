/**
 * Ollama Model Management (SPEC_031)
 */

import { state, type ModelInfo } from './store.js';
import { formatBytes, saveSetting } from './utils.js';
import { VERIFIED_MODELS, type VerifiedModel } from './constants.js';
import {
  getRecommendedMaxModelSize,
  getModelSizeClass,
  showRestartModal,
  checkModelChanges,
} from './ui.js';

/**
 * Check if Ollama is running and update UI
 */
export async function checkOllamaStatus() {
  const statusEl = document.getElementById('ollama-service-status');
  const versionEl = document.getElementById('ollama-service-version');
  if (!statusEl && !versionEl) return;

  const setStatus = (text: string, color: string) => {
    if (statusEl) {
      statusEl.textContent = text;
      statusEl.style.color = color;
    }
  };

  const setVersion = (ver: string) => {
    if (versionEl) versionEl.textContent = ver;
  };

  // 1. Immediate Visual Feedback
  setStatus('⏳ Checking...', '#fbbf24'); // Yellow
  if (versionEl) versionEl.textContent = '--';

  // 2. Artificial Delay for UX (so user sees the change)
  await new Promise((r) => setTimeout(r, 500));

  try {
    const response = await fetch('http://localhost:11434/api/version');
    if (response.ok) {
      const data = await response.json();
      setStatus('✅ Ollama running', '#4ade80');
      setVersion(`v${data.version}`);
    } else {
      setStatus('❌ Ollama not responding', '#f87171');
    }
  } catch (e) {
    setStatus('❌ Ollama not running', '#f87171');
  }
}

/**
 * Load available Ollama models and populate dropdown
 */
export async function loadOllamaModels() {
  const select = document.getElementById('default-model') as HTMLSelectElement;
  if (!select) return;

  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) throw new Error('Ollama not available');

    const data = await response.json();
    const models = data.models || [];
    state.availableModels = models;

    select.replaceChildren();
    // Update model count in UI
    const countEl = document.getElementById('ollama-loaded-models');
    if (countEl) countEl.textContent = models.length.toString();

    // Populate Installed Models List
    const listContainer = document.getElementById('ollama-models-list');
    if (listContainer) {
      listContainer.replaceChildren();
      if (models.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = 'color: #888; text-align: center; padding: 10px;';
        emptyMsg.textContent = 'No models installed';
        listContainer.appendChild(emptyMsg);
      } else {
        models.forEach((model: ModelInfo) => {
          const row = document.createElement('div');
          row.style.cssText =
            'display: flex; justify-content: space-between; align-items: center; padding: 8px 4px; border-bottom: 1px solid #333;';

          const info = document.createElement('div');
          const modelName = document.createElement('span');
          modelName.style.color = '#e0e0e0';
          modelName.textContent = model.name;
          const modelSize = document.createElement('span');
          modelSize.style.cssText = 'color: #888; font-size: 0.85em; margin-left: 8px;';
          modelSize.textContent = formatBytes(model.size);
          info.appendChild(modelName);
          info.appendChild(document.createTextNode(' '));
          info.appendChild(modelSize);

          const btn = document.createElement('button');
          btn.className = 'btn btn-danger'; // Uses existing class
          btn.textContent = '🗑️';
          btn.title = 'Delete Model';
          btn.style.padding = '2px 8px';
          btn.style.fontSize = '0.9em';
          btn.onclick = () => deleteOllamaModel(model.name);

          row.appendChild(info);
          row.appendChild(btn);
          listContainer.appendChild(row);
        });
      }
    }

    if (models.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.text = 'No models installed';
      select.appendChild(option);
      return;
    }

    const maxRecommendedB = getRecommendedMaxModelSize();

    models.forEach((model: ModelInfo) => {
      const sizeGB = model.size / (1024 * 1024 * 1024);
      const modelSizeClass = getModelSizeClass(model.name, sizeGB, maxRecommendedB);

      const option = document.createElement('option');
      option.value = model.name;
      const warningPrefix = modelSizeClass === 'too-large' ? '⚠️ ' : '';
      option.text = `${warningPrefix}${model.name} (${formatBytes(model.size)})`;
      if (modelSizeClass === 'too-large') {
        option.style.color = '#f87171';
      }
      select.appendChild(option);
    });

    const settings = await window.settingsAPI.getAll();
    // SPEC_038: Prefer localModel (new global setting) over defaultOllamaModel (legacy)
    const currentModel = settings.localModel || settings.defaultOllamaModel;
    if (currentModel) {
      select.value = currentModel;
    }
  } catch (e) {
    console.error('Failed to load Ollama models:', e);
    select.replaceChildren();
    const errorOpt = document.createElement('option');
    errorOpt.value = '';
    errorOpt.text = 'Ollama not available';
    select.appendChild(errorOpt);
  }
}

export async function onDefaultModelChange(model: string) {
  if (!model) return;
  // SPEC_038: Update global local model (used for ALL local modes)
  await window.settingsAPI.set('localModel', model);
  // Keep defaultOllamaModel for backward compatibility
  await window.settingsAPI.set('defaultOllamaModel', model);
  await checkModelChanges();
  if (state.initialModels['default'] !== model) {
    showRestartModal();
  }
}

/**
 * Safe Model Library Logic (SPEC_033)
 */
export async function initSafeModelLibrary() {
  try {
    // 1. Get Hardware Info
    const result = await window.settingsAPI.runHardwareTest();
    const vramGB = parseFloat(result.vram); // Assuming format like "8.0 GB" or similar, parse logic needed?
    // Actually, runHardwareTest returns formatted strings. Let's assume we can get raw number or parse it.
    // For robustness, let's look at how ui.ts does it or just re-implement a safe parse.
    // Result.vram is likely string. Let's trust a conservative 4GB if parsing fails.
    let vram = 4;
    if (result.vram) {
      const match = result.vram.match(/(\d+(\.\d+)?)/);
      if (match) vram = parseFloat(match[1]);
    }

    // 2. Get Compatible Models
    const compatible = getCompatibleModels(vram);

    // 3. Populate Dropdown
    const select = document.getElementById('verified-model-select') as HTMLSelectElement;
    const info = document.getElementById('verified-model-info');

    if (select) {
      select.replaceChildren();
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.text = 'Select a model...';
      select.appendChild(defaultOpt);
      compatible.forEach((m) => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.text = `${m.name} (${m.sizeGb}GB)`;

        // Warning for models > 50% VRAM
        if (m.sizeGb > vram * 0.5) {
          opt.text += ' ⚠️ High VRAM';
          opt.style.color = '#fbbf24'; // Yellow in supported browsers
        }

        // Check if already installed
        const isInstalled = state.availableModels?.some((am: ModelInfo) => am.name === m.id);
        if (isInstalled) {
          opt.text += ' ✅ Installed';
          opt.disabled = true;
        }
        select.appendChild(opt);
      });

      // Bind change event
      select.onchange = () => {
        const model = VERIFIED_MODELS.find((m) => m.id === select.value);
        if (info) info.textContent = model ? model.description : '';
      };
    }
  } catch (e) {
    console.error('Failed to init Safe Model Library:', e);
  }
}

export function installVerifiedModel() {
  const select = document.getElementById('verified-model-select') as HTMLSelectElement;
  if (select && select.value) {
    quickPullModel(select.value);
  }
}

export function getCompatibleModels(vramGB: number): VerifiedModel[] {
  return VERIFIED_MODELS.filter((m) => {
    return m.sizeGb <= vramGB;
  });
}

export function saveOllamaSetting(key: string, value: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  window.settingsAPI.set(key as any, value as any);
}

export async function restartOllama() {
  const statusEl = document.getElementById('ollama-restart-status');
  if (statusEl) {
    statusEl.textContent = '⏳ Restarting Service...';
    statusEl.style.color = '#fbbf24'; // Yellow
  }

  // Yield to let UI paint
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Progress animation
  let dots = 0;
  const interval = setInterval(() => {
    dots = (dots + 1) % 4;
    if (statusEl) statusEl.textContent = '⏳ Restarting Service' + '.'.repeat(dots);
  }, 500);

  try {
    const result = await window.settingsAPI.restartOllama();
    clearInterval(interval);

    if (result.success) {
      if (statusEl) {
        statusEl.textContent = '✅ Service restarted successfully';
        statusEl.style.color = '#4ade80'; // Green
      }
      // Refresh status immediately
      checkOllamaStatus();

      // Clear message after 5 seconds
      setTimeout(() => {
        if (statusEl) statusEl.textContent = '';
      }, 5000);
    } else {
      if (statusEl) {
        statusEl.textContent = `❌ Restart failed: ${result.error}`;
        statusEl.style.color = '#f87171'; // Red
      }
    }
  } catch (e) {
    clearInterval(interval);
    if (statusEl) {
      statusEl.textContent = '❌ Error triggering restart';
      statusEl.style.color = '#f87171';
    }
  }
}

export async function warmupModel() {
  try {
    const result = await window.settingsAPI.warmupOllamaModel();
    if (result.success) {
      alert(`Model ${result.model} warmed up successfully!`);
    } else {
      alert(`Warmup failed: ${result.error}`);
    }
  } catch (e) {
    alert('Error warming up model');
  }
}

export async function pullOllamaModel() {
  const input = document.getElementById('ollama-pull-model') as HTMLInputElement;
  const statusEl = document.getElementById('ollama-pull-status');
  const modelName = input?.value?.trim();

  if (!modelName) {
    if (statusEl) statusEl.textContent = '⚠️ Please enter a model name';
    return;
  }

  if (statusEl) {
    statusEl.textContent = `⏳ Pulling ${modelName}...`;
    statusEl.style.color = '#fbbf24';
  }

  try {
    const response = await fetch('http://localhost:11434/api/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: false }),
    });

    if (response.ok) {
      if (statusEl) {
        statusEl.textContent = `✅ Successfully pulled ${modelName}!`;
        statusEl.style.color = '#4ade80';
      }
      if (input) input.value = '';
      await loadOllamaModels();
    } else {
      const errorData = await response.text();
      if (statusEl) {
        statusEl.textContent = `❌ Failed: ${errorData}`;
        statusEl.style.color = '#f87171';
      }
    }
  } catch (e) {
    if (statusEl) {
      statusEl.textContent = `❌ Error: ${e}`;
      statusEl.style.color = '#f87171';
    }
  }
}

export async function deleteOllamaModel(modelName: string) {
  if (!confirm(`Delete model "${modelName}"?`)) return;

  try {
    const response = await fetch('http://localhost:11434/api/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });

    if (response.ok) {
      alert(`🗑️ ${modelName} deleted successfully`);
      await loadOllamaModels();
    } else {
      const errorData = await response.text();
      alert(`❌ Failed to delete: ${errorData}`);
    }
  } catch (e) {
    alert(`❌ Error deleting model: ${e}`);
  }
}

export function quickPullModel(modelName: string) {
  const input = document.getElementById('ollama-pull-model') as HTMLInputElement;
  if (input) input.value = modelName;
  pullOllamaModel();
}
