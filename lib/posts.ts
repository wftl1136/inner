import { sb } from './supabase';
import type { MiniProfile, Post } from './types';

const AUTHOR = 'author:profiles!author_id(id,username,display_name,avatar_path)';
const BASE = `id,author_id,body,image_path,repost_of,allow_reposts,created_at,${AUTHOR}`;
export const POST_SELECT = `${BASE},likes(count),comments(count)`;

type Base = Omit<Post, 'original' | 'likes' | 'comments'> & { author: MiniProfile };

/** Подтягивает оригиналы репостов отдельным запросом (без неоднозначных встраиваний). */
async function attachOriginals(posts: Post[]) {
  const ids = Array.from(new Set(posts.map((p) => p.repost_of).filter((x): x is string => !!x)));
  if (!ids.length) return posts;
  const { data } = await sb().from('posts').select(BASE).in('id', ids);
  const map = new Map(((data || []) as unknown as Base[]).map((p) => [p.id, p]));
  return posts.map((p) => (p.repost_of ? { ...p, original: map.get(p.repost_of) || null } : p));
}

export async function fetchPosts(opts: { authorId?: string; limit?: number; before?: string } = {}) {
  let q = sb().from('posts').select(POST_SELECT).order('created_at', { ascending: false }).limit(opts.limit ?? 30);
  if (opts.authorId) q = q.eq('author_id', opts.authorId);
  if (opts.before) q = q.lt('created_at', opts.before);
  const { data, error } = await q;
  if (error) throw error;
  const posts = await attachOriginals(((data || []) as unknown as Post[]).filter((p) => p && p.author));
  const ids = posts.map((p) => p.id);
  let liked = new Set<string>();
  if (ids.length) {
    const { data: me } = await sb().auth.getUser();
    const { data: mine } = await sb().from('likes').select('post_id').in('post_id', ids).eq('user_id', me.user?.id || '');
    liked = new Set((mine || []).map((r) => r.post_id as string));
  }
  return { posts, liked };
}

export async function fetchPost(id: string) {
  const { data } = await sb().from('posts').select(POST_SELECT).eq('id', id).maybeSingle();
  if (!data) return null;
  const [p] = await attachOriginals([data as unknown as Post]);
  return p;
}
