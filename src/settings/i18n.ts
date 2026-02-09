/**
 * Settings UI i18n Module
 * Handles translation loading and UI updates for Settings window
 */

/**
 * Translate an element's text content
 */
async function translateElement(element: Element, key: string): Promise<void> {
  try {
    const translated = await window.i18n.t(`settings:${key}`);
    element.textContent = translated;
  } catch (error) {
    console.error(`Failed to translate key: ${key}`, error);
  }
}

/**
 * Apply translations to all UI elements with data-i18n attributes
 */
export async function applyTranslations(): Promise<void> {
  const elements = document.querySelectorAll('[data-i18n]');

  // Translate all elements in parallel
  const promises = Array.from(elements).map((element) => {
    const key = element.getAttribute('data-i18n');
    if (key) {
      return translateElement(element, key);
    }
    return Promise.resolve();
  });

  await Promise.all(promises);
}

/**
 * Initialize i18n system for Settings window
 * - Loads initial translations
 * - Sets up language change listener
 */
export async function initializeI18n(): Promise<void> {
  // Load current language
  const currentLang = await window.i18n.getLanguage();
  console.log(`[i18n] Settings UI language: ${currentLang}`);

  // Apply initial translations
  await applyTranslations();

  // Listen for language changes and re-translate
  window.i18n.onLanguageChange(async (newLang: string) => {
    console.log(`[i18n] Language changed to: ${newLang}, reloading translations`);
    await applyTranslations();
  });

  console.log('[i18n] Settings UI translations initialized');
}

/**
 * Helper: Translate a single key (for dynamic content)
 */
export async function t(key: string): Promise<string> {
  return await window.i18n.t(`settings:${key}`);
}
