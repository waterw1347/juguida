import koRaw from './ko.json';
import enRaw from './en.json';

export type Locale = 'ko' | 'en';
type Dict = Record<string, string>;

const DICTS: Record<Locale, Dict> = {
  ko: koRaw as unknown as Dict,
  en: enRaw as unknown as Dict,
};

/**
 * App-wide i18n singleton (not React-only) so the engine/orchestrator can
 * translate toasts and warnings too. React subscribes via I18nProvider.
 */
class I18n {
  private locale: Locale = 'ko';
  private readonly listeners = new Set<() => void>();

  readonly getLocale = (): Locale => this.locale;

  setLocale(locale: Locale): void {
    if (locale === this.locale) return;
    this.locale = locale;
    for (const listener of this.listeners) listener();
  }

  readonly subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  /** Translate `key`, interpolating `{param}` placeholders. Falls back KO → key. */
  readonly t = (key: string, params?: Record<string, string | number>): string => {
    let str = DICTS[this.locale][key] ?? DICTS.ko[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return str;
  };
}

export const i18n = new I18n();

export function detectLocale(): Locale {
  const lang = typeof navigator !== 'undefined' ? navigator.language : '';
  return lang?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}
