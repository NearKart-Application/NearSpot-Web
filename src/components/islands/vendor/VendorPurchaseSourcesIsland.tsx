import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';
import { Button } from '@/components/ui/button';

const MARKET_TYPE_LABELS: Record<string, string> = {
  informal:  'Informal / Street Market',
  wholesale: 'Wholesale Market',
  mandi:     'Mandi / Agricultural Market',
  direct:    'Direct from Farmer',
  online:    'Online Supplier',
  formal:    'Formal Distributor',
};

interface PurchaseSource {
  id: string;
  name: string;
  market_type: string;
  contact_name: string;
  phone: string;
  address: string;
  notes: string;
  is_active: boolean;
}

const EMPTY_FORM = {
  name: '',
  market_type: 'informal',
  contact_name: '',
  phone: '',
  address: '',
  notes: '',
};

function SourceModal({
  initial,
  onClose,
  onSuccess,
}: {
  initial?: PurchaseSource;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState(
    initial
      ? {
          name: initial.name,
          market_type: initial.market_type,
          contact_name: initial.contact_name ?? '',
          phone: initial.phone ?? '',
          address: initial.address ?? '',
          notes: initial.notes ?? '',
        }
      : EMPTY_FORM,
  );
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () =>
      initial
        ? api.patch(`/inventory/purchase-sources/${initial.id}/`, form)
        : api.post('/inventory/purchase-sources/', form),
    onSuccess: () => onSuccess(),
    onError: (e: any) =>
      setError(
        e?.response?.data?.detail ?? JSON.stringify(e?.response?.data) ?? 'Failed to save',
      ),
  });

  function field(key: keyof typeof form, label: string, opts?: { type?: string }) {
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <input
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          type={opts?.type ?? 'text'}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-bold text-navy text-lg">
          {initial ? 'Edit Purchase Source' : 'New Purchase Source'}
        </h3>

        {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        {field('name', 'Source Name *')}

        <div>
          <label className="block text-xs text-gray-500 mb-1">Market Type</label>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            value={form.market_type}
            onChange={e => setForm(f => ({ ...f, market_type: e.target.value }))}
          >
            {Object.entries(MARKET_TYPE_LABELS).map(([val, lbl]) => (
              <option key={val} value={val}>{lbl}</option>
            ))}
          </select>
        </div>

        {field('contact_name', 'Contact Name')}
        {field('phone', 'Phone')}
        {field('address', 'Address')}

        <div>
          <label className="block text-xs text-gray-500 mb-1">Notes</label>
          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            rows={3}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => { if (!form.name.trim()) { setError('Name is required'); return; } mut.mutate(); }}
            disabled={mut.isPending}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-60"
          >
            {mut.isPending ? 'Saving…' : initial ? 'Save Changes' : 'Add Source'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PurchaseSourcesContent() {
  const qc = useQueryClient();
  const { data: sources = [], isLoading, error, refetch } = useQuery<PurchaseSource[]>({
    queryKey: ['purchase-sources'],
    queryFn: () => api.get('/inventory/purchase-sources/').then(r => r.data),
  });

  const [modal, setModal] = useState<{ open: boolean; source?: PurchaseSource }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<PurchaseSource | null>(null);
  const [msg, setMsg] = useState('');

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/purchase-sources/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-sources'] });
      setDeleteTarget(null);
      flash('Purchase source removed');
    },
  });

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(''), 3000);
  }

  function handleSuccess() {
    setModal({ open: false });
    qc.invalidateQueries({ queryKey: ['purchase-sources'] });
    flash(modal.source ? 'Source updated' : 'Source added');
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) return <IslandError error={error} refetch={refetch} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy">Purchase Sources</h2>
          <p className="text-sm text-gray-500 mt-0.5">Track where you buy stock — mandis, markets, suppliers</p>
        </div>
        <Button
          onClick={() => setModal({ open: true })}
          className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
        >
          + Add Source
        </Button>
      </div>

      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm font-medium">
          {msg}
        </div>
      )}

      {sources.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🏪</p>
          <p className="font-medium">No purchase sources yet</p>
          <p className="text-sm mt-1">Add the markets, mandis, and suppliers you source from</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map(src => (
            <div key={src.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-navy">{src.name}</p>
                  <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    {MARKET_TYPE_LABELS[src.market_type] ?? src.market_type}
                  </span>
                </div>
              </div>
              {src.contact_name && (
                <p className="text-sm text-gray-600 mt-2">
                  <span className="text-gray-400">Contact:</span> {src.contact_name}
                </p>
              )}
              {src.phone && (
                <p className="text-sm text-gray-600">
                  <span className="text-gray-400">Phone:</span> {src.phone}
                </p>
              )}
              {src.address && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{src.address}</p>
              )}
              {src.notes && (
                <p className="text-xs text-gray-400 mt-2 italic line-clamp-2">{src.notes}</p>
              )}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setModal({ open: true, source: src })}
                  className="flex-1 text-xs border border-gray-200 rounded-lg py-1.5 text-gray-600 hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(src)}
                  className="flex-1 text-xs border border-red-100 rounded-lg py-1.5 text-red-500 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <SourceModal
          initial={modal.source}
          onClose={() => setModal({ open: false })}
          onSuccess={handleSuccess}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-navy">Remove Source?</h3>
            <p className="text-sm text-gray-500">
              Remove <strong>{deleteTarget.name}</strong>? This will hide it from your list.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(deleteTarget.id)}
                disabled={deleteMut.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-60"
              >
                {deleteMut.isPending ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VendorPurchaseSourcesIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <VendorAuthGuard>
        <PurchaseSourcesContent />
      </VendorAuthGuard>
    </QueryClientProvider>
  );
}
