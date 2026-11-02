'use client';

import { uniq } from '@/lib/uniq';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { sb } from './supabase';
import { PROFILE_FIELDS, type Call, type MiniProfile, type Profile } from './types';

export type Route = { name: string; param?: string };

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '');
  const [name, param] = clean.split('/');
  return { name: name || 'feed', param: param ? decodeURIComponent(param) : undefined };
}

export function go(path: string) {
  const target = '#/' + path.replace(/^\/+/, '');
  if (location.hash !== target) location.hash = target;
}

type AppCtx = {
  userId: string;
  me: Profile | null;
  refreshMe: () => Promise<void>;
  friends: MiniProfile[];
  refreshFriends: () => Promise<void>;
  pendingIn: number;
  setPendingIn: (n: number) => void;
  route: Route;
  toast: (msg: string) => void;
  dataSaver: boolean;
  setDataSaver: (v: boolean) => void;
  activeCall: Call | null;
  setActiveCall: React.Dispatch<React.SetStateAction<Call | null>>;
  startCall: (calleeId: string, kind: 'voice' | 'video') => Promise<void>;
  profileCache: Record<string, MiniProfile>;
  rememberProfiles: (ps: MiniProfile[]) => void;
  badges: Badges;
  refreshBadges: () => void;
};

/** Счётчики на иконках: непрочитанные сообщения, пропущенные звонки, новое в уведомлениях */
export type Badges = { chats: number; calls: number; notifications: number };

const SEEN_CALLS = 'inner.seen.calls';
const SEEN_NOTIFS = 'inner.seen.notifications';

// Первый запуск: считаем новым всё за последние сутки, а не всю историю
function seenAt(key: string) {
  try {
    const v = localStorage.getItem(key);
    if (v) return v;
    const start = new Date(Date.now() - 86400000).toISOString();
    localStorage.setItem(key, start);
    return start;
  } catch {
    return new Date(Date.now() - 86400000).toISOString();
  }
}

function markSeenNow(key: string) {
  try {
    localStorage.setItem(key, new Date().toISOString());
  } catch {}
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('AppProvider missing');
  return c;
}

