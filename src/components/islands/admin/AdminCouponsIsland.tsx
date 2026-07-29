import { useState, useEffect, useRef } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';

interface Coupon {
  id: string;
  code: string;
  discount_percent: number;
  plans: { name: string; display_name: string }[];
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  target_store: { id: string; name: string } | null;
  created_by: { full_name: string } | null;
  status: 'active' | 'availed' | 'expired';
  created_at: string;
}

interface StoreHit {
  store_id: string;
  store_name: string;
  city?: string;
  owner_name?: string;
  is_verified?: boolean;
}

function useDebounce(value: string, delay: number) {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

function CouponForm({
  onClose,
  onSave,
  loading,
}: {
  onClose: () => void;
  onSave: (data: { store_id: string; plan_name?: string; discount_percent: number; expires_at?: string }) => void;
  loading: boolean;
}) {
  const [discount, setDiscount] = useState(10);
  const [planName, setPlanName]  = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [storeSearch, setStoreSearch] = useState('');
  const [selectedStore, setSelectedStore] = useState<StoreHit | null>(null);
  const dStoreSearch = useDebounce(storeSearch, 350);

  const { data: storeResults } = useQuery<StoreHit[]>({
    queryKey: ['admin-vendor-search', dStoreSearch],
    queryFn: () =>
      dStoreSearch.length >= 2
        ? api.get('/admin-panel/vendors/search/', { params: { q: dStoreSearch } }).then((r) => r.data)
        : Promise.resolve([]),
    enabled: dStoreSearch.length >= 2,
  });

  const stores = storeResults ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card p-6 w-full max-w-md">
        <h3 className="font-bold text-sm mb-4" style={{ color: '#1C2E4A' }}>Create Coupon</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Store</label>
            {selectedStore ? (
              <div className="flex items-center gap-2">
                <span className="input flex-1 text-sm">{selectedStore.store_name}</span>
                <button onClick={() => { setSelectedStore(null); setStoreSearch(''); }} className="btn-ghost btn-sm">×</button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  className="input"
                  placeholder="Search store…"
                />
                {stores.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-card-hover z-10 max-h-40 overflow-y-auto mt-1">
                    {stores.map((s) => (
                      <button
                        key={s.store_id}
                        onClick={() => { setSelectedStore(s); setStoreSearch(''); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                      >
                        {s.store_name}{s.city ? ` · ${s.city}` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div><label className="label">Discount %</label><input type="number" min={1} max={100} value={discount} onChange={(e) => setDiscount(+e.target.value)} className="input" /></div>
          <div><label className="label">Plan Name (optional)</label><input value={planName} onChange={(e) => setPlanName(e.target.value)} className="input" placeholder="e.g. pro" /></div>
          <div><label className="label">Expires At (optional)</label><input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="input" /></div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="btn-ghost btn-sm">Cancel</button>
          <button
            onClick={() => {
              if (!selectedStore) return;
              onSave({
                store_id: selectedStore.store_id,
                discount_percent: discount,
                ...(planName && { plan_name: planName }),
                ...(expiresAt && { expires_at: expiresAt }),
              });
            }}
            disabled={loading || !selectedStore}
            className="btn-primary btn-sm"
          >
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_TABS = ['all', 'active', 'availed', 'expired'] as const;
type StatusTab = typeof STATUS_TABS[number];

const STATUS_BADGE: Record<string, string> = { active: 'badge-green', availed: 'badge-blue', expired: 'badge-red' };

function Inner() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<StatusTab>('all');
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<Coupon[]>({
    queryKey: ['admin-coupons', tab],
    queryFn: () =>
      api.get('/admin-panel/coupons/', { params: tab !== 'all' ? { status: tab } : {} }).then((r) => Array.isArray(r.data) ? r.data : (r.data?.results ?? [])),
  });

  const create = useMutation({
    mutationFn: (payload: Parameters<typeof api.post>[1]) => api.post('/admin-panel/coupons/', payload).then((r) => r.data),
    onSuccess: () => { setShowForm(false); qc.invalidateQueries({ queryKey: ['admin-coupons'] }); },
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/admin-panel/coupons/${id}/`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-coupons'] }),
  });

  if (isLoading) {
    return <div className="space-y-3 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-2xl" />)}</div>;
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="font-semibold" style={{ color: '#1C2E4A' }}>Failed to load coupons</p>
        <button onClick={() => refetch()} className="btn-primary mt-4">Retry</button>
      </div>
    );
  }

  const coupons = data ?? [];

  return (
    <div className="space-y-4">
      {showForm && (
        <CouponForm
          onClose={() => setShowForm(false)}
          onSave={(payload) => create.mutate(payload)}
          loading={create.isPending}
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                tab === t ? 'text-white' : 'text-gray-500'
              }`}
              style={tab === t ? { backgroundColor: '#1C2E4A' } : {}}
            >
              {t}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary btn-sm">+ Create Coupon</button>
      </div>

      <div className="space-y-3">
        {coupons.map((c) => (
          <div key={c.id} className="card p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="font-bold text-sm font-mono" style={{ color: '#1C2E4A' }}>{c.code}</code>
                <span className={`badge ${STATUS_BADGE[c.status] ?? 'badge-navy'} capitalize`}>{c.status}</span>
                <span className="badge badge-gold">{c.discount_percent}% off</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {c.target_store ? `Store: ${c.target_store.name}` : 'All stores'}
                {c.plans?.length ? ` · Plans: ${c.plans.map(p => p.display_name).join(', ')}` : ''}
                {` · Used: ${c.used_count}/${c.max_uses || '∞'}`}
                {c.expires_at ? ` · Expires: ${new Date(c.expires_at).toLocaleDateString()}` : ''}
              </p>
              {c.created_by && <p className="text-xs text-gray-400">Created by {c.created_by.full_name}</p>}
            </div>
            {c.used_count === 0 && (
              <button
                onClick={() => { if (confirm('Delete this coupon? This cannot be undone.')) del.mutate(c.id); }}
                disabled={del.isPending}
                className="btn-danger btn-sm shrink-0"
              >
                Delete
              </button>
            )}
          </div>
        ))}
        {coupons.length === 0 && <div className="card p-12 text-center text-gray-400">No coupons</div>}
      </div>
    </div>
  );
}

export default function AdminCouponsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <Inner />
      </AdminShell>
    </QueryClientProvider>
  );
}
