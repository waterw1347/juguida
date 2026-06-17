import type { CatchResultInfo } from '../../app/GameStore';
import { useI18n } from '../../i18n/I18nProvider';
import { Popup } from '../components/Popup';

interface ResultModalProps {
  result: CatchResultInfo;
  onClose: () => void;
}

/** Shown after a successful capture: which ghost, rarity, lore, and reward. */
export function ResultModal({ result, onClose }: ResultModalProps) {
  const { t, locale } = useI18n();
  const { def, reward, ambush, firstCatch } = result;
  return (
    <Popup
      open
      title={t('result.title')}
      actions={
        <button className="btn-primary" onClick={onClose}>
          {t('result.continue')}
        </button>
      }
    >
      <div className="result">
        <span className={`result__rarity result__rarity--${def.rarity}`}>
          {t(`rarity.${def.rarity}`)}
        </span>
        <div className="result__name">
          {def.name[locale]}
          {firstCatch && <span className="result__new">{t('result.new')}</span>}
        </div>
        <p className="result__lore">{def.lore[locale]}</p>
        <div className="result__reward">
          {t('result.reward', { n: reward.toLocaleString() })}
          {ambush && <span className="result__bonus">{t('result.bonus')}</span>}
        </div>
      </div>
    </Popup>
  );
}
