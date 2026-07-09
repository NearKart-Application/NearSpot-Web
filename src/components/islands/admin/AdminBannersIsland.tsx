import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';

interface Banner {
  id: string;
  title: string;
  subtitle: string;
  badge_text: string;
  image_url: string;
  link_type: string;
  link_value: string;
  target_city: string;
  display_order: number;
  is_active: boolean;
  is_paid: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

type BannerForm = Omit<Banner, 'id' | 'created_at'>;

const EMPTY_FORM: BannerForm = {
  title: '', subtitle: '', badge_text: '', image_url: '',
  link_type: 'store', link_value: '', target_city: '',
  display_order: 0, is_active: true, is_paid: false,
  starts_at: null, ends_at: null,
};

function BannerFormModal({
  initial,
  onClose,
  onSave,
  loading,
}: {
  initial: BannerForm;
  onClose: () => void;
  onSave: (data: BannerForm) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<BannerForm>(initial);
  const set = (k: keyof BannerForm, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-sm mb-4" style={{ color: '#1C2E4A' }}>
          {initial.title ? 'Edit Banner' : 'New Banner'}
        </h3>
        <div className="space-y-3">
          <div><label className="label">Title</label><input value={form.title} onChange={(e) => set('title', e.target.value)} className="input" /></div>
          <div><label className="label">Subtitle</label><input value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} className="input" /></div>
          <div><label className="label">Badge Text</label><input value={form.badge_text} onChange={(e) => set('badge_text', e.target.value)} className="input" /></div>
          <div><label className="label">Image URL</label><input value={form.image_url} onChange={(e) => set('image_url', e.target.value)} className="input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Link Type</label>
              <select value={form.link_type} onChange={(e) => set('link_type', e.target.value)} className="input">
                <option value="store">Store</option>
                <option value="category">Category</option>
                <option value="url">URL</option>
                <option value="none">None</option>
              </select>
            </div>
            <div><label className="label">Link Value</label><input value={form.link_value} onChange={(e) => set('link_value', e.target.value)} className="input" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Target City</label><input value={form.target_city} onChange={(e) => set('target_city', e.target.value)} className="input" /></div>
            <div><label className="label">Display Order</label><input type="number" value={form.display_order} onChange={(e) => set('display_order', +e.target.value)} className="input" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Starts At</label><input type="datetime-local" value={form.starts_at ?? ''} onChange={(e) => set('starts_at', e.target.value || null)} className="input" /></div>
            <div><label className="label">Ends At</label><input type="datetime-local" value={form.ends_at ?? ''} onChange={(e) => set('ends_at', e.target.value || null)} className="input" /></div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="rounded" />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_paid} onChange={(e) => set('is_paid', e.target.checked)} className="rounded" />
              Paid
            </label>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="btn-ghost btn-sm">Cancel</button>
          <button onClick={() => onSave(form)} disabled={loading || !form.title} className="btn-primary btn-sm">
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Inner() {
  const qc = useQueryClient();
  const [editTarget, setEditTarget] = useState<(Banner & { _new?: boolean }) | null>(null);

  const { data, isLoading, error, refetch } = useQuery<{ count: number; results: Banner[] }>({
    queryKey: ['admin-banners'],
    queryFn: () => api.get('/admin-panel/banners/').then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (payload: BannerForm) => api.post('/admin-panel/banners/', payload).then((r) => r.data),
    onSuccess: () => { setEditTarget(null); qc.invalidateQueries({ queryKey: ['admin-banners'] }); },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BannerForm }) =>
      api.patch(`/admin-panel/banners/${id}/`, payload).then((r) => r.data),
    onSuccess: () => { setEditTarget(null); qc.invalidateQueries({ queryKey: ['admin-banners'] }); },
  });

  const toggle = useMutation({
    mutationFn: (id: string) => api.post(`/admin-panel/banners/${id}/toggle/`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-banners'] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/admin-panel/banners/${id}/`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-banners'] }),
  });

  if (isLoading) {
    return <div className="space-y-3 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-2xl" />)}</div>;
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-4xl mb-2">⚠️</p>
        <p className="font-semibold" style={{ color: '#1C2E4A' }}>Failed to load banners</p>
        <button onClick={() => refetch()} className="btn-primary mt-4">Retry</button>
      </div>
    );
  }

  const banners = data?.results ?? [];

  return (
    <div className="space-y-4">
      {editTarget && (
        <BannerFormModal
          initial={editTarget._new ? EMPTY_FORM : {
            title: editTarget.title, subtitle: editTarget.subtitle, badge_text: editTarget.badge_text,
            image_url: editTarget.image_url, link_type: editTarget.link_type, link_value: editTarget.link_value,
            target_city: editTarget.target_city, display_order: editTarget.display_order,
            is_active: editTarget.is_active, is_paid: editTarget.is_paid,
            starts_at: editTarget.starts_at, ends_at: editTarget.ends_at,
          }}
          onClose={() => setEditTarget(null)}
          onSave={(form) => {
            if (editTarget._new) create.mutate(form);
            else update.mutate({ id: editTarget.id, payload: form });
          }}
          loading={create.isPending || update.isPending}
        />
      )}

      <div className="flex items-center justify-between">
        <h2 className="section-title mb-0">Banners ({data?.count ?? 0})</h2>
        <button onClick={() => setEditTarget({ _new: true } as any)} className="btn-primary btn-sm">
          + New Banner
        </button>
      </div>

      <div className="space-y-3">
        {banners.map((b) => (
          <div key={b.id} className="card p-4 flex items-center gap-4">
            {b.image_url && (
              <img src={b.image_url} alt={b.title} className="w-20 h-12 object-cover rounded-xl shrink-0 bg-gray-100" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm" style={{ color: '#1C2E4A' }}>{b.title}</span>
                <span className={`badge ${b.is_active ? 'badge-green' : 'badge-red'}`}>{b.is_active ? 'Active' : 'Inactive'}</span>
                {b.is_paid && <span className="badge badge-gold">Paid</span>}
                {b.badge_text && <span className="badge badge-navy">{b.badge_text}</span>}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {b.subtitle} · Order {b.display_order}{b.target_city ? ` · ${b.target_city}` : ''}
              </p>
              {(b.starts_at || b.ends_at) && (
                <p className="text-xs text-gray-400">
                  {b.starts_at ? new Date(b.starts_at).toLocaleDateString() : '∞'} → {b.ends_at ? new Date(b.ends_at).toLocaleDateString() : '∞'}
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => toggle.mutate(b.id)} disabled={toggle.isPending} className="btn-outline btn-sm">
                {b.is_active ? 'Disable' : 'Enable'}
              </button>
              <button onClick={() => setEditTarget(b)} className="btn-ghost btn-sm">Edit</button>
              <button
                onClick={() => { if (confirm('Delete this banner?')) del.mutate(b.id); }}
                disabled={del.isPending}
                className="btn-danger btn-sm"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {banners.length === 0 && <div className="card p-12 text-center text-gray-400">No banners</div>}
      </div>
    </div>
  );
}

export default function AdminBannersIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <Inner />
      </AdminShell>
    </QueryClientProvider>
  );
}
