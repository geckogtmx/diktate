/**
 * Ollama Model Management (SPEC_031)
 */

import { state } from './store.js';
import { formatBytes, saveSetting } from './utils.js';
import {
    getRecommendedMaxModelSize,
    getModelSizeClass,
    showRestartModal,
    checkModelChanges
} from './ui.js';

/**
 * Check if Ollama is running and update UI
 */
export async function checkOllamaStatus() {
    const statusEl = document.getElementById('ollama-version');
    if (!statusEl) return;

    try {
        const response = await fetch('http://localhost:11434/api/version');
        if (response.ok) {
            const data = await response.json();
            statusEl.textContent = `✅ Ollama v${data.version} running`;
            statusEl.style.color = '#4ade80';
        } else {
            statusEl.textContent = '❌ Ollama not responding';
            statusEl.style.color = '#f87171';
        }
    } catch (e) {
        statusEl.textContent = '❌ Ollama not running';
        statusEl.style.color = '#f87171';
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

        select.innerHTML = '';
        if (models.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.text = 'No models installed';
            select.appendChild(option);
            return;
        }

        const maxRecommendedB = getRecommendedMaxModelSize();

        models.forEach((model: any) => {
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
        if (settings.defaultOllamaModel) {
            select.value = settings.defaultOllamaModel;
        }
    } catch (e) {
        console.error('Failed to load Ollama models:', e);
        select.innerHTML = '<option value="">Ollama not available</option>';
    }
}

export async function onDefaultModelChange(model: string) {
    if (!model) return;
    await window.settingsAPI.set('defaultOllamaModel', model);
    await checkModelChanges();
    if (state.initialModels['default'] !== model) {
        showRestartModal();
    }
}

export function saveOllamaSetting(key: string, value: any) {
    window.settingsAPI.set(key, value);
}

export async function restartOllama() {
    try {
        const result = await window.settingsAPI.restartOllama();
        if (result.success) {
            alert('Ollama restart signal sent');
            setTimeout(checkOllamaStatus, 3000);
        } else {
            alert(`Failed to restart Ollama: ${result.error}`);
        }
    } catch (e) {
        alert('Error restarting Ollama');
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
            body: JSON.stringify({ name: modelName, stream: false })
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
            body: JSON.stringify({ name: modelName })
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

