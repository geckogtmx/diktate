/**
 * UI Stubs/Forward Declarations
 * These will be moved to ui.ts in the final step of Phase 3
 */

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

export async function checkModelChanges() {
    const banner = document.getElementById('restart-banner');
    if (!banner) return;
    // Logic will be fully moved to ui.ts
}