export function AppProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [me, setMe] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<MiniProfile[]>([]);
  const [pendingIn, setPendingIn] = useState(0);
  const [route, setRoute] = useState<Route>({ name: 'feed' });
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [dataSaver, setDataSaverState] = useState(false);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [profileCache, setProfileCache] = useState<Record<string, MiniProfile>>({});
  const [counts, setCounts] = useState({ chats: 0, calls: 0, activity: 0 });

  const rememberProfiles = useCallback((ps: MiniProfile[]) => {
    if (!ps.length) return;
    setProfileCache((prev) => {
      const next = { ...prev };
      for (const p of ps) if (p) next[p.id] = p;
      return next;
    });
  }, []);

  const refreshMe = useCallback(async () => {
    const { data } = await sb().from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) {
      setMe(data as Profile);
      rememberProfiles([data as MiniProfile]);
    }
  }, [userId, rememberProfiles]);

  const refreshFriends = useCallback(async () => {
    const { data: reqs } = await sb().from('friend_requests').select('from_id,to_id,status').or(`from_id.eq.${userId},to_id.eq.${userId}`);
    const rows = reqs || [];
    setPendingIn(rows.filter((r) => r.status === 'pending' && r.to_id === userId).length);
    const ids = rows.filter((r) => r.status === 'accepted').map((r) => (r.from_id === userId ? r.to_id : r.from_id));
    if (!ids.length) return setFriends([]);
    const { data } = await sb().from('profiles').select(PROFILE_FIELDS).in('id', ids).order('display_name');
    const list = (data || []) as MiniProfile[];
    setFriends(list);
    rememberProfiles(list);
  }, [userId, rememberProfiles]);

  useEffect(() => {
    refreshMe();
    refreshFriends();
    try {
      setDataSaverState(localStorage.getItem('inner.saver') === '1');
    } catch {}
    const onHash = () => setRoute(parseHash(location.hash));
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [refreshMe, refreshFriends]);

  // Живые изменения круга: новые запросы и принятые приглашения
  useEffect(() => {
    const ch = sb()
      .channel(uniq('fr-' + userId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => refreshFriends())
      .subscribe();
    return () => {
      sb().removeChannel(ch);
    };
  }, [userId, refreshFriends]);

  const refreshBadges = useCallback(async () => {
    const callsSince = seenAt(SEEN_CALLS);
    const notifSince = seenAt(SEEN_NOTIFS);
    const [m, c, l, k] = await Promise.all([
      sb().from('messages').select('id', { count: 'exact', head: true }).neq('sender_id', userId).is('read_at', null),
      sb().from('calls').select('id', { count: 'exact', head: true }).eq('callee_id', userId).in('status', ['missed', 'cancelled']).gt('created_at', callsSince),
      sb()
        .from('likes')
        .select('post_id,post:posts!inner(author_id)', { count: 'exact', head: true })
        .eq('post.author_id', userId)
        .neq('user_id', userId)
        .gt('created_at', notifSince),
      sb()
        .from('comments')
        .select('id,post:posts!inner(author_id)', { count: 'exact', head: true })
        .eq('post.author_id', userId)
        .neq('author_id', userId)
        .gt('created_at', notifSince)
    ]);
    setCounts({ chats: m.count || 0, calls: c.count || 0, activity: (l.count || 0) + (k.count || 0) });
  }, [userId]);

  // Открыл звонки или уведомления — счётчик обнуляется
  useEffect(() => {
    if (route.name === 'calls') markSeenNow(SEEN_CALLS);
    if (route.name === 'notifications') markSeenNow(SEEN_NOTIFS);
    refreshBadges();
  }, [route.name, refreshBadges]);

  // Живые счётчики: новые сообщения, прочтения и звонки
  useEffect(() => {
    const ch = sb()
      .channel(uniq('badges-' + userId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => refreshBadges())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => refreshBadges())
      .subscribe();
    const onVisible = () => document.visibilityState === 'visible' && refreshBadges();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      sb().removeChannel(ch);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, refreshBadges]);

  const badges = useMemo<Badges>(
    () => ({
      chats: counts.chats,
      calls: route.name === 'calls' ? 0 : counts.calls,
      notifications: pendingIn + (route.name === 'notifications' ? 0 : counts.activity)
    }),
    [counts, pendingIn, route.name]
  );

  // Тот же счётчик — в заголовке вкладки и на иконке приложения на экране «Домой»
  useEffect(() => {
    const total = badges.chats + badges.calls + badges.notifications;
    document.title = total ? `(${total}) inner` : 'inner';
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    (total ? nav.setAppBadge?.(total) : nav.clearAppBadge?.())?.catch(() => {});
  }, [badges]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg((m) => (m === msg ? null : m)), 2600);
  }, []);

  const setDataSaver = useCallback((v: boolean) => {
    setDataSaverState(v);
    try {
      localStorage.setItem('inner.saver', v ? '1' : '0');
    } catch {}
  }, []);

  const startCall = useCallback(
    async (calleeId: string, kind: 'voice' | 'video') => {
      const { data, error } = await sb().from('calls').insert({ callee_id: calleeId, kind }).select('*').single();
      if (error || !data) {
        toast(error?.message || 'Error');
        return;
      }
      setActiveCall(data as Call);
    },
    [toast]
  );

  const value = useMemo<AppCtx>(
    () => ({
      userId,
      me,
      refreshMe,
      friends,
      refreshFriends,
      pendingIn,
      setPendingIn,
      route,
      toast,
      dataSaver,
      setDataSaver,
      activeCall,
      setActiveCall,
      startCall,
      profileCache,
      rememberProfiles,
      badges,
      refreshBadges
    }),
    [userId, me, refreshMe, friends, refreshFriends, pendingIn, route, toast, dataSaver, setDataSaver, activeCall, startCall, profileCache, rememberProfiles, badges, refreshBadges]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </Ctx.Provider>
  );
}
