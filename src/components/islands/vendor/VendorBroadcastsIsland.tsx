import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

interface Channel { id: string; name: string; description?: string; subscriber_count: number; post_count: number; created_at: string; }
interface Post { id: string; content: string; image_url?: string; created_at: string; view_count?: number; }

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

function CreateChannelModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState('');

  const createMut = useMutation({
    mutationFn: () => api.post('/stores/mine/broadcast-channels/', { name, description: desc }),
    onSuccess: () => onSuccess(),
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Failed to create'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-navy">New Channel</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Channel Name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Weekly Offers"
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm mb-3 focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10" />
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Description (optional)</label>
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What will you broadcast?"
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm mb-3 focus:outline-none focus:border-navy/40" />
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
        <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !name.trim()}
          className="w-full btn-primary py-3 rounded-xl font-bold">
          {createMut.isPending ? 'Creating…' : 'Create Channel'}
        </button>
      </div>
    </div>
  );
}

function RenameChannelModal({ channel, onClose, onSuccess }: { channel: Channel; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState(channel.name);
  const [desc, setDesc] = useState(channel.description ?? '');
  const [error, setError] = useState('');

  const renameMut = useMutation({
    mutationFn: () => api.patch(`/stores/mine/broadcast-channels/${channel.id}/`, { name, description: desc }),
    onSuccess: () => onSuccess(),
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Failed to rename'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-navy">Rename Channel</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Channel Name</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm mb-3 focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10" />
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Description</label>
        <input value={desc} onChange={e => setDesc(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm mb-3 focus:outline-none focus:border-navy/40" />
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
        <button onClick={() => renameMut.mutate()} disabled={renameMut.isPending || !name.trim()}
          className="w-full btn-primary py-3 rounded-xl font-bold">
          {renameMut.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

function CreatePostModal({ channelId, onClose, onSuccess }: { channelId: string; onClose: () => void; onSuccess: () => void }) {
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const postMut = useMutation({
    mutationFn: () => api.post(`/stores/mine/broadcast-channels/${channelId}/posts/`, { content }),
    onSuccess: () => onSuccess(),
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Failed to post'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-navy">New Broadcast Post</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>
        <textarea value={content} onChange={e => setContent(e.target.value.slice(0, 1000))}
          placeholder="Write your broadcast message…" rows={5}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm resize-none mb-1 focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10" />
        <p className="text-xs text-gray-400 mb-3 text-right">{content.length}/1000</p>
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
        <button onClick={() => postMut.mutate()} disabled={postMut.isPending || !content.trim()}
          className="w-full btn-primary py-3 rounded-xl font-bold">
          {postMut.isPending ? 'Sending…' : '📢 Send Broadcast'}
        </button>
      </div>
    </div>
  );
}

function ChannelView({ channel }: { channel: Channel }) {
  const [showPost, setShowPost] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const qc = useQueryClient();

  const { data: postsData } = useQuery({
    queryKey: ['vendor-broadcasts', channel.id],
    queryFn: () => api.get(`/stores/mine/broadcast-channels/${channel.id}/posts/`).then(r => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/stores/mine/broadcast-channels/${channel.id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor-channels'] }); setShowDeleteConfirm(false); },
  });

  const posts: Post[] = Array.isArray(postsData) ? postsData : (postsData?.results ?? []);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📢</span>
          <div>
            <h3 className="font-bold text-navy">{channel.name}</h3>
            <p className="text-xs text-gray-400">
              {channel.subscriber_count} subscriber{channel.subscriber_count !== 1 ? 's' : ''} · {channel.post_count} post{channel.post_count !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRename(true)} className="btn-outline btn-sm px-3 py-1.5 text-xs">Rename</button>
          <button onClick={() => setShowDeleteConfirm(true)} className="btn-danger btn-sm px-3 py-1.5 text-xs">Delete</button>
          <button onClick={() => setShowPost(true)} className="btn-primary btn-sm px-4 py-1.5 text-sm">+ Post</button>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-2xl">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-sm">No posts yet. Broadcast to your followers!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(p => (
            <div key={p.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <p className="text-sm text-gray-700 whitespace-pre-line">{p.content}</p>
              <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                <span>{fmtDate(p.created_at)}</span>
                {p.view_count != null && <span>👁 {p.view_count}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showPost && (
        <CreatePostModal channelId={channel.id} onClose={() => setShowPost(false)}
          onSuccess={() => {
            setShowPost(false);
            qc.invalidateQueries({ queryKey: ['vendor-broadcasts', channel.id] });
            qc.invalidateQueries({ queryKey: ['vendor-channels'] });
          }} />
      )}
      {showRename && (
        <RenameChannelModal channel={channel} onClose={() => setShowRename(false)}
          onSuccess={() => { setShowRename(false); qc.invalidateQueries({ queryKey: ['vendor-channels'] }); }} />
      )}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-navy mb-2">Delete Channel?</h3>
            <p className="text-sm text-gray-600 mb-4">
              "{channel.name}" has {channel.subscriber_count} subscriber(s) and {channel.post_count} post(s). This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}
                className="flex-1 btn-danger py-2.5 rounded-xl text-sm font-bold">
                {deleteMut.isPending ? 'Deleting…' : 'Delete Channel'}
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 btn-outline py-2.5 rounded-xl text-sm font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Inner() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-channels'],
    queryFn: () => api.get('/stores/mine/broadcast-channels/').then(r => r.data),
  });

  const channels: Channel[] = Array.isArray(data) ? data : (data?.results ?? []);
  const activeChannel = channels.find(c => c.id === activeChannelId) ?? channels[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Broadcasts</h1>
          <p className="text-sm text-gray-400">{channels.length} channel{channels.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm px-4 py-2 text-sm">+ New Channel</button>
      </div>

      {isLoading ? (
        <div className="card h-32 animate-pulse" />
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : channels.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">📢</div>
          <p className="font-semibold text-gray-600">No broadcast channels yet</p>
          <p className="text-sm mt-1">Create a channel to start sending updates to your followers</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 btn-primary btn-sm px-6 py-2">Create Channel</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Channel list */}
          <div className="lg:col-span-1">
            <div className="card overflow-hidden">
              {channels.map(c => (
                <button key={c.id} onClick={() => setActiveChannelId(c.id)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 last:border-0 transition-colors ${
                    (activeChannel?.id === c.id) ? 'bg-navy/5' : 'hover:bg-gray-50'
                  }`}>
                  <div className="w-9 h-9 rounded-xl bg-navy/10 flex items-center justify-center text-sm font-bold text-navy shrink-0">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-navy text-sm truncate">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.subscriber_count} subs · {c.post_count} posts</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Active channel */}
          <div className="lg:col-span-3">
            {activeChannel && <ChannelView key={activeChannel.id} channel={activeChannel} />}
          </div>
        </div>
      )}

      {showCreate && (
        <CreateChannelModal onClose={() => setShowCreate(false)} onSuccess={() => {
          setShowCreate(false);
          qc.invalidateQueries({ queryKey: ['vendor-channels'] });
        }} />
      )}
    </div>
  );
}

export default function VendorBroadcastsIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
