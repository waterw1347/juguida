import { i18n, detectLocale, type Locale } from '../i18n/i18n';

export type ThemeMode = 'system' | 'dark' | 'light';

export interface Settings {
  locale: Locale;
  theme: ThemeMode;
  audio: boolean;
}

const STORAGE_KEY = 'joogwida.settings';

/**
 * User preferences (locale, theme, audio). Stored synchronously in localStorage
 * so theme/locale apply before first paint (no flash). Applying a change updates
 * the i18n singleton and the document's `data-theme`.
 */
export class SettingsService {
  private settings: Settings;
  private readonly listeners = new Set<() => void>();
  private systemMql: MediaQueryList | null = null;

  constructor() {
    this.settings = this.read();
  }

  /** Apply current settings to i18n + the DOM. Call once at boot. */
  apply(): void {
    i18n.setLocale(this.settings.locale);
    this.applyTheme();
  }

  readonly getSnapshot = (): Settings => this.settings;

  readonly subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  update(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    this.persist();
    if (patch.locale) i18n.setLocale(patch.locale);
    if (patch.theme !== undefined) this.applyTheme();
    for (const listener of this.listeners) listener();
  }

  private read(): Settings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Settings>;
        return {
          locale: p.locale === 'ko' || p.locale === 'en' ? p.locale : detectLocale(),
          theme:
            p.theme === 'dark' || p.theme === 'light' || p.theme === 'system' ? p.theme : 'dark',
          audio: typeof p.audio === 'boolean' ? p.audio : true,
        };
      }
    } catch {
      // Ignore malformed/unavailable storage.
    }
    return { locale: detectLocale(), theme: 'dark', audio: true };
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Best-effort.
    }
  }

  private applyTheme(): void {
    const mode = this.settings.theme;
    const resolved = mode === 'system' ? (this.prefersDark() ? 'dark' : 'light') : mode;
    document.documentElement.dataset.theme = resolved;
    this.bindSystem(mode === 'system');
  }

  private prefersDark(): boolean {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  }

  private bindSystem(on: boolean): void {
    if (on && !this.systemMql) {
      this.systemMql = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemMql.addEventListener('change', this.onSystemChange);
    } else if (!on && this.systemMql) {
      this.systemMql.removeEventListener('change', this.onSystemChange);
      this.systemMql = null;
    }
  }

  private readonly onSystemChange = (): void => {
    if (this.settings.theme === 'system') this.applyTheme();
  };
}
