import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

interface DiscountCode {
  id: string; code: string; discount_type: string;
  value: number; min_order_amount?: number;
  max_uses?: number; uses_count: number;
  is_active: boolean; valid_till?: string; valid_from?: string;
  description?: string; created_at: string;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

function AddCodeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [code, setCode]     = useState('');
  const [desc, setDesc]     = useState('');
  const [type, setType]     = useState<'percent' | 'flat'>('percent');
  const [value, setValue]   = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [maxUses, setMaxUses]   = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTill, setValidTill] = useState('');
  const [error, setError]   = useState('');

  const createMut = useMutation({
    mutationFn: () => api.post('/stores/mine/discount-codes/', {
      code: code.toUpperCase(),
      description: desc || undefined,
      discount_type: type,
      value: parseFloat(value),
      ...(minOrder ? { min_order_amount: parseFloat(minOrder) } : {}),
      ...(maxUses  ? { max_uses: parseInt(maxUses) }           : {}),
      ...(validFrom ? { valid_from: validFrom } : {}),
      ...(validTill ? { valid_till: validTill } : {}),
    }),
    onSuccess: () => onSuccess(),
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Failed to create code'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-navy">Create Discount Code</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Code</label>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. SAVE20"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Description (optional)</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Summer sale 20% off"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Type</label>
              <select value={type} onChange={e => setType(e.target.value as any)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-navy/40">
                <option value="percent">Percentage (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Value {type === 'percent' ? '(%)' : '(₹)'}
              </label>
              <input type="number" value={value} onChange={e => setValue(e.target.value)}
                placeholder={type === 'percent' ? '20' : '100'}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Min Order (₹)</label>
              <input type="number" value={minOrder} onChange={e => setMinOrder(e.target.value)} placeholder="Optional"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Max Uses</label>
              <input type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Unlimited"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Valid From</label>
              <input type="datetime-local" value={validFrom} onChange={e => setValidFrom(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Valid Till</label>
              <input type="datetime-local" value={validTill} onChange={e => setValidTill(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !code || !value}
            className="w-full btn-primary py-3 rounded-xl font-bold">
            {createMut.isPending ? 'Creating…' : 'Create Code'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Inner() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-discount-codes'],
    queryFn: () => api.get('/stores/mine/discount-codes/').then(r => r.data),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/stores/mine/discount-codes/${id}/`, { is_active: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-discount-codes'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/stores/mine/discount-codes/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-discount-codes'] }),
  });

  const codes: DiscountCode[] = Array.isArray(data) ? data : (data?.results ?? []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Discount Codes</h1>
          <p className="text-sm text-gray-400">{codes.filter(c => c.is_active).length} active codes</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm px-4 py-2 text-sm">+ New Code</button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card h-20 animate-pulse" />)}</div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : codes.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">🎟️</div>
          <p className="font-semibold text-gray-600">No discount codes yet</p>
          <button onClick={() => setShowAdd(true)} className="mt-4 btn-primary btn-sm px-6 py-2">Create your first code</button>
        </div>
      ) : (
        <div className="space-y-3">
          {codes.map(c => {
            const isExpired = c.valid_till && new Date(c.valid_till) < new Date();
            const isExhausted = c.max_uses && c.uses_count >= c.max_uses;
            return (
              <div key={c.id} className={`card p-5 ${!c.is_active || isExpired || isExhausted ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="font-mono font-black text-navy text-lg tracking-widest">{c.code}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        c.is_active && !isExpired && !isExhausted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {isExpired ? 'Expired' : isExhausted ? 'Exhausted' : c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {c.description && <p className="text-xs text-gray-400 mb-1">{c.description}</p>}
                    <p className="text-sm font-semibold text-gray-700">
                      {c.discount_type === 'percent' ? `${c.value}% off` : `₹${c.value} off`}
                      {c.min_order_amount ? ` · Min ₹${c.min_order_amount}` : ''}
                    </p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                      <span>Used: {c.uses_count}{c.max_uses ? `/${c.max_uses}` : ''} times</span>
                      {c.valid_till && <span>Expires: {fmtDate(c.valid_till)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => toggleMut.mutate({ id: c.id, active: !c.is_active })}
                      className={`relative rounded-full transition-colors`}
                      style={{ width: '40px', height: '22px', background: c.is_active ? '#1C2E4A' : '#e5e7eb' }}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${c.is_active ? 'translate-x-[18px]' : ''}`} />
                    </button>
                    <button onClick={() => { if (confirm(`Delete code ${c.code}?`)) deleteMut.mutate(c.id); }}
                      className="text-sm text-red-500 hover:text-red-700">🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddCodeModal onClose={() => setShowAdd(false)} onSuccess={() => {
          setShowAdd(false);
          qc.invalidateQueries({ queryKey: ['vendor-discount-codes'] });
        }} />
      )}
    </div>
  );
}

export default function VendorDiscountCodesIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
