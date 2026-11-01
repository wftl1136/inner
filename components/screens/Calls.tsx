'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/lib/app';
import { timeAgo, useT } from '@/lib/i18n';
import { sb } from '@/lib/supabase';
import type { Call, MiniProfile } from '@/lib/types';
import { Avatar, Icon } from '../ui';

const P = 'id,username,display_name,avatar_path';
type Row = Call & { caller: MiniProfile; callee: MiniProfile };

export default function Calls() {
  const { t } = useT();
  const { userId, friends, startCall, activeCall } = useApp();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tab, setTab] = useState<'all' | 'missed'>('all');

  useEffect(() => {
    sb()
      .from('calls')
      .select(`*,caller:profiles!caller_id(${P}),callee:profiles!callee_id(${P})`)
      .order('created_at', { ascending: false })
      .limit(60)
      .then(({ data }) => setRows((data || []) as unknown as Row[]));
  }, [activeCall]);

  const isMissed = (c: Row) => c.callee_id === userId && ['missed', 'cancelled'].includes(c.status);
  const list = (rows || []).filter((c) => (tab === 'missed' ? isMissed(c) : true));

  function meta(c: Row) {
    const kind = c.kind === 'video' ? t('video') : t('voice');
    if (isMissed(c)) return `${kind} · ${t('missedCall')}`;
    if (c.status === 'declined') return `${kind} · ${t('declinedCall')}`;
    const dir = c.caller_id === userId ? t('outgoing') : t('incoming');
    let dur = '';
    if (c.answered_at && c.ended_at) {
      const m = Math.max(1, Math.round((new Date(c.ended_at).getTime() - new Date(c.answered_at).getTime()) / 60000));
      dur = ' · ' + t('minAgo', { n: m });
    }
    return `${kind} · ${dir}${dur}`;
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="title">{t('tabCalls')}</h1>
      </header>

      {friends.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 className="h2" style={{ margin: 0 }}>
            {t('circle')}
          </h2>
          <div className="stories" style={{ padding: '2px 4px 4px', gap: 14 }}>
            {friends.map((f) => (
              <div key={f.id} className="story-card" style={{ width: 72 }}>
                <Avatar p={f} size={64} />
                <span className="ellipsis" style={{ maxWidth: 72, fontSize: 13 }}>
                  {f.display_name.split(' ')[0]}
                </span>
                <span className="row" style={{ gap: 4 }}>
                  <button className="icon-btn" style={{ width: 32, height: 32, background: 'var(--fill)' }} aria-label={`${t('call')}: ${f.display_name}`} onClick={() => startCall(f.id, 'voice')}>
                    <Icon name="phone" size={14} stroke={2.4} />
                  </button>
                  <button className="icon-btn" style={{ width: 32, height: 32, background: 'var(--fill)' }} aria-label={`${t('videoCall')}: ${f.display_name}`} onClick={() => startCall(f.id, 'video')}>
                    <Icon name="video" size={15} stroke={2.4} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="segmented">
        <button aria-pressed={tab === 'all'} onClick={() => setTab('all')}>
          {t('all')}
        </button>
        <button aria-pressed={tab === 'missed'} onClick={() => setTab('missed')}>
          {t('missed')}
        </button>
      </div>

      {rows === null && <p className="empty">{t('loading')}</p>}
      {rows && list.length === 0 && <p className="empty">{t('callsEmpty')}</p>}
      {list.length > 0 && (
        <div className="group">
          {list.map((c) => {
            const other = c.caller_id === userId ? c.callee : c.caller;
            return (
              <div key={c.id} className="cell">
                <Avatar p={other} size={44} />
                <span className="cell-body">
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <strong className="ellipsis" style={{ fontWeight: 600, color: isMissed(c) ? 'var(--danger)' : undefined }}>
                      {other.display_name}
                    </strong>
                    <span className="muted ellipsis" style={{ fontSize: 13 }}>
                      {meta(c)}
                    </span>
                  </span>
                  <span className="row" style={{ gap: 8, flexShrink: 0 }}>
                    <span className="muted" style={{ fontSize: 13 }}>
                      {timeAgo(c.created_at, t)}
                    </span>
                    <button
                      className="icon-btn"
                      style={{ width: 40, height: 40, background: 'var(--fill)' }}
                      aria-label={c.kind === 'video' ? t('videoCall') : t('call')}
                      onClick={() => startCall(other.id, c.kind)}
                    >
                      <Icon name={c.kind === 'video' ? 'video' : 'phone'} size={17} />
                    </button>
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
