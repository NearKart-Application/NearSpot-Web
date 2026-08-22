import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { auth } from '../../../lib/auth';
import { AdminShell } from './AdminShell';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

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

const TYPE_LABELS: Record<string, string> = {
  product: '🛍 Products',
  service: '🛠 Services',
  home:    '🏠 Home',
};

const PAGE_SIZES = [20, 50, 100] as const;

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
        active
          ? 'text-white border-transparent'
          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
      }`}
      style={active ? { backgroundColor: '#0F172A' } : {}}
    >
      {children}
    </button>
  );
}

function Inner() {
  const qc = useQueryClient();
  const _u = auth.user() as any;
  const isMaster = (_u?.ui_mode ?? _u?.role) === 'master_admin';

  const [search,        setSearch]        = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState<'' | 'true' | 'false'>('');
  const [activeFilter,   setActiveFilter]   = useState<'' | 'true' | 'false'>('');
  const [typeFilter,     setTypeFilter]     = useState<'' | 'product' | 'service' | 'home'>('');
  const [page,           setPage]           = useState(1);
  const [pageSize,       setPageSize]       = useState<20 | 50 | 100>(20);
  const [changingTypeId, setChangingTypeId] = useState<string | null>(null);

  const dSearch = useDebounce(search, 400);

  useEffect(() => { setPage(1); }, [dSearch, verifiedFilter, activeFilter, typeFilter, pageSize]);

  const { data, isLoading, error, refetch } = useQuery<{ count: number; results: AdminStore[] }>({
    queryKey: ['admin-stores', dSearch, verifiedFilter, activeFilter, typeFilter, page, pageSize],
    queryFn: () =>
      api.get('/admin-panel/stores/', {
        params: {
          page,
          page_size: pageSize,
          ...(dSearch        && { search:      dSearch }),
          ...(verifiedFilter && { is_verified: verifiedFilter }),
          ...(activeFilter   && { is_active:   activeFilter }),
          ...(typeFilter     && { store_type:  typeFilter }),
        },
      }).then((r) => r.data),
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const patch = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.patch(`/admin-panel/stores/${id}/`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-stores'] }),
  });

  const stores     = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-4xl mb-2">⚠️</p>
        <p className="font-semibold text-gray-800">Failed to load stores</p>
        <p className="text-sm text-gray-400 mt-1">
          {(error as any)?.response?.data?.detail ?? 'Check your connection'}
        </p>
        <Button onClick={() => refetch()} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3">
        {/* Search + page size */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 w-64"
            />
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-gray-400 whitespace-nowrap">Rows:</span>
            {PAGE_SIZES.map((s) => (
              <FilterButton key={s} active={pageSize === s} onClick={() => setPageSize(s)}>
                {s}
              </FilterButton>
            ))}
          </div>
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {(['', 'true', 'false'] as const).map((v) => (
              <FilterButton key={v} active={verifiedFilter === v} onClick={() => setVerifiedFilter(v)}>
                {v === '' ? 'All' : v === 'true' ? '✓ Verified' : 'Unverified'}
              </FilterButton>
            ))}
          </div>

          <div className="w-px h-4 bg-gray-200" />

          <div className="flex gap-1">
            {(['', 'true', 'false'] as const).map((v) => (
              <FilterButton key={`a${v}`} active={activeFilter === v} onClick={() => setActiveFilter(v)}>
                {v === '' ? 'Any Status' : v === 'true' ? 'Active' : 'Inactive'}
              </FilterButton>
            ))}
          </div>

          <div className="w-px h-4 bg-gray-200" />

          <div className="flex gap-1">
            {(['', 'product', 'service', 'home'] as const).map((v) => (
              <FilterButton key={`t${v}`} active={typeFilter === v} onClick={() => setTypeFilter(v)}>
                {v === '' ? 'All Types' : TYPE_LABELS[v]}
              </FilterButton>
            ))}
          </div>

          <span className="text-sm text-gray-400 ml-auto whitespace-nowrap">
            {isLoading ? 'Loading…' : `${totalCount.toLocaleString()} stores`}
          </span>
        </div>
      </div>

      {/* ── Store list ── */}
      <div className={`space-y-3 transition-opacity ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
        {isLoading && stores.length === 0
          ? [...Array(5)].map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-2xl animate-pulse" />)
          : stores.map((store) => (
            <div key={store.id} className="card p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-900">{store.name}</span>
                    <span className={`badge ${store.is_verified ? 'badge-blue' : 'badge-yellow'}`}>
                      {store.is_verified ? '✓ Verified' : 'Unverified'}
                    </span>
                    <span className={`badge ${store.is_active ? 'badge-green' : 'badge-red'}`}>
                      {store.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="badge badge-navy">{TYPE_LABELS[store.store_type] ?? store.store_type}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {store.locality} · {store.category} · {store.owner_name} ({store.owner_phone})
                    {store.owner_profile_id && (
                      <span className="ml-1 font-mono font-semibold" style={{ color: '#F59E0B' }}>
                        {store.owner_profile_id}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {store.product_count} products · {store.video_count} videos · Score: {store.performance_score} · Wallet: ₹{parseFloat(store.wallet_balance || '0').toLocaleString()}
                  </p>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <div className="flex gap-2">
                    <Button
                      variant={store.is_verified ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => patch.mutate({ id: store.id, payload: { is_verified: !store.is_verified } })}
                      disabled={patch.isPending}
                    >
                      {store.is_verified ? 'Unverify' : 'Verify'}
                    </Button>
                    <Button
                      variant={store.is_active ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => patch.mutate({ id: store.id, payload: { is_active: !store.is_active } })}
                      disabled={patch.isPending}
                    >
                      {store.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <a
                      href={`/admin/stock-logs?store_id=${store.id}&store_name=${encodeURIComponent(store.name)}`}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 hover:border-navy/30 hover:text-navy transition-colors"
                    >
                      Stock Log
                    </a>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setChangingTypeId(store.id)}
                          className="text-xs"
                        >
                          Change Type
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        }

        {!isLoading && stores.length === 0 && (
          <div className="card p-12 text-center text-gray-400">No stores match your filters</div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages} · {((page - 1) * pageSize + 1).toLocaleString()}–{Math.min(page * pageSize, totalCount).toLocaleString()} of {totalCount.toLocaleString()}
          </p>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setPage(1)} disabled={page === 1} className="px-2">«</Button>
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | '…')[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '…' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-gray-400 text-sm">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                      page === p
                        ? 'text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                    style={page === p ? { backgroundColor: '#0F172A' } : {}}
                  >
                    {p}
                  </button>
                )
              )}

            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2">»</Button>
          </div>
        </div>
      )}
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
