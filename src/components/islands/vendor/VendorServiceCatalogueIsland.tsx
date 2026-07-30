import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

interface Service {
  id: string;
  name: string;
  description: string;
  price_from: number | null;
  price_to: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  image_url: string;
  sort_order: number;
}

const EMPTY_FORM = {
  name: '',
  description: '',
  price_from: '',
  price_to: '',
  duration_minutes: '',
  is_active: true,
  image_url: '',
  sort_order: 0,
};

function ServiceModal({
  initial,
  onClose,
  onSuccess,
}: {
  initial?: Service;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState(
    initial
      ? {
          name: initial.name,
          description: initial.description ?? '',
          price_from: initial.price_from != null ? String(initial.price_from) : '',
          price_to: initial.price_to != null ? String(initial.price_to) : '',
          duration_minutes: initial.duration_minutes != null ? String(initial.duration_minutes) : '',
          is_active: initial.is_active,
          image_url: initial.image_url ?? '',
          sort_order: initial.sort_order ?? 0,
        }
      : EMPTY_FORM,
  );
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        description: form.description,
        price_from: form.price_from !== '' ? parseFloat(form.price_from) : null,
        price_to: form.price_to !== '' ? parseFloat(form.price_to) : null,
        duration_minutes: form.duration_minutes !== '' ? parseInt(form.duration_minutes) : null,
        is_active: form.is_active,
        image_url: form.image_url,
        sort_order: form.sort_order,
      };
      return initial
        ? api.put(`/stores/mine/services/${initial.id}/`, payload)
        : api.post('/stores/mine/services/', payload);
    },
    onSuccess: () => onSuccess(),
    onError: (e: any) =>
      setError(e?.response?.data?.detail ?? JSON.stringify(e?.response?.data) ?? 'Failed to save service'),
  });

  const set = (key: string, val: string | boolean | number) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-navy text-lg">{initial ? 'Edit Service' : 'Add Service'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Service Name *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Deep Cleaning, Haircut"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Brief description of the service"
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Price From (₹)</label>
              <input
                type="number"
                min="0"
                value={form.price_from}
                onChange={e => set('price_from', e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Price To (₹)</label>
              <input
                type="number"
                min="0"
                value={form.price_to}
                onChange={e => set('price_to', e.target.value)}
                placeholder="Leave blank if fixed"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Duration (minutes)</label>
              <input
                type="number"
                min="1"
                value={form.duration_minutes}
                onChange={e => set('duration_minutes', e.target.value)}
                placeholder="e.g. 60"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Sort Order</label>
              <input
                type="number"
                min="0"
                value={form.sort_order}
                onChange={e => set('sort_order', parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Image URL</label>
            <input
              value={form.image_url}
              onChange={e => set('image_url', e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="service-active"
              checked={form.is_active}
              onChange={e => set('is_active', e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="service-active" className="text-sm text-gray-700">Service is active / available</label>
          </div>
        </div>

        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.name}
            className="flex-1 btn-primary py-2.5 rounded-xl font-bold text-sm"
          >
            {mut.isPending ? 'Saving…' : initial ? 'Save Changes' : 'Add Service'}
          </button>
        </div>
      </div>
    </div>
  );
}

function priceRange(service: Service): string {
  const from = service.price_from;
  const to = service.price_to;
  if (from == null && to == null) return 'Price on request';
  if (from != null && to != null) return `₹${Number(from).toLocaleString('en-IN')}–₹${Number(to).toLocaleString('en-IN')}`;
  if (from != null) return `₹${Number(from).toLocaleString('en-IN')}+`;
  return `up to ₹${Number(to).toLocaleString('en-IN')}`;
}

function ServiceCard({
  service,
  onEdit,
  onDelete,
  onToggle,
}: {
  service: Service;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="card p-5">
      {service.image_url && (
        <div className="w-full h-36 rounded-xl bg-gray-100 overflow-hidden mb-4">
          <img src={service.image_url} alt={service.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-navy leading-tight">{service.name}</h3>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${service.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {service.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>
      {service.description && (
        <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{service.description}</p>
      )}
      <div className="flex items-center gap-4 mt-3">
        <span className="text-sm font-bold text-navy">{priceRange(service)}</span>
        {service.duration_minutes && (
          <span className="text-xs text-gray-400">⏱ {service.duration_minutes} min</span>
        )}
      </div>
      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
        <button onClick={onToggle} className="text-xs font-bold text-gray-500 hover:text-navy transition-colors">
          {service.is_active ? 'Deactivate' : 'Activate'}
        </button>
        <button onClick={onEdit} className="text-xs font-bold text-navy hover:underline">Edit</button>
        <button onClick={onDelete} className="text-xs font-bold text-red-500 hover:underline ml-auto">Delete</button>
      </div>
    </div>
  );
}

function Inner() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-services'],
    queryFn: () => api.get('/stores/mine/services/').then(r => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/stores/mine/services/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-services'] }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.put(`/stores/mine/services/${id}/`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-services'] }),
  });

  const services: Service[] = data?.results ?? (Array.isArray(data) ? data : []);

  const handleSuccess = () => {
    setShowAdd(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ['vendor-services'] });
  };

  return (
    <div className="space-y-6">
      {/* Notice banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 text-sm text-blue-700">
        ℹ️ <span className="font-semibold">Note:</span> Service catalogue is only relevant for service-type vendors (salons, repair shops, etc.). Product vendors can ignore this section.
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Service Catalogue</h1>
          <p className="text-sm text-gray-400">{services.length} service{services.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary px-5 py-2.5 rounded-xl font-bold text-sm">
          + Add Service
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-48 animate-pulse" />)}
        </div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : services.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">💆</div>
          <p className="font-semibold text-gray-600">No services listed</p>
          <p className="text-sm mt-1">Add services your customers can book or enquire about</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary mt-4 px-6 py-2.5 rounded-xl text-sm font-bold">
            Add First Service
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map(s => (
            <ServiceCard
              key={s.id}
              service={s}
              onEdit={() => setEditing(s)}
              onToggle={() => toggleMut.mutate({ id: s.id, is_active: !s.is_active })}
              onDelete={() => {
                if (confirm(`Delete service "${s.name}"? This cannot be undone.`)) {
                  deleteMut.mutate(s.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {showAdd && <ServiceModal onClose={() => setShowAdd(false)} onSuccess={handleSuccess} />}
      {editing && <ServiceModal initial={editing} onClose={() => setEditing(null)} onSuccess={handleSuccess} />}
    </div>
  );
}

export default function VendorServiceCatalogueIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
