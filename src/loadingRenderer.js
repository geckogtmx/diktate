/**
 * Ultra-minimalist renderer for loading.html
 */

document.addEventListener('DOMContentLoaded', () => {
    const statusContainer = document.getElementById('status-container');
    const readySection = document.getElementById('ready-section');
    const logoLayer = document.querySelector('.logo-layer');

    // Heartbeat to keep renderer active in Windows' eyes
    const pulse = () => {
        if (logoLayer) {
            const scale = 1 + Math.sin(Date.now() / 1000) * 0.02;
            logoLayer.style.transform = `scale(${scale})`;
        }
        requestAnimationFrame(pulse);
    };
    pulse();

    // Listen for the final completion event
    window.loadingAPI.onReady(() => {
        console.log('[LOADING] Ready signal received');
        if (statusContainer) statusContainer.classList.add('hidden');
        if (readySection) readySection.classList.remove('hidden');
    });

    // Button Handlers
    document.getElementById('btn-cp')?.addEventListener('click', () => {
        window.loadingAPI.sendAction('open-cp');
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => {
        window.loadingAPI.sendAction('open-settings');
    });

    document.getElementById('btn-close')?.addEventListener('click', () => {
        window.loadingAPI.sendAction('close');
    });

    // Signal main process we are ready
    window.loadingAPI.sendAction('ready');
});
