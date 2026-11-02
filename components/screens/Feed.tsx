'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { go, useApp } from '@/lib/app';
import { useT } from '@/lib/i18n';
import { fetchPosts } from '@/lib/posts';
import { mediaUrl, sb, uploadImage } from '@/lib/supabase';
import { seenStories, shareInvite } from '@/lib/invite';
import type { MiniProfile, Post, Story } from '@/lib/types';
import { PostCard } from '../PostCard';
import { Avatar, Badge, Icon } from '../ui';

type StoryGroup = { author: MiniProfile; stories: Story[]; fresh: boolean };

export default function Feed() {
  const { t } = useT();
  const { me, userId, friends, toast, badges } = useApp();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [more, setMore] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const { posts, liked } = await fetchPosts();
      setPosts(posts);
      setLiked(liked);
      setMore(posts.length === 30);
    } catch {
      setPosts([]);
    }
    const { data } = await sb()
      .from('stories')
      .select('id,author_id,image_path,caption,created_at,author:profiles!author_id(id,username,display_name,avatar_path)')
      .order('created_at');
    const seen = seenStories();
    const map = new Map<string, StoryGroup>();
    for (const s of (data || []) as unknown as (Story & { author: MiniProfile })[]) {
      const g = map.get(s.author_id) || { author: s.author, stories: [], fresh: false };
      g.stories.push(s);
      if (!seen.has(s.id)) g.fresh = true;
      map.set(s.author_id, g);
    }
    const list = Array.from(map.values()).sort((a, b) => Number(b.fresh) - Number(a.fresh));
    setGroups(list);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    if (!posts?.length) return;
    const { posts: next, liked: l2 } = await fetchPosts({ before: posts[posts.length - 1].created_at });
    setPosts([...posts, ...next]);
    setLiked(new Set([...liked, ...l2]));
    setMore(next.length === 30);
  }

  async function addStory(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadImage(userId, file, 1440);
      const { error } = await sb().from('stories').insert({ image_path: path });
      if (error) throw error;
      await load();
    } catch {
      toast(t('error'));
    } finally {
      setUploading(false);
    }
  }

  const myGroup = groups.find((g) => g.author.id === userId);
  const others = groups.filter((g) => g.author.id !== userId);
  const max = me?.plus ? 500 : 150;

  return (
    <div className="page flush">
      <header className="topbar pad">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 className="title">{t('tabFeed')}</h1>
          <span className="meta">
            {t('circle')} ({friends.length}/{max})
          </span>
        </div>
        <div className="actions">
          <button className="icon-btn" aria-label={t('findPeople')} onClick={() => go('search')}>
            <Icon name="search" />
          </button>
          <button
            className="icon-btn"
            aria-label={badges.notifications ? `${t('notifications')}, ${badges.notifications}` : t('notifications')}
            onClick={() => go('notifications')}
          >
            <Icon name="bell" />
            <Badge n={badges.notifications} className="on-icon" />
          </button>
        </div>
      </header>

      <nav className="stories" aria-label="Stories">
        <div className="story-card fresh">
          <button
            className="story-thumb center"
            style={{ background: myGroup ? undefined : 'var(--fill)' }}
            aria-label={myGroup ? t('you') : t('newStory')}
            onClick={() => (myGroup ? go('story/' + userId) : fileRef.current?.click())}
          >
            {myGroup ? (
              <img src={mediaUrl(myGroup.stories[myGroup.stories.length - 1].image_path) || ''} alt="" />
            ) : (
              <span className="center" style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--primary)', color: 'var(--on-primary)' }}>
                <Icon name="plus" size={16} />
              </span>
            )}
          </button>
          <button onClick={() => fileRef.current?.click()} aria-label={t('newStory')} style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)' }}>
            {uploading ? t('loading') : myGroup ? '+ ' + t('you') : t('you')}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={addStory} />
        </div>
        {others.map((g) => (
          <button key={g.author.id} className={'story-card' + (g.fresh ? ' fresh' : '')} onClick={() => go('story/' + g.author.id)}>
            <span className={'story-thumb' + (g.fresh ? ' fresh' : '')}>
              <img src={mediaUrl(g.stories[g.stories.length - 1].image_path) || ''} alt="" loading="lazy" />
              <Avatar p={g.author} size={24} />
            </span>
            <span className="ellipsis" style={{ maxWidth: 72 }}>
              {g.author.display_name.split(' ')[0]}
            </span>
          </button>
        ))}
      </nav>

      <div className="pad" style={{ display: 'flex', flexDirection: 'column' }}>
        {posts === null && <p className="empty">{t('loading')}</p>}
        {posts?.length === 0 && (
          <div className="card" style={{ alignItems: 'center', textAlign: 'center', padding: 24 }}>
            <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
              {t('feedEmpty')}
            </p>
            <button className="btn primary" onClick={() => me && shareInvite(me.username, t('shareText'), () => toast(t('linkCopied')))}>
              {t('inviteFriends')}
            </button>
          </div>
        )}
        {posts?.map((p) => (
          <PostCard key={p.id} post={p} liked={liked.has(p.id)} onChanged={load} />
        ))}
        {posts && posts.length > 0 && more && (
          <button className="btn fill" style={{ marginTop: 16 }} onClick={loadMore}>
            {t('loadMore')}
          </button>
        )}
      </div>
    </div>
  );
}
