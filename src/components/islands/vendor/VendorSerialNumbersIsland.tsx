import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';
import { Button } from '@/components/ui/button';

interface SerialNumber {
  id: string;
  serial_number: string;
  status: string;
  product?: { id: string; name: string };
  variant?: { id: string; name: string };
  notes?: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  sold:      'bg-gray-100 text-gray-600',
  returned:  'bg-amber-100 text-amber-700',
  defective: 'bg-red-100 text-red-700',
};

function Inner() {
  const [form, setForm] = useState({ serial_number: '', product_id: '', notes: '', status: 'available' });
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['serial-numbers'],
    queryFn: () => api.get('/inventory/serial-numbers/').then(r => r.data),
  });

  const { data: productsData } = useQuery({
    queryKey: ['vendor-products-all'],
    queryFn: () => api.get('/products/vendor/', { params: { page_size: 200 } }).then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post('/inventory/serial-numbers/', {
      serial_number: form.serial_number.trim(),
      product: form.product_id || undefined,
      notes: form.notes.trim() || undefined,
      status: form.status,
    }),
    onSuccess: () => {
      refetch();
      setAdding(false);
      setForm({ serial_number: '', product_id: '', notes: '', status: 'available' });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/serial-numbers/${id}/`),
    onSuccess: () => refetch(),
  });

  const allSerials: SerialNumber[] = data?.results ?? (Array.isArray(data) ? data : []);
  const serials = allSerials.filter(sn =>
    (!statusFilter || sn.status === statusFilter) &&
    (!search || sn.serial_number.toLowerCase().includes(search.toLowerCase()) ||
      (sn.product?.name ?? '').toLowerCase().includes(search.toLowerCase()))
  );
  const products = productsData?.results ?? [];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">Serial Numbers</h2>
          <p className="text-sm text-gray-400 mt-0.5">Track IMEI numbers, tag numbers, and unit-level IDs</p>
        </div>
        <Button onClick={() => setAdding(true)} className="px-5 py-2.5 rounded-xl font-bold text-sm">
          + Add Serial Number
        </Button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="card p-5 space-y-3">
          <h4 className="font-bold text-navy text-sm">New Serial Number</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Serial Number *</label>
              <input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                placeholder="SN123456789" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-navy/40" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none">
                {['available', 'sold', 'returned', 'defective'].map(s =>
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                )}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Product</label>
            <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none">
              <option value="">— Select product (optional) —</option>
              {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="IMEI, tag number, etc." className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none" />
          </div>
          {createMut.isError && (
            <p className="text-xs text-red-600 font-semibold">
              {(createMut.error as any)?.response?.data?.serial_number?.[0]
                ?? (createMut.error as any)?.response?.data?.detail
                ?? 'Failed to save. Please try again.'}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.serial_number.trim()} className="flex-1">
              {createMut.isPending ? 'Saving…' : 'Save'}
            </Button>
            <button onClick={() => setAdding(false)}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search serial # or product…"
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-navy/40 w-56" />
        <div className="flex gap-2">
          {['', 'available', 'sold', 'returned', 'defective'].map(s => (
            <button key={s || 'all'} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                statusFilter === s ? 'bg-navy text-white border-navy' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 font-semibold">{serials.length} serial number{serials.length !== 1 ? 's' : ''}</p>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="card h-14 animate-pulse" />)}</div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : serials.length === 0 ? (
        <div className="card p-14 text-center text-gray-400">
          <div className="text-4xl mb-3">🔢</div>
          <p className="font-semibold text-gray-600">No serial numbers found</p>
          <p className="text-sm mt-1">Add IMEI numbers, tag numbers, or any unit-level IDs</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Serial #', 'Product', 'Status', 'Notes', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {serials.map(sn => (
                <tr key={sn.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-navy font-semibold">{sn.serial_number}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{sn.product?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold capitalize ${STATUS_COLORS[sn.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {sn.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{sn.notes ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { if (confirm('Delete this serial number?')) deleteMut.mutate(sn.id); }}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function VendorSerialNumbersIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
