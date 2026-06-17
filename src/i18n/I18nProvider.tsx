import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { i18n, type Locale } from './i18n';

interface I18nContextValue {
  locale: Locale;
  t: typeof i18n.t;
}

const I18nContext = createContext<I18nContextValue>({ locale: 'ko', t: i18n.t });

/** Re-renders consumers when the locale changes. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(i18n.subscribe, i18n.getLocale, i18n.getLocale);
  const value = useMemo<I18nContextValue>(() => ({ locale, t: i18n.t }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
