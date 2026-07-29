import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';
import Img from '../../ui/Img';

interface Reservation {
  id: string;
  customer_name?: string; customer_phone?: string;
  product: { id: string; name: string; primary_image?: string; base_price: string };
  variant_name?: string; quantity: number;
  status: string; expires_at: string; created_at: string;
  note?: string; vendor_note?: string; cancel_reason?: string;
}

const STATUS_META: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  pending:   { label: 'Pending',   icon: '⏳', bg: 'bg-amber-50 border-amber-200',   text: 'text-amber-700' },
  confirmed: { label: 'Confirmed', icon: '✅', bg: 'bg-green-50 border-green-200',   text: 'text-green-700' },
  cancelled: { label: 'Cancelled', icon: '✗',  bg: 'bg-red-50 border-red-200',       text: 'text-red-600' },
  expired:   { label: 'Expired',   icon: '⌛', bg: 'bg-gray-100 border-gray-200',    text: 'text-gray-500' },
  completed: { label: 'Completed', icon: '🎉', bg: 'bg-blue-50 border-blue-200',     text: 'text-blue-600' },
  picked_up: { label: 'Picked Up', icon: '📦', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function timeLeft(expires: string) {
  const diff = new Date(expires).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

type DialogAction = 'confirm' | 'reject' | 'complete' | 'cancel';

function ActionDialog({ action, customerName, onConfirm, onClose }: {
  action: DialogAction; customerName: string;
  onConfirm: (note: string) => void; onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(false);
  const needsNote = action === 'reject' || action === 'cancel';
  const isConfirm = action === 'confirm';
  const QUICK_NOTES = ['Getting ready — come in 10 mins', 'Ready in 15 mins', 'Ready in 20 mins', 'Come anytime, item is ready'];

  const titles: Record<DialogAction, string> = {
    confirm: 'Confirm Reservation', reject: 'Reject Reservation',
    complete: 'Mark Completed', cancel: 'Emergency Cancellation',
  };
  const bodies: Record<DialogAction, string> = {
    confirm: `Confirm hold for ${customerName || 'this customer'}? Add a readiness message to send them.`,
    reject: 'Reject this reservation? The customer will be notified with your reason.',
    complete: 'Mark as completed? Customer will earn 20 loyalty points for picking up.',
    cancel: 'Emergency cancel this confirmed reservation? The customer will be notified with your reason.',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="font-bold text-navy mb-2">{titles[action]}</h3>
        <p className="text-sm text-gray-600 mb-4">{bodies[action]}</p>
        {isConfirm && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">Quick message to customer:</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {QUICK_NOTES.map(q => (
                <button key={q} onClick={() => setNote(q)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${note === q ? 'bg-navy text-white border-navy' : 'border-gray-200 text-gray-600 hover:border-navy'}`}>
                  {q}
                </button>
              ))}
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="Or type a custom message…"
              rows={2} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:border-navy/40" />
          </div>
        )}
        {needsNote && (
          <div className="mb-4">
            <textarea value={note} onChange={e => { setNote(e.target.value); setNoteError(false); }}
              placeholder={`Reason for ${action === 'cancel' ? 'cancellation' : 'rejection'}…`}
              rows={3} className={`w-full rounded-xl border px-3 py-2 text-sm resize-none focus:outline-none ${noteError ? 'border-red-400' : 'border-gray-200 focus:border-navy/40'}`} />
            {noteError && <p className="text-xs text-red-500 mt-1">Please enter a reason before {action === 'cancel' ? 'cancelling' : 'rejecting'}</p>}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={() => {
            if (needsNote && !note.trim()) { setNoteError(true); return; }
            onConfirm(note);
          }} className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${action === 'reject' || action === 'cancel' ? 'btn-danger' : 'btn-primary'}`}>
            {action === 'cancel' ? 'Cancel Reservation' : action === 'reject' ? 'Reject' : action === 'complete' ? 'Mark Completed' : 'Confirm'}
          </button>
          <button onClick={onClose} className="flex-1 btn-outline py-2.5 rounded-xl text-sm font-bold">Dismiss</button>
        </div>
      </div>
    </div>
  );
}

function ReservationCard({ res, onUpdate }: { res: Reservation; onUpdate: () => void }) {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<DialogAction | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const meta = STATUS_META[res.status] ?? STATUS_META.pending;

  const updateStatus = useMutation({
    mutationFn: ({ status, vendor_note }: { status: string; vendor_note?: string }) =>
      api.patch(`/reservations/${res.id}/status/`, { status, ...(vendor_note ? { vendor_note } : {}) }),
    onSuccess: () => { setDialog(null); qc.invalidateQueries({ queryKey: ['vendor-reservations'] }); onUpdate(); },
  });

  const price = parseFloat(res.product.base_price ?? '0');
  const statusToSend: Record<DialogAction, string> = {
    confirm: 'confirmed', reject: 'cancelled', complete: 'completed', cancel: 'cancelled',
  };

  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden shrink-0">
          <Img src={res.product.primary_image} alt={res.product.name} fallback="product" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-navy line-clamp-1">{res.product.name}</h3>
              {res.variant_name && <p className="text-xs text-gray-400">{res.variant_name}</p>}
              <p className="text-sm font-semibold text-gray-700 mt-0.5">
                Qty: {res.quantity} · ₹{(price * res.quantity).toLocaleString('en-IN')}
              </p>
            </div>
            <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${meta.bg} ${meta.text}`}>
              {meta.icon} {meta.label}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
            {res.customer_name && <span>👤 {res.customer_name}</span>}
            {res.customer_phone && (
              <a href={`tel:${res.customer_phone}`} className="text-navy hover:underline">📞 {res.customer_phone}</a>
            )}
            <span>📅 {fmtDate(res.created_at)}</span>
            {['pending', 'confirmed'].includes(res.status) && (
              <span className="text-amber-600 font-semibold">⏰ {timeLeft(res.expires_at)}</span>
            )}
          </div>
          {res.note && <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">Customer note: {res.note}</p>}
          {res.vendor_note && <p className="mt-2 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">Your note: {res.vendor_note}</p>}
        </div>
      </div>

      {/* Actions — pending */}
      {res.status === 'pending' && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
          <button onClick={() => setDialog('confirm')} disabled={updateStatus.isPending}
            className="flex-1 btn-primary btn-sm py-2">✅ Confirm</button>
          <button onClick={() => setDialog('reject')} disabled={updateStatus.isPending}
            className="flex-1 btn-danger btn-sm py-2">✗ Reject</button>
          <button onClick={() => setShowNote(v => !v)} className="btn-outline btn-sm px-3 py-2">📝</button>
        </div>
      )}
      {/* Actions — confirmed */}
      {res.status === 'confirmed' && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
          <button onClick={() => setDialog('complete')} disabled={updateStatus.isPending}
            className="flex-1 btn-primary btn-sm py-2">✅ Mark Completed</button>
          <button onClick={() => setDialog('cancel')} disabled={updateStatus.isPending}
            className="flex-1 btn-danger btn-sm py-2">⚠️ Emergency Cancel</button>
          <button onClick={() => setShowNote(v => !v)} className="btn-outline btn-sm px-3 py-2">📝</button>
        </div>
      )}

      {/* Vendor note input */}
      {showNote && (
        <div className="mt-3 flex gap-2">
          <input value={noteInput} onChange={e => setNoteInput(e.target.value)}
            placeholder="Add vendor note to customer…"
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-navy/40" />
          <button onClick={() => {
            api.patch(`/reservations/${res.id}/status/`, { status: res.status, vendor_note: noteInput }).then(() => {
              setShowNote(false); setNoteInput(''); qc.invalidateQueries({ queryKey: ['vendor-reservations'] });
            });
          }} className="btn-primary btn-sm px-4">Send</button>
        </div>
      )}

      {/* Confirm dialog */}
      {dialog && (
        <ActionDialog action={dialog} customerName={res.customer_name ?? ''}
          onClose={() => setDialog(null)}
          onConfirm={note => updateStatus.mutate({ status: statusToSend[dialog], vendor_note: note || undefined })}
        />
      )}
    </div>
  );
}

type TabT = 'pending' | 'confirmed' | 'cancelled' | 'all';

function Inner() {
  const [tab, setTab] = useState<TabT>('pending');
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-reservations'],
    queryFn:  () => api.get('/reservations/list/', { params: { role: 'vendor', page_size: 100 } }).then(r => r.data),
    refetchInterval: 30_000,
  });

  const reservations: Reservation[] = data?.results ?? (Array.isArray(data) ? data : []);

  const counts = {
    pending:   reservations.filter(r => r.status === 'pending').length,
    confirmed: reservations.filter(r => r.status === 'confirmed').length,
    cancelled: reservations.filter(r => r.status === 'cancelled').length,
    all:       reservations.length,
  };

  const shown = tab === 'all' ? reservations : reservations.filter(r => r.status === tab);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Reservations</h1>
        <p className="text-sm text-gray-400">
          {counts.pending} pending · {counts.confirmed} confirmed
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {([['pending', 'Pending'], ['confirmed', 'Confirmed'], ['cancelled', 'Cancelled'], ['all', 'All']] as [TabT, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab === t ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {label} {(counts[t] ?? 0) > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${tab === t ? 'bg-white/20' : 'bg-navy/10 text-navy'}`}>{counts[t]}</span>}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="card p-5 animate-pulse h-32" />)}
        </div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : shown.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">📋</div>
          <p className="font-semibold text-gray-600">No {tab !== 'all' ? tab : ''} reservations</p>
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map(r => <ReservationCard key={r.id} res={r} onUpdate={() => qc.invalidateQueries({ queryKey: ['vendor-reservations'] })} />)}
        </div>
      )}
    </div>
  );
}

export default function VendorReservationsIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
