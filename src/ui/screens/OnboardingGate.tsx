import type { PermissionIssue } from '../../app/GameStore';
import { useI18n } from '../../i18n/I18nProvider';
import { Popup } from '../components/Popup';

interface OnboardingGateProps {
  onStart: () => void;
  busy: boolean;
  issue: PermissionIssue | null;
}

/** iOS Safari tab (not yet installed) → show "Add to Home Screen" hint. */
function isIosBrowserTab(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return isIos && nav.standalone === false;
}

/**
 * Full-screen "탭하여 시작" gate. The tap is the single user gesture that drives
 * both permission prompts (motion + camera) and the audio unlock. On denial it
 * surfaces a custom Popup with retry — never a native dialog.
 */
export function OnboardingGate({ onStart, busy, issue }: OnboardingGateProps) {
  const { t } = useI18n();
  return (
    <div className="gate">
      <div className="gate__inner">
        <p className="gate__eyebrow">{t('gate.eyebrow')}</p>
        <h1 className="gate__title">{t('gate.title')}</h1>
        <p className="gate__desc">{t('gate.desc')}</p>
        <button className="btn-primary gate__cta" onClick={onStart} disabled={busy}>
          {busy ? t('gate.cta.busy') : t('gate.cta')}
        </button>
        <p className="gate__hint">{t('gate.hint')}</p>
        {isIosBrowserTab() && <p className="gate__install">{t('install.body')}</p>}
      </div>

      <Popup
        open={issue !== null}
        title={t('permission.title')}
        actions={
          <button className="btn-primary" onClick={onStart} disabled={busy}>
            {t('permission.retry')}
          </button>
        }
      >
        <p>{issue?.message}</p>
      </Popup>
    </div>
  );
}
