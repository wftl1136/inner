'use client';

import { useEffect, useState } from 'react';
import { sb } from '@/lib/supabase';
import { LANGS, useT } from '@/lib/i18n';
import { Beams, Icon, Logo } from '../ui';

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
    <div className="shell" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="auth-hero">
        <Beams />
      </div>
      <div className="page" style={{ maxWidth: 440, paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)', gap: 24, position: 'relative' }}>
        <div className="row" style={{ justifyContent: 'space-between', paddingTop: 12 }}>
          <Logo />
          <label className="sr-only" htmlFor="lang">
            {t('language')}
          </label>
          <select
            id="lang"
            value={lang}
            onChange={(e) => setLang(e.target.value as typeof lang)}
            style={{ height: 36, borderRadius: 18, border: '1px solid var(--line)', background: 'var(--fill)', padding: '0 12px', fontSize: 14 }}
          >
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 48 }}>
          {inviter && (
            <span className="meta" style={{ color: 'var(--text2)' }}>
              {t('invitedBy', { name: '@' + inviter })}
            </span>
          )}
          <h1 className="title" style={{ fontSize: 36, lineHeight: 1.1 }}>
            {t('appTagline')}
          </h1>
          <p className="subtitle" style={{ fontSize: 16, lineHeight: 1.5 }}>
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
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                  <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text3)' }}>{t('usernameHint')}</span>
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
            <button className="btn primary block arrow" type="submit" disabled={busy} style={{ marginTop: 8, height: 52, borderRadius: 26, paddingLeft: 24 }}>
              {busy ? t('loading') : mode === 'up' ? t('signUp') : t('signIn')}
              <span className="btn-arrow" style={{ width: 36, height: 36, borderRadius: 18 }}>
                <Icon name="arrowRight" size={18} />
              </span>
            </button>
          </form>
        )}

        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
          <span className="muted" style={{ fontSize: 15 }}>
            {mode === 'up' ? t('haveAccount') : t('noAccount')}{' '}
            <button style={{ color: 'var(--text)', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 4, textDecorationColor: 'var(--line-strong)' }} onClick={() => { setErr(''); setMode(mode === 'up' ? 'in' : 'up'); }}>
              {mode === 'up' ? t('signIn') : t('signUp')}
            </button>
          </span>
          <span style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{t('terms')}</span>
        </div>
      </div>
    </div>
  );
}
