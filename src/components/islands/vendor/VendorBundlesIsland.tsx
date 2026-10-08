import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';
import { Button } from '@/components/ui/button';

interface Bundle {
  id: string;
  name: string;
  description?: string;
  components: { product: { id: string; name: string }; quantity: number }[];
  created_at: string;
}

function Inner() {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', components: [{ product_id: '', quantity: '1' }] });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['bundles'],
    queryFn: () => api.get('/inventory/bundles/').then(r => r.data),
  });

  const { data: productsData } = useQuery({
    queryKey: ['vendor-products-all'],
    queryFn: () => api.get('/products/vendor/', { params: { page_size: 200 } }).then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post('/inventory/bundles/', {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      components: form.components
        .filter(c => c.product_id)
        .map(c => ({ product: c.product_id, quantity: parseInt(c.quantity) || 1 })),
    }),
    onSuccess: () => {
      refetch();
      setShowAdd(false);
      setForm({ name: '', description: '', components: [{ product_id: '', quantity: '1' }] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/bundles/${id}/`),
    onSuccess: () => refetch(),
  });

  const bundles: Bundle[] = data?.results ?? (Array.isArray(data) ? data : []);
  const products = productsData?.results ?? [];

  const addComponent    = () => setForm(f => ({ ...f, components: [...f.components, { product_id: '', quantity: '1' }] }));
  const removeComponent = (i: number) => setForm(f => ({ ...f, components: f.components.filter((_, j) => j !== i) }));
  const setComponent    = (i: number, key: 'product_id' | 'quantity', val: string) =>
    setForm(f => ({ ...f, components: f.components.map((c, j) => j === i ? { ...c, [key]: val } : c) }));

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">Bundles</h2>
          <p className="text-sm text-gray-400 mt-0.5">Group products into combos or bundle deals</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="px-5 py-2.5 rounded-xl font-bold text-sm">
          + Create Bundle
        </Button>
      </div>

      {/* Create form */}
      {showAdd && (
        <div className="card p-5 space-y-4">
          <h4 className="font-bold text-navy text-sm">New Bundle / Combo</h4>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Bundle Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Phone + Cover Combo"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-navy/40" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional description"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Components</label>
            <div className="space-y-2">
              {form.components.map((comp, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={comp.product_id} onChange={e => setComponent(i, 'product_id', e.target.value)}
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none">
                    <option value="">— Select product —</option>
                    {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" min="1" value={comp.quantity}
                    onChange={e => setComponent(i, 'quantity', e.target.value)}
                    className="w-16 rounded-xl border border-gray-200 px-3 py-2 text-sm text-center focus:outline-none" />
                  {form.components.length > 1 && (
                    <button onClick={() => removeComponent(i)} className="text-red-400 hover:text-red-600 text-lg font-bold">×</button>
                  )}
                </div>
              ))}
              <button onClick={addComponent} className="text-xs text-navy font-semibold hover:underline">
                + Add component
              </button>
            </div>
          </div>
          {createMut.isError && (
            <p className="text-xs text-red-600 font-semibold">Failed to create. Please try again.</p>
          )}
          <div className="flex gap-2">
            <Button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !form.name.trim() || !form.components.some(c => c.product_id)}
              className="flex-1">
              {createMut.isPending ? 'Creating…' : 'Create Bundle'}
            </Button>
            <button onClick={() => setShowAdd(false)}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 font-semibold">{bundles.length} bundle{bundles.length !== 1 ? 's' : ''}</p>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card h-24 animate-pulse" />)}</div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : bundles.length === 0 ? (
        <div className="card p-14 text-center text-gray-400">
          <div className="text-4xl mb-3">📦</div>
          <p className="font-semibold text-gray-600">No bundles yet</p>
          <p className="text-sm mt-1">Create combos to sell multiple products as a single deal</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bundles.map(b => (
            <div key={b.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-navy">{b.name}</h4>
                  {b.description && <p className="text-xs text-gray-400 mt-0.5">{b.description}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {b.components.map((c, i) => (
                      <span key={i} className="px-2.5 py-1 bg-navy/8 text-navy text-xs font-semibold rounded-full border border-navy/10">
                        {c.product.name} ×{c.quantity}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => { if (confirm(`Delete bundle "${b.name}"?`)) deleteMut.mutate(b.id); }}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold shrink-0">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VendorBundlesIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
