import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';

interface OfferTemplate {
  id: string;
  name: string;
  description_template: string;
  default_discount_pct: number;
  badge_text: string;
  emoji: string;
  image_url: string;
  is_active: boolean;
  is_default: boolean;
  display_order: number;
  created_at: string;
}

type TemplateForm = Omit<OfferTemplate, 'id' | 'created_at'>;

const EMPTY_FORM: TemplateForm = {
  name: '', description_template: '', default_discount_pct: 0,
  badge_text: '', emoji: '', image_url: '',
  is_active: true, is_default: false, display_order: 0,
};

function TemplateModal({
  initial,
  onClose,
  onSave,
  loading,
  title,
}: {
  initial: TemplateForm;
  onClose: () => void;
  onSave: (data: TemplateForm) => void;
  loading: boolean;
  title: string;
}) {
  const [form, setForm] = useState<TemplateForm>(initial);
  const set = (k: keyof TemplateForm, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-sm mb-4" style={{ color: '#1C2E4A' }}>{title}</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Name</label><input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" /></div>
            <div><label className="label">Emoji</label><input value={form.emoji} onChange={(e) => set('emoji', e.target.value)} className="input" /></div>
          </div>
          <div><label className="label">Description Template</label><textarea value={form.description_template} onChange={(e) => set('description_template', e.target.value)} rows={3} className="input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Default Discount %</label><input type="number" min={0} max={100} value={form.default_discount_pct} onChange={(e) => set('default_discount_pct', +e.target.value)} className="input" /></div>
            <div><label className="label">Badge Text</label><input value={form.badge_text} onChange={(e) => set('badge_text', e.target.value)} className="input" /></div>
          </div>
          <div><label className="label">Image URL</label><input value={form.image_url} onChange={(e) => set('image_url', e.target.value)} className="input" /></div>
          <div><label className="label">Display Order</label><input type="number" value={form.display_order} onChange={(e) => set('display_order', +e.target.value)} className="input" /></div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="rounded" />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_default} onChange={(e) => set('is_default', e.target.checked)} className="rounded" />
              Default
            </label>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="btn-ghost btn-sm">Cancel</button>
          <button onClick={() => onSave(form)} disabled={loading || !form.name} className="btn-primary btn-sm">
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Inner() {
  const qc = useQueryClient();
  const [editTarget, setEditTarget] = useState<(OfferTemplate & { _new?: boolean }) | null>(null);

  const { data, isLoading, error, refetch } = useQuery<OfferTemplate[]>({
    queryKey: ['admin-offer-templates'],
    queryFn: () => api.get('/admin-panel/offer-templates/').then((r) => Array.isArray(r.data) ? r.data : r.data.results ?? []),
  });

  const create = useMutation({
    mutationFn: (payload: TemplateForm) => api.post('/admin-panel/offer-templates/', payload).then((r) => r.data),
    onSuccess: () => { setEditTarget(null); qc.invalidateQueries({ queryKey: ['admin-offer-templates'] }); },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TemplateForm }) =>
      api.patch(`/admin-panel/offer-templates/${id}/`, payload).then((r) => r.data),
    onSuccess: () => { setEditTarget(null); qc.invalidateQueries({ queryKey: ['admin-offer-templates'] }); },
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/admin-panel/offer-templates/${id}/`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-offer-templates'] }),
  });

  if (isLoading) {
    return <div className="space-y-3 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}</div>;
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="font-semibold" style={{ color: '#1C2E4A' }}>Failed to load templates</p>
        <button onClick={() => refetch()} className="btn-primary mt-4">Retry</button>
      </div>
    );
  }

  const templates = data ?? [];

  const buildForm = (t: OfferTemplate): TemplateForm => ({
    name: t.name, description_template: t.description_template,
    default_discount_pct: t.default_discount_pct, badge_text: t.badge_text,
    emoji: t.emoji, image_url: t.image_url, is_active: t.is_active,
    is_default: t.is_default, display_order: t.display_order,
  });

  return (
    <div className="space-y-4">
      {editTarget && (
        <TemplateModal
          title={editTarget._new ? 'New Offer Template' : 'Edit Offer Template'}
          initial={editTarget._new ? EMPTY_FORM : buildForm(editTarget)}
          onClose={() => setEditTarget(null)}
          onSave={(form) => {
            if (editTarget._new) create.mutate(form);
            else update.mutate({ id: editTarget.id, payload: form });
          }}
          loading={create.isPending || update.isPending}
        />
      )}

      <div className="flex items-center justify-between">
        <h2 className="section-title mb-0">Offer Templates ({templates.length})</h2>
        <button onClick={() => setEditTarget({ _new: true } as any)} className="btn-primary btn-sm">+ New Template</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t) => (
          <div key={t.id} className="card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{t.emoji}</span>
                <div>
                  <p className="font-semibold text-sm" style={{ color: '#1C2E4A' }}>{t.name}</p>
                  {t.badge_text && <span className="badge badge-gold">{t.badge_text}</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1 items-end shrink-0">
                <span className={`badge ${t.is_active ? 'badge-green' : 'badge-red'}`}>{t.is_active ? 'Active' : 'Inactive'}</span>
                {t.is_default && <span className="badge badge-blue">Default</span>}
              </div>
            </div>
            <p className="text-xs text-gray-500 line-clamp-2">{t.description_template}</p>
            <p className="text-xs text-gray-400">Discount: {t.default_discount_pct}% · Order: {t.display_order}</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditTarget(t)} className="btn-ghost btn-sm flex-1">Edit</button>
              <button
                onClick={() => { if (confirm('Delete this template?')) del.mutate(t.id); }}
                disabled={del.isPending}
                className="btn-danger btn-sm"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {templates.length === 0 && <div className="col-span-3 card p-12 text-center text-gray-400">No templates</div>}
      </div>
    </div>
  );
}

export default function AdminOfferTemplatesIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <Inner />
      </AdminShell>
    </QueryClientProvider>
  );
}
