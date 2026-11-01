'use client';

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
  setActiveCall: (c: Call | null) => void;
  startCall: (calleeId: string, kind: 'voice' | 'video') => Promise<void>;
  profileCache: Record<string, MiniProfile>;
  rememberProfiles: (ps: MiniProfile[]) => void;
};

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
      .channel('fr-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => refreshFriends())
      .subscribe();
    return () => {
      sb().removeChannel(ch);
    };
  }, [userId, refreshFriends]);

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
      rememberProfiles
    }),
    [userId, me, refreshMe, friends, refreshFriends, pendingIn, route, toast, dataSaver, setDataSaver, activeCall, startCall, profileCache, rememberProfiles]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && (
        <div className="toast glass" role="status">
          {toastMsg}
        </div>
      )}
    </Ctx.Provider>
  );
}
