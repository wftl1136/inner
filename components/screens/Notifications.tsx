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
        <button className="icon-btn glass" aria-label={t('back')} onClick={() => history.back()}>
          <Icon name="back" size={20} stroke={2.2} />
        </button>
      </div>
      <h1 className="title">{t('notifications')}</h1>

      {reqs.length > 0 && (
        <>
          <h2 className="h2">{t('requests')}</h2>
          {reqs.map((r) => (
            <div key={r.id} className="card" style={{ borderRadius: 22 }}>
              <button className="row" style={{ gap: 12, textAlign: 'left' }} onClick={() => go('profile/' + r.from.username)}>
                <Avatar p={r.from} size={48} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 15, lineHeight: 1.35 }}>
                    <strong style={{ fontWeight: 600 }}>{r.from.display_name}</strong> {t('wantsAdd')}
                  </span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    @{r.from.username} · {timeAgo(r.created_at, t)}
                  </span>
                </span>
              </button>
              <div className="row">
                <button className="btn sm primary grow" onClick={() => answer(r.id, true)}>
                  {t('accept')}
                </button>
                <button className="btn sm fill grow" onClick={() => answer(r.id, false)}>
                  {t('decline')}
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {acts && acts.length === 0 && reqs.length === 0 && <p className="empty">{t('nothingNew')}</p>}
      {acts && acts.length > 0 && (
        <div className="group">
          {acts.map((a) => (
            <button key={a.key} className="cell" onClick={() => go('profile/' + a.who.username)}>
              <span style={{ position: 'relative' }}>
                <Avatar p={a.who} size={42} />
                <span
                  style={{
                    position: 'absolute',
                    right: -3,
                    bottom: -3,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    border: '2px solid var(--surface)',
                    background: a.kind === 'like' ? 'var(--like)' : 'var(--accent)'
                  }}
                />
              </span>
              <span className="cell-body" style={{ paddingTop: 12, paddingBottom: 12 }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 15, lineHeight: 1.35 }}>
                    <strong style={{ fontWeight: 600 }}>{a.who.display_name}</strong>{' '}
                    {a.kind === 'like' ? t('liked') : t('commented', { text: a.text || '' })}
                  </span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {timeAgo(a.at, t)}
                  </span>
                </span>
                {a.image && <img src={mediaUrl(a.image) || ''} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
