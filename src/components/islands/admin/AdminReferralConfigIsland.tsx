import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';

interface ReferralConfig {
  id: string;
  city: string;
  vendor_reward: number;
  customer_reward: number;
  vendor_reward_min: number;
  vendor_reward_max: number;
  customer_reward_min: number;
  customer_reward_max: number;
}

type ConfigForm = Omit<ReferralConfig, 'id'>;

const EMPTY_FORM: ConfigForm = {
  city: '', vendor_reward: 0, customer_reward: 0,
  vendor_reward_min: 0, vendor_reward_max: 0,
  customer_reward_min: 0, customer_reward_max: 0,
};

function ConfigCard({
  config,
  onSave,
  loading,
}: {
  config: ReferralConfig;
  onSave: (id: string, data: ConfigForm) => void;
  loading: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ConfigForm>({
    city: config.city,
    vendor_reward: config.vendor_reward,
    customer_reward: config.customer_reward,
    vendor_reward_min: config.vendor_reward_min,
    vendor_reward_max: config.vendor_reward_max,
    customer_reward_min: config.customer_reward_min,
    customer_reward_max: config.customer_reward_max,
  });
  const set = (k: keyof ConfigForm, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  if (!editing) {
    return (
      <div className="card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm" style={{ color: '#1C2E4A' }}>{config.city || 'Default'}</p>
          <button onClick={() => setEditing(true)} className="btn-ghost btn-sm">Edit</button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          <div>
            <p className="text-gray-400 uppercase tracking-wide font-semibold">Vendor</p>
            <p>Reward: ₹{config.vendor_reward}</p>
            <p>Range: ₹{config.vendor_reward_min} – ₹{config.vendor_reward_max}</p>
          </div>
          <div>
            <p className="text-gray-400 uppercase tracking-wide font-semibold">Customer</p>
            <p>Reward: ₹{config.customer_reward}</p>
            <p>Range: ₹{config.customer_reward_min} – ₹{config.customer_reward_max}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-3">
      <p className="font-semibold text-sm" style={{ color: '#1C2E4A' }}>Editing: {config.city || 'Default'}</p>
      <div><label className="label">City</label><input value={form.city} onChange={(e) => set('city', e.target.value)} className="input" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Vendor Reward (₹)</label><input type="number" value={form.vendor_reward} onChange={(e) => set('vendor_reward', +e.target.value)} className="input" /></div>
        <div><label className="label">Customer Reward (₹)</label><input type="number" value={form.customer_reward} onChange={(e) => set('customer_reward', +e.target.value)} className="input" /></div>
        <div><label className="label">Vendor Min (₹)</label><input type="number" value={form.vendor_reward_min} onChange={(e) => set('vendor_reward_min', +e.target.value)} className="input" /></div>
        <div><label className="label">Vendor Max (₹)</label><input type="number" value={form.vendor_reward_max} onChange={(e) => set('vendor_reward_max', +e.target.value)} className="input" /></div>
        <div><label className="label">Customer Min (₹)</label><input type="number" value={form.customer_reward_min} onChange={(e) => set('customer_reward_min', +e.target.value)} className="input" /></div>
        <div><label className="label">Customer Max (₹)</label><input type="number" value={form.customer_reward_max} onChange={(e) => set('customer_reward_max', +e.target.value)} className="input" /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setEditing(false)} className="btn-ghost btn-sm">Cancel</button>
        <button
          onClick={() => { onSave(config.id, form); setEditing(false); }}
          disabled={loading}
          className="btn-primary btn-sm"
        >
          {loading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function NewConfigCard({
  onSave,
  loading,
}: {
  onSave: (data: ConfigForm) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<ConfigForm>(EMPTY_FORM);
  const set = (k: keyof ConfigForm, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="card p-4 space-y-3 border-dashed border-2 border-gray-200">
      <p className="font-semibold text-sm" style={{ color: '#1C2E4A' }}>New Config</p>
      <div><label className="label">City</label><input value={form.city} onChange={(e) => set('city', e.target.value)} className="input" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Vendor Reward (₹)</label><input type="number" value={form.vendor_reward} onChange={(e) => set('vendor_reward', +e.target.value)} className="input" /></div>
        <div><label className="label">Customer Reward (₹)</label><input type="number" value={form.customer_reward} onChange={(e) => set('customer_reward', +e.target.value)} className="input" /></div>
        <div><label className="label">Vendor Min</label><input type="number" value={form.vendor_reward_min} onChange={(e) => set('vendor_reward_min', +e.target.value)} className="input" /></div>
        <div><label className="label">Vendor Max</label><input type="number" value={form.vendor_reward_max} onChange={(e) => set('vendor_reward_max', +e.target.value)} className="input" /></div>
        <div><label className="label">Customer Min</label><input type="number" value={form.customer_reward_min} onChange={(e) => set('customer_reward_min', +e.target.value)} className="input" /></div>
        <div><label className="label">Customer Max</label><input type="number" value={form.customer_reward_max} onChange={(e) => set('customer_reward_max', +e.target.value)} className="input" /></div>
      </div>
      <button onClick={() => onSave(form)} disabled={loading || !form.city} className="btn-primary btn-sm w-full">
        {loading ? 'Creating…' : 'Create Config'}
      </button>
    </div>
  );
}

function Inner() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<ReferralConfig[]>({
    queryKey: ['admin-referral-config'],
    queryFn: () => api.get('/admin-panel/referral-config/').then((r) => Array.isArray(r.data) ? r.data : r.data.results ?? []),
  });

  const create = useMutation({
    mutationFn: (payload: ConfigForm) => api.post('/admin-panel/referral-config/', payload).then((r) => r.data),
    onSuccess: () => { setShowNew(false); qc.invalidateQueries({ queryKey: ['admin-referral-config'] }); },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ConfigForm }) =>
      api.patch(`/admin-panel/referral-config/${id}/`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-referral-config'] }),
  });

  if (isLoading) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-200 rounded-2xl" />)}</div>;
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="font-semibold" style={{ color: '#1C2E4A' }}>Failed to load referral config</p>
        <button onClick={() => refetch()} className="btn-primary mt-4">Retry</button>
      </div>
    );
  }

  const configs = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title mb-0">Referral Config ({configs.length})</h2>
        <button onClick={() => setShowNew((v) => !v)} className="btn-primary btn-sm">
          {showNew ? 'Cancel' : '+ New Config'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {showNew && (
          <NewConfigCard
            onSave={(form) => create.mutate(form)}
            loading={create.isPending}
          />
        )}
        {configs.map((cfg) => (
          <ConfigCard
            key={cfg.id}
            config={cfg}
            onSave={(id, form) => update.mutate({ id, payload: form })}
            loading={update.isPending}
          />
        ))}
        {configs.length === 0 && !showNew && (
          <div className="col-span-2 card p-12 text-center text-gray-400">No configs</div>
        )}
      </div>
    </div>
  );
}

export default function AdminReferralConfigIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <Inner />
      </AdminShell>
    </QueryClientProvider>
  );
}
