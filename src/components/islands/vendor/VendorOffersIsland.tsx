import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

interface Offer {
  id: string; title: string; description?: string; offer_type?: string;
  discount_pct?: number; discount_flat?: number; image_url?: string;
  valid_from?: string; valid_till?: string; is_active: boolean; created_at?: string;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

function AddOfferModal({ storeId, onClose, onSuccess }: { storeId: string; onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle]       = useState('');
  const [desc, setDesc]         = useState('');
  const [offerType, setOfferType] = useState('percentage');
  const [discPct, setDiscPct]   = useState('');
  const [discFlat, setDiscFlat] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [error, setError] = useState('');

  const createMut = useMutation({
    mutationFn: () => api.post(`/stores/${storeId}/offers/`, {
      title, description: desc, offer_type: offerType,
      ...(offerType === 'percentage' ? { discount_pct: parseFloat(discPct) } : { discount_flat: parseFloat(discFlat) }),
      ...(validFrom ? { valid_from: validFrom } : {}),
      ...(validUntil ? { valid_till: validUntil } : {}),
    }),
    onSuccess: () => onSuccess(),
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Failed to create offer'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-navy">Create Offer</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Summer Sale 20% Off"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Description (optional)</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-navy/40" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Type</label>
              <select value={offerType} onChange={e => setOfferType(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none">
                <option value="percentage">Percentage Off</option>
                <option value="flat">Flat Amount Off</option>
                <option value="bogo">Buy 1 Get 1</option>
                <option value="bundle">Bundle Deal</option>
              </select>
            </div>
            {offerType === 'percentage' && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Discount %</label>
                <input type="number" value={discPct} onChange={e => setDiscPct(e.target.value)} placeholder="20"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none" />
              </div>
            )}
            {offerType === 'flat' && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Amount (₹)</label>
                <input type="number" value={discFlat} onChange={e => setDiscFlat(e.target.value)} placeholder="100"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Valid From</label>
              <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Valid Until</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none" />
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !title || !validFrom || !validUntil}
            className="w-full btn-primary py-3 rounded-xl font-bold">
            {createMut.isPending ? 'Creating…' : 'Create Offer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Inner() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data: storeData } = useQuery({
    queryKey: ['vendor-store-id'],
    queryFn: () => api.get('/stores/mine/').then(r => r.data),
  });
  const storeId: string = (storeData as any)?.id ?? '';

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-offers', storeId],
    queryFn: () => api.get(`/stores/${storeId}/offers/`).then(r => r.data),
    enabled: !!storeId,
  });

  const deleteMut = useMutation({
    mutationFn: (offerId: string) => api.delete(`/stores/${storeId}/offers/${offerId}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-offers', storeId] }),
  });

  const offers: Offer[] = data?.results ?? (Array.isArray(data) ? data : []);
  const now = new Date();
  const active = offers.filter(o => o.is_active && new Date(o.valid_till ?? '') >= now);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Offers</h1>
          <p className="text-sm text-gray-400">{active.length} active offer{active.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm px-4 py-2 text-sm">+ New Offer</button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card h-24 animate-pulse" />)}</div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : offers.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">🏷️</div>
          <p className="font-semibold text-gray-600">No offers yet</p>
          <p className="text-sm mt-1">Create offers to attract more customers</p>
          <button onClick={() => setShowAdd(true)} className="mt-4 btn-primary btn-sm px-6 py-2">Create your first offer</button>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map(offer => {
            const expired = offer.valid_till ? new Date(offer.valid_till) < now : false;
            return (
              <div key={offer.id} className={`card p-5 ${expired ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-navy">{offer.title}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        expired ? 'bg-gray-100 text-gray-500' : offer.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {expired ? 'Expired' : offer.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {offer.description && <p className="text-sm text-gray-500 mb-2">{offer.description}</p>}
                    <div className="flex gap-4 text-xs text-gray-400">
                      {offer.discount_pct ? <span className="font-semibold text-green-600">{offer.discount_pct}% off</span> : null}
                      {offer.discount_flat ? <span className="font-semibold text-green-600">₹{offer.discount_flat} off</span> : null}
                      <span>{offer.valid_from ? fmtDate(offer.valid_from) : '—'} – {offer.valid_till ? fmtDate(offer.valid_till) : '—'}</span>
                    </div>
                  </div>
                  <button onClick={() => { if (confirm(`Delete "${offer.title}"?`)) deleteMut.mutate(offer.id); }}
                    className="text-sm text-red-500 hover:text-red-700 shrink-0">🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && storeId && (
        <AddOfferModal storeId={storeId} onClose={() => setShowAdd(false)} onSuccess={() => {
          setShowAdd(false);
          qc.invalidateQueries({ queryKey: ['vendor-offers', storeId] });
        }} />
      )}
    </div>
  );
}

export default function VendorOffersIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
