import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';
import Img from '../../ui/Img';

interface Video {
  id: string; title: string; description?: string;
  thumbnail?: string; thumbnail_url?: string;
  hls_url?: string; video_url?: string;
  status: string; video_type: string;
  view_count: number; like_count: number;
  is_pinned: boolean; is_visible: boolean;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  ready:      'bg-green-100 text-green-700',
  processing: 'bg-blue-100 text-blue-700',
  pending:    'bg-amber-100 text-amber-700',
  failed:     'bg-red-100 text-red-600',
  expired:    'bg-gray-100 text-gray-500',
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

function Inner() {
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-videos'],
    queryFn: () => api.get('/videos/my-videos/').then(r => r.data),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, field, val }: { id: string; field: string; val: boolean }) =>
      api.patch(`/videos/${id}/update/`, { [field]: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-videos'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/videos/${id}/delete/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-videos'] }),
  });

  const videos: Video[] = data?.results ?? (Array.isArray(data) ? data : []);
  const stats = {
    total: videos.length,
    ready: videos.filter(v => v.status === 'ready').length,
    views: videos.reduce((a, v) => a + v.view_count, 0),
    likes: videos.reduce((a, v) => a + v.like_count, 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Videos</h1>
          <p className="text-sm text-gray-400">{stats.total} videos · {stats.views.toLocaleString()} views</p>
        </div>
        <button className="btn-primary btn-sm px-4 py-2 text-sm" onClick={() => alert('Use the mobile app to upload videos')}>
          + Upload Video
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total },
          { label: 'Live', value: stats.ready },
          { label: 'Views', value: stats.views.toLocaleString() },
          { label: 'Likes', value: stats.likes.toLocaleString() },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-xl font-bold text-navy">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="card h-56 animate-pulse" />)}
        </div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : videos.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">🎬</div>
          <p className="font-semibold text-gray-600">No videos yet</p>
          <p className="text-sm mt-1">Upload your first video from the mobile app</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map(v => {
            const thumb = v.thumbnail_url ?? v.thumbnail;
            return (
              <div key={v.id} className="card overflow-hidden">
                {/* Thumbnail */}
                <div className="relative h-40 bg-gray-900">
                  <Img src={thumb} alt={v.title} fallback="generic"
                    className="w-full h-full object-cover opacity-80" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[v.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {v.status}
                    </span>
                  </div>
                  {v.is_pinned && (
                    <div className="absolute top-2 left-2 text-xs font-bold text-white bg-navy/70 px-2 py-0.5 rounded-full">📌 Pinned</div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-navy text-sm line-clamp-1">{v.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{fmtDate(v.created_at)} · {v.video_type.replace('_', ' ')}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>👁 {v.view_count.toLocaleString()}</span>
                    <span>❤️ {v.like_count.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                      <button onClick={() => toggleMut.mutate({ id: v.id, field: 'is_visible', val: !v.is_visible })}
                        className={`relative w-8 h-4.5 rounded-full transition-colors ${v.is_visible ? 'bg-navy' : 'bg-gray-200'}`}
                        style={{ height: '18px' }}>
                        <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${v.is_visible ? 'translate-x-[14px]' : ''}`} />
                      </button>
                      Visible
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer ml-1">
                      <button onClick={() => toggleMut.mutate({ id: v.id, field: 'is_pinned', val: !v.is_pinned })}
                        className={`relative w-8 rounded-full transition-colors ${v.is_pinned ? 'bg-gold' : 'bg-gray-200'}`}
                        style={{ height: '18px' }}>
                        <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${v.is_pinned ? 'translate-x-[14px]' : ''}`} />
                      </button>
                      Pin
                    </label>
                    <button onClick={() => { if (confirm(`Delete "${v.title}"?`)) deleteMut.mutate(v.id); }}
                      className="ml-auto text-xs text-red-500 font-bold hover:underline">Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function VendorVideosIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
