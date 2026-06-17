import { useState } from 'react';
import type { GhostDef } from '../../data/catalog.types';
import type { CollectionEntry, CollectionMap } from '../../services/persistence/schema';
import { useI18n } from '../../i18n/I18nProvider';

interface DogamProps {
  catalog: GhostDef[];
  collection: CollectionMap;
  onClose: () => void;
}

/** The 도감 (collection book): every catalog ghost, captured ones revealed. */
export function Dogam({ catalog, collection, onClose }: DogamProps) {
  const { t } = useI18n();
  const caught = Object.keys(collection).length;
  return (
    <div className="dogam">
      <div className="dogam__header">
        <h2 className="dogam__title">{t('dogam.title')}</h2>
        <span className="dogam__progress">
          {caught} <span className="dogam__progress-total">/ {catalog.length}</span>
        </span>
        <button className="dogam__close" onClick={onClose} aria-label={t('dogam.close')}>
          ✕
        </button>
      </div>
      <div className="dogam__grid">
        {catalog.map((def) => (
          <DogamCell key={def.id} def={def} entry={collection[def.id]} />
        ))}
      </div>
    </div>
  );
}

function DogamCell({ def, entry }: { def: GhostDef; entry: CollectionEntry | undefined }) {
  const { t, locale } = useI18n();
  if (!entry) {
    return (
      <div className="dogam-cell dogam-cell--locked">
        <span className="dogam-cell__q">?</span>
      </div>
    );
  }
  return (
    <div className={`dogam-cell dogam-cell--${def.rarity}`}>
      <GhostThumb def={def} />
      <div className="dogam-cell__name">{def.name[locale]}</div>
      <div className="dogam-cell__meta">
        <span className={`dogam-cell__rarity dogam-cell__rarity--${def.rarity}`}>
          {t(`rarity.${def.rarity}`)}
        </span>
        <span className="dogam-cell__count">×{entry.count}</span>
      </div>
    </div>
  );
}

/** Real sprite if present, else an emoji placeholder (art may not exist yet). */
function GhostThumb({ def }: { def: GhostDef }) {
  const { locale } = useI18n();
  const [failed, setFailed] = useState(false);
  if (failed || !def.sprite.atlas) {
    return (
      <div className="dogam-cell__thumb dogam-cell__thumb--placeholder" aria-hidden="true">
        👻
      </div>
    );
  }
  return (
    <img
      className="dogam-cell__thumb"
      src={`/${def.sprite.atlas}`}
      alt={def.name[locale]}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
