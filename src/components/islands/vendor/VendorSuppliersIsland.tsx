import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';
import { Button } from '@/components/ui/button';

interface Supplier {
  id: string;
  name: string;
  contact_name: string;
  phone: string;
  whatsapp: string;
  address: string;
  product_categories: string;
  notes: string;
  is_active: boolean;
}

const EMPTY_FORM = {
  name: '',
  contact_name: '',
  phone: '',
  whatsapp: '',
  address: '',
  product_categories: '',
  notes: '',
  is_active: true,
};

function SupplierModal({
  initial,
  onClose,
  onSuccess,
}: {
  initial?: Supplier;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState(
    initial
      ? {
          name: initial.name,
          contact_name: initial.contact_name ?? '',
          phone: initial.phone,
          whatsapp: initial.whatsapp ?? '',
          address: initial.address ?? '',
          product_categories: initial.product_categories ?? '',
          notes: initial.notes ?? '',
          is_active: initial.is_active,
        }
      : EMPTY_FORM,
  );
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () =>
      initial
        ? api.patch(`/inventory/suppliers/${initial.id}/`, form)
        : api.post('/inventory/suppliers/', form),
    onSuccess: () => onSuccess(),
    onError: (e: any) =>
      setError(e?.response?.data?.detail ?? JSON.stringify(e?.response?.data) ?? 'Failed to save supplier'),
  });

  const set = (key: string, val: string | boolean) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-navy text-lg">{initial ? 'Edit Supplier' : 'Add Supplier'}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Name *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Supplier company name"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Contact Name</label>
            <input
              value={form.contact_name}
              onChange={e => set('contact_name', e.target.value)}
              placeholder="Person to contact"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Phone *</label>
              <input
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">WhatsApp</label>
              <input
                value={form.whatsapp}
                onChange={e => set('whatsapp', e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Address</label>
            <input
              value={form.address}
              onChange={e => set('address', e.target.value)}
              placeholder="Supplier address"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Product Categories</label>
            <input
              value={form.product_categories}
              onChange={e => set('product_categories', e.target.value)}
              placeholder="e.g. Electronics, Clothing"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any additional notes"
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40 resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="supplier-active"
              checked={form.is_active}
              onChange={e => set('is_active', e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="supplier-active" className="text-sm text-gray-700">Active supplier</label>
          </div>
        </div>

        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.name || !form.phone}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm"
          >
            {mut.isPending ? 'Saving…' : initial ? 'Save Changes' : 'Add Supplier'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SupplierCard({ supplier, onEdit, onDelete }: { supplier: Supplier; onEdit: () => void; onDelete: () => void }) {
  const cats = supplier.product_categories ? supplier.product_categories.split(',').map(c => c.trim()).filter(Boolean) : [];

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-navy truncate">{supplier.name}</h3>
            <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${supplier.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {supplier.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          {supplier.contact_name && (
            <p className="text-sm text-gray-500 mb-1">👤 {supplier.contact_name}</p>
          )}
          <p className="text-sm text-gray-600">📞 {supplier.phone}</p>
          {supplier.whatsapp && (
            <p className="text-sm text-gray-500">💬 {supplier.whatsapp}</p>
          )}
          {cats.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {cats.map(c => (
                <span key={c} className="text-[11px] bg-navy/10 text-navy font-semibold px-2 py-0.5 rounded-full">{c}</span>
              ))}
            </div>
          )}
          {supplier.address && (
            <p className="text-xs text-gray-400 mt-2">📍 {supplier.address}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button onClick={onEdit} className="text-xs font-bold text-navy hover:underline">Edit</button>
          <button onClick={onDelete} className="text-xs font-bold text-red-500 hover:underline">Delete</button>
        </div>
      </div>
    </div>
  );
}

function Inner() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-suppliers'],
    queryFn: () => api.get('/inventory/suppliers/').then(r => r.data),
  });

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.patch(`/inventory/suppliers/${id}/`, { is_active: false }),
    onSuccess: () => { setDeleteError(null); qc.invalidateQueries({ queryKey: ['vendor-suppliers'] }); },
    onError: (e: any) => setDeleteError(e?.response?.data?.detail ?? 'Failed to deactivate supplier'),
  });

  const suppliers: Supplier[] = data?.results ?? (Array.isArray(data) ? data : []);

  const handleSuccess = () => {
    setShowAdd(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ['vendor-suppliers'] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Suppliers</h1>
          <p className="text-sm text-gray-400">{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="px-5 py-2.5 rounded-xl font-bold text-sm">
          + Add Supplier
        </Button>
      </div>

      {deleteError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {deleteError}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}</div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : suppliers.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">🏭</div>
          <p className="font-semibold text-gray-600">No suppliers yet</p>
          <p className="text-sm mt-1">Add your first supplier to get started</p>
          <Button onClick={() => setShowAdd(true)} className="mt-4 px-6 py-2.5 rounded-xl text-sm font-bold">
            Add Supplier
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {suppliers.map(s => (
            <SupplierCard
              key={s.id}
              supplier={s}
              onEdit={() => setEditing(s)}
              onDelete={() => {
                if (confirm(`Remove "${s.name}" from your supplier list?`)) {
                  deleteMut.mutate(s.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <SupplierModal onClose={() => setShowAdd(false)} onSuccess={handleSuccess} />
      )}
      {editing && (
        <SupplierModal initial={editing} onClose={() => setEditing(null)} onSuccess={handleSuccess} />
      )}
    </div>
  );
}

export default function VendorSuppliersIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
