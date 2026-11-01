'use client';

import { useCallback, useEffect, useState } from 'react';
import { go, useApp } from '@/lib/app';
import { timeAgo, useT } from '@/lib/i18n';
import { sb } from '@/lib/supabase';
import type { Message, MiniProfile } from '@/lib/types';
import { FriendPicker } from '../Sheet';
import { Avatar, Icon } from '../ui';

const P = 'id,username,display_name,avatar_path';
type Row = { id: string; other: MiniProfile; last: Message | null; unread: number; at: string };

export default function Chats() {
  const { t } = useT();
  const { userId, toast } = useApp();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [q, setQ] = useState('');
  const [picker, setPicker] = useState(false);

  const load = useCallback(async () => {
    const { data } = await sb()
      .from('conversations')
      .select(`id,user_a,user_b,last_message_at,a:profiles!user_a(${P}),b:profiles!user_b(${P})`)
      .order('last_message_at', { ascending: false })
      .limit(100);
    type C = { id: string; user_a: string; last_message_at: string; a: MiniProfile; b: MiniProfile };
    const convs = (data || []) as unknown as C[];
    const ids = convs.map((c) => c.id);
    let msgs: Message[] = [];
    if (ids.length) {
      const { data: m } = await sb().from('messages').select('*').in('conversation_id', ids).order('created_at', { ascending: false }).limit(500);
      msgs = (m || []) as Message[];
    }
    setRows(
      convs.map((c) => {
        const mine = msgs.filter((m) => m.conversation_id === c.id);
        return {
          id: c.id,
          other: c.user_a === userId ? c.b : c.a,
          last: mine[0] || null,
          unread: mine.filter((m) => m.sender_id !== userId && !m.read_at).length,
          at: c.last_message_at
        };
      })
    );
  }, [userId]);

  useEffect(() => {
    load();
    const ch = sb()
      .channel('chats-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => load())
      .subscribe();
    return () => {
      sb().removeChannel(ch);
    };
  }, [load]);

  async function startChat(f: MiniProfile) {
    setPicker(false);
    const { data, error } = await sb().rpc('get_or_create_conversation', { other: f.id });
    if (error || !data) return toast(t('error'));
    go('chat/' + data);
  }

  const term = q.trim().toLowerCase();
  const shown = (rows || [])
    .filter((r) => (filter === 'unread' ? r.unread > 0 : true))
    .filter((r) => !term || r.other.display_name.toLowerCase().includes(term) || r.other.username.includes(term));

  function preview(m: Message | null) {
    if (!m) return '';
    if (m.shared_post_id && !m.body) return t('sharedPost');
    return (m.sender_id === userId ? t('you') + ': ' : '') + m.body;
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="title">{t('tabChats')}</h1>
        <button className="icon-btn glass" aria-label={t('newChat')} onClick={() => setPicker(true)}>
          <Icon name="edit" size={19} />
        </button>
      </header>
      <label className="search">
        <Icon name="search" size={17} />
        <span className="sr-only">{t('searchUser')}</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchUser')} />
      </label>
      <div className="row" style={{ gap: 8 }}>
        <button className={'chip' + (filter === 'all' ? ' on' : '')} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          {t('all')}
        </button>
        <button className={'chip' + (filter === 'unread' ? ' on' : '')} aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>
          {t('unread')}
        </button>
      </div>
      {rows === null && <p className="empty">{t('loading')}</p>}
      {rows && shown.length === 0 && <p className="empty">{t('chatsEmpty')}</p>}
      {shown.length > 0 && (
        <div className="group">
          {shown.map((r) => (
            <button key={r.id} className="cell" onClick={() => go('chat/' + r.id)}>
              <Avatar p={r.other} size={52} />
              <span className="cell-body" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 3, paddingTop: 12, paddingBottom: 12 }}>
                <span className="row" style={{ justifyContent: 'space-between' }}>
                  <strong className="ellipsis" style={{ fontWeight: 600 }}>
                    {r.other.display_name}
                  </strong>
                  <span className="muted" style={{ fontSize: 13, flexShrink: 0 }}>
                    {timeAgo(r.at, t)}
                  </span>
                </span>
                <span className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted ellipsis" style={{ fontSize: 15 }}>
                    {preview(r.last)}
                  </span>
                  {r.unread > 0 && <span className="badge">{r.unread}</span>}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {picker && <FriendPicker onPick={startChat} onClose={() => setPicker(false)} />}
    </div>
  );
}
