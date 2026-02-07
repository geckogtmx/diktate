/**
 * Privacy & Diagnostics Module
 * SPEC_030 - Privacy Settings & Power User Diagnostics
 */

import { setVal, setCheck, saveSetting } from './utils.js';
import type { Settings } from './types.js';

const descriptionsData = [
  {
    title: 'Ghost Mode',
    text: 'Absolute zero storage. No metrics, no history, no traces of what you say or do.',
  },
  {
    title: 'Stats-Only',
    text: 'Saves counts and timings only. Transcription text is completely discarded to protect your content.',
  },
  {
    title: 'Balanced',
    text: 'Saves processed text and performance metrics. Redacts sensitive info if scrubber is on. (Recommended)',
  },
  {
    title: 'Full (Experimental)',
    text: 'Saves everything including raw transcriptions and system prompts. Useful for debugging prompt logic.',
  },
];

function buildDescription(index: number): DocumentFragment {
  const frag = document.createDocumentFragment();
  const strong = document.createElement('strong');
  strong.textContent = descriptionsData[index].title;
  frag.appendChild(strong);
  frag.appendChild(document.createTextNode(': ' + descriptionsData[index].text));
  return frag;
}

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
    intensityDesc.replaceChildren(buildDescription(val));
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
export function loadPrivacySettings(settings: Settings | undefined) {
  if (!settings) return;

  const intensity =
    settings.privacyLoggingIntensity !== undefined ? settings.privacyLoggingIntensity : 2;
  setVal('logging-intensity', intensity.toString());

  const intensityDesc = document.getElementById('intensity-desc');
  if (intensityDesc) {
    intensityDesc.replaceChildren(buildDescription(intensity));
  }

  setCheck('privacy-pii-scrubber', settings.privacyPiiScrubber !== false);
}
