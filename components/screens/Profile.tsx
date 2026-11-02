'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { go, useApp } from '@/lib/app';
import { useT } from '@/lib/i18n';
import { fetchPosts } from '@/lib/posts';
import { sb, uploadImage } from '@/lib/supabase';
import { shareInvite } from '@/lib/invite';
import type { FriendRequest, Post, Profile } from '@/lib/types';
import { PostCard } from '../PostCard';
import { Avatar, Icon } from '../ui';

type Rel = 'self' | 'friend' | 'out' | 'in' | 'none';

export default function ProfileScreen({ username }: { username: string }) {
  const { t } = useT();
  const { userId, me, refreshMe, friends, refreshFriends, toast, startCall } = useApp();
  const [p, setP] = useState<Profile | null>(null);
  const [req, setReq] = useState<FriendRequest | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [circleCount, setCircleCount] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!username) return;
    const { data } = await sb().from('profiles').select('*').eq('username', username).maybeSingle();
    if (!data) return setP(null);
    const prof = data as Profile;
    setP(prof);
    setName(prof.display_name);
    setBio(prof.bio);
    if (prof.id !== userId) {
      const { data: r } = await sb()
        .from('friend_requests')
        .select('*')
        .or(`and(from_id.eq.${userId},to_id.eq.${prof.id}),and(from_id.eq.${prof.id},to_id.eq.${userId})`)
        .maybeSingle();
      setReq((r as FriendRequest) || null);
    }
    const { data: cnt } = await sb().rpc('friend_count', { u: prof.id });
    setCircleCount(typeof cnt === 'number' ? cnt : null);
    try {
      const res = await fetchPosts({ authorId: prof.id });
      setPosts(res.posts);
      setLiked(res.liked);
    } catch {
      setPosts([]);
    }
  }, [username, userId]);

  useEffect(() => {
    load();
  }, [load, friends.length]);

  if (!p) return <div className="page"><p className="empty">{t('loading')}</p></div>;

  const rel: Rel =
    p.id === userId ? 'self' : !req ? 'none' : req.status === 'accepted' ? 'friend' : req.status === 'pending' ? (req.from_id === userId ? 'out' : 'in') : 'none';
  const max = p.plus ? 500 : 150;

  async function addToCircle() {
    if (req && req.status === 'declined') await sb().from('friend_requests').delete().eq('id', req.id);
    const { error } = await sb().from('friend_requests').insert({ to_id: p!.id });
    if (error) return toast(t('error'));
    toast(t('requested'));
    load();
  }
  async function answer(accept: boolean) {
    const { error } = await sb().from('friend_requests').update({ status: accept ? 'accepted' : 'declined' }).eq('id', req!.id);
    if (error) return toast(error.message.includes('circle_full') ? t('circleFull') : t('error'));
    refreshFriends();
    load();
  }
  async function removeFriend() {
    if (!confirm(t('removeFromCircle') + '?')) return;
    await sb().from('friend_requests').delete().eq('id', req!.id);
    refreshFriends();
    load();
  }
  async function openChat() {
    const { data, error } = await sb().rpc('get_or_create_conversation', { other: p!.id });
    if (error || !data) return toast(t('error'));
    go('chat/' + data);
  }
  async function saveProfile() {
    setBusy(true);
    const { error } = await sb().from('profiles').update({ display_name: name.trim() || p!.username, bio: bio.trim() }).eq('id', userId);
    setBusy(false);
    if (error) return toast(t('error'));
    setEditing(false);
    await refreshMe();
    load();
  }
  async function changeAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const path = await uploadImage(userId, f, 512);
      await sb().from('profiles').update({ avatar_path: path }).eq('id', userId);
      await refreshMe();
      load();
    } catch {
      toast(t('error'));
    }
  }

  return (
    <div className="page">
      <div className="topbar">
        {rel === 'self' ? (
          <button className="icon-btn filled" aria-label={t('inviteFriends')} onClick={() => shareInvite(p.username, t('shareText'), () => toast(t('linkCopied')))}>
            <Icon name="share" />
          </button>
        ) : (
          <button className="icon-btn filled" aria-label={t('back')} onClick={() => history.back()}>
            <Icon name="back" size={22} />
          </button>
        )}
        {rel === 'self' && (
          <button className="icon-btn filled" aria-label={t('settings')} onClick={() => go('settings')}>
            <Icon name="settings" />
          </button>
        )}
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        <CircleRing count={circleCount ?? 0} max={max} label={rel === 'self' ? t('myCircle') : t('circle')}>
          <button onClick={() => rel === 'self' && fileRef.current?.click()} aria-label={rel === 'self' ? t('changePhoto') : p.display_name} style={{ cursor: rel === 'self' ? 'pointer' : 'default', borderRadius: '50%' }}>
            <Avatar p={p} size={160} />
          </button>
        </CircleRing>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={changeAvatar} />
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', textAlign: 'left' }}>
            <label className="field">
              {t('displayName')}
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </label>
            <label className="field">
              {t('bio')}
              <textarea className="input" style={{ height: 96, padding: '12px 16px', resize: 'none' }} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} />
            </label>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn fill grow" onClick={() => setEditing(false)}>
                {t('cancel')}
              </button>
              <button className="btn primary grow" disabled={busy} onClick={saveProfile}>
                {t('save')}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <h1 className="title" style={{ fontSize: 24 }}>{p.display_name}</h1>
            <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
              <span className="meta" style={{ fontSize: 13, color: 'var(--text2)' }}>@{p.username}</span>
              {p.plus && <span className="meta" style={{ fontSize: 13, color: 'var(--text)' }}>inner+</span>}
            </div>
            <span className="meta" style={{ fontSize: 13 }}>
              {rel === 'self' ? t('myCircle') : t('circle')} ({circleCount ?? '—'}/{max})
            </span>
            {p.bio && <p style={{ margin: '4px 0 0', fontSize: 15, lineHeight: 1.5, maxWidth: 440 }}>{p.bio}</p>}
          </div>
        )}
      </section>

      {!editing && (
        <>
          <div className="row" style={{ gap: 8 }}>
            {rel === 'self' && (
              <>
                <button className="btn primary arrow grow" onClick={() => shareInvite(p.username, t('shareText'), () => toast(t('linkCopied')))}>
                  {t('copyInvite')}
                  <span className="btn-arrow">
                    <Icon name="arrowRight" size={16} />
                  </span>
                </button>
                <button className="btn fill" onClick={() => setEditing(true)}>
                  {t('edit')}
                </button>
              </>
            )}
            {rel === 'none' && (
              <button className="btn primary grow" onClick={addToCircle}>
                {t('addToCircle')}
              </button>
            )}
            {rel === 'out' && (
              <button className="btn fill grow" disabled>
                {t('requested')}
              </button>
            )}
            {rel === 'in' && (
              <>
                <button className="btn primary grow" onClick={() => answer(true)}>
                  {t('accept')}
                </button>
                <button className="btn fill grow" onClick={() => answer(false)}>
                  {t('decline')}
                </button>
              </>
            )}
            {rel === 'friend' && (
              <>
                <button className="btn primary grow" onClick={openChat}>
                  {t('write')}
                </button>
                <button className="icon-btn filled lg" aria-label={t('call')} onClick={() => startCall(p.id, 'voice')}>
                  <Icon name="phone" />
                </button>
                <button className="icon-btn filled lg" aria-label={t('videoCall')} onClick={() => startCall(p.id, 'video')}>
                  <Icon name="video" size={22} />
                </button>
                <button className="icon-btn filled lg" aria-label={t('removeFromCircle')} onClick={removeFriend}>
                  <Icon name="more" />
                </button>
              </>
            )}
          </div>

          {rel !== 'self' && rel !== 'friend' ? (
            <p className="empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Icon name="lock" />
              {t('privateProfile')}
            </p>
          ) : posts.length === 0 ? (
            <p className="empty">{t('noPosts')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--line)' }}>
              {posts.map((post) => (
                <PostCard key={post.id} post={post} liked={liked.has(post.id)} onChanged={load} />
              ))}
            </div>
          )}
          {rel === 'self' && me && <span className="sr-only">{me.username}</span>}
        </>
      )}
    </div>
  );
}

/** Круг: 150 делений вокруг аватара, занятые места светятся по очереди */
function CircleRing({ count, max, label, children }: { count: number; max: number; label: string; children: React.ReactNode }) {
  const [lit, setLit] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setLit(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const ticks = 150;
  const filled = Math.round((Math.min(count, max) / max) * ticks);
  const c = 112;
  return (
    <div className="ring" role="img" aria-label={`${label}: ${count} / ${max}`}>
      <svg viewBox="0 0 224 224" aria-hidden="true">
        {Array.from({ length: ticks }, (_, i) => {
          const a = (i / ticks) * Math.PI * 2 - Math.PI / 2;
          const on = lit && i < filled;
          return (
            <line
              key={i}
              x1={c + Math.cos(a) * 98}
              y1={c + Math.sin(a) * 98}
              x2={c + Math.cos(a) * 108}
              y2={c + Math.sin(a) * 108}
              strokeWidth={on ? 2 : 1.25}
              className={on ? 'on' : undefined}
              style={{ '--d': `${Math.round((i / Math.max(filled, 1)) * 900)}ms` } as React.CSSProperties}
            />
          );
        })}
      </svg>
      {children}
    </div>
  );
}
