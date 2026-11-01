import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://genmiditpwrcowwuydsv.supabase.co';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_1rZink4c1Sg_fPYLXCvwWg_j6VzEeH5';

export const isConfigured = Boolean(url && anon);

let client: SupabaseClient | null = null;

export function sb(): SupabaseClient {
  if (!client) {
    if (!url || !anon) throw new Error('Supabase is not configured');
    client = createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
  return client;
}

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return sb().storage.from('media').getPublicUrl(path).data.publicUrl;
}

/** Сжимает фото перед загрузкой: меньше трафика у тебя и у друзей. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b || file), 'image/jpeg', quality));
}

export async function uploadImage(userId: string, file: File, maxSide = 1600): Promise<string> {
  const blob = await compressImage(file, maxSide);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await sb().storage.from('media').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}
