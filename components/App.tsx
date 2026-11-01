'use client';

import { uniq } from '@/lib/uniq';

import { Component, useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isConfigured, sb } from '@/lib/supabase';
import { I18nProvider, useT } from '@/lib/i18n';
import { AppProvider, go, useApp } from '@/lib/app';
import type { Call } from '@/lib/types';
import { Icon, Avatar } from './ui';
import AuthScreen from './screens/Auth';
import Feed from './screens/Feed';
import NewPost from './screens/NewPost';
import StoryViewer from './screens/StoryViewer';
import ProfileScreen from './screens/Profile';
import Search from './screens/Search';
import Notifications from './screens/Notifications';
import Chats from './screens/Chats';
import ChatScreen from './screens/Chat';
import Calls from './screens/Calls';
import CallScreen from './screens/CallScreen';
import Settings from './screens/Settings';
import Plus from './screens/Plus';

export default function App() {
  return (
    <I18nProvider>
      <ErrorBoundary>{isConfigured ? <Gate /> : <NotConfigured />}</ErrorBoundary>
    </I18nProvider>
  );
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('inner crashed:', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="shell">
        <div className="page" style={{ justifyContent: 'center', minHeight: '100dvh', textAlign: 'center' }}>
          <h1 className="title" style={{ fontSize: 26 }}>inner</h1>
          <p className="subtitle">Что-то пошло не так · Something went wrong</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text2)', background: 'var(--surface)', padding: 12, borderRadius: 12, textAlign: 'left' }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button className="btn primary" onClick={() => { location.hash = '#/feed'; location.reload(); }}>
            ↻
          </button>
        </div>
      </div>
    );
  }
}

function NotConfigured() {
  const { t } = useT();
  return (
    <div className="shell">
      <div className="page" style={{ justifyContent: 'center', minHeight: '100dvh' }}>
        <h1 className="title">{t('setupTitle')}</h1>
        <p className="subtitle">{t('setupText')}</p>
      </div>
    </div>
  );
}

