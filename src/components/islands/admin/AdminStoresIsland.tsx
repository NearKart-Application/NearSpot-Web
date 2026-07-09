import { useState, useEffect, useRef } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { auth } from '../../../lib/auth';
import { AdminShell } from './AdminShell';

interface AdminStore {
  id: string;
  name: string;
  category: string;
  address: string;
  locality: string;
  is_active: boolean;
  is_verified: boolean;
  is_open: boolean;
  store_type: 'product' | 'service' | 'home';
  wallet_balance: string;
  performance_score: number;
  owner_phone: string;
  owner_name: string;
  owner_profile_id: string;
  product_count: number;
  video_count: number;
  license_url: string | null;
  gst_url: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = { product: '🛍 Products', service: '🛠 Services', home: '🏠 Home' };

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function Inner() {
  const qc = useQueryClient();
  const _u = auth.user() as any;
  const isMaster = (_u?.ui_mode ?? _u?.role) === 'master_admin';

  const [search, setSearch] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState<'' | 'true' | 'false'>('');
  const [activeFilter, setActiveFilter]   = useState<'' | 'true' | 'false'>('');
  const [changingTypeId, setChangingTypeId] = useState<string | null>(null);

  const dSearch = useDebounce(search, 400);

  const { data, isLoading, error, refetch } = useQuery<{ count: number; results: AdminStore[] }>({
    queryKey: ['admin-stores', dSearch, verifiedFilter, activeFilter],
    queryFn: () =>
      api.get('/admin-panel/stores/', {
        params: {
          ...(dSearch && { search: dSearch }),
          ...(verifiedFilter !== '' && { is_verified: verifiedFilter }),
          ...(activeFilter !== '' && { is_active: activeFilter }),
        },
      }).then((r) => r.data),
  });

  const patch = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.patch(`/admin-panel/stores/${id}/`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-stores'] }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-2xl" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-4xl mb-2">⚠️</p>
        <p className="font-semibold" style={{ color: '#1C2E4A' }}>Failed to load stores</p>
        <button onClick={() => refetch()} className="btn-primary mt-4">Retry</button>
      </div>
    );
  }

  const stores = data?.results ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search stores…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input max-w-xs"
        />
        <div className="flex gap-2 flex-wrap">
          {(['', 'true', 'false'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVerifiedFilter(v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                verifiedFilter === v
                  ? 'text-white border-transparent'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
              style={verifiedFilter === v ? { backgroundColor: '#1C2E4A' } : {}}
            >
              {v === '' ? 'All' : v === 'true' ? 'Verified' : 'Unverified'}
            </button>
          ))}
          {(['', 'true', 'false'] as const).map((v) => (
            <button
              key={`a${v}`}
              onClick={() => setActiveFilter(v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                activeFilter === v
                  ? 'text-white border-transparent'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
              style={activeFilter === v ? { backgroundColor: '#1C2E4A' } : {}}
            >
              {v === '' ? 'All Status' : v === 'true' ? 'Active' : 'Inactive'}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-400 ml-auto">{data?.count ?? 0} stores</span>
      </div>

      <div className="space-y-3">
        {stores.map((store) => (
          <div key={store.id} className="card p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm" style={{ color: '#1C2E4A' }}>{store.name}</span>
                  <span className={`badge ${store.is_verified ? 'badge-blue' : 'badge-yellow'}`}>
                    {store.is_verified ? '✓ Verified' : 'Unverified'}
                  </span>
                  <span className={`badge ${store.is_active ? 'badge-green' : 'badge-red'}`}>
                    {store.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="badge badge-navy">{TYPE_LABELS[store.store_type] ?? store.store_type}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {store.locality} · {store.category} · Owner: {store.owner_name} ({store.owner_phone})
                  {store.owner_profile_id && <span className="ml-1 font-mono font-semibold" style={{ color: '#C8973A' }}>{store.owner_profile_id}</span>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {store.product_count} products · {store.video_count} videos · Score: {store.performance_score} · Wallet: ₹{parseFloat(store.wallet_balance || '0').toLocaleString()}
                </p>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <div className="flex gap-2">
                  <button
                    onClick={() => patch.mutate({ id: store.id, payload: { is_verified: !store.is_verified } })}
                    disabled={patch.isPending}
                    className={store.is_verified ? 'btn-outline btn-sm' : 'btn-primary btn-sm'}
                  >
                    {store.is_verified ? 'Unverify' : 'Verify'}
                  </button>
                  <button
                    onClick={() => patch.mutate({ id: store.id, payload: { is_active: !store.is_active } })}
                    disabled={patch.isPending}
                    className={store.is_active ? 'btn-danger btn-sm' : 'btn-outline btn-sm'}
                  >
                    {store.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>

                {isMaster && (
                  <div className="flex items-center gap-2">
                    {changingTypeId === store.id ? (
                      <select
                        defaultValue={store.store_type}
                        onChange={(e) => {
                          patch.mutate({ id: store.id, payload: { store_type: e.target.value } });
                          setChangingTypeId(null);
                        }}
                        onBlur={() => setChangingTypeId(null)}
                        autoFocus
                        className="input py-1 text-xs"
                      >
                        <option value="product">Products</option>
                        <option value="service">Services</option>
                        <option value="home">Home</option>
                      </select>
                    ) : (
                      <button
                        onClick={() => setChangingTypeId(store.id)}
                        className="btn-ghost btn-sm text-xs"
                      >
                        Change Type
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {stores.length === 0 && (
          <div className="card p-12 text-center text-gray-400">No stores found</div>
        )}
      </div>
    </div>
  );
}

export default function AdminStoresIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <Inner />
      </AdminShell>
    </QueryClientProvider>
  );
}
