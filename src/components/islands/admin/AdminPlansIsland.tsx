import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { auth } from '../../../lib/auth';
import { AdminShell } from './AdminShell';

interface Plan {
  name: string;
  display_name: string;
  price: number;
  duration_days: number;
  video_limit: number;
  product_limit: number;
  store_track: 'both' | 'product' | 'service';
  description: string;
  is_active: boolean;
}

type PlanForm = Plan;

const EMPTY_FORM: PlanForm = {
  name: '', display_name: '', price: 0, duration_days: 30,
  video_limit: 0, product_limit: 0, store_track: 'both',
  description: '', is_active: true,
};

function PlanModal({
  initial,
  onClose,
  onSave,
  loading,
  title,
  slug,
}: {
  initial: PlanForm;
  onClose: () => void;
  onSave: (data: PlanForm) => void;
  loading: boolean;
  title: string;
  slug?: string;
}) {
  const [form, setForm] = useState<PlanForm>(initial);
  const set = (k: keyof PlanForm, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-sm mb-4" style={{ color: '#1C2E4A' }}>{title}</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Plan Key (name)</label><input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" placeholder="pro" disabled={!!slug} /></div>
            <div><label className="label">Display Name</label><input value={form.display_name} onChange={(e) => set('display_name', e.target.value)} className="input" placeholder="Pro" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Price (₹)</label><input type="number" min={0} value={form.price} onChange={(e) => set('price', +e.target.value)} className="input" /></div>
            <div><label className="label">Duration (days)</label><input type="number" min={1} value={form.duration_days} onChange={(e) => set('duration_days', +e.target.value)} className="input" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Video Limit (0 = unlimited)</label><input type="number" min={0} value={form.video_limit} onChange={(e) => set('video_limit', +e.target.value)} className="input" /></div>
            <div><label className="label">Product Limit (0 = unlimited)</label><input type="number" min={0} value={form.product_limit} onChange={(e) => set('product_limit', +e.target.value)} className="input" /></div>
          </div>
          <div>
            <label className="label">Store Track</label>
            <select value={form.store_track} onChange={(e) => set('store_track', e.target.value)} className="input">
              <option value="both">Both</option>
              <option value="product">Products only</option>
              <option value="service">Services only</option>
            </select>
          </div>
          <div><label className="label">Description</label><textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} className="input" /></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="rounded" />
            Active
          </label>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="btn-ghost btn-sm">Cancel</button>
          <button onClick={() => onSave(form)} disabled={loading || !form.name || !form.display_name} className="btn-primary btn-sm">
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function NotMasterGuard({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed]  = useState(false);

  useEffect(() => {
    const user = auth.user() as any;
    const mode = user?.ui_mode ?? user?.role;
    if (mode === 'master_admin') setAllowed(true);
    else window.location.href = '/admin/dashboard';
    setChecked(true);
  }, []);

  if (!checked) return null;
  if (!allowed) return null;
  return <>{children}</>;
}

function Inner() {
  const qc = useQueryClient();
  const [editTarget, setEditTarget] = useState<(Plan & { _new?: boolean }) | null>(null);

  const { data, isLoading, error, refetch } = useQuery<Plan[]>({
    queryKey: ['admin-plans'],
    queryFn: () => api.get('/admin-panel/plans/').then((r) => Array.isArray(r.data) ? r.data : r.data.results ?? []),
  });

  const create = useMutation({
    mutationFn: (payload: PlanForm) => api.post('/admin-panel/plans/', payload).then((r) => r.data),
    onSuccess: () => { setEditTarget(null); qc.invalidateQueries({ queryKey: ['admin-plans'] }); },
  });

  const update = useMutation({
    mutationFn: ({ slug, payload }: { slug: string; payload: PlanForm }) =>
      api.patch(`/admin-panel/plans/${slug}/`, payload).then((r) => r.data),
    onSuccess: () => { setEditTarget(null); qc.invalidateQueries({ queryKey: ['admin-plans'] }); },
  });

  if (isLoading) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {[...Array(4)].map((_, i) => <div key={i} className="h-40 bg-gray-200 rounded-2xl" />)}
    </div>;
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="font-semibold" style={{ color: '#1C2E4A' }}>Failed to load plans</p>
        <button onClick={() => refetch()} className="btn-primary mt-4">Retry</button>
      </div>
    );
  }

  const plans = data ?? [];

  return (
    <div className="space-y-4">
      {editTarget && (
        <PlanModal
          title={editTarget._new ? 'New Plan' : `Edit: ${editTarget.display_name}`}
          initial={editTarget._new ? EMPTY_FORM : editTarget}
          slug={editTarget._new ? undefined : editTarget.name}
          onClose={() => setEditTarget(null)}
          onSave={(form) => {
            if (editTarget._new) create.mutate(form);
            else update.mutate({ slug: editTarget.name, payload: form });
          }}
          loading={create.isPending || update.isPending}
        />
      )}

      <div className="flex items-center justify-between">
        <h2 className="section-title mb-0">Plans ({plans.length})</h2>
        <button onClick={() => setEditTarget({ _new: true } as any)} className="btn-primary btn-sm">+ New Plan</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.name} className="card p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-base" style={{ color: '#1C2E4A' }}>{plan.display_name}</p>
                <p className="text-xs font-mono text-gray-400">{plan.name}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`badge ${plan.is_active ? 'badge-green' : 'badge-red'}`}>
                  {plan.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="badge badge-navy capitalize">{plan.store_track}</span>
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#1C2E4A' }}>₹{parseFloat(String(plan.price)).toLocaleString()}</p>
            <div className="text-xs text-gray-500 space-y-1">
              <p>{plan.duration_days} days</p>
              <p>{plan.video_limit || '∞'} videos · {plan.product_limit || '∞'} products</p>
              {plan.description && <p className="text-gray-400 line-clamp-2">{plan.description}</p>}
            </div>
            <button onClick={() => setEditTarget(plan)} className="btn-outline btn-sm w-full">Edit Plan</button>
          </div>
        ))}
        {plans.length === 0 && <div className="col-span-3 card p-12 text-center text-gray-400">No plans</div>}
      </div>
    </div>
  );
}

export default function AdminPlansIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <NotMasterGuard>
          <Inner />
        </NotMasterGuard>
      </AdminShell>
    </QueryClientProvider>
  );
}
