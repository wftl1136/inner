'use client';

import { useEffect, useState } from 'react';
import { sb } from '@/lib/supabase';
import { LANGS, useT } from '@/lib/i18n';

export default function AuthScreen() {
  const { t, lang, setLang } = useT();
  const [mode, setMode] = useState<'up' | 'in'>('up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState('');
  const [inviter, setInviter] = useState<string | null>(null);

  useEffect(() => {
    try {
      setInviter(localStorage.getItem('inner.invite'));
    } catch {}
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      if (mode === 'up') {
        const u = username.trim().toLowerCase();
        if (!/^[a-z0-9_.]{3,24}$/.test(u)) throw new Error(t('usernameHint'));
        const { data: free } = await sb().rpc('username_available', { u });
        if (free === false) throw new Error(t('usernameTaken'));
        const { data, error } = await sb().auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: u, display_name: displayName.trim() || u }, emailRedirectTo: location.origin }
        });
        if (error) throw error;
        if (!data.session) setSent(email.trim());
      } else {
        const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <div className="page" style={{ maxWidth: 440, paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)', gap: 22 }}>
        <div className="row" style={{ justifyContent: 'space-between', paddingTop: 12 }}>
          <div className="row" style={{ gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.8 }}>inner</span>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--accent)', marginTop: 6 }} />
          </div>
          <label className="sr-only" htmlFor="lang">
            {t('language')}
          </label>
          <select
            id="lang"
            value={lang}
            onChange={(e) => setLang(e.target.value as typeof lang)}
            style={{ height: 36, borderRadius: 18, border: 0, background: 'var(--fill)', padding: '0 12px', fontSize: 14 }}
          >
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {inviter && (
            <span className="sys" style={{ alignSelf: 'flex-start' }}>
              {t('invitedBy', { name: '@' + inviter })}
            </span>
          )}
          <h1 style={{ margin: 0, fontSize: 40, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1.4 }}>{t('appTagline')}</h1>
          <p className="subtitle" style={{ fontSize: 17, lineHeight: 1.45 }}>
            {t('appSub')}
          </p>
        </div>

        {sent ? (
          <div className="card" role="status">
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>{t('checkEmail', { email: sent })}</p>
            <button className="btn fill" onClick={() => { setSent(''); setMode('in'); }}>
              {t('signIn')}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mode === 'up' && (
              <>
                <label className="field">
                  {t('displayName')}
                  <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} autoComplete="name" />
                </label>
                <label className="field">
                  {t('username')}
                  <input
                    className="input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                    maxLength={24}
                    autoCapitalize="none"
                    autoCorrect="off"
                    placeholder="maks.zh"
                    required
                  />
                  <span style={{ fontWeight: 400, fontSize: 12 }}>{t('usernameHint')}</span>
                </label>
              </>
            )}
            <label className="field">
              {t('email')}
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required placeholder="you@mail.com" />
            </label>
            <label className="field">
              {t('password')}
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                required
                placeholder={t('passwordHint')}
              />
            </label>
            {err && (
              <p className="error" role="alert" style={{ margin: 0 }}>
                {err}
              </p>
            )}
            <button className="btn primary block" type="submit" disabled={busy} style={{ marginTop: 6, height: 54, fontSize: 17 }}>
              {busy ? t('loading') : mode === 'up' ? t('signUp') : t('signIn')}
            </button>
          </form>
        )}

        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
          <span className="muted" style={{ fontSize: 15 }}>
            {mode === 'up' ? t('haveAccount') : t('noAccount')}{' '}
            <button style={{ color: 'var(--text)', fontWeight: 600 }} onClick={() => { setErr(''); setMode(mode === 'up' ? 'in' : 'up'); }}>
              {mode === 'up' ? t('signIn') : t('signUp')}
            </button>
          </span>
          <span className="muted" style={{ fontSize: 12 }}>
            {t('terms')}
          </span>
        </div>
      </div>
    </div>
  );
}
