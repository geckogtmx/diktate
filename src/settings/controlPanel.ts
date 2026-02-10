/**
 * Control Panel Module (SPEC_043)
 * Handles settings for the "Control Panel" tab, which configures the visibility
 * of elements on the main application HUD.
 */

import { loadSettings } from './utils.js';

export async function initControlPanel(): Promise<void> {
  console.log('[ControlPanel] Initializing...');

  // Define the toggles and their corresponding setting keys
  const toggles = [
    { id: 'cp-show-modes', key: 'uiShowModes', default: true },
    { id: 'cp-show-actions', key: 'uiShowActions', default: true },
    { id: 'cp-show-session-stats', key: 'uiShowSessionStats', default: true },
    { id: 'cp-show-perf-stats', key: 'uiShowPerfStats', default: true },
  ];

  for (const toggle of toggles) {
    const element = document.getElementById(toggle.id) as HTMLInputElement;
    if (element) {
      // Load initial value
      try {
        const value = await window.settingsAPI.get(toggle.key);
        element.checked = value !== undefined ? (value as boolean) : toggle.default;
      } catch (e) {
        console.error(`[ControlPanel] Failed to load setting ${toggle.key}`, e);
        element.checked = toggle.default;
      }

      // Add change listener
      element.addEventListener('change', async (e) => {
        const isChecked = (e.target as HTMLInputElement).checked;
        console.log(`[ControlPanel] Setting ${toggle.key} = ${isChecked}`);
        try {
          await window.settingsAPI.set(toggle.key, isChecked);
        } catch (error) {
          console.error(`[ControlPanel] Failed to save setting ${toggle.key}`, error);
        }
      });
    } else {
      console.warn(`[ControlPanel] Element #${toggle.id} not found`);
    }
  }

  console.log('[ControlPanel] Initialization complete');
}
