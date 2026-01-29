/**
 * UI & Hardware Management
 */

import { state } from './store.js';
import { formatBytes } from './utils.js';

/**
 * Runs hardware performance test (GPU/VRAM)
 */
export async function runHardwareTest() {
    const btn = document.getElementById('hardware-test-btn') as HTMLButtonElement;
    const gpuEl = document.getElementById('hw-gpu');
    const vramEl = document.getElementById('hw-vram');
    const tierEl = document.getElementById('hw-tier');

    if (!btn || !gpuEl || !vramEl || !tierEl) return;

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '🔬 Testing...';

    try {
        const result = await window.settingsAPI.runHardwareTest();
        gpuEl.textContent = result.gpu;
        vramEl.textContent = result.vram;
        tierEl.textContent = result.tier;

        if (result.tier.toLowerCase().includes('quality')) tierEl.style.color = '#4ade80';
        else if (result.tier.toLowerCase().includes('balanced')) tierEl.style.color = '#fbbf24';
        else tierEl.style.color = '#60a5fa';

    } catch (e) {
        gpuEl.textContent = 'Test failed';
    } finally {
        btn.disabled = false;
        btn.textContent = originalText || '🔬 Run Hardware Test';
    }
}

export function getRecommendedMaxModelSize(): number {
    const tierEl = document.getElementById('hw-tier');
    const tier = tierEl?.textContent?.toLowerCase() || '';
    if (tier.includes('quality') || tier.includes('12gb')) return 8;
    if (tier.includes('balanced') || tier.includes('6-12gb')) return 8;
    if (tier.includes('fast') || tier.includes('4-6gb')) return 4;
    return 4;
}

export function getModelSizeClass(modelName: string, sizeGB: number, maxRecommendedB: number): 'ok' | 'borderline' | 'too-large' {
    const match = modelName.toLowerCase().match(/(\d+)b/);
    let modelParamB = 0;
    if (match) {
        modelParamB = parseInt(match[1]);
    } else {
        modelParamB = Math.ceil(sizeGB / 2);
    }
    if (modelParamB <= maxRecommendedB) return 'ok';
    if (modelParamB <= maxRecommendedB * 1.5) return 'borderline';
    return 'too-large';
}

export function showRestartModal() {
    const modal = document.getElementById('restart-modal');
    if (modal) modal.style.display = 'flex';
}

export function hideRestartModal() {
    const modal = document.getElementById('restart-modal');
    if (modal) modal.style.display = 'none';
}

export function relaunchApp() {
    window.settingsAPI.relaunchApp();
}

export async function checkModelChanges() {
    const banner = document.getElementById('restart-banner');
    if (!banner) return;

    try {
        const settings = await window.settingsAPI.getAll();
        let changed = false;

        if (state.initialModels['default'] !== settings.defaultOllamaModel) changed = true;

        if (!changed) {
            const modes = ['standard', 'prompt', 'professional', 'ask', 'refine', 'refine_instruction'];
            for (const mode of modes) {
                if (state.initialModels[`modeModel_${mode}`] !== (settings[`modeModel_${mode}`] || '')) {
                    changed = true;
                    break;
                }
            }
        }

        state.hasModelChanges = changed;
        banner.style.display = changed ? 'flex' : 'none';
    } catch (e) {
        console.error('Failed to check model changes:', e);
    }
}

export async function populateSoundDropdowns() {
    try {
        const soundFiles = await window.settingsAPI.getSoundFiles();
        if (!soundFiles || soundFiles.length === 0) return;

        const ids = ['start-sound', 'stop-sound', 'ask-sound'];
        ids.forEach(id => {
            const select = document.getElementById(id) as HTMLSelectElement;
            if (!select) return;
            const currentVal = select.value;
            select.innerHTML = '<option value="none">🔇 None (Silent)</option>';
            soundFiles.forEach(sound => {
                const option = document.createElement('option');
                option.value = sound;
                option.text = `🔊 ${sound}`;
                select.appendChild(option);
            });
            select.value = currentVal;
        });
    } catch (e) {
        console.error('Failed to populate sound dropdowns:', e);
    }
}

export function previewSpecificSound(selectId: string) {
    const select = document.getElementById(selectId) as HTMLSelectElement;
    const sound = select?.value;
    if (sound && sound !== 'none') {
        window.settingsAPI.playSound(sound).catch(() => { });
    }
}
