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
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        className="glass"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '75dvh',
          overflowY: 'auto',
          borderRadius: '28px 28px 0 0',
          padding: '16px 16px calc(env(safe-area-inset-bottom) + 16px)',
          background: 'var(--surface)'
        }}
      >
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <strong style={{ fontSize: 17 }}>{title}</strong>
          <button className="icon-btn" onClick={onClose} aria-label="Close" style={{ background: 'var(--fill)', width: 36, height: 36 }}>
            <Icon name="close" size={16} stroke={2.4} />
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
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 600 }}>{f.display_name}</span>
              <span className="muted" style={{ fontSize: 13 }}>
                @{f.username}
              </span>
            </span>
          </span>
        </button>
      ))}
    </Sheet>
  );
}
