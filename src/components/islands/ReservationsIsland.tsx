import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { queryClient } from '../../lib/queryClient';
import { CustomerAuthGuard } from './CustomerAuthGuard';
import api from '../../lib/api';
import Img from '../ui/Img';

const listContainer = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const listItem = { hidden: { opacity: 0, y: 20, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: 'easeOut' as const } } };

interface Reservation {
  id: string;
  store: { id: string; name: string; avatar?: string; locality?: string; phone?: string };
  product: { id: string; name: string; base_price: string; primary_image?: string; image?: string };
  variant_name?: string;
  quantity: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired' | 'completed' | 'picked_up';
  expires_at: string;
  hours_left?: number;
  points_redeemed?: number;
  discount_amount?: string | number;
  created_at: string;
  updated_at: string;
  note?: string;
  vendor_note?: string;
  cancel_reason?: string;
  cancelled_by?: string;
}

const STATUS: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   icon: '⏳', color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  confirmed: { label: 'Confirmed', icon: '✅', color: 'text-green-700',   bg: 'bg-green-50 border-green-200' },
  cancelled: { label: 'Cancelled', icon: '✗',  color: 'text-red-600',     bg: 'bg-red-50 border-red-200' },
  expired:   { label: 'Expired',   icon: '⌛', color: 'text-gray-500',    bg: 'bg-gray-100 border-gray-200' },
  completed: { label: 'Completed', icon: '🎉', color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200' },
  picked_up: { label: 'Picked Up', icon: '📦', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
};

function Countdown({ expiresAt, status }: { expiresAt: string; status: string }) {
  const [left, setLeft] = useState('');
  const active = ['pending', 'confirmed'].includes(status);

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setLeft('Expired'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setLeft(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [expiresAt, status]);

  if (!active) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1.5">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"/>
      </svg>
      Expires in {left || '…'}
    </div>
  );
}

function CancelModal({ res, onConfirm, onClose, cancelError }: { res: Reservation; onConfirm: (reason: string) => void; onClose: () => void; cancelError?: boolean }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">⚠️</div>
          <h3 className="text-lg font-bold text-navy">Cancel Reservation?</h3>
          <p className="text-sm text-gray-500 mt-1">
            This will cancel your hold for <strong>{res.product.name}</strong> at {res.store.name}.
          </p>
        </div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason for cancellation (optional)"
          rows={2}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 mb-3 resize-none focus:outline-none focus:border-navy"
        />
        {cancelError && (
          <p className="text-xs text-red-500 text-center mb-3">Failed to cancel. Please try again.</p>
        )}
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
            Keep It
          </button>
          <button onClick={() => onConfirm(reason)}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors">
            Yes, Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ReservationCard({
  res,
  onCancel,
  onChat,
}: {
  res: Reservation;
  onCancel: () => void;
  onChat: () => void;
}) {
  const cfg = STATUS[res.status] ?? STATUS.pending;
  const img = res.product.primary_image ?? (res.product as any).image;
  const canCancel = ['pending', 'confirmed'].includes(res.status);
  const isActive  = canCancel;
  const price = parseFloat(res.product.base_price ?? '0');
  const historyDate = new Date(res.updated_at || res.expires_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Status bar */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${cfg.bg}`}>
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{cfg.icon}</span>
          <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
          {res.cancelled_by && <span className={`text-[10px] ${cfg.color}`}>by {res.cancelled_by}</span>}
        </div>
        <span className="text-[10px] text-gray-400">
          {new Date(res.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </span>
      </div>

      <div className="flex gap-3 p-4">
        {/* Product image */}
        <a href={`/products/${res.product.id}`} className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden shrink-0 block">
          <Img src={img} alt={res.product.name} fallback="product" loading="lazy"
            className="w-full h-full object-cover" />
        </a>

        <div className="flex-1 min-w-0">
          <a href={`/products/${res.product.id}`} className="font-bold text-navy text-sm hover:underline line-clamp-2 block">
            {res.product.name}
          </a>
          {res.variant_name && <p className="text-xs text-gray-400">{res.variant_name}</p>}
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm font-black text-navy">₹{price.toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-500">Qty: {res.quantity}</p>
          </div>

          {/* Store row */}
          <a href={`/stores/${res.store.id}`} className="flex items-center gap-1.5 mt-2 group">
            <div className="w-5 h-5 rounded-md bg-navy/10 overflow-hidden shrink-0">
              <Img src={res.store.avatar} alt={res.store.name} fallback="avatar"
                className="w-full h-full object-cover" />
            </div>
            <span className="text-xs text-gray-600 group-hover:text-navy transition-colors truncate">{res.store.name}</span>
            {res.store.locality && <span className="text-xs text-gray-400 truncate">· {res.store.locality}</span>}
          </a>

          {/* Countdown / date */}
          <div className="mt-2">
            <Countdown expiresAt={res.expires_at} status={res.status} />
            {!isActive && (
              <p className="text-xs text-gray-400">
                {['completed', 'picked_up'].includes(res.status) ? `Picked up on ${historyDate}` :
                 res.status === 'cancelled' ? `Cancelled on ${historyDate}` :
                 `Expired on ${historyDate}`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Perks */}
      {(Number(res.discount_amount) > 0 || (res.points_redeemed ?? 0) > 0) && (
        <div className="border-t border-gray-100 px-4 py-2 flex gap-4 flex-wrap">
          {Number(res.discount_amount) > 0 && (
            <span className="text-xs text-green-600 font-semibold">✓ ₹{Number(res.discount_amount).toFixed(0)} discount applied</span>
          )}
          {(res.points_redeemed ?? 0) > 0 && (
            <span className="text-xs text-amber-600 font-semibold">⭐ {res.points_redeemed} points redeemed</span>
          )}
        </div>
      )}

      {/* Vendor note */}
      {res.vendor_note && (
        <div className="border-t border-gray-100 px-4 py-2.5 bg-blue-50/50">
          <p className="text-xs"><span className="font-bold text-navy">Store note:</span> <span className="text-gray-600">{res.vendor_note}</span></p>
        </div>
      )}

      {/* Cancel reason */}
      {res.cancel_reason && (
        <div className="border-t border-gray-100 px-4 py-2 bg-red-50/40">
          <p className="text-xs"><span className="font-bold text-red-600">Reason:</span> <span className="text-gray-600">{res.cancel_reason}</span></p>
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-gray-100 p-3 flex gap-2">
        {isActive ? (
          <>
            {/* Call store */}
            {res.store.phone && (
              <a href={`tel:${res.store.phone}`}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-green-200 text-green-600 hover:bg-green-50 transition-colors shrink-0"
                title={`Call ${res.store.name}`}>
                📞
              </a>
            )}
            {/* Chat with store */}
            <button onClick={onChat}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:border-navy hover:text-navy transition-colors shrink-0"
              title="Message store">
              💬
            </button>
            <a href={`/stores/${res.store.id}`}
              className="flex-1 text-center py-2 rounded-xl border border-navy text-navy text-xs font-bold hover:bg-navy hover:text-white transition-colors">
              View Store
            </a>
            <button onClick={onCancel}
              className="flex-1 py-2 rounded-xl border border-red-200 text-red-500 text-xs font-bold hover:bg-red-50 transition-colors">
              Cancel
            </button>
          </>
        ) : (
          <>
            <a href={`/products/${res.product.id}`}
              className="flex-1 text-center py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:border-navy hover:text-navy transition-colors">
              View Product
            </a>
            <a href={`/products/${res.product.id}`}
              className="flex-1 text-center py-2 rounded-xl bg-navy text-white text-xs font-bold hover:bg-navy/90 transition-colors">
              Reserve Again
            </a>
          </>
        )}
      </div>
    </div>
  );
}

type TabT = 'active' | 'past';

function Inner() {
  const [tab, setTab] = useState<TabT>('active');
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const qc = useQueryClient();
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ns_access');

  const { data, isLoading } = useQuery({
    queryKey: ['reservations'],
    queryFn:  () => api.get('/reservations/list/').then(r => r.data),
    enabled:  isLoggedIn,
    refetchInterval: 30_000,
  });

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/reservations/${id}/cancel/`, { cancel_reason: reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      setCancelTarget(null);
    },
  });

  const startChatMut = useMutation({
    mutationFn: (storeId: string) => api.post('/conversations/start/', { store_id: storeId }),
    onSuccess: (res) => {
      window.location.href = `/customer/chat?conversation=${res.data.id}`;
    },
  });

  if (!isLoggedIn) return (
    <div className="flex flex-col items-center py-24 text-center px-6">
      <div className="w-24 h-24 rounded-full bg-navy/10 flex items-center justify-center mb-5 text-5xl">📋</div>
      <h2 className="text-xl font-black text-navy">Sign in to see your reservations</h2>
      <p className="text-gray-400 text-sm mt-2">Reserve products at local stores and track your pickups here.</p>
      <a href="/auth/login" className="mt-6 btn-primary px-10 py-3">Sign In</a>
    </div>
  );

  const all: Reservation[] = data?.results ?? (Array.isArray(data) ? data : []);
  const active = all.filter(r => ['pending', 'confirmed'].includes(r.status));
  const past   = all.filter(r => !['pending', 'confirmed'].includes(r.status));
  const shown  = tab === 'active' ? active : past;

  return (
    <div>
      {/* Header */}
      <motion.div className="mb-5" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' as const }}>
        <h1 className="text-xl font-black text-navy">My Reservations</h1>
        <p className="text-sm text-gray-400">{all.length} total reservation{all.length !== 1 ? 's' : ''}</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-5">
        {(['active', 'past'] as TabT[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-bold capitalize border-b-2 transition-all ${
              tab === t ? 'border-navy text-navy' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {t === 'active' ? `Active (${active.length})` : `History (${past.length})`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
              <div className="h-6 bg-gray-200 rounded-full w-1/3 mb-3" />
              <div className="flex gap-3">
                <div className="w-20 h-20 bg-gray-200 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded-full w-3/4" />
                  <div className="h-3 bg-gray-200 rounded-full w-1/2" />
                  <div className="h-3 bg-gray-200 rounded-full w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center px-6">
          <div className="text-6xl mb-4">{tab === 'active' ? '🎉' : '📜'}</div>
          <h3 className="font-bold text-navy text-lg">
            {tab === 'active' ? 'No active reservations' : 'No reservation history'}
          </h3>
          <p className="text-gray-400 text-sm mt-2 max-w-xs">
            {tab === 'active'
              ? 'Browse stores and reserve products to hold them for pickup.'
              : 'Your completed and cancelled reservations will appear here.'}
          </p>
          {tab === 'active' && <a href="/" className="mt-5 btn-primary px-8">Browse Stores</a>}
        </div>
      ) : (
        <motion.div className="space-y-4" variants={listContainer} initial="hidden" animate="show">
          {shown.map(r => (
            <motion.div key={r.id} variants={listItem}>
              <ReservationCard
                res={r}
                onCancel={() => setCancelTarget(r)}
                onChat={() => startChatMut.mutate(r.store.id)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Cancel confirmation modal */}
      {cancelTarget && (
        <CancelModal
          res={cancelTarget}
          onConfirm={(reason) => cancelMut.mutate({ id: cancelTarget.id, reason })}
          onClose={() => setCancelTarget(null)}
          cancelError={cancelMut.isError}
        />
      )}
    </div>
  );
}

export default function ReservationsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomerAuthGuard>
        <Inner />
      </CustomerAuthGuard>
    </QueryClientProvider>
  );
}