function Gate() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const m = location.hash.match(/^#\/invite\/([a-z0-9_.]{3,24})/i);
    if (m) {
      try {
        localStorage.setItem('inner.invite', m[1].toLowerCase());
      } catch {}
    }
    sb()
      .auth.getSession()
      .then(({ data }) => setSession(data.session));
    const { data } = sb().auth.onAuthStateChange((_e, s) => setSession(s));
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => {
      let pref = 'system';
      try {
        pref = localStorage.getItem('inner.theme') || 'system';
      } catch {}
      if (pref === 'system') document.documentElement.dataset.theme = mq.matches ? 'dark' : 'light';
    };
    mq.addEventListener('change', onScheme);
    return () => {
      data.subscription.unsubscribe();
      mq.removeEventListener('change', onScheme);
    };
  }, []);

  if (session === undefined) return null;
  if (!session) return <AuthScreen />;
  return (
    <AppProvider userId={session.user.id}>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const { route, userId, pendingIn, me, activeCall, setActiveCall, toast, refreshFriends } = useApp();
  const { t } = useT();
  const closeCall = useCallback(() => setActiveCall(null), [setActiveCall]);

  // Приглашение по ссылке: после входа отправляем запрос в круг
  useEffect(() => {
    let invite: string | null = null;
    try {
      invite = localStorage.getItem('inner.invite');
      localStorage.removeItem('inner.invite');
    } catch {}
    if (!invite) {
      const m = location.hash.match(/^#\/invite\/([a-z0-9_.]{3,24})/i);
      invite = m ? m[1].toLowerCase() : null;
    }
    if (!invite) return;
    (async () => {
      const { data: p } = await sb().from('profiles').select('id,username').eq('username', invite).maybeSingle();
      if (p && p.id !== userId) {
        const { error } = await sb().from('friend_requests').insert({ to_id: p.id });
        if (!error) toast(t('requested'));
        refreshFriends();
        go('profile/' + p.username);
      } else {
        go('feed');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Входящие звонки в реальном времени
  useEffect(() => {
    const ch = sb()
      .channel(uniq('calls-' + userId))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls', filter: `callee_id=eq.${userId}` }, (payload) => {
        const call = payload.new as Call;
        if (call.status === 'ringing') setActiveCall((cur) => cur || call);
      })
      .subscribe();
    // Запасной опрос, если realtime не доставил событие
    const poll = window.setInterval(async () => {
      if (document.hidden) return;
      const since = new Date(Date.now() - 40000).toISOString();
      const { data } = await sb().from('calls').select('*').eq('callee_id', userId).eq('status', 'ringing').gte('created_at', since).order('created_at', { ascending: false }).limit(1);
      const c = (data || [])[0] as Call | undefined;
      if (c) setActiveCall((cur) => cur || c);
    }, 4000);
    return () => {
      window.clearInterval(poll);
      sb().removeChannel(ch);
    };
  }, [userId, setActiveCall]);

  const name = route.name;
  let screen: React.ReactNode;
  switch (name) {
    case 'new':
      screen = <NewPost />;
      break;
    case 'story':
      screen = <StoryViewer authorId={route.param || ''} />;
      break;
    case 'profile':
      screen = <ProfileScreen username={route.param || me?.username || ''} />;
      break;
    case 'me':
      screen = <ProfileScreen username={me?.username || ''} />;
      break;
    case 'search':
      screen = <Search />;
      break;
    case 'notifications':
      screen = <Notifications />;
      break;
    case 'chats':
      screen = <Chats />;
      break;
    case 'chat':
      screen = <ChatScreen conversationId={route.param || ''} />;
      break;
    case 'calls':
      screen = <Calls />;
      break;
    case 'settings':
      screen = <Settings />;
      break;
    case 'plus':
      screen = <Plus />;
      break;
    case 'invite':
      screen = null;
      break;
    default:
      screen = <Feed />;
  }

  const tabs = [
    { id: 'feed', icon: 'home', label: t('tabFeed') },
    { id: 'calls', icon: 'phone', label: t('tabCalls') },
    { id: 'chats', icon: 'chat', label: t('tabChats') },
    { id: 'me', icon: 'profile', label: t('tabProfile') }
  ];
  const current = name === 'profile' && route.param === me?.username ? 'me' : name;
  const hideBars = ['new', 'story', 'chat'].includes(name);

  return (
    <div className="shell">
      <aside className="sidebar glass" aria-label="inner">
        <div className="row" style={{ padding: '4px 12px 16px' }}>
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.8 }}>inner</span>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--accent)', marginTop: 6 }} />
        </div>
        {tabs.map((tab) => (
          <button key={tab.id} className="side-link" aria-current={current === tab.id ? 'page' : undefined} onClick={() => go(tab.id)}>
            {tab.icon === 'profile' ? <Avatar p={me} size={22} /> : <Icon name={tab.icon} size={20} />}
            {tab.label}
          </button>
        ))}
        <button className="side-link" aria-current={current === 'notifications' ? 'page' : undefined} onClick={() => go('notifications')}>
          <Icon name="bell" size={20} />
          {t('notifications')}
          {pendingIn > 0 && <span className="badge" style={{ marginLeft: 'auto' }}>{pendingIn}</span>}
        </button>
        <button className="side-link" aria-current={current === 'settings' ? 'page' : undefined} onClick={() => go('settings')}>
          <Icon name="menu" size={20} />
          {t('settings')}
        </button>
        <button className="btn primary" style={{ marginTop: 14 }} onClick={() => go('new')}>
          {t('newPost')}
        </button>
      </aside>

      <main style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column' }}>{screen}</main>

      {!hideBars && (
        <div className="tabbar-wrap">
          <div className="tabbar-inner">
            <nav className="tabbar glass" aria-label="Menu">
              {tabs.map((tab) => (
                <button key={tab.id} className="tab" aria-current={current === tab.id ? 'page' : undefined} onClick={() => go(tab.id)} aria-label={tab.label}>
                  {tab.icon === 'profile' ? <Avatar p={me} size={23} /> : <Icon name={tab.icon} size={22} />}
                  {tab.label}
                </button>
              ))}
            </nav>
            <button className="fab glass" aria-label={t('newPost')} onClick={() => go('new')}>
              <Icon name="plus" size={24} stroke={2.2} />
            </button>
          </div>
        </div>
      )}

      {activeCall && <CallScreen call={activeCall} onClose={closeCall} />}
    </div>
  );
}
