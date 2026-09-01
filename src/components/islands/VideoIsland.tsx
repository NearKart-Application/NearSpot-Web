import { useState, useEffect, useRef, useCallback } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';

// Session-level mute state: persists across video cards, resets on page reload
let globalMuted = true;

interface Video {
  id: string;
  store_id?: string;
  store_name?: string;
  store?: { id: string; name: string; avatar?: string };
  title?: string;
  description?: string;
  video_url?: string;
  hls_url?: string;
  thumbnail_url?: string;
  thumbnail?: string;
  duration_seconds?: number;
  view_count?: number;
  like_count?: number;
  is_liked?: boolean;
  is_saved?: boolean;
  is_pinned?: boolean;
  locality?: string;
  distance_km?: number;
  tags?: { id: string; name: string; product_id?: string; product_name?: string }[];
}

function fmtCount(n?: number) {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDur(s?: number) {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function VideoCard({ video }: { video: Video }) {
  const qc = useQueryClient();
  const cardRef   = useRef<HTMLDivElement>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const hlsRef    = useRef<any>(null);
  const visibleRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const [liked, setLiked] = useState(video.is_liked ?? false);
  const [likes, setLikes] = useState(video.like_count ?? 0);
  const [saved, setSaved] = useState(video.is_saved ?? false);
  const [muted, setMuted] = useState(globalMuted);
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ns_access');

  const src       = video.video_url ?? video.hls_url;
  const thumb     = video.thumbnail_url ?? video.thumbnail;
  const storeName = video.store_name ?? video.store?.name;
  const storeId   = video.store_id ?? video.store?.id;

  // IntersectionObserver: play/pause based on actual visibility, not scroll math
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.intersectionRatio >= 0.8;
        visibleRef.current = isVisible;
        setVisible(isVisible);
        const v = videoRef.current;
        if (!v) return;
        if (isVisible) {
          v.muted = globalMuted;
          setMuted(globalMuted);
          v.play().catch(() => {});
        } else {
          v.pause();
          v.currentTime = 0;
        }
      },
      { threshold: [0.8] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Attach HLS.js for non-Safari browsers (which can't play .m3u8 natively)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;

    const isHls = src.includes('.m3u8');
    const nativeHls = v.canPlayType('application/vnd.apple.mpegurl');

    if (isHls && !nativeHls) {
      import('hls.js').then(({ default: Hls }) => {
        if (!Hls.isSupported() || !videoRef.current) return;
        const hls = new Hls({ enableWorker: false });
        hls.loadSource(src);
        hls.attachMedia(videoRef.current);
        hlsRef.current = hls;
        // Only play on MANIFEST_PARSED if this card is currently visible
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (videoRef.current && visibleRef.current) {
            videoRef.current.muted = globalMuted;
            videoRef.current.play().catch(() => {});
          }
        });
      });
    } else {
      v.src = src;
      v.load();
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    globalMuted = !globalMuted;
    v.muted = globalMuted;
    setMuted(globalMuted);
  };

  const likeMut = useMutation({
    mutationFn: () => api.post(`/videos/${video.id}/like/`),
    onMutate: () => {
      setLiked(l => !l);
      setLikes(n => liked ? n - 1 : n + 1);
    },
    onError: () => {
      setLiked(l => !l);
      setLikes(n => liked ? n + 1 : n - 1);
    },
  });

  const saveMut = useMutation({
    mutationFn: () => api.post(`/videos/${video.id}/save/`),
    onMutate: () => setSaved(s => !s),
    onError: () => setSaved(s => !s),
  });

  const handleLike = () => {
    if (!isLoggedIn) { window.location.href = '/auth/login'; return; }
    likeMut.mutate();
  };

  const handleSave = () => {
    if (!isLoggedIn) { window.location.href = '/auth/login'; return; }
    saveMut.mutate();
  };

  return (
    <div ref={cardRef} className="relative w-full h-full bg-black flex items-center justify-center">
      {/* Video */}
      {src ? (
        <video ref={videoRef} poster={thumb ?? undefined}
          className="w-full h-full object-contain" loop playsInline muted
          controls={false} onClick={toggleMute} />
      ) : thumb ? (
        <img src={thumb} alt={video.title} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-6xl opacity-30">🎬</div>
      )}

      {/* Gradient overlay bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Mute indicator */}
      {muted && visible && (
        <button onClick={toggleMute}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 text-white rounded-full p-4 pointer-events-auto animate-ping-once z-10 opacity-80">
          🔇
        </button>
      )}

      {/* Top bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        {video.locality && (
          <span className="text-white/80 text-xs bg-black/40 px-2.5 py-1 rounded-full">📍 {video.locality}</span>
        )}
        {fmtDur(video.duration_seconds) && (
          <span className="text-white/80 text-xs bg-black/40 px-2 py-1 rounded-full ml-auto">
            {fmtDur(video.duration_seconds)}
          </span>
        )}
      </div>

      {/* Right action buttons */}
      <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5">
        <button onClick={handleLike} className="flex flex-col items-center gap-1">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            liked ? 'bg-red-500 scale-110' : 'bg-black/30'
          }`}>
            <svg className="w-6 h-6 text-white" fill={liked ? 'currentColor' : 'none'}
              stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
            </svg>
          </div>
          <span className="text-white text-xs font-bold">{fmtCount(likes)}</span>
        </button>

        <button onClick={handleSave} className="flex flex-col items-center gap-1">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            saved ? 'bg-amber-500' : 'bg-black/30'
          }`}>
            <svg className="w-6 h-6 text-white" fill={saved ? 'currentColor' : 'none'}
              stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
            </svg>
          </div>
          <span className="text-white text-xs font-bold">Save</span>
        </button>

        <button className="flex flex-col items-center gap-1"
          onClick={() => {
            const url = `${window.location.origin}/videos/${video.id}`;
            if (navigator.share) {
              navigator.share({ url, title: video.title ?? 'Check this out on NearSpot' }).catch(() => {});
            } else {
              navigator.clipboard.writeText(url).then(() => {
                const el = document.getElementById(`share-tip-${video.id}`);
                if (el) { el.style.opacity = '1'; setTimeout(() => { el.style.opacity = '0'; }, 1500); }
              });
            }
          }}>
          <div className="w-11 h-11 rounded-full bg-black/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
            </svg>
          </div>
          <span id={`share-tip-${video.id}`} className="text-white text-xs font-bold opacity-0 transition-opacity">Copied!</span>
          <span className="text-white text-xs font-bold">Share</span>
        </button>

        {/* Views */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-11 h-11 rounded-full bg-black/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </div>
          <span className="text-white text-xs font-bold">{fmtCount(video.view_count)}</span>
        </div>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-8 left-4 right-16">
        {storeId && (
          <a href={`/stores/${storeId}`} className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-white flex items-center justify-center text-white text-xs font-bold">
              {video.store?.avatar
                ? <img src={video.store.avatar} alt={storeName} className="w-full h-full object-cover rounded-full" />
                : storeName?.slice(0, 2).toUpperCase()
              }
            </div>
            <span className="text-white font-bold text-sm">{storeName}</span>
          </a>
        )}
        {video.title && (
          <p className="text-white font-semibold text-sm line-clamp-2 leading-snug">{video.title}</p>
        )}
        {video.description && (
          <p className="text-white/70 text-xs mt-1 line-clamp-2">{video.description}</p>
        )}
        {video.tags && video.tags.length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {video.tags.slice(0, 3).map(tag => (
              tag.product_id ? (
                <a key={tag.id} href={`/products/${tag.product_id}`}
                  className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full hover:bg-white/30 transition-colors">
                  🛍️ {tag.product_name ?? tag.name}
                </a>
              ) : (
                <span key={tag.id} className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full">#{tag.name}</span>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Video Upload Modal (vendor only) ───────────────────────────────── */
function VideoUploadModal({ onClose }: { onClose: () => void }) {
  const [file, setFile]       = useState<File | null>(null);
  const [title, setTitle]     = useState('');
  const [desc, setDesc]       = useState('');
  const [step, setStep]       = useState<'form' | 'uploading' | 'done' | 'error'>('form');
  const [progress, setProgress] = useState(0);
  const [errMsg, setErrMsg]   = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file || !title.trim()) return;
    setStep('uploading');
    setProgress(10);
    try {
      // Step 1: request presigned URL
      const { data: req } = await api.post('/videos/request-upload/', {
        title: title.trim(),
        description: desc.trim(),
        duration_seconds: 0,
      });
      const { video_id, upload_url } = req;
      setProgress(30);

      // Step 2: PUT to S3
      await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'video/mp4' },
      });
      setProgress(80);

      // Step 3: confirm upload
      await api.post(`/videos/${video_id}/confirm-upload/`, { duration_seconds: 0 });
      setProgress(100);
      setStep('done');
    } catch (e: any) {
      setErrMsg(e?.response?.data?.message ?? 'Upload failed. Please try again.');
      setStep('error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-navy">Upload Video</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">✕</button>
        </div>

        {step === 'done' ? (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">🎬</div>
            <p className="font-bold text-navy">Video uploaded!</p>
            <p className="text-sm text-gray-400 mt-1">It will be ready in a few minutes after processing.</p>
            <button onClick={onClose} className="mt-5 w-full py-3 bg-navy text-white rounded-xl font-bold text-sm hover:bg-navy/90 transition-colors">Done</button>
          </div>
        ) : step === 'uploading' ? (
          <div className="py-6">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-navy rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-center text-sm text-gray-500">{progress < 80 ? 'Uploading video…' : 'Processing…'}</p>
          </div>
        ) : (
          <>
            {step === 'error' && <p className="text-sm text-red-500 mb-4 bg-red-50 px-3 py-2 rounded-xl">{errMsg}</p>}
            <input ref={fileRef} type="file" accept="video/mp4,video/mov,video/avi,video/*" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <button onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-2xl p-6 mb-4 text-center hover:border-navy/30 transition-colors">
              {file ? (
                <><div className="text-2xl mb-1">🎬</div><p className="text-sm font-semibold text-navy">{file.name}</p><p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p></>
              ) : (
                <><div className="text-3xl mb-2">📹</div><p className="text-sm font-bold text-navy">Tap to select video</p><p className="text-xs text-gray-400 mt-1">MP4, MOV or AVI</p></>
              )}
            </button>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Video title *"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-navy/20 mb-3" />
            <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-navy/20 mb-4 resize-none" />
            <button onClick={handleUpload} disabled={!file || !title.trim()}
              className="w-full py-3 bg-navy text-white rounded-xl font-bold text-sm hover:bg-navy/90 transition-colors disabled:opacity-50">
              Upload Video
            </button>
          </>
        )}
      </div>
    </div>
  );
}

type FeedTab = 'trending' | 'following' | 'my-videos';

function Inner() {
  const [tab, setTab] = useState<FeedTab>('trending');
  const [showUpload, setShowUpload] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ns_access');
  const userRole: string = (() => { try { return JSON.parse(localStorage.getItem('ns_user') ?? '{}').role ?? ''; } catch { return ''; } })();
  const isVendor = userRole === 'vendor';

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['videos-trending'],
    queryFn:  () => api.get('/videos/feed/trending/').then(r => r.data),
  });
  const { data: followData } = useQuery({
    queryKey: ['videos-following'],
    queryFn:  () => api.get('/videos/feed/following/').then(r => r.data),
    enabled:  isLoggedIn && tab === 'following',
  });
  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: ['videos-mine'],
    queryFn:  () => api.get('/videos/my-videos/').then(r => r.data),
    enabled:  isVendor && tab === 'my-videos',
  });

  const pinMut = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      api.patch(`/videos/${id}/update/`, { is_pinned: pinned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['videos-mine'] }),
  });

  const trendVideos: Video[] = trendData?.results ?? (Array.isArray(trendData) ? trendData : []);
  const followVideos: Video[] = followData?.results ?? (Array.isArray(followData) ? followData : []);
  const myVideos: Video[] = myData?.results ?? (Array.isArray(myData) ? myData : []);
  const videos = tab === 'following' ? followVideos : tab === 'my-videos' ? myVideos : trendVideos;

  const feedTabs: { key: FeedTab; label: string }[] = [
    { key: 'trending', label: 'Trending' },
    { key: 'following', label: 'Following' },
    ...(isVendor ? [{ key: 'my-videos' as FeedTab, label: 'My Videos' }] : []),
  ];

  return (
    <div className="relative h-[calc(100vh-4rem)]">
      {/* Tab switch */}
      <motion.div className="absolute top-4 left-0 right-0 z-10 flex justify-center gap-2 px-4"
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' as const }}>
        <div className="flex bg-black/30 backdrop-blur rounded-full p-1 gap-1">
          {feedTabs.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); containerRef.current?.scrollTo({ top: 0 }); }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                tab === t.key ? 'bg-white text-navy' : 'text-white/80 hover:text-white'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        {isVendor && (
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 bg-white/90 text-navy text-xs font-bold px-3 py-1.5 rounded-full hover:bg-white transition-colors backdrop-blur">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Upload
          </button>
        )}
      </motion.div>

      {(trendLoading && tab === 'trending') || (myLoading && tab === 'my-videos') ? (
        <div className="flex items-center justify-center h-full bg-black">
          <div className="text-center text-white">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full border-2 border-white/25 border-t-white animate-spin" />
            <p className="text-sm opacity-70">Loading videos…</p>
          </div>
        </div>
      ) : tab === 'my-videos' ? (
        /* My Videos — grid layout with pin toggle */
        <div className="h-full bg-gray-950 overflow-y-auto pt-16 pb-6">
          {myVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60%] text-white/60 px-6 text-center">
              <div className="text-5xl mb-4">🎬</div>
              <p className="font-bold">No videos yet</p>
              <p className="text-sm mt-2">Upload your first product video to attract customers</p>
              <button onClick={() => setShowUpload(true)}
                className="mt-5 px-6 py-2.5 bg-white text-navy text-sm font-bold rounded-xl hover:bg-white/90 transition-colors">
                Upload Video
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 px-2">
              {myVideos.map(v => (
                <div key={v.id} className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16]">
                  {(v.thumbnail_url ?? v.thumbnail) && (
                    <img src={v.thumbnail_url ?? v.thumbnail} alt={v.title} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  {v.is_pinned && (
                    <span className="absolute top-2 left-2 text-[9px] font-bold bg-gold text-navy px-1.5 py-0.5 rounded-full">📌 Pinned</span>
                  )}
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-white text-xs font-semibold line-clamp-2">{v.title}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-white/60 text-[10px]">👁 {v.view_count ?? 0}</span>
                      <button onClick={() => pinMut.mutate({ id: v.id, pinned: !v.is_pinned })}
                        title={v.is_pinned ? 'Unpin' : 'Pin to top'}
                        className="text-[10px] font-bold text-white bg-white/20 px-2 py-0.5 rounded-full hover:bg-white/30 transition-colors">
                        {v.is_pinned ? '📌 Unpin' : '📌 Pin'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : videos.length === 0 ? (
        <div className="flex items-center justify-center h-full bg-black">
          <div className="text-center text-white px-6">
            <div className="text-5xl mb-4">🎬</div>
            <h3 className="font-bold text-lg">
              {tab === 'following' && !isLoggedIn ? 'Sign in to see videos'
                : tab === 'following' ? 'No videos from followed stores' : 'No videos available'}
            </h3>
            <p className="text-white/60 text-sm mt-2">
              {tab === 'following' ? 'Follow stores to see their video content here.' : 'Check back soon for new videos from local stores.'}
            </p>
            {tab === 'following' && !isLoggedIn && (
              <a href="/auth/login" className="mt-4 inline-block px-6 py-2.5 bg-white text-navy text-sm font-bold rounded-xl hover:bg-white/90 transition-colors">Sign In</a>
            )}
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="overflow-y-scroll snap-y snap-mandatory h-full bg-black" style={{ scrollbarWidth: 'none' }}>
          {videos.map((v) => (
            <div key={v.id} className="snap-start h-full w-full relative">
              <VideoCard video={v} />
            </div>
          ))}
        </div>
      )}

      {showUpload && <VideoUploadModal onClose={() => { setShowUpload(false); qc.invalidateQueries({ queryKey: ['videos-mine'] }); }} />}
    </div>
  );
}

export default function VideoIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <Inner />
    </QueryClientProvider>
  );
}
