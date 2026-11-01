'use client';

import { useRef, useState } from 'react';
import { go, useApp } from '@/lib/app';
import { useT } from '@/lib/i18n';
import { sb, uploadImage } from '@/lib/supabase';
import { Avatar, Icon } from '../ui';

export default function NewPost() {
  const { t } = useT();
  const { me, userId, toast, dataSaver } = useApp();
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [allowReposts, setAllowReposts] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function publish() {
    if (!body.trim() && !file) return;
    setBusy(true);
    try {
      const image_path = file ? await uploadImage(userId, file, dataSaver ? 1080 : 1600) : null;
      const { error } = await sb().from('posts').insert({ body: body.trim(), image_path, allow_reposts: allowReposts });
      if (error) throw error;
      go('feed');
    } catch {
      toast(t('error'));
      setBusy(false);
    }
  }

  return (
    <div className="page" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
      <div className="topbar">
        <button className="btn sm glass" style={{ height: 44, borderRadius: 22 }} onClick={() => history.back()}>
          {t('cancel')}
        </button>
        <strong style={{ fontSize: 17 }}>{t('newPost')}</strong>
        <button className="btn sm primary" style={{ height: 44, borderRadius: 22 }} disabled={busy || (!body.trim() && !file)} onClick={publish}>
          {busy ? t('publishing') : t('publish')}
        </button>
      </div>

      <div className="row" style={{ gap: 12, padding: '0 4px' }}>
        <Avatar p={me} size={44} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <strong style={{ fontSize: 15 }}>{me?.display_name}</strong>
          <span className="row muted" style={{ gap: 4, fontSize: 13 }}>
            <Icon name="lock" size={11} stroke={2.5} />
            {t('privacyValue')}
          </span>
        </div>
      </div>

      <label style={{ padding: '0 4px' }}>
        <span className="sr-only">{t('whatsNew')}</span>
        <textarea className="textarea" placeholder={t('whatsNew')} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} autoFocus rows={4} />
      </label>

      {preview ? (
        <div className="media" style={{ position: 'relative', maxHeight: 420 }}>
          <img src={preview} alt="" />
          <button
            className="icon-btn glass"
            aria-label={t('delete')}
            onClick={() => {
              setFile(null);
              setPreview(null);
            }}
            style={{ position: 'absolute', top: 10, right: 10, width: 34, height: 34 }}
          >
            <Icon name="close" size={14} stroke={2.6} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          className="center"
          style={{ height: 140, borderRadius: 20, border: '1.5px dashed var(--text2)', color: 'var(--text2)', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500 }}
        >
          <Icon name="image" size={24} />
          {t('addPhoto')}
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />

      <div className="group">
        <div className="cell">
          <span className="cell-body">
            <span>{t('allowReposts')}</span>
            <button role="switch" aria-checked={allowReposts} aria-label={t('allowReposts')} className="switch" onClick={() => setAllowReposts(!allowReposts)} />
          </span>
        </div>
      </div>
    </div>
  );
}
