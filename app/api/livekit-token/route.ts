import { AccessToken } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/** Проверка настройки (без секретов): открой /api/livekit-token в браузере. */
export async function GET() {
  return Response.json({
    livekitKey: Boolean(process.env.LIVEKIT_API_KEY),
    livekitSecret: Boolean(process.env.LIVEKIT_API_SECRET),
    keyLooksRight: (process.env.LIVEKIT_API_KEY || '').trim().startsWith('API')
  });
}

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://genmiditpwrcowwuydsv.supabase.co';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_1rZink4c1Sg_fPYLXCvwWg_j6VzEeH5';
  const key = process.env.LIVEKIT_API_KEY?.trim();
  const secret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !anon || !key || !secret) return Response.json({ error: 'not_configured' }, { status: 503 });

  const auth = req.headers.get('authorization') || '';
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!jwt) return Response.json({ error: 'unauthorized' }, { status: 401 });

  let callId = '';
  try {
    callId = String((await req.json()).callId || '');
  } catch {}
  if (!/^[0-9a-f-]{36}$/i.test(callId)) return Response.json({ error: 'bad_request' }, { status: 400 });

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData } = await supabase.auth.getUser(jwt);
  const user = userData.user;
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  // RLS отдаст звонок только его участникам
  const { data: call } = await supabase.from('calls').select('id,status').eq('id', callId).maybeSingle();
  if (!call || !['ringing', 'accepted'].includes(call.status)) return Response.json({ error: 'forbidden' }, { status: 403 });

  const at = new AccessToken(key, secret, { identity: user.id, ttl: '2h' });
  at.addGrant({ roomJoin: true, room: `call-${call.id}`, canPublish: true, canSubscribe: true, canPublishData: false });
  return Response.json({ token: await at.toJwt() });
}
