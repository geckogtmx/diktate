/**
 * i18n Service
 * Handles internationalization using i18next with dependency injection pattern
 */

import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import * as path from 'path';
import Store from 'electron-store';
import type { App } from 'electron';
import type { UserSettings } from '../types/settings';
import { validateTranslationFile } from './i18nValidator';
import { logger } from '../utils/logger';

export interface I18nServiceDependencies {
  store: Store<UserSettings>;
  app: App;
}

export class I18nService {
  private i18nextInstance: typeof i18next;
  private deps: I18nServiceDependencies;

  constructor(deps: I18nServiceDependencies) {
    this.deps = deps;
    this.i18nextInstance = i18next.createInstance();
  }

  /**
   * Detect system language on first launch
   * Returns 'es' if OS locale is Spanish, otherwise 'en'
   */
  private getSystemLanguage(): string {
    const osLocale = this.deps.app.getLocale(); // e.g., 'es', 'es-ES', 'es-MX'
    if (osLocale.startsWith('es')) {
      return 'es';
    }
    return 'en';
  }

  public async initialize(): Promise<void> {
    // Check if this is first-time launch (language not set in store)
    const hasLanguageSet = this.deps.store.has('language');
    let currentLanguage: string;

    if (!hasLanguageSet) {
      // First launch: detect system language and ask user (Task 3.4)
      const systemLang = this.getSystemLanguage();
      currentLanguage = systemLang; // For now, default to system language
      logger.info('I18N', `First-time launch detected. System language: ${systemLang}`);

      // Save that we've already prompted (even if user just accepted the default)
      this.deps.store.set('languagePromptShown', true);
      this.deps.store.set('language', systemLang);
    } else {
      currentLanguage = this.deps.store.get('language', 'en') as string;
    }

    // Path resolution: From compiled dist/services/ → dist/locales
    const localesPath = this.deps.app.isPackaged
      ? path.join(process.resourcesPath, 'locales')
      : path.join(__dirname, '../locales');

    logger.info('I18N', `Loading locales from: ${localesPath}`);

    try {
      // Initialize i18next with fs-backend
      await this.i18nextInstance.use(Backend).init({
        lng: currentLanguage,
        fallbackLng: 'en',
        debug: false, // Set to true for development debugging
        backend: {
          loadPath: path.join(localesPath, '{{lng}}', '{{ns}}.json'),
        },
        ns: ['common', 'settings'],
        defaultNS: 'common',
        interpolation: {
          escapeValue: false, // React/Electron don't need HTML escaping
        },
      });

      logger.info('I18N', `i18next initialized successfully with language: ${currentLanguage}`);
    } catch (error) {
      // Graceful degradation: If initialization fails, force English
      logger.error('I18N', `Failed to initialize i18next with language: ${currentLanguage}`, error);
      logger.info('I18N', 'Falling back to English');

      try {
        await this.i18nextInstance.use(Backend).init({
          lng: 'en',
          fallbackLng: 'en',
          debug: false,
          backend: {
            loadPath: path.join(localesPath, '{{lng}}', '{{ns}}.json'),
          },
          ns: ['common', 'settings'],
          defaultNS: 'common',
          interpolation: {
            escapeValue: false,
          },
        });

        // Update store to reflect fallback
        this.deps.store.set('language', 'en');
        logger.info('I18N', 'Successfully initialized i18next with English fallback');
      } catch (fallbackError) {
        // Last resort: log error but continue (app will work with key names)
        logger.error(
          'I18N',
          'Failed to initialize i18next even with English fallback',
          fallbackError
        );
      }
    }

    // Validate loaded translation files (non-blocking, warnings only)
    const languages = ['en', 'es']; // Validate all available languages
    const namespaces = ['common', 'settings'];

    for (const lang of languages) {
      for (const ns of namespaces) {
        const filePath = path.join(localesPath, lang, `${ns}.json`);
        try {
          await validateTranslationFile(filePath);
          logger.info('I18N', `Validated translation file: ${lang}/${ns}.json`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.warn(
            'I18N',
            `Validation failed for ${lang}/${ns}.json (translations may still load): ${errorMsg}`
          );
          // Continue loading other files (graceful degradation)
        }
      }
    }

    logger.info('I18N', `i18n service ready. Current language: ${this.getCurrentLanguage()}`);
  }

  public t(key: string, options?: Record<string, unknown>): string {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = this.i18nextInstance.t(key, options as any) as string;

      // If translation returns the key itself, it means translation failed
      if (result === key) {
        logger.warn('I18N', `Translation not found for key: ${key}`);
      }

      return result;
    } catch (error) {
      logger.error('I18N', `Translation error for key: ${key}`, error);
      return key; // Fallback to key
    }
  }

  public async changeLanguage(lang: string): Promise<void> {
    await this.i18nextInstance.changeLanguage(lang);
    this.deps.store.set('language', lang);
    logger.info('I18N', `Language changed to: ${lang}`);
  }

  public getCurrentLanguage(): string {
    return this.i18nextInstance.language || 'en';
  }
}
