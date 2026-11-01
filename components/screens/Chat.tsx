'use client';

import { uniq } from '@/lib/uniq';

import { useCallback, useEffect, useRef, useState } from 'react';
import { go, useApp } from '@/lib/app';
import { useT } from '@/lib/i18n';
import { fetchPost } from '@/lib/posts';
import { mediaUrl, sb } from '@/lib/supabase';
import type { Message, MiniProfile, Post } from '@/lib/types';
import { Avatar, Icon } from '../ui';

const P = 'id,username,display_name,avatar_path';

export default function ChatScreen({ conversationId }: { conversationId: string }) {
  const { t, lang } = useT();
  const { userId, startCall, toast } = useApp();
  const [other, setOther] = useState<MiniProfile | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [shared, setShared] = useState<Record<string, Post | null>>({});
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const markRead = useCallback(async () => {
    await sb().from('messages').update({ read_at: new Date().toISOString() }).eq('conversation_id', conversationId).neq('sender_id', userId).is('read_at', null);
  }, [conversationId, userId]);

  useEffect(() => {
    (async () => {
      const { data: c } = await sb().from('conversations').select(`id,user_a,a:profiles!user_a(${P}),b:profiles!user_b(${P})`).eq('id', conversationId).maybeSingle();
      if (!c) return go('chats');
      const conv = c as unknown as { user_a: string; a: MiniProfile; b: MiniProfile };
      setOther(conv.user_a === userId ? conv.b : conv.a);
      const { data } = await sb().from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(200);
      setMsgs(((data || []) as Message[]).reverse());
      markRead();
    })();
    const ch = sb()
      .channel(uniq('chat-' + conversationId))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as Message;
        setMsgs((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
        if (m.sender_id !== userId) markRead();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as Message;
        setMsgs((list) => list.map((x) => (x.id === m.id ? m : x)));
      })
      .subscribe();
    return () => {
      sb().removeChannel(ch);
    };
  }, [conversationId, userId, markRead]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
    const missing = msgs.map((m) => m.shared_post_id).filter((id): id is string => !!id && !(id in shared));
    if (missing.length) {
      Promise.all(missing.map((id) => fetchPost(id).then((p) => [id, p] as const))).then((pairs) =>
        setShared((s) => ({ ...s, ...Object.fromEntries(pairs) }))
      );
    }
  }, [msgs, shared]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    const { data, error } = await sb().from('messages').insert({ conversation_id: conversationId, body }).select('*').single();
    if (error) {
      setDraft(body);
      return toast(t('error'));
    }
    setMsgs((list) => (list.some((x) => x.id === data.id) ? list : [...list, data as Message]));
  }

  const fmt = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' });
  const dayFmt = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long' });
  const lastMine = [...msgs].reverse().find((m) => m.sender_id === userId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', width: '100%' }}>
      <div className="row" style={{ position: 'sticky', top: 0, zIndex: 5, padding: 'calc(env(safe-area-inset-top) + 8px) 12px 8px', gap: 8 }}>
        <button className="icon-btn glass" aria-label={t('back')} onClick={() => go('chats')}>
          <Icon name="back" size={20} stroke={2.2} />
        </button>
        <button className="row glass grow" style={{ height: 48, borderRadius: 24, padding: '0 14px 0 6px', textAlign: 'left' }} onClick={() => other && go('profile/' + other.username)}>
          <Avatar p={other} size={36} />
          <span className="ellipsis" style={{ fontWeight: 600, fontSize: 15 }}>
            {other?.display_name}
          </span>
        </button>
        <div className="capsule glass">
          <button className="icon-btn" aria-label={t('call')} onClick={() => other && startCall(other.id, 'voice')}>
            <Icon name="phone" size={19} />
          </button>
          <button className="icon-btn" aria-label={t('videoCall')} onClick={() => other && startCall(other.id, 'video')}>
            <Icon name="video" size={20} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {msgs.map((m, i) => {
          const prev = msgs[i - 1];
          const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
          const out = m.sender_id === userId;
          const post = m.shared_post_id ? shared[m.shared_post_id] : undefined;
          const rawContent = post?.repost_of ? post.original : post;
          const content = rawContent && rawContent.author ? rawContent : null;
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {newDay && <span className="sys" style={{ margin: '8px 0' }}>{dayFmt.format(new Date(m.created_at))}</span>}
              {m.shared_post_id && (
                <button
                  className={'bubble ' + (out ? 'out' : 'in')}
                  style={{ padding: 8, width: 240, display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}
                  onClick={() => content && go('profile/' + content.author.username)}
                >
                  <span className="row" style={{ gap: 5, fontSize: 12, fontWeight: 600, opacity: 0.75 }}>
                    <Icon name="repost" size={12} stroke={2.4} />
                    {t('sharedPost')}
                  </span>
                  {content ? (
                    <>
                      <span className="row" style={{ gap: 8 }}>
                        <Avatar p={content.author} size={24} />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{content.author.display_name}</span>
                      </span>
                      {content.image_path && <img src={mediaUrl(content.image_path) || ''} alt="" style={{ borderRadius: 12, maxHeight: 180, objectFit: 'cover' }} />}
                      {content.body && <span style={{ fontSize: 14, lineHeight: 1.35 }}>{content.body.slice(0, 160)}</span>}
                    </>
                  ) : (
                    <span style={{ fontSize: 13 }}>{post === null ? t('originalHidden') : '…'}</span>
                  )}
                </button>
              )}
              {m.body && (
                <div className={'bubble ' + (out ? 'out' : 'in')} title={fmt.format(new Date(m.created_at))}>
                  {m.body}
                </div>
              )}
              {out && m.id === lastMine?.id && m.read_at && (
                <span className="muted" style={{ alignSelf: 'flex-end', fontSize: 11, paddingRight: 4 }}>
                  {t('readAt')} {fmt.format(new Date(m.read_at))}
                </span>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="row" style={{ padding: '8px 12px calc(env(safe-area-inset-bottom) + 10px)', gap: 8 }}>
        <label className="sr-only" htmlFor="msg">
          {t('message')}
        </label>
        <input
          id="msg"
          className="glass"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('message')}
          maxLength={4000}
          autoComplete="off"
          style={{ flex: 1, minWidth: 0, height: 46, borderRadius: 23, padding: '0 18px', fontSize: 16 }}
        />
        <button type="submit" className="icon-btn" aria-label={t('send')} style={{ width: 46, height: 46, borderRadius: 23, background: 'var(--primary)', color: 'var(--on-primary)' }}>
          <Icon name="send" size={19} />
        </button>
      </form>
    </div>
  );
}
