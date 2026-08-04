import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';
import { Button } from '@/components/ui/button';

interface Notification {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  reservation_confirmed: '✅',
  reservation_cancelled: '❌',
  reservation_expiring:  '⏰',
  reservation_expired:   '⌛',
  new_product:           '🆕',
  offer:                 '🎉',
  price_drop:            '📉',
  store_broadcast:       '📢',
  loyalty_earned:        '⭐',
  loyalty:               '⭐',
  follow:                '🏪',
  chat:                  '💬',
  new_message:           '💬',
  chat_message:          '💬',
  wallet:                '💰',
  wallet_transfer:       '💰',
  payment_request:       '💸',
  system:                '🔔',
};

const TYPE_COLORS: Record<string, string> = {
  reservation_confirmed: 'bg-green-100',
  reservation_cancelled: 'bg-red-100',
  reservation_expiring:  'bg-orange-100',
  reservation_expired:   'bg-gray-100',
  offer:                 'bg-purple-100',
  price_drop:            'bg-blue-100',
  store_broadcast:       'bg-indigo-100',
  loyalty_earned:        'bg-amber-100',
  loyalty:               'bg-amber-100',
  follow:                'bg-green-100',
  chat:                  'bg-sky-100',
  new_message:           'bg-sky-100',
  chat_message:          'bg-sky-100',
  wallet:                'bg-emerald-100',
  wallet_transfer:       'bg-emerald-100',
  payment_request:       'bg-rose-100',
};

const NOTIF_PREFS_KEY = 'ns_notif_prefs';

interface NotifPrefs {
  chat: boolean;
  reservations: boolean;
  offers: boolean;
  loyalty: boolean;
  wallet: boolean;
  new_product: boolean;
  general: boolean;
}

function loadPrefs(): NotifPrefs {
  try {
    const r = localStorage.getItem(NOTIF_PREFS_KEY);
    if (r) return { chat: true, reservations: true, offers: true, loyalty: true, wallet: true, new_product: true, general: true, ...JSON.parse(r) };
  } catch {}
  return { chat: true, reservations: true, offers: true, loyalty: true, wallet: true, new_product: true, general: true };
}

function savePrefs(prefs: NotifPrefs) {
  try { localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs)); } catch {}
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function notifMatchesPref(notif: Notification, prefs: NotifPrefs): boolean {
  const t = notif.notification_type;
  if (t.includes('reservation')) return prefs.reservations;
  if (t === 'offer' || t === 'price_drop' || t === 'store_broadcast') return prefs.offers;
  if (t === 'loyalty_earned' || t === 'loyalty') return prefs.loyalty;
  if (t === 'wallet' || t === 'wallet_transfer' || t === 'payment_request') return prefs.wallet;
  if (t === 'new_product') return prefs.new_product;
  if (t === 'chat_message' || t === 'chat' || t === 'new_message') return prefs.chat;
  return prefs.general;
}

function NotifCard({ notif, onRead }: { notif: Notification; onRead: () => void }) {
  const icon  = TYPE_ICONS[notif.notification_type] ?? '🔔';
  const color = TYPE_COLORS[notif.notification_type] ?? 'bg-gray-100';
  const link  = notif.data?.reservation_id ? `/customer/reservations`
               : notif.data?.store_id ? `/stores/${notif.data.store_id}`
               : notif.data?.product_id ? `/products/${notif.data.product_id}`
               : notif.data?.conversation_id ? `/customer/chat?conversation=${notif.data.conversation_id}`
               : null;

  function handleClick(e: React.MouseEvent) {
    if (!notif.is_read) onRead();
    if (link) {
      e.preventDefault();
      setTimeout(() => { window.location.href = link; }, 50);
    }
  }

  return (
    <div onClick={handleClick}
      className={`bg-white border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors flex gap-3 p-4 ${!notif.is_read ? 'bg-navy/5' : ''}`}>
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${color}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`text-sm font-bold leading-tight ${notif.is_read ? 'text-gray-700' : 'text-navy'}`}>{notif.title}</h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {!notif.is_read && <div className="w-2 h-2 rounded-full bg-navy" />}
            <span className="text-[11px] text-gray-400">{timeAgo(notif.created_at)}</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>
      </div>
    </div>
  );
}

