'use client';

import { useCallback, useEffect, useState } from 'react';
import { go, useApp } from '@/lib/app';
import { timeAgo, useT } from '@/lib/i18n';
import { mediaUrl, sb } from '@/lib/supabase';
import type { MiniProfile } from '@/lib/types';
import { Avatar, Icon } from '../ui';

type Req = { id: string; created_at: string; from: MiniProfile };
type Act = { key: string; who: MiniProfile; kind: 'like' | 'comment'; text?: string; at: string; image: string | null };

const P = 'id,username,display_name,avatar_path';

export default function Notifications() {
  const { t } = useT();
  const { userId, refreshFriends, toast } = useApp();
  const [reqs, setReqs] = useState<Req[]>([]);
  const [acts, setActs] = useState<Act[] | null>(null);

  const load = useCallback(async () => {
    const { data: r } = await sb()
      .from('friend_requests')
      .select(`id,created_at,from:profiles!from_id(${P})`)
      .eq('to_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setReqs((r || []) as unknown as Req[]);

    const [{ data: likes }, { data: comments }] = await Promise.all([
      sb()
        .from('likes')
        .select(`created_at,user:profiles!user_id(${P}),post:posts!inner(id,author_id,image_path)`)
        .eq('post.author_id', userId)
        .neq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30),
      sb()
        .from('comments')
        .select(`id,body,created_at,author:profiles!author_id(${P}),post:posts!inner(id,author_id,image_path)`)
        .eq('post.author_id', userId)
        .neq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(30)
    ]);
    type L = { created_at: string; user: MiniProfile; post: { id: string; image_path: string | null } };
    type C = { id: string; body: string; created_at: string; author: MiniProfile; post: { id: string; image_path: string | null } };
    const list: Act[] = [
      ...((likes || []) as unknown as L[]).map((l) => ({ key: 'l' + l.post.id + l.user.id, who: l.user, kind: 'like' as const, at: l.created_at, image: l.post.image_path })),
      ...((comments || []) as unknown as C[]).map((c) => ({ key: 'c' + c.id, who: c.author, kind: 'comment' as const, text: c.body, at: c.created_at, image: c.post.image_path }))
    ].sort((a, b) => b.at.localeCompare(a.at));
    setActs(list);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function answer(id: string, accept: boolean) {
    const { error } = await sb().from('friend_requests').update({ status: accept ? 'accepted' : 'declined' }).eq('id', id);
    if (error) toast(error.message.includes('circle_full') ? t('circleFull') : t('error'));
    refreshFriends();
    load();
  }

  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn filled" aria-label={t('back')} onClick={() => history.back()}>
          <Icon name="back" size={22} />
        </button>
      </div>
      <h1 className="title">{t('notifications')}</h1>

      {reqs.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="h2">
            {t('requests')} <span className="meta">({reqs.length})</span>
          </h2>
          {reqs.map((r) => (
            <div key={r.id} className="card">
              <button className="row" style={{ textAlign: 'left' }} onClick={() => go('profile/' + r.from.username)}>
                <Avatar p={r.from} size={48} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 15, lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 500 }}>{r.from.display_name}</span> {t('wantsAdd')}
                  </span>
                  <span className="meta">
                    @{r.from.username} · {timeAgo(r.created_at, t)}
                  </span>
                </span>
              </button>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn sm primary grow" onClick={() => answer(r.id, true)}>
                  {t('accept')}
                </button>
                <button className="btn sm fill grow" onClick={() => answer(r.id, false)}>
                  {t('decline')}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {acts && acts.length === 0 && reqs.length === 0 && <p className="empty">{t('nothingNew')}</p>}
      {acts && acts.length > 0 && (
        <div className="list">
          {acts.map((a) => (
            <button key={a.key} className="cell" onClick={() => go('profile/' + a.who.username)}>
              <span style={{ position: 'relative', display: 'flex' }}>
                <Avatar p={a.who} size={44} />
                <span
                  className="center"
                  style={{
                    position: 'absolute',
                    right: -4,
                    bottom: -4,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    boxShadow: '0 0 0 2px var(--bg)',
                    background: a.kind === 'like' ? 'var(--like)' : 'var(--primary)',
                    color: a.kind === 'like' ? '#fff' : 'var(--on-primary)'
                  }}
                >
                  <Icon name={a.kind === 'like' ? 'heart' : 'chat'} size={12} filled={a.kind === 'like'} />
                </span>
              </span>
              <span className="cell-body" style={{ minHeight: 68 }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 15, lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 500 }}>{a.who.display_name}</span>{' '}
                    <span className="muted">{a.kind === 'like' ? t('liked') : t('commented', { text: a.text || '' })}</span>
                  </span>
                  <span className="meta">{timeAgo(a.at, t)}</span>
                </span>
                {a.image && <img src={mediaUrl(a.image) || ''} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
