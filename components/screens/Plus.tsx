'use client';

import { useT } from '@/lib/i18n';
import { Icon } from '../ui';

export default function Plus() {
  const { t } = useT();
  const features = [t('plusF1'), t('plusF2'), t('plusF3'), t('plusF4'), t('plusF5')];
  return (
    <div className="page">
      <div className="topbar" style={{ justifyContent: 'flex-end' }}>
        <button className="icon-btn glass" aria-label={t('close')} onClick={() => history.back()}>
          <Icon name="close" size={18} stroke={2.2} />
        </button>
      </div>
      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)', padding: '0 4px' }}>inner+</span>
      <h1 className="title" style={{ marginTop: -6 }}>
        {t('plusHeadline')}
      </h1>
      <ul className="group" style={{ listStyle: 'none', margin: 0, padding: '6px 16px' }}>
        {features.map((f, i) => (
          <li key={i} className="row" style={{ gap: 14, padding: '12px 0', borderBottom: i < features.length - 1 ? '0.5px solid var(--sep)' : 0, fontSize: 15 }}>
            <span className="tile accent">
              <Icon name="check" size={15} stroke={2.8} />
            </span>
            {f}
          </li>
        ))}
      </ul>
      <p className="card" style={{ margin: 0, borderRadius: 20, fontSize: 15, lineHeight: 1.5 }}>
        {t('plusSoon')}
      </p>
    </div>
  );
}
