import { useI18n } from '../../i18n/I18nProvider';

interface HuntViewProps {
  hasOrientationData: boolean;
  credits: number;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onOpenDogam: () => void;
  onOpenSettings: () => void;
}

/**
 * Hunting HUD: a full-screen hold-to-catch surface, the center reticle (its gauge
 * ring is driven imperatively via the --catch-gauge CSS variable, and the
 * `is-targeting` root class toggles the locked-on look), plus a credits counter.
 */
export function HuntView({
  hasOrientationData,
  credits,
  onHoldStart,
  onHoldEnd,
  onOpenDogam,
  onOpenSettings,
}: HuntViewProps) {
  const { t } = useI18n();
  return (
    <div className="hunt">
      <div
        className="catch-surface"
        onPointerDown={onHoldStart}
        onPointerUp={onHoldEnd}
        onPointerCancel={onHoldEnd}
      />

      <div className="credits" aria-label={t('credits.label')}>
        <span className="credits__coin" aria-hidden="true">
          ◈
        </span>
        {credits.toLocaleString()}
      </div>

      <div className="hud-topright">
        <button className="hud-btn" onClick={onOpenDogam}>
          {t('hud.dogam')}
        </button>
        <button className="hud-btn" onClick={onOpenSettings} aria-label={t('hud.settings')}>
          ⚙
        </button>
      </div>

      <div className="reticle" aria-hidden="true">
        <span className="reticle__gauge" />
        <span className="reticle__ring" />
        <span className="reticle__dot" />
      </div>

      <div className="catch-hint">{t('hunt.catchHint')}</div>

      {!hasOrientationData && <div className="hunt__hint">{t('hunt.orientHint')}</div>}
    </div>
  );
}
