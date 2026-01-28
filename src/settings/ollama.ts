/**
 * Ollama Model Management (SPEC_031)
 */

import { state } from './store';
import { formatBytes, saveSetting } from './utils';
import {
    getRecommendedMaxModelSize,
    getModelSizeClass,
    showRestartModal,
    checkModelChanges
} from './ui_stubs'; // We will create ui.ts later, using stubs for now or imports

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
