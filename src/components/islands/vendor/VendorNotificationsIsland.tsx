import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

interface Notification {
  id: string; title: string; body: string; notification_type: string;
  is_read: boolean; created_at: string; data?: Record<string, any>;
}

const TYPE_ICON: Record<string, string> = {
  reservation_confirmed: '✅',
  reservation_cancelled: '❌',
  reservation_expiring:  '⏰',
  reservation_expired:   '⌛',
  review:                '⭐',
  follow:                '👥',
  new_product:           '🆕',
  offer:                 '🎉',
  store_broadcast:       '📢',
  chat:                  '💬',
  new_message:           '💬',
  chat_message:          '💬',
  wallet:                '💰',
  wallet_transfer:       '💰',
  payment_request:       '💸',
  system:                '🔔',
};

const TYPE_COLOR: Record<string, string> = {
  reservation_confirmed: 'bg-green-100',
  reservation_cancelled: 'bg-red-100',
  reservation_expiring:  'bg-orange-100',
  reservation_expired:   'bg-gray-100',
  review:                'bg-amber-100',
  follow:                'bg-green-100',
  store_broadcast:       'bg-indigo-100',
  chat:                  'bg-sky-100',
  new_message:           'bg-sky-100',
  chat_message:          'bg-sky-100',
  wallet:                'bg-emerald-100',
  wallet_transfer:       'bg-emerald-100',
  payment_request:       'bg-rose-100',
};

function notifLink(n: { notification_type: string; data?: Record<string, any> }): string | null {
  const t = n.notification_type;
  if (t.startsWith('reservation')) return '/vendor/reservations';
  if (t === 'review')              return '/vendor/reviews';
  if (t === 'wallet' || t === 'wallet_transfer' || t === 'payment_request') return '/vendor/wallet';
  if (t === 'new_product')         return '/vendor/products';
  if (n.data?.conversation_id)     return `/chat/${n.data.conversation_id}`;
  return null;
}

function fmtDate(s: string) {
  const d = new Date(s);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function Inner() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-notifications'],
    queryFn: () => api.get('/notifications/').then(r => r.data),
    refetchInterval: 30_000,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-notifications'] }),
  });

  const markAllMut = useMutation({
    mutationFn: () => api.post('/notifications/read-all/'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-notifications'] }),
  });

  const notifications: Notification[] = data?.results ?? (Array.isArray(data) ? data : []);
  const unread = notifications.filter(n => !n.is_read);
  const shown = filter === 'unread' ? unread : notifications;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Notifications</h1>
          <p className="text-sm text-gray-400">{unread.length} unread</p>
        </div>
        {unread.length > 0 && (
          <button onClick={() => markAllMut.mutate()} disabled={markAllMut.isPending}
            className="text-sm font-bold text-navy hover:underline">
            {markAllMut.isPending ? 'Marking…' : 'Mark all read'}
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'unread'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all ${filter === f ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f} {f === 'unread' && unread.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-white/20">{unread.length}</span>}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="card overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-4 p-4 border-b border-gray-100 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : shown.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">🔔</div>
          <p className="font-semibold text-gray-600">{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {shown.map(n => {
            const link = notifLink(n);
            return (
              <div key={n.id}
                onClick={() => {
                  if (!n.is_read) markReadMut.mutate(n.id);
                  if (link) setTimeout(() => { window.location.href = link; }, 50);
                }}
                className={`flex items-start gap-4 p-4 border-b border-gray-100 last:border-0 transition-colors cursor-pointer ${n.is_read ? 'bg-white hover:bg-gray-50' : 'bg-amber-50/60 hover:bg-amber-50'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${n.is_read ? (TYPE_COLOR[n.notification_type] ?? 'bg-gray-100') : (TYPE_COLOR[n.notification_type] ?? 'bg-amber-100')}`}>
                  {TYPE_ICON[n.notification_type] ?? '🔔'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold ${n.is_read ? 'text-gray-700' : 'text-navy'}`}>{n.title}</p>
                    <span className="text-xs text-gray-400 shrink-0">{fmtDate(n.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  {!n.is_read && <div className="w-2 h-2 rounded-full bg-amber-400" />}
                  {link && <span className="text-gray-300 text-base">›</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function VendorNotificationsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <VendorAuthGuard>
        <Inner />
      </VendorAuthGuard>
    </QueryClientProvider>
  );
}
