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

/** Размер по длинной стороне: 2560 — резко даже на весь экран iPhone, 1440 — в режиме экономии трафика. */
export const PHOTO_SIDE = 2560;
export const PHOTO_SIDE_SAVER = 1440;
export const AVATAR_SIDE = 640;

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (bitmap) return bitmap;
  // Запасной путь для форматов, которые createImageBitmap не берёт, но <img> показывает (HEIC в Safari)
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Готовит фото к загрузке: уменьшает до maxSide по длинной стороне и пережимает один раз в высоком качестве.
 * Пережатие заодно убирает EXIF с геопозицией — бакет публичный.
 */
export async function compressImage(file: File, maxSide = PHOTO_SIDE, quality = 0.92): Promise<Blob> {
  const src = await decode(file);
  if (!src) throw new Error('unsupported_image');
  const w0 = 'naturalWidth' in src ? src.naturalWidth : src.width;
  const h0 = 'naturalHeight' in src ? src.naturalHeight : src.height;
  const scale = Math.min(1, maxSide / Math.max(w0, h0));
  const tw = Math.round(w0 * scale);
  const th = Math.round(h0 * scale);

  // Уменьшаем ступенями по половине: за один большой шаг браузер мылит и рябит мелкие детали
  let cur: CanvasImageSource = src;
  let cw = w0;
  let ch = h0;
  while (cw / 2 >= tw && ch / 2 >= th) {
    const step = document.createElement('canvas');
    step.width = Math.round(cw / 2);
    step.height = Math.round(ch / 2);
    const sctx = step.getContext('2d');
    if (!sctx) break;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(cur, 0, 0, step.width, step.height);
    cur = step;
    cw = step.width;
    ch = step.height;
  }

  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cur, 0, 0, tw, th);
  if ('close' in src) src.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode_failed'))), 'image/jpeg', quality)
  );
}

export async function uploadImage(userId: string, file: File, maxSide = PHOTO_SIDE): Promise<string> {
  const blob = await compressImage(file, maxSide);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await sb().storage.from('media').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}
