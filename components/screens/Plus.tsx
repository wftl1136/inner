'use client';

import { useT } from '@/lib/i18n';
import { Icon } from '../ui';

export default function Plus() {
  const { t } = useT();
  const features = [t('plusF1'), t('plusF2'), t('plusF3'), t('plusF4'), t('plusF5')];
  return (
    <div className="page">
      <div className="topbar" style={{ justifyContent: 'flex-end' }}>
        <button className="icon-btn filled" aria-label={t('close')} onClick={() => history.back()}>
          <Icon name="close" />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="meta" style={{ fontSize: 13, color: 'var(--text2)' }}>inner+</span>
        <h1 className="title">{t('plusHeadline')}</h1>
      </div>
      <ul className="group" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {features.map((f, i) => (
          <li key={i} className="cell">
            <span className="cell-icon" style={{ color: 'var(--text)' }}>
              <Icon name="check" />
            </span>
            <span className="cell-body" style={{ fontSize: 15 }}>
              {f}
            </span>
          </li>
        ))}
      </ul>
      <p className="muted" style={{ margin: '0 4px', fontSize: 14, lineHeight: 1.5 }}>
        {t('plusSoon')}
      </p>
    </div>
  );
}
