import { useState, useSyncExternalStore, type ReactNode } from 'react';
import type { SettingsService, ThemeMode } from '../../services/SettingsService';
import type { Locale } from '../../i18n/i18n';
import { useI18n } from '../../i18n/I18nProvider';
import { Popup } from '../components/Popup';

interface SettingsProps {
  service: SettingsService;
  onClose: () => void;
  onReset: () => void;
}

export function Settings({ service, onClose, onReset }: SettingsProps) {
  const { t } = useI18n();
  const settings = useSyncExternalStore(service.subscribe, service.getSnapshot);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="settings">
      <div className="settings__header">
        <h2 className="settings__title">{t('settings.title')}</h2>
        <button className="dogam__close" onClick={onClose} aria-label={t('settings.close')}>
          ✕
        </button>
      </div>

      <div className="settings__body">
        <Row label={t('settings.language')}>
          <Seg
            options={[
              ['ko', '한국어'],
              ['en', 'English'],
            ]}
            value={settings.locale}
            onChange={(v) => service.update({ locale: v as Locale })}
          />
        </Row>

        <Row label={t('settings.theme')}>
          <Seg
            options={[
              ['dark', t('settings.theme.dark')],
              ['light', t('settings.theme.light')],
              ['system', t('settings.theme.system')],
            ]}
            value={settings.theme}
            onChange={(v) => service.update({ theme: v as ThemeMode })}
          />
        </Row>

        <Row label={t('settings.audio')}>
          <Seg
            options={[
              ['on', t('settings.on')],
              ['off', t('settings.off')],
            ]}
            value={settings.audio ? 'on' : 'off'}
            onChange={(v) => service.update({ audio: v === 'on' })}
          />
        </Row>

        <button className="settings__reset" onClick={() => setConfirmReset(true)}>
          {t('settings.reset')}
        </button>
      </div>

      <Popup
        open={confirmReset}
        title={t('settings.reset.confirmTitle')}
        onClose={() => setConfirmReset(false)}
        actions={
          <>
            <button className="btn-ghost" onClick={() => setConfirmReset(false)}>
              {t('settings.reset.cancel')}
            </button>
            <button
              className="btn-danger"
              onClick={() => {
                onReset();
                setConfirmReset(false);
              }}
            >
              {t('settings.reset.ok')}
            </button>
          </>
        }
      >
        <p>{t('settings.reset.confirmBody')}</p>
      </Popup>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="settings__row">
      <span className="settings__label">{label}</span>
      {children}
    </div>
  );
}

function Seg({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<readonly [string, string]>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="seg">
      {options.map(([val, label]) => (
        <button
          key={val}
          className={`seg__btn${value === val ? ' is-active' : ''}`}
          onClick={() => onChange(val)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
