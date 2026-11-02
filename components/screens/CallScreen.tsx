'use client';

import { uniq } from '@/lib/uniq';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  VideoQuality,
  type RemoteTrack,
  type RemoteTrackPublication
} from 'livekit-client';
import { useApp } from '@/lib/app';
import { useT } from '@/lib/i18n';
import { sb } from '@/lib/supabase';
import type { Call, MiniProfile } from '@/lib/types';
import { Avatar, Beams, Icon } from '../ui';

type Phase = 'ringing' | 'connecting' | 'live' | 'ended';
type Mode = 'auto' | 'hd' | 'eco';

const LK_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://inner-t2lpfjqp.livekit.cloud';

export default function CallScreen({ call, onClose }: { call: Call; onClose: () => void }) {
  const { t } = useT();
  const { userId, dataSaver } = useApp();
  const isCaller = call.caller_id === userId;
  const otherId = isCaller ? call.callee_id : call.caller_id;
  const isVideo = call.kind === 'video';

  const [other, setOther] = useState<MiniProfile | null>(null);
  const [phase, setPhase] = useState<Phase>('ringing');
  const [note, setNote] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(isVideo);
  const [remoteVideo, setRemoteVideo] = useState(false);
  const [mode, setMode] = useState<Mode>(dataSaver ? 'eco' : 'auto');
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [seconds, setSeconds] = useState(0);
  const [detail, setDetail] = useState('');
  const [needAudioTap, setNeedAudioTap] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const remoteVideoEl = useRef<HTMLVideoElement>(null);
  const localVideoEl = useRef<HTMLVideoElement>(null);
  const audioBox = useRef<HTMLDivElement>(null);
  const closedRef = useRef(false);

  useEffect(() => {
    sb()
      .from('profiles')
      .select('id,username,display_name,avatar_path')
      .eq('id', otherId)
      .maybeSingle()
      .then(({ data }) => setOther(data as MiniProfile));
  }, [otherId]);

  const finish = useCallback(
    async (status: Call['status'], message?: string) => {
      if (closedRef.current) return;
      closedRef.current = true;
      setPhase('ended');
      setNote(message || t('callEnded'));
      const room = roomRef.current;
      roomRef.current = null;
      room?.disconnect();
      await sb().from('calls').update({ status, ended_at: new Date().toISOString() }).eq('id', call.id);
      window.setTimeout(onClose, message ? 4000 : 1500);
    },
    [call.id, onClose, t]
  );

  const join = useCallback(async () => {
    if (roomRef.current || closedRef.current) return;
    if (!LK_URL) return finish('ended', t('callsNotReady'));
    setPhase('connecting');
    const { data: s } = await sb().auth.getSession();
    const res = await fetch('/api/livekit-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token || ''}` },
      body: JSON.stringify({ callId: call.id })
    });
    if (!res.ok) {
      setDetail(`token ${res.status}`);
      return finish('ended', t('callsNotReady'));
    }
    const { token } = await res.json();

    const eco = mode === 'eco';
    const preset = eco ? VideoPresets.h360 : VideoPresets.h720;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: { resolution: preset.resolution, facingMode: 'user' },
      audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      publishDefaults: { simulcast: true, videoEncoding: preset.encoding, dtx: true, red: true }
    });
    roomRef.current = room;

    room
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub: RemoteTrackPublication) => {
        if (track.kind === Track.Kind.Video && remoteVideoEl.current) {
          track.attach(remoteVideoEl.current);
          setRemoteVideo(true);
          if (eco) pub.setVideoQuality(VideoQuality.LOW);
        }
        if (track.kind === Track.Kind.Audio && audioBox.current) {
          const el = track.attach();
          audioBox.current.appendChild(el);
        }
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => el.remove());
        if (track.kind === Track.Kind.Video) setRemoteVideo(false);
      })
      .on(RoomEvent.TrackMuted, (pub) => {
        if (pub.kind === Track.Kind.Video && pub.source === Track.Source.Camera && !(pub as unknown as { isLocal?: boolean }).isLocal) setRemoteVideo(false);
      })
      .on(RoomEvent.TrackUnmuted, (pub) => {
        if (pub.kind === Track.Kind.Video && pub.source === Track.Source.Camera) setRemoteVideo(true);
      })
      .on(RoomEvent.AudioPlaybackStatusChanged, () => setNeedAudioTap(!room.canPlaybackAudio))
      .on(RoomEvent.ParticipantDisconnected, () => finish('ended'))
      .on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) finish('ended');
      });

    try {
      await room.connect(LK_URL, token);
    } catch (e) {
      setDetail('connect: ' + (e instanceof Error ? e.message : String(e)));
      roomRef.current = null;
      return finish('ended', t('error'));
    }
    setPhase('live');
    room.startAudio().catch(() => setNeedAudioTap(true));
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch (e) {
      setMicOn(false);
      setDetail(t('permDenied'));
    }
    if (isVideo) {
      try {
        await room.localParticipant.setCameraEnabled(true);
        const cam = room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
        if (cam && localVideoEl.current) cam.attach(localVideoEl.current);
      } catch {
        setCamOn(false);
        setDetail(t('permDenied'));
      }
    }
  }, [call.id, finish, isVideo, mode, t]);

  // Следим за статусом звонка (ответили, отклонили, положили трубку): realtime + запасной опрос
  const onStatus = useRef<(c: Call) => void>(() => {});
  onStatus.current = (c: Call) => {
    if (closedRef.current) return;
    if (c.status === 'accepted' && isCaller && !roomRef.current) join();
    if (c.status === 'declined') finish('declined', t('declinedCall'));
    if (['ended', 'missed', 'cancelled'].includes(c.status)) finish(c.status);
  };
  useEffect(() => {
    const ch = sb()
      .channel(uniq('call-' + call.id))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${call.id}` }, (payload) => onStatus.current(payload.new as Call))
      .subscribe();
    const poll = window.setInterval(async () => {
      if (closedRef.current) return;
      const { data } = await sb().from('calls').select('*').eq('id', call.id).maybeSingle();
      if (data) onStatus.current(data as Call);
    }, 2500);
    return () => {
      window.clearInterval(poll);
      sb().removeChannel(ch);
    };
  }, [call.id]);

  // Нет ответа 45 секунд — пропущенный
  useEffect(() => {
    if (phase !== 'ringing') return;
    const id = window.setTimeout(() => {
      if (!roomRef.current) finish('missed', t('noAnswer'));
    }, 45000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Таймер разговора
  useEffect(() => {
    if (phase !== 'live') return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  // Звук и вибрация входящего
  useEffect(() => {
    if (phase !== 'ringing' || isCaller) return;
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
    } catch {}
    const ring = () => {
      try {
        navigator.vibrate?.([300, 200, 300]);
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 660;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.85);
      } catch {}
    };
    ring();
    const id = window.setInterval(ring, 2000);
    return () => {
      window.clearInterval(id);
      ctx?.close();
    };
  }, [phase, isCaller]);

  useEffect(
    () => () => {
      roomRef.current?.disconnect();
    },
    []
  );

  async function accept() {
    await sb().from('calls').update({ status: 'accepted', answered_at: new Date().toISOString() }).eq('id', call.id);
    join();
  }

  async function hangUp() {
    if (phase === 'ringing') return finish(isCaller ? 'cancelled' : 'declined');
    finish('ended');
  }

  async function toggleMic() {
    const next = !micOn;
    setMicOn(next);
    await roomRef.current?.localParticipant.setMicrophoneEnabled(next);
  }

  async function toggleCam() {
    const room = roomRef.current;
    const next = !camOn;
    setCamOn(next);
    if (!room) return;
    await room.localParticipant.setCameraEnabled(next);
    const cam = room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
    if (next && cam && localVideoEl.current) cam.attach(localVideoEl.current);
  }

  async function flip() {
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    const cam = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
    if (cam instanceof LocalVideoTrack) await cam.restartTrack({ facingMode: next });
  }

  function cycleMode() {
    const order: Mode[] = ['auto', 'hd', 'eco'];
    const next = order[(order.indexOf(mode) + 1) % order.length];
    setMode(next);
    const room = roomRef.current;
    if (!room) return;
    const q = next === 'eco' ? VideoQuality.LOW : next === 'hd' ? VideoQuality.HIGH : VideoQuality.MEDIUM;
    room.remoteParticipants.forEach((p) =>
      p.trackPublications.forEach((pub) => {
        if (pub.kind === Track.Kind.Video) pub.setVideoQuality(q);
      })
    );
    const cam = room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
    if (cam instanceof LocalVideoTrack) {
      const preset = next === 'eco' ? VideoPresets.h360 : VideoPresets.h720;
      cam.restartTrack({ resolution: preset.resolution, facingMode: facing }).catch(() => {});
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const status =
    phase === 'ended' ? note : phase === 'live' ? `${mm}:${ss}` : phase === 'connecting' ? t('connecting') : isCaller ? t('calling') : t('ringing');
  const modeLabel = mode === 'auto' ? t('auto') : mode === 'hd' ? t('hd') : t('eco');
  const modeHint = mode === 'auto' ? t('autoHint') : mode === 'hd' ? t('hdHint') : t('ecoHint');
  const showVideo = isVideo && remoteVideo && phase === 'live';

  return (
    <div className="call-stage" role="dialog" aria-modal="true" aria-label={other?.display_name || 'call'}>
      <Beams off={phase === 'live' || phase === 'ended'} />
      <video ref={remoteVideoEl} autoPlay playsInline style={{ position: 'absolute', inset: 0, display: showVideo ? 'block' : 'none' }} />
      <div ref={audioBox} hidden />

      {!showVideo && (
        <div className="center" style={{ position: 'absolute', inset: 0, flexDirection: 'column', gap: 24, paddingBottom: 160 }}>
          <Avatar p={other} size={128} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '0 24px', textAlign: 'center' }}>
            <h1 className="title">{other?.display_name || t('loading')}</h1>
            <p className="meta" style={{ margin: 0, fontSize: 15, color: 'var(--text2)' }}>
              {(isVideo ? t('video') : t('voice')) + ' · ' + status}
            </p>
            {detail && (
              <p className="meta" style={{ margin: 0 }}>
                {detail}
              </p>
            )}
          </div>
        </div>
      )}

      {showVideo && (
        <div className="row" style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 12px)', left: 16, right: 16, justifyContent: 'center' }}>
          <div className="media-chip" style={{ padding: '8px 16px', borderRadius: 20, textAlign: 'center' }}>
            <div className="name">{other?.display_name}</div>
            <div className="meta" style={{ color: 'var(--text2)' }}>
              {status}
            </div>
          </div>
        </div>
      )}

      {isVideo && phase === 'live' && (
        <button className="media-chip meta" onClick={cycleMode} aria-label={modeHint} style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 12px)', right: 16, height: 40, padding: '0 14px', borderRadius: 20, fontSize: 13, color: '#f2f2f2' }}>
          {modeLabel}
        </button>
      )}

      {isVideo && (
        <div className="call-self" style={{ display: camOn && phase !== 'ringing' ? 'block' : 'none' }}>
          <video ref={localVideoEl} autoPlay playsInline muted />
        </div>
      )}

      {needAudioTap && phase === 'live' && (
        <button
          className="btn primary"
          style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(env(safe-area-inset-bottom) + 128px)' }}
          onClick={() => roomRef.current?.startAudio().then(() => setNeedAudioTap(false))}
        >
          {t('enableSound')}
        </button>
      )}

      <div className="call-controls">
        {phase === 'ringing' && !isCaller ? (
          <>
            <div>
              <button className="call-btn end" aria-label={t('decline')} onClick={hangUp}>
                <Icon name="hangup" size={26} />
              </button>
              <div className="call-label">{t('decline')}</div>
            </div>
            <div style={{ width: 64 }} />
            <div>
              <button className="call-btn answer" aria-label={t('answer')} onClick={accept}>
                <Icon name={isVideo ? 'video' : 'phone'} size={26} />
              </button>
              <div className="call-label">{t('answer')}</div>
            </div>
          </>
        ) : (
          <>
            <button className={'call-btn' + (micOn ? '' : ' on')} aria-label={t('mic')} aria-pressed={!micOn} onClick={toggleMic}>
              <Icon name="mic" size={24} />
            </button>
            {isVideo && (
              <button className={'call-btn' + (camOn ? '' : ' on')} aria-label={t('camera')} aria-pressed={!camOn} onClick={toggleCam}>
                <Icon name="video" size={24} />
              </button>
            )}
            {isVideo && (
              <button className="call-btn" aria-label={t('flip')} onClick={flip}>
                <Icon name="flip" size={24} />
              </button>
            )}
            <button className="call-btn end" aria-label={t('end')} onClick={hangUp}>
              <Icon name="hangup" size={26} />
            </button>
          </>
        )}
      </div>
      {isVideo && phase === 'live' && (
        <span className="sr-only" aria-live="polite">
          {modeHint}
        </span>
      )}
    </div>
  );
}
