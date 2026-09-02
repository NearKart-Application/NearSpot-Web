import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';
import { Button } from '@/components/ui/button';

const CATEGORY_OPTIONS = [
  { value: 'weight', label: 'Weight (kg, g, lb…)' },
  { value: 'volume', label: 'Volume (L, ml, fl oz…)' },
  { value: 'count',  label: 'Count / Unit (piece, dozen…)' },
  { value: 'length', label: 'Length (m, cm, inch…)' },
];

interface UoM {
  id: string; name: string; symbol: string; category: string;
  conversion_factor: string; is_base_unit: boolean; notes: string;
}

const EMPTY_FORM = {
  name: '', symbol: '', category: 'count', conversion_factor: '1.000000',
  is_base_unit: false, notes: '',
};

function UomModal({
  initial, onClose, onSuccess,
}: { initial?: UoM; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState(
    initial
      ? { name: initial.name, symbol: initial.symbol, category: initial.category,
          conversion_factor: initial.conversion_factor, is_base_unit: initial.is_base_unit, notes: initial.notes }
      : EMPTY_FORM,
  );
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () =>
      initial ? api.patch(`/inventory/uom/${initial.id}/`, form) : api.post('/inventory/uom/', form),
    onSuccess: () => onSuccess(),
    onError: (e: any) =>
      setError(e?.response?.data?.detail ?? JSON.stringify(e?.response?.data) ?? 'Failed to save'),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-bold text-navy text-lg">{initial ? 'Edit Unit' : 'New Unit of Measure'}</h3>
        {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Unit Name *</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Kilogram" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Symbol *</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} placeholder="kg" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Category</label>
          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Conversion Factor</label>
          <input type="number" step="any" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            value={form.conversion_factor}
            onChange={e => setForm(f => ({ ...f, conversion_factor: e.target.value }))} />
          <p className="text-xs text-gray-400 mt-1">Relative to the base unit of this category (e.g. 1000 for gram vs kilogram)</p>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.is_base_unit}
            onChange={e => setForm(f => ({ ...f, is_base_unit: e.target.checked }))} />
          Base unit of this category
        </label>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Notes</label>
          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => { if (!form.name.trim() || !form.symbol.trim()) { setError('Name and symbol required'); return; } mut.mutate(); }}
            disabled={mut.isPending}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-60">
            {mut.isPending ? 'Saving…' : initial ? 'Save Changes' : 'Add Unit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UnitsContent() {
  const qc = useQueryClient();
  const { data: units = [], isLoading, error, refetch } = useQuery<UoM[]>({
    queryKey: ['uom'],
    queryFn: () => api.get('/inventory/uom/').then(r => r.data),
  });

  const [modal, setModal] = useState<{ open: boolean; uom?: UoM }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<UoM | null>(null);
  const [msg, setMsg] = useState('');

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/uom/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uom'] });
      setDeleteTarget(null);
      flash('Unit removed');
    },
    onError: (e: any) => flash(e?.response?.data?.error ?? 'Cannot delete this unit'),
  });

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000); }

  function handleSuccess() {
    setModal({ open: false });
    qc.invalidateQueries({ queryKey: ['uom'] });
    flash(modal.uom ? 'Unit updated' : 'Unit added');
  }

  const grouped = CATEGORY_OPTIONS.map(c => ({
    ...c,
    items: units.filter(u => u.category === c.value),
  })).filter(g => g.items.length > 0);

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error) return <IslandError error={error} refetch={refetch} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy">Units of Measure</h2>
          <p className="text-sm text-gray-500 mt-0.5">Define units for stock quantities (kg, litre, piece, meter…)</p>
        </div>
        <Button onClick={() => setModal({ open: true })} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl">
          + Add Unit
        </Button>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm font-medium">{msg}</div>}

      {units.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">⚖️</p>
          <p className="font-medium">No units defined yet</p>
          <p className="text-sm mt-1">Add kg, litre, piece, meter — whatever your products are measured in</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.value}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">{group.label}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map(u => (
                  <div key={u.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-amber-500">{u.symbol}</span>
                        <span className="text-sm font-semibold text-navy">{u.name}</span>
                        {u.is_base_unit && (
                          <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5 font-medium">Base</span>
                        )}
                      </div>
                      {u.notes && <p className="text-xs text-gray-400 mt-1">{u.notes}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">Factor: {u.conversion_factor}</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => setModal({ open: true, uom: u })}
                        className="text-xs border border-gray-200 rounded-lg px-2.5 py-1 text-gray-600 hover:bg-gray-50">Edit</button>
                      {!u.is_base_unit && (
                        <button onClick={() => setDeleteTarget(u)}
                          className="text-xs border border-red-100 rounded-lg px-2.5 py-1 text-red-500 hover:bg-red-50">Delete</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <UomModal initial={modal.uom} onClose={() => setModal({ open: false })} onSuccess={handleSuccess} />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-navy">Delete Unit?</h3>
            <p className="text-sm text-gray-500">Delete <strong>{deleteTarget.name} ({deleteTarget.symbol})</strong>?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={() => deleteMut.mutate(deleteTarget.id)} disabled={deleteMut.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-60">
                {deleteMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VendorUnitsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <VendorAuthGuard>
        <UnitsContent />
      </VendorAuthGuard>
    </QueryClientProvider>
  );
}
