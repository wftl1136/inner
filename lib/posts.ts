import { sb } from './supabase';
import type { Post } from './types';

const AUTHOR = 'author:profiles!author_id(id,username,display_name,avatar_path)';
export const POST_SELECT = `id,author_id,body,image_path,repost_of,allow_reposts,created_at,${AUTHOR},original:posts!repost_of(id,author_id,body,image_path,repost_of,allow_reposts,created_at,${AUTHOR}),likes(count),comments(count)`;

export async function fetchPosts(opts: { authorId?: string; limit?: number; before?: string } = {}) {
  let q = sb().from('posts').select(POST_SELECT).order('created_at', { ascending: false }).limit(opts.limit ?? 30);
  if (opts.authorId) q = q.eq('author_id', opts.authorId);
  if (opts.before) q = q.lt('created_at', opts.before);
  const { data, error } = await q;
  if (error) throw error;
  const posts = (data || []) as unknown as Post[];
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
  return (data as unknown as Post) || null;
}
