'use client';

import { useEffect, useState } from 'react';
import { go, useApp } from '@/lib/app';
import { timeAgo, useT } from '@/lib/i18n';
import { markSeen } from '@/lib/invite';
import { mediaUrl, sb } from '@/lib/supabase';
import type { MiniProfile, Story } from '@/lib/types';
import { Avatar, Icon } from '../ui';

const DURATION = 5000;

export default function StoryViewer({ authorId }: { authorId: string }) {
  const { t } = useT();
  const { userId, toast } = useApp();
  const [stories, setStories] = useState<Story[] | null>(null);
  const [author, setAuthor] = useState<MiniProfile | null>(null);
  const [i, setI] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');

  useEffect(() => {
    (async () => {
      const [{ data }, { data: p }] = await Promise.all([
        sb().from('stories').select('*').eq('author_id', authorId).order('created_at'),
        sb().from('profiles').select('id,username,display_name,avatar_path').eq('id', authorId).maybeSingle()
      ]);
      const list = (data || []) as Story[];
      if (!list.length) return go('feed');
      setStories(list);
      setAuthor(p as MiniProfile);
    })();
  }, [authorId]);

  useEffect(() => {
    if (!stories) return;
    markSeen([stories[i].id]);
    setElapsed(0);
  }, [i, stories]);

  useEffect(() => {
    if (!stories || paused) return;
    const step = 100;
    const id = window.setInterval(() => {
      setElapsed((e) => {
        if (e + step >= DURATION) {
          if (i < stories.length - 1) setI(i + 1);
          else go('feed');
          return 0;
        }
        return e + step;
      });
    }, step);
    return () => window.clearInterval(id);
  }, [stories, i, paused]);

  if (!stories || !author) return <div className="overlay dark-media" />;
  const s = stories[i];
  const mine = authorId === userId;

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    const body = reply.trim();
    if (!body) return;
    setReply('');
    const { data: conv, error } = await sb().rpc('get_or_create_conversation', { other: authorId });
    if (error || !conv) return toast(t('error'));
    await sb().from('messages').insert({ conversation_id: conv, body });
    toast(t('sentTo', { name: author!.display_name }));
    setPaused(false);
  }

  async function removeStory() {
    await sb().from('stories').delete().eq('id', s.id);
    go('feed');
  }

  return (
    <div className="overlay dark-media">
      <img src={mediaUrl(s.image_path) || ''} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
      <button aria-label={t('back')} onClick={() => i > 0 && setI(i - 1)} style={{ position: 'absolute', left: 0, top: 120, bottom: 120, width: '35%' }} />
      <button aria-label={t('more')} onClick={() => (i < stories.length - 1 ? setI(i + 1) : go('feed'))} style={{ position: 'absolute', right: 0, top: 120, bottom: 120, width: '65%' }} />

      <div className="sheet-top" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="progress">
          {stories.map((st, k) => (
            <span key={st.id}>
              <i style={{ width: k < i ? '100%' : k === i ? `${(elapsed / DURATION) * 100}%` : '0%' }} />
            </span>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="row media-chip" onClick={() => go('profile/' + author.username)} style={{ height: 44, padding: '0 16px 0 4px', borderRadius: 22, gap: 8 }}>
            <Avatar p={author} size={36} />
            <span className="name">{author.display_name}</span>
            <span className="meta" style={{ color: 'rgba(242, 242, 242, 0.7)' }}>
              {timeAgo(s.created_at, t)}
            </span>
          </button>
          <div className="row" style={{ gap: 8 }}>
            {mine && (
              <button className="icon-btn media-chip" aria-label={t('delete')} onClick={removeStory}>
                <Icon name="close" size={18} />
              </button>
            )}
            <button className="icon-btn media-chip" aria-label={t('close')} onClick={() => go('feed')}>
              <Icon name="down" size={22} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />
      {!mine && (
        <form className="sheet-bottom row" style={{ position: 'relative', gap: 8 }} onSubmit={sendReply}>
          <label className="sr-only" htmlFor="story-reply">
            {t('replyTo', { name: author.display_name })}
          </label>
          <input
            id="story-reply"
            className="media-chip"
            value={reply}
            onFocus={() => setPaused(true)}
            onBlur={() => !reply && setPaused(false)}
            onChange={(e) => setReply(e.target.value)}
            placeholder={t('replyTo', { name: author.display_name })}
            style={{ flex: 1, minWidth: 0, height: 48, borderRadius: 24, padding: '0 20px', fontSize: 16 }}
          />
          <button type="submit" className="icon-btn lg" aria-label={t('send')} style={{ background: '#f2f2f2', color: '#050505' }}>
            <Icon name="arrowUp" />
          </button>
        </form>
      )}
    </div>
  );
}
