import { useState, useEffect, useRef } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
            const url = window.location.href;
            if (navigator.share) {
              navigator.share({ url }).catch(() => {});
            } else {
              navigator.clipboard.writeText(url);
            }
          }}>
          <div className="w-11 h-11 rounded-full bg-black/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
            </svg>
          </div>
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

type FeedTab = 'trending' | 'following';

function Inner() {
  const [tab, setTab] = useState<FeedTab>('trending');
  const containerRef = useRef<HTMLDivElement>(null);
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ns_access');

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['videos-trending'],
    queryFn:  () => api.get('/videos/feed/trending/').then(r => r.data),
  });

  const { data: followData } = useQuery({
    queryKey: ['videos-following'],
    queryFn:  () => api.get('/videos/feed/following/').then(r => r.data),
    enabled:  isLoggedIn && tab === 'following',
  });

  const trendVideos: Video[] = trendData?.results ?? (Array.isArray(trendData) ? trendData : []);
  const followVideos: Video[] = followData?.results ?? (Array.isArray(followData) ? followData : []);
  const videos = tab === 'following' ? followVideos : trendVideos;

  return (
    <div className="relative h-[calc(100vh-4rem)]">
      {/* Tab switch */}
      <div className="absolute top-4 left-0 right-0 z-10 flex justify-center">
        <div className="flex bg-black/30 backdrop-blur rounded-full p-1 gap-1">
          {(['trending', 'following'] as FeedTab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); containerRef.current?.scrollTo({ top: 0 }); }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all capitalize ${
                tab === t ? 'bg-white text-navy' : 'text-white/80 hover:text-white'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {trendLoading ? (
        <div className="flex items-center justify-center h-full bg-black">
          <div className="text-center text-white">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full border-2 border-white/25 border-t-white animate-spin" />
            <p className="text-sm opacity-70">Loading videos…</p>
          </div>
        </div>
      ) : videos.length === 0 ? (
        <div className="flex items-center justify-center h-full bg-black">
          <div className="text-center text-white px-6">
            <div className="text-5xl mb-4">🎬</div>
            <h3 className="font-bold text-lg">
              {tab === 'following' && !isLoggedIn
                ? 'Sign in to see videos'
                : tab === 'following' ? 'No videos from followed stores' : 'No videos available'}
            </h3>
            <p className="text-white/60 text-sm mt-2">
              {tab === 'following' && !isLoggedIn
                ? 'Follow stores to see their video content here.'
                : tab === 'following' ? 'Follow stores to see their video content here.' : 'Check back soon for new videos from local stores.'}
            </p>
            {tab === 'following' && !isLoggedIn && (
              <a href="/auth/login"
                className="mt-4 inline-block px-6 py-2.5 bg-white text-navy text-sm font-bold rounded-xl hover:bg-white/90 transition-colors">
                Sign In
              </a>
            )}
          </div>
        </div>
      ) : (
        <div ref={containerRef}
          className="overflow-y-scroll snap-y snap-mandatory h-full bg-black"
          style={{ scrollbarWidth: 'none' }}>
          {videos.map((v) => (
            <div key={v.id} className="snap-start h-full w-full relative">
              <VideoCard video={v} />
            </div>
          ))}
        </div>
      )}
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
