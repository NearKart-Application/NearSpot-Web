import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomerAuthGuard } from './CustomerAuthGuard';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';

const list  = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item  = { hidden: { opacity: 0, y: 16, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: 'easeOut' as const } } };

type Status = 'pending' | 'confirmed' | 'cancelled' | 'expired' | 'completed' | 'picked_up';

interface Reservation {
  id: string;
  store: { id: string; name: string; locality?: string; avatar?: string };
  product: { id: string; name: string; base_price: string; primary_image?: string };
  variant_name?: string;
  quantity: number;
  status: Status;
  expires_at: string;
  created_at: string;
  points_redeemed?: number;
  discount_amount?: string | number;
  cancel_reason?: string;
  cancelled_by?: string;
  vendor_note?: string;
  note?: string;
}

interface ListResponse { results: Reservation[]; count: number; }

const STATUS_MAP: Record<string, { label: string; emoji: string; pill: string }> = {
  pending:   { label: 'Pending',   emoji: '⏳', pill: 'bg-amber-100 text-amber-800 border-amber-200' },
  confirmed: { label: 'Confirmed', emoji: '✅', pill: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { label: 'Cancelled', emoji: '✗',  pill: 'bg-red-100 text-red-700 border-red-200' },
  expired:   { label: 'Expired',   emoji: '⌛', pill: 'bg-gray-100 text-gray-600 border-gray-200' },
  completed: { label: 'Completed', emoji: '🎉', pill: 'bg-blue-100 text-blue-700 border-blue-200' },
  picked_up: { label: 'Picked Up', emoji: '📦', pill: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

const ALL_STATUSES = ['all', 'pending', 'confirmed', 'completed', 'picked_up', 'cancelled', 'expired'];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function CancelModal({ res, onConfirm, onClose }: { res: Reservation; onConfirm: (r: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">⚠️</div>
          <h3 className="text-lg font-bold text-navy">Cancel Reservation?</h3>
          <p className="text-sm text-gray-500 mt-1">
            Cancel your hold for <strong>{res.product.name}</strong> at {res.store.name}.
          </p>
        </div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason (optional)"
          rows={3}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-navy/30 mb-4"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">
            Keep it
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-bold"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ReservationCard({ res, onCancel }: { res: Reservation; onCancel: () => void }) {
  const s = STATUS_MAP[res.status] ?? { label: res.status, emoji: '•', pill: 'bg-gray-100 text-gray-600 border-gray-200' };
  const canCancel = ['pending', 'confirmed'].includes(res.status);

  return (
    <motion.div variants={item} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex gap-4 p-4">
        {res.product.primary_image ? (
          <img src={res.product.primary_image} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-gray-100" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-navy/5 flex items-center justify-center flex-shrink-0 text-2xl">🛍</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-navy text-sm leading-tight truncate">{res.product.name}</p>
              {res.variant_name && <p className="text-xs text-gray-400 mt-0.5">{res.variant_name}</p>}
            </div>
            <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${s.pill}`}>
              {s.emoji} {s.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1.5 truncate">📍 {res.store.name}{res.store.locality ? ` · ${res.store.locality}` : ''}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm font-bold text-navy">₹{parseFloat(res.product.base_price).toLocaleString('en-IN')} × {res.quantity}</span>
            <span className="text-xs text-gray-400">{fmt(res.created_at)}</span>
          </div>
          {(res.points_redeemed ?? 0) > 0 && (
            <p className="text-xs text-amber-600 mt-1">⭐ {res.points_redeemed} points redeemed</p>
          )}
        </div>
      </div>

      {(res.vendor_note || res.cancel_reason) && (
        <div className="px-4 pb-3">
          {res.vendor_note && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">💬 {res.vendor_note}</p>}
          {res.cancel_reason && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mt-1">Reason: {res.cancel_reason}</p>}
        </div>
      )}

      {canCancel && (
        <div className="px-4 pb-4">
          <button
            onClick={onCancel}
            className="w-full py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors"
          >
            Cancel Reservation
          </button>
        </div>
      )}
    </motion.div>
  );
}

function Inner() {
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ns_access');
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<ListResponse>({
    queryKey: ['purchase-history', statusFilter],
    queryFn: () => api.get('/reservations/list/', { params: statusFilter !== 'all' ? { status: statusFilter } : {} }).then(r => r.data),
    enabled: isLoggedIn,
  });

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/reservations/${id}/cancel/`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-history'] });
      setCancelTarget(null);
    },
  });

  const reservations = data?.results ?? [];
  const total = data?.count ?? 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-black text-navy">Purchase History</h1>
        <p className="text-sm text-gray-500 mt-1">Your reservations and pick-ups</p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
        {ALL_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              statusFilter === s
                ? 'bg-navy text-white border-navy'
                : 'bg-white text-gray-600 border-gray-200 hover:border-navy/30'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_MAP[s]?.label ?? s}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-16 h-16 bg-gray-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-3">Failed to load purchase history</p>
          <button onClick={() => refetch()} className="px-6 py-2 bg-navy text-white rounded-xl text-sm font-bold">Retry</button>
        </div>
      )}

      {!isLoading && !isError && reservations.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🛍</div>
          <h3 className="text-navy font-bold text-lg">No reservations yet</h3>
          <p className="text-gray-400 text-sm mt-1">Start shopping to see your purchase history here</p>
          <a href="/" className="inline-block mt-5 px-8 py-3 bg-navy text-white rounded-2xl text-sm font-bold">Explore Stores</a>
        </div>
      )}

      {!isLoading && reservations.length > 0 && (
        <>
          <p className="text-xs text-gray-400 mb-3">{total} total reservation{total !== 1 ? 's' : ''}</p>
          <motion.div className="space-y-3" variants={list} initial="hidden" animate="show">
            {reservations.map(r => (
              <ReservationCard key={r.id} res={r} onCancel={() => setCancelTarget(r)} />
            ))}
          </motion.div>
        </>
      )}

      <AnimatePresence>
        {cancelTarget && (
          <CancelModal
            res={cancelTarget}
            onClose={() => setCancelTarget(null)}
            onConfirm={reason => cancelMut.mutate({ id: cancelTarget.id, reason })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CustomerPurchaseHistoryIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomerAuthGuard>
        <Inner />
      </CustomerAuthGuard>
    </QueryClientProvider>
  );
}
