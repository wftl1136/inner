'use client';

import { useEffect } from 'react';
import { useApp } from '@/lib/app';
import { useT } from '@/lib/i18n';
import type { MiniProfile } from '@/lib/types';
import { Avatar, Icon } from './ui';

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose} className="scrim">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 17, fontWeight: 500 }}>{title}</span>
          <button className="icon-btn filled" onClick={onClose} aria-label="Close" style={{ width: 32, height: 32 }}>
            <Icon name="close" size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FriendPicker({ onPick, onClose }: { onPick: (p: MiniProfile) => void; onClose: () => void }) {
  const { friends } = useApp();
  const { t } = useT();
  return (
    <Sheet title={t('pickFriend')} onClose={onClose}>
      {friends.length === 0 && <p className="empty">{t('feedEmpty')}</p>}
      {friends.map((f) => (
        <button key={f.id} className="cell" style={{ paddingLeft: 0 }} onClick={() => onPick(f)}>
          <Avatar p={f} size={40} />
          <span className="cell-body">
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="name">{f.display_name}</span>
              <span className="meta">@{f.username}</span>
            </span>
          </span>
        </button>
      ))}
    </Sheet>
  );
}
