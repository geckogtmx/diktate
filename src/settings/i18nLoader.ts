/**
 * i18n Loader for Settings Renderer
 * Fetches translations from main process via IPC
 */

class I18nLoader {
  private translations: Record<string, string> = {};
  private currentLanguage: string = 'en';

  async initialize(): Promise<void> {
    this.currentLanguage = await window.i18n.getLanguage();
    await this.loadTranslations();

    // Listen for language changes
    window.i18n.onLanguageChange(async (lang: string) => {
      this.currentLanguage = lang;
      await this.loadTranslations();
      this.updateUI();
    });
  }

  private async loadTranslations(): Promise<void> {
    // Pre-load all translation keys (flatten the JSON structure)
    const keys = [
      // Tabs
      'tabs.general',
      'tabs.hotkeys',
      'tabs.audio',
      'tabs.modes',
      'tabs.notes',
      'tabs.ollama',
      'tabs.apikeys',
      'tabs.privacy',
      'tabs.about',
      // General
      'general.title',
      'general.language_label',
      'general.language_sublabel',
      'general.save_language',
      'general.processing_mode',
      'general.processing_mode_sublabel',
      'general.processing_mode_local',
      'general.processing_mode_cloud',
      'general.default_model',
      'general.default_model_sublabel',
      'general.save_model',
      'general.loading_models',
      // Hotkeys
      'hotkeys.title',
      'hotkeys.dictate',
      'hotkeys.dictate_sublabel',
      'hotkeys.ask',
      'hotkeys.ask_sublabel',
      'hotkeys.translate',
      'hotkeys.translate_sublabel',
      'hotkeys.refine',
      'hotkeys.refine_sublabel',
      'hotkeys.oops',
      'hotkeys.oops_sublabel',
      'hotkeys.note',
      'hotkeys.note_sublabel',
      'hotkeys.reset_default',
      // System
      'system.title',
      'system.auto_start',
      'system.auto_start_sublabel',
      // Audio
      'audio.title',
      'audio.input_device',
      'audio.default_microphone',
      'audio.transcription_model',
      'audio.transcription_model_sublabel',
      'audio.model_turbo',
      'audio.model_medium',
      'audio.model_small',
      'audio.model_base',
      'audio.model_tiny',
      'audio.sound_effects',
      'audio.sound_effects_sublabel',
      'audio.sound_start',
      'audio.sound_stop',
      'audio.sound_ask',
      'audio.sound_none',
      'audio.preview_sound',
      'audio.signal_monitor',
      'audio.signal_monitor_sublabel',
      'audio.test_microphone',
      'audio.stop_test',
      'audio.noise_filter',
      'audio.noise_filter_sublabel',
      'audio.max_duration',
      'audio.max_duration_sublabel',
      // Ollama
      'ollama.title',
      'ollama.hardware_performance',
      'ollama.hardware_performance_sublabel',
      'ollama.run_hardware_test',
      'ollama.service_status',
      'ollama.service_status_sublabel',
      'ollama.refresh',
      'ollama.restart_service',
      'ollama.warmup_model',
      'ollama.verified_library',
      'ollama.pull_model',
      'ollama.installed_models',
      'ollama.installed_models_sublabel',
      'ollama.keep_alive',
      'ollama.keep_alive_sublabel',
      'ollama.keep_alive_5m',
      'ollama.keep_alive_10m',
      'ollama.keep_alive_30m',
      'ollama.keep_alive_1h',
      'ollama.keep_alive_24h',
      'ollama.server_url',
      'ollama.server_url_sublabel',
      // Modes
      'modes.title',
      'modes.default_mode',
      'modes.default_mode_sublabel',
      'modes.mode_standard',
      'modes.mode_prompt',
      'modes.mode_professional',
      'modes.ask_output',
      'modes.ask_output_sublabel',
      'modes.output_type',
      'modes.output_clipboard',
      'modes.output_notification',
      'modes.custom_prompts',
      'modes.custom_prompts_sublabel',
      'modes.prompt_dictate',
      'modes.prompt_ask',
      'modes.prompt_translate',
      'modes.prompt_refine',
      'modes.reset_prompt',
      'modes.prompt_placeholder',
      // Notes
      'notes.title',
      'notes.note_file',
      'notes.note_file_sublabel',
      'notes.browse',
      'notes.timestamp_format',
      'notes.timestamp_format_sublabel',
      'notes.folder_pattern',
      'notes.folder_pattern_sublabel',
      'notes.filename_pattern',
      'notes.filename_pattern_sublabel',
      // API Keys
      'apikeys.title',
      'apikeys.warning',
      'apikeys.gemini',
      'apikeys.gemini_sublabel',
      'apikeys.anthropic',
      'apikeys.anthropic_sublabel',
      'apikeys.openai',
      'apikeys.openai_sublabel',
      'apikeys.test_key',
      'apikeys.save_key',
      // Privacy
      'privacy.title',
      'privacy.local_processing',
      'privacy.local_processing_desc',
      'privacy.cloud_processing',
      'privacy.cloud_processing_desc',
      'privacy.data_collection',
      'privacy.data_collection_desc',
      'privacy.logs',
      'privacy.logs_desc',
      // About
      'about.title',
      'about.version',
      'about.developer',
      'about.license',
      'about.source_code',
      'about.documentation',
      'about.support',
      // Common
      'common.save',
      'common.cancel',
      'common.close',
      'common.ok',
      'common.test',
      'common.reset',
      'common.loading',
      'common.error',
      'common.success',
    ];

    // Fetch all translations in parallel
    const promises = keys.map(async (key) => {
      const value = await window.i18n.t(`settings:${key}`);
      this.translations[key] = value;
    });

    await Promise.all(promises);
  }

  t(key: string): string {
    return this.translations[key] || key;
  }

  private updateUI(): void {
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.getAttribute('data-i18n');
      if (key) {
        element.textContent = this.t(key);
      }
    });
  }
}

export const i18n = new I18nLoader();