function ToggleRow({ icon, title, subtitle, checked, onChange }: {
  icon: string; title: string; subtitle: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-navy/8 flex items-center justify-center text-lg">{icon}</div>
        <div>
          <p className="text-sm font-semibold text-navy">{title}</p>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      <button onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-navy' : 'bg-gray-200'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

function SettingsTab() {
  const [prefs, setPrefs] = useState<NotifPrefs>(loadPrefs);

  const update = (key: keyof NotifPrefs, val: boolean) => {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    savePrefs(next);
  };

  return (
    <div>
      <p className="text-xs text-gray-400 mb-4">Choose which notification types you want to see in-app.</p>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4">
        <ToggleRow icon="💬" title="Chat messages" subtitle="Messages from stores" checked={prefs.chat} onChange={v => update('chat', v)} />
        <ToggleRow icon="📌" title="Reservations" subtitle="Confirmations, reminders, cancellations" checked={prefs.reservations} onChange={v => update('reservations', v)} />
        <ToggleRow icon="🎉" title="Offers & deals" subtitle="Price drops, discounts, store broadcasts" checked={prefs.offers} onChange={v => update('offers', v)} />
        <ToggleRow icon="💰" title="Wallet & payments" subtitle="Wallet transfers and payment requests" checked={prefs.wallet} onChange={v => update('wallet', v)} />
        <ToggleRow icon="⭐" title="Loyalty rewards" subtitle="Points earned and milestones" checked={prefs.loyalty} onChange={v => update('loyalty', v)} />
        <ToggleRow icon="🆕" title="New products" subtitle="New arrivals from stores you follow" checked={prefs.new_product} onChange={v => update('new_product', v)} />
        <ToggleRow icon="🔔" title="General" subtitle="System and account notifications" checked={prefs.general} onChange={v => update('general', v)} />
      </div>
    </div>
  );
}

type TabT = 'notifications' | 'settings';
type FilterT = 'all' | 'unread';

function Inner() {
  const [tab, setTab]       = useState<TabT>('notifications');
  const [filter, setFilter] = useState<FilterT>('all');
  const [prefs]             = useState<NotifPrefs>(loadPrefs);
  const qc = useQueryClient();
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ns_access');

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => api.get('/notifications/').then(r => r.data),
    enabled:  isLoggedIn,
    refetchInterval: 30_000,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMut = useMutation({
    mutationFn: () => api.post('/notifications/read-all/'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  if (!isLoggedIn) return (
    <div className="flex flex-col items-center py-24 text-center px-6">
      <div className="w-24 h-24 rounded-full bg-navy/10 flex items-center justify-center mb-5 text-5xl">🔔</div>
      <h2 className="text-xl font-black text-navy">Sign in to see notifications</h2>
      <p className="text-gray-400 text-sm mt-2">Get alerts on reservations, offers, and price drops.</p>
      <a href="/auth/login" className="mt-6 btn-primary px-10 py-3">Sign In</a>
    </div>
  );

  const allNotifs: Notification[] = data?.results ?? (Array.isArray(data) ? data : []);
  const filtered  = allNotifs.filter(n => notifMatchesPref(n, prefs));
  const unread    = filtered.filter(n => !n.is_read);
  const shown     = filter === 'unread' ? unread : filtered;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-navy">Notifications</h1>
          {unread.length > 0 && tab === 'notifications' && (
            <p className="text-sm text-gray-400">{unread.length} unread</p>
          )}
        </div>
        {tab === 'notifications' && unread.length > 0 && (
          <button onClick={() => markAllMut.mutate()} disabled={markAllMut.isPending}
            className="text-xs font-bold text-navy hover:underline transition-colors">
            Mark all read
          </button>
        )}
      </div>

      {/* Top tabs */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab('notifications')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${tab === 'notifications' ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          Notifications
        </button>
        <button onClick={() => setTab('settings')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${tab === 'settings' ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          ⚙️ Preferences
        </button>
      </div>

      {tab === 'settings' ? <SettingsTab /> : (
        <>
          {/* Filter chips */}
          <div className="flex gap-2 mb-4">
            {(['all', 'unread'] as FilterT[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all capitalize ${
                  filter === f ? 'bg-gold text-navy' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {f === 'unread' ? `Unread (${unread.length})` : `All (${filtered.length})`}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3 p-4 border-b border-gray-100 animate-pulse">
                  <div className="w-11 h-11 bg-gray-200 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded-full w-3/4" />
                    <div className="h-3 bg-gray-200 rounded-full w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="text-6xl mb-4">🔔</div>
              <h3 className="font-bold text-navy text-lg">
                {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
              </h3>
              <p className="text-gray-400 text-sm mt-2">
                {filter === 'unread' ? 'You have no unread notifications.' : 'Your notifications will appear here.'}
              </p>
              {filter === 'unread' && (
                <Button variant="outline" onClick={() => setFilter('all')} className="mt-4">View all</Button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              {shown.map(n => (
                <NotifCard key={n.id} notif={n} onRead={() => markReadMut.mutate(n.id)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function NotificationsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <Inner />
    </QueryClientProvider>
  );
}
