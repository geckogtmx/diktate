/**
 * Privacy & Diagnostics Module
 * SPEC_030 - Privacy Settings & Power User Diagnostics
 */

import { setVal, setCheck, saveSetting } from './utils.js';

const descriptions = [
  '<strong>Ghost Mode</strong>: Absolute zero storage. No metrics, no history, no traces of what you say or do.',
  '<strong>Stats-Only</strong>: Saves counts and timings only. Transcription text is completely discarded to protect your content.',
  '<strong>Balanced</strong>: Saves processed text and performance metrics. Redacts sensitive info if scrubber is on. (Recommended)',
  '<strong>Full (Experimental)</strong>: Saves everything including raw transcriptions and system prompts. Useful for debugging prompt logic.',
];

/**
 * Initialize Privacy components
 */
export async function initializePrivacySettings() {
  const intensitySlider = document.getElementById('logging-intensity') as HTMLInputElement;
  const intensityDesc = document.getElementById('intensity-desc');
  const piiScrubber = document.getElementById('privacy-pii-scrubber') as HTMLInputElement;
  const wipeBtn = document.getElementById('wipe-history-btn');
  const wipeStatus = document.getElementById('wipe-status');

  if (!intensitySlider || !intensityDesc || !piiScrubber) return;

  // Handle Intensity Change
  intensitySlider.addEventListener('input', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value);
    intensityDesc.innerHTML = descriptions[val];
  });

  intensitySlider.addEventListener('change', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value);
    saveSetting('privacyLoggingIntensity', val);
    // Sync with backend immediately
    window.settingsAPI.invokeBackend('set_privacy_settings', {
      level: val,
      scrub: piiScrubber.checked,
    });
  });

  // Handle PII Scrubber Toggle
  piiScrubber.addEventListener('change', (e) => {
    const val = (e.target as HTMLInputElement).checked;
    saveSetting('privacyPiiScrubber', val);
    // Sync with backend immediately
    window.settingsAPI.invokeBackend('set_privacy_settings', {
      level: parseInt(intensitySlider.value),
      scrub: val,
    });
  });

  // Handle Wipe Data
  wipeBtn?.addEventListener('click', async () => {
    const confirmed = confirm(
      'Are you sure you want to permanently delete all local history and metrics? This cannot be undone.'
    );
    if (confirmed) {
      try {
        // Call IPC to wipe data
        const success = await window.settingsAPI.invokeBackend('clear_history_data', {});
        if (success && wipeStatus) {
          wipeStatus.style.display = 'inline';
          setTimeout(() => {
            wipeStatus.style.display = 'none';
          }, 3000);
        }
      } catch (err) {
        console.error('Failed to wipe history:', err);
        alert('Error wiping history. Check logs.');
      }
    }
  });
}

/**
 * Update UI with loaded privacy settings
 */
export function loadPrivacySettings(settings: any) {
  if (!settings) return;

  const intensity =
    settings.privacyLoggingIntensity !== undefined ? settings.privacyLoggingIntensity : 2;
  setVal('logging-intensity', intensity.toString());

  const intensityDesc = document.getElementById('intensity-desc');
  if (intensityDesc) {
    intensityDesc.innerHTML = descriptions[intensity];
  }

  setCheck('privacy-pii-scrubber', settings.privacyPiiScrubber !== false);
}
