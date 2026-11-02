'use client';

import { useEffect, useState } from 'react';
import { go, useApp } from '@/lib/app';
import { useT } from '@/lib/i18n';
import { sb } from '@/lib/supabase';
import { shareInvite } from '@/lib/invite';
import { PROFILE_FIELDS, type MiniProfile } from '@/lib/types';
import { Avatar, Icon } from '../ui';

export default function Search() {
  const { t } = useT();
  const { userId, me, toast } = useApp();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<MiniProfile[]>([]);

  useEffect(() => {
    const term = q.trim().replace(/^@/, '').replace(/[%,()]/g, '');
    if (term.length < 2) return setResults([]);
    const id = window.setTimeout(async () => {
      const { data } = await sb()
        .from('profiles')
        .select(PROFILE_FIELDS)
        .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
        .neq('id', userId)
        .limit(20);
      setResults((data || []) as MiniProfile[]);
    }, 250);
    return () => window.clearTimeout(id);
  }, [q, userId]);

  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn filled" aria-label={t('back')} onClick={() => history.back()}>
          <Icon name="back" size={22} />
        </button>
      </div>
      <h1 className="title">{t('findPeople')}</h1>
      <label className="search">
        <Icon name="search" size={18} />
        <span className="sr-only">{t('searchUser')}</span>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchUser')} autoCapitalize="none" autoCorrect="off" />
      </label>
      {q.trim().length >= 2 && results.length === 0 && <p className="empty">{t('nothingFound')}</p>}
      {results.length > 0 && (
        <div className="list">
          {results.map((p) => (
            <button key={p.id} className="cell" onClick={() => go('profile/' + p.username)}>
              <Avatar p={p} size={44} />
              <span className="cell-body" style={{ minHeight: 64 }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="name">{p.display_name}</span>
                  <span className="meta">@{p.username}</span>
                </span>
                <span style={{ color: 'var(--text3)', display: 'flex' }}>
                  <Icon name="chevron" size={16} />
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      <button className="btn fill" onClick={() => me && shareInvite(me.username, t('shareText'), () => toast(t('linkCopied')))}>
        <Icon name="share" size={18} />
        {t('inviteFriends')}
      </button>
    </div>
  );
}
