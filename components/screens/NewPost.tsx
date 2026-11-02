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
        <button className="btn sm fill" onClick={() => history.back()}>
          {t('cancel')}
        </button>
        <span style={{ fontSize: 17, fontWeight: 500 }}>{t('newPost')}</span>
        <button className="btn sm primary" disabled={busy || (!body.trim() && !file)} onClick={publish}>
          {busy ? t('publishing') : t('publish')}
        </button>
      </div>

      <div className="row">
        <Avatar p={me} size={44} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="name">{me?.display_name}</span>
          <span className="row meta" style={{ gap: 4 }}>
            <Icon name="lock" size={12} />
            {t('privacyValue')}
          </span>
        </div>
      </div>

      <label>
        <span className="sr-only">{t('whatsNew')}</span>
        <textarea className="textarea" placeholder={t('whatsNew')} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} autoFocus rows={4} />
      </label>

      {preview ? (
        <div className="media" style={{ position: 'relative', maxHeight: 420 }}>
          <img src={preview} alt="" />
          <button
            className="icon-btn media-chip"
            aria-label={t('delete')}
            onClick={() => {
              setFile(null);
              setPreview(null);
            }}
            style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32 }}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          className="center"
          style={{ height: 144, borderRadius: 16, border: '1px dashed var(--line-strong)', background: 'var(--surface)', color: 'var(--text2)', flexDirection: 'column', gap: 8, fontSize: 14, fontWeight: 500 }}
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
