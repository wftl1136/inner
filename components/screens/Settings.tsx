'use client';

import { useEffect, useState } from 'react';
import { go, useApp } from '@/lib/app';
import { LANGS, useT, type Lang } from '@/lib/i18n';
import { sb } from '@/lib/supabase';
import { Avatar, Icon } from '../ui';

type Theme = 'system' | 'light' | 'dark';

function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export default function Settings() {
  const { t, lang, setLang } = useT();
  const { me, friends, dataSaver, setDataSaver } = useApp();
  const [theme, setTheme] = useState<Theme>('system');
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    try {
      setTheme((localStorage.getItem('inner.theme') as Theme) || 'system');
    } catch {}
  }, []);

  function pickTheme(v: Theme) {
    setTheme(v);
    try {
      localStorage.setItem('inner.theme', v);
    } catch {}
    applyTheme(v);
  }

  const max = me?.plus ? 500 : 150;

  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn filled" aria-label={t('back')} onClick={() => history.back()}>
          <Icon name="back" size={22} />
        </button>
      </div>
      <h1 className="title">{t('settings')}</h1>

      <button className="card row" style={{ flexDirection: 'row', textAlign: 'left' }} onClick={() => go('me')}>
        <Avatar p={me} size={52} />
        <span className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 17, fontWeight: 500 }}>{me?.display_name}</span>
          <span className="meta">
            @{me?.username}
            {me?.plus ? ' · inner+' : ''}
          </span>
        </span>
        <span style={{ color: 'var(--text3)', display: 'flex' }}>
          <Icon name="chevron" size={18} />
        </span>
      </button>

      <div className="group">
        <div className="cell">
          <span className="cell-icon">
            <Icon name="lock" />
          </span>
          <span className="cell-body">
            <span>{t('privacy')}</span>
            <span className="muted" style={{ fontSize: 15 }}>
              {t('privacyValue')}
            </span>
          </span>
        </div>
        <button className="cell" onClick={() => go('me')}>
          <span className="cell-icon">
            <Icon name="users" />
          </span>
          <span className="cell-body">
            <span>{t('myCircle')}</span>
            <span className="row" style={{ gap: 8, color: 'var(--text3)' }}>
              <span className="meta">
                ({friends.length}/{max})
              </span>
              <Icon name="chevron" size={16} />
            </span>
          </span>
        </button>
        <button className="cell" onClick={() => go('plus')}>
          <span className="cell-icon">
            <Icon name="star" />
          </span>
          <span className="cell-body">
            <span>{t('plus')}</span>
            <span style={{ color: 'var(--text3)', display: 'flex' }}>
              <Icon name="chevron" size={16} />
            </span>
          </span>
        </button>
      </div>

      <div className="group">
        <button className="cell" aria-expanded={langOpen} onClick={() => setLangOpen(!langOpen)}>
          <span className="cell-icon">
            <Icon name="globe" />
          </span>
          <span className="cell-body">
            <span>{t('language')}</span>
            <span className="row muted" style={{ gap: 8, fontSize: 15 }}>
              {LANGS.find((l) => l.id === lang)?.label}
              <span style={{ display: 'flex', color: 'var(--text3)', transform: langOpen ? 'rotate(90deg)' : 'none', transition: 'transform var(--t-fast) var(--ease)' }}>
                <Icon name="chevron" size={16} />
              </span>
            </span>
          </span>
        </button>
        {langOpen &&
          LANGS.map((l) => (
            <button key={l.id} className="cell" style={{ paddingLeft: 52 }} aria-pressed={l.id === lang} onClick={() => setLang(l.id as Lang)}>
              <span className="cell-body" style={{ minHeight: 48 }}>
                <span>{l.label}</span>
                {l.id === lang && (
                  <span style={{ display: 'flex' }}>
                    <Icon name="check" size={18} />
                  </span>
                )}
              </span>
            </button>
          ))}
        <div className="cell">
          <span className="cell-icon">
            <Icon name="wifi" />
          </span>
          <span className="cell-body">
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span>{t('dataSaver')}</span>
              <span className="muted" style={{ fontSize: 13 }}>
                {t('dataSaverHint')}
              </span>
            </span>
            <button role="switch" aria-checked={dataSaver} aria-label={t('dataSaver')} className="switch" onClick={() => setDataSaver(!dataSaver)} />
          </span>
        </div>
        <div className="cell" style={{ alignItems: 'flex-start' }}>
          <span className="cell-icon" style={{ marginTop: 14 }}>
            <Icon name="moon" />
          </span>
          <span className="cell-body" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12, padding: '14px 16px 16px 0' }}>
            <span>{t('appearance')}</span>
            <span className="segmented">
              {(['system', 'light', 'dark'] as Theme[]).map((v) => (
                <button key={v} aria-pressed={theme === v} onClick={() => pickTheme(v)}>
                  {t(v)}
                </button>
              ))}
            </span>
          </span>
        </div>
      </div>

      <p className="muted" style={{ margin: '0 4px', fontSize: 13, lineHeight: 1.5 }}>
        {t('installHint')}
      </p>

      <div className="group">
        <button className="cell" style={{ justifyContent: 'center', color: 'var(--danger)', paddingLeft: 0, fontWeight: 500 }} onClick={() => sb().auth.signOut()}>
          {t('logout')}
        </button>
      </div>
    </div>
  );
}
