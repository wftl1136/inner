'use client';

import { useState } from 'react';
import { go, useApp } from '@/lib/app';
import { timeAgo, useT } from '@/lib/i18n';
import { mediaUrl, sb } from '@/lib/supabase';
import type { MiniProfile, Post } from '@/lib/types';
import { FriendPicker, Sheet } from './Sheet';
import { Avatar, Icon } from './ui';

type Comment = { id: string; body: string; created_at: string; author_id: string; author: MiniProfile };

export function PostCard({ post, liked, onChanged }: { post: Post; liked: boolean; onChanged?: () => void }) {
  const { t } = useT();
  const { userId, toast } = useApp();
  const [isLiked, setLiked] = useState(liked);
  const [likeCount, setLikeCount] = useState(post.likes?.[0]?.count ?? 0);
  const [commentCount, setCommentCount] = useState(post.comments?.[0]?.count ?? 0);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState(false);

  const isRepost = Boolean(post.repost_of);
  const raw = isRepost ? post.original : post;
  const content = raw && raw.author ? raw : null;
  const mine = post.author_id === userId;

  async function toggleLike() {
    const next = !isLiked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    const q = next
      ? sb().from('likes').insert({ post_id: post.id })
      : sb().from('likes').delete().eq('post_id', post.id).eq('user_id', userId);
    const { error } = await q;
    if (error) {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    }
  }

  async function openComments() {
    if (comments) return setComments(null);
    const { data } = await sb()
      .from('comments')
      .select('id,body,created_at,author_id,author:profiles!author_id(id,username,display_name,avatar_path)')
      .eq('post_id', post.id)
      .order('created_at');
    setComments((data || []) as unknown as Comment[]);
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    const { data, error } = await sb()
      .from('comments')
      .insert({ post_id: post.id, body })
      .select('id,body,created_at,author_id,author:profiles!author_id(id,username,display_name,avatar_path)')
      .single();
    if (error) return toast(t('error'));
    setComments((c) => [...(c || []), data as unknown as Comment]);
    setCommentCount((n) => n + 1);
  }

  async function repost() {
    const target = post.repost_of || post.id;
    const { error } = await sb().from('posts').insert({ repost_of: target });
    toast(error ? t('error') : t('repostDone'));
    if (!error) onChanged?.();
  }

  async function sendTo(friend: MiniProfile) {
    setPicker(false);
    const { data: convId, error } = await sb().rpc('get_or_create_conversation', { other: friend.id });
    if (error || !convId) return toast(t('error'));
    const { error: e2 } = await sb().from('messages').insert({ conversation_id: convId, shared_post_id: post.repost_of || post.id });
    toast(e2 ? t('error') : t('sentTo', { name: friend.display_name }));
  }

  async function remove() {
    setMenu(false);
    if (!confirm(t('deleteConfirm'))) return;
    const { error } = await sb().from('posts').delete().eq('id', post.id);
    if (error) return toast(t('error'));
    onChanged?.();
  }

  const img = mediaUrl(content?.image_path);
  const canRepost = content ? content.allow_reposts !== false : false;

  return (
    <article className="post">
      {isRepost && (
        <span className="row meta" style={{ gap: 8 }}>
          <Icon name="repost" size={14} />
          {t('reposted', { name: post.author.display_name })}
        </span>
      )}

      {content ? (
        <>
          <div className="row">
            <button onClick={() => go('profile/' + content.author.username)} aria-label={content.author.display_name}>
              <Avatar p={content.author} size={40} />
            </button>
            <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button className="name" onClick={() => go('profile/' + content.author.username)} style={{ textAlign: 'left' }}>
                {content.author.display_name}
              </button>
              <span className="meta">
                {t('circle')} · {timeAgo(content.created_at, t)}
              </span>
            </div>
            {mine && (
              <button className="icon-btn" aria-label={t('more')} onClick={() => setMenu(true)} style={{ color: 'var(--text2)' }}>
                <Icon name="more" />
              </button>
            )}
          </div>
          {content.body && <p className="post-body">{content.body}</p>}
          {img && (
            <div className="media" style={{ maxHeight: 560 }}>
              <img src={img} alt="" loading="lazy" decoding="async" />
            </div>
          )}
        </>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {t('originalHidden')}
        </p>
      )}

      <div className="row" style={{ gap: 4, marginLeft: -10 }}>
        <button className={'act' + (isLiked ? ' on' : '')} aria-pressed={isLiked} aria-label={t('like')} onClick={toggleLike}>
          <Icon name="heart" filled={isLiked} />
          {likeCount > 0 && likeCount}
        </button>
        <button className="act" aria-label={t('comments')} aria-expanded={!!comments} onClick={openComments}>
          <Icon name="chat" />
          {commentCount > 0 && commentCount}
        </button>
        {canRepost && (
          <button className="act" aria-label={t('repost')} onClick={repost}>
            <Icon name="repost" />
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button className="act" aria-label={t('send')} onClick={() => setPicker(true)} style={{ marginRight: -10 }}>
          <Icon name="send" />
        </button>
      </div>

      {comments && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'rise var(--t-enter) var(--ease) both' }}>
          {comments.map((c) => (
            <div key={c.id} className="row" style={{ alignItems: 'flex-start' }}>
              <Avatar p={c.author} size={28} />
              <div style={{ fontSize: 14, lineHeight: 1.45 }}>
                <span style={{ fontWeight: 500 }}>{c.author.display_name}</span> {c.body}
                <div className="meta">{timeAgo(c.created_at, t)}</div>
              </div>
            </div>
          ))}
          <form onSubmit={addComment} className="composer" style={{ padding: 0 }}>
            <label className="sr-only" htmlFor={'c-' + post.id}>
              {t('writeComment')}
            </label>
            <input
              id={'c-' + post.id}
              style={{ height: 40, fontSize: 15 }}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('writeComment')}
              maxLength={1000}
            />
            <button className="icon-btn send-btn" type="submit" aria-label={t('send')} disabled={!draft.trim()} style={{ width: 40, height: 40 }}>
              <Icon name="arrowUp" size={18} />
            </button>
          </form>
        </div>
      )}

      {picker && <FriendPicker onPick={sendTo} onClose={() => setPicker(false)} />}
      {menu && (
        <Sheet title={t('more')} onClose={() => setMenu(false)}>
          <button className="btn fill block" style={{ color: 'var(--danger)' }} onClick={remove}>
            {t('delete')}
          </button>
        </Sheet>
      )}
    </article>
  );
}
