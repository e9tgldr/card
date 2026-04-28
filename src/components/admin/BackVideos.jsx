// src/components/admin/BackVideos.jsx
import { useRef, useState } from 'react';
import { Upload, RefreshCw, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { probeVideoDuration } from '@/lib/videoMeta';

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_CAPTIONS_BYTES = 100 * 1024;
const MAX_DURATION_S = 60;

function formatDuration(s) {
  if (!Number.isFinite(s)) return '';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function BackVideos({ figures, videosById = {}, onChange }) {
  const { t } = useLang();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  const handleVideoUpload = async (figId, file) => {
    setError('');
    if (file.type !== 'video/mp4') {
      setError(t('admin.backVideos.notMp4'));
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError(t('admin.backVideos.tooBig', { mb: (file.size / 1024 / 1024).toFixed(1) }));
      return;
    }
    let durationS;
    try {
      durationS = await probeVideoDuration(file);
    } catch {
      setError('probe_failed');
      return;
    }
    if (durationS > MAX_DURATION_S) {
      setError(t('admin.backVideos.tooLong', { s: durationS.toFixed(1) }));
      return;
    }

    setBusy(figId);
    const form = new FormData();
    form.append('action', 'upload-video');
    form.append('fig_id', String(figId));
    form.append('duration_s', String(durationS));
    form.append('file', file);
    const { data, error: invErr } = await supabase.functions.invoke('upload-figure-back-video', { body: form });
    setBusy(null);
    if (invErr || !data?.ok) {
      setError(data?.reason || invErr?.message || 'server');
      return;
    }
    onChange?.();
  };

  const handleCaptionsUpload = async (figId, file) => {
    setError('');
    if (file.size > MAX_CAPTIONS_BYTES) {
      setError(t('admin.backVideos.tooBig', { mb: (file.size / 1024 / 1024).toFixed(2) }));
      return;
    }
    const text = await file.text();
    if (!text.trimStart().startsWith('WEBVTT')) {
      setError(t('admin.backVideos.notVtt'));
      return;
    }
    setBusy(figId);
    const form = new FormData();
    form.append('action', 'upload-captions');
    form.append('fig_id', String(figId));
    form.append('file', file);
    const { data, error: invErr } = await supabase.functions.invoke('upload-figure-back-video', { body: form });
    setBusy(null);
    if (invErr || !data?.ok) {
      setError(data?.reason || invErr?.message || 'server');
      return;
    }
    onChange?.();
  };

  const handleDelete = async (figId) => {
    if (!window.confirm(t('admin.backVideos.delete') + '?')) return;
    setBusy(figId);
    const { data, error: invErr } = await supabase.functions.invoke('upload-figure-back-video', {
      body: { action: 'delete', fig_id: figId },
    });
    setBusy(null);
    if (invErr || !data?.ok) {
      setError(data?.reason || invErr?.message || 'server');
      return;
    }
    onChange?.();
  };

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="px-3 py-2 rounded bg-red-950/50 border border-red-500 text-sm text-red-200">
          {error}
        </div>
      )}
      <ScrollArea className="h-[60vh]">
        <div className="space-y-2">
          {figures.map((f) => {
            const v = videosById[f.fig_id];
            return (
              <BackVideoRow
                key={f.fig_id}
                figure={f}
                video={v}
                busy={busy === f.fig_id}
                onUploadVideo={(file) => handleVideoUpload(f.fig_id, file)}
                onUploadCaptions={(file) => handleCaptionsUpload(f.fig_id, file)}
                onDelete={() => handleDelete(f.fig_id)}
                t={t}
              />
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function BackVideoRow({ figure, video, busy, onUploadVideo, onUploadCaptions, onDelete, t }) {
  const videoRef = useRef(null);
  const captionsRef = useRef(null);

  return (
    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
      <span className="text-xl w-8 text-center">{figure.ico}</span>
      <div className="flex-1 min-w-0">
        <div className="font-cinzel text-sm font-bold truncate">{figure.name}</div>
        <div className="text-xs text-muted-foreground font-body">
          {video ? (
            <>
              ✓ {formatDuration(video.durationS)} {video.captionsUrl && '· cc'}
            </>
          ) : (
            t('admin.backVideos.empty')
          )}
        </div>
      </div>
      <input
        type="file"
        accept="video/mp4"
        className="hidden"
        ref={videoRef}
        data-testid="video-file-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUploadVideo(f);
          e.target.value = '';
        }}
      />
      <input
        type="file"
        accept=".vtt,text/vtt,text/plain"
        className="hidden"
        ref={captionsRef}
        data-testid={`captions-file-input-${figure.fig_id}`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUploadCaptions(f);
          e.target.value = '';
        }}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => videoRef.current?.click()}
        className="gap-1"
      >
        {video ? <RefreshCw className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
        {video ? t('admin.backVideos.replace') : t('admin.backVideos.upload')}
      </Button>
      {video && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => captionsRef.current?.click()}
          className="gap-1"
        >
          <FileText className="w-3.5 h-3.5" />
          {t('admin.backVideos.captions')}
        </Button>
      )}
      {video && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onDelete}
          className="gap-1 text-red-300"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {t('admin.backVideos.delete')}
        </Button>
      )}
    </div>
  );
}
