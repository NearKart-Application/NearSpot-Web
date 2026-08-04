import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

interface AdminProduct {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  status: 'active' | 'draft' | 'inactive';
  base_price: string;
  is_visible: boolean;
  store_name: string;
  image_count: number;
  variant_count: number;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  active:   'badge-green',
  draft:    'badge-yellow',
  inactive: 'badge-red',
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

  const [search,        setSearch]        = useState('');
  const [storeName,     setStoreName]     = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');
  const [visibleFilter, setVisibleFilter] = useState<'' | 'true' | 'false'>('');
  const [page,          setPage]          = useState(1);
  const [pageSize,      setPageSize]      = useState<20 | 50 | 100>(20);

  const dSearch    = useDebounce(search, 400);
  const dStoreName = useDebounce(storeName, 400);

  useEffect(() => { setPage(1); }, [dSearch, dStoreName, statusFilter, visibleFilter, pageSize]);

  const { data, isLoading, error, refetch } = useQuery<{ count: number; results: AdminProduct[] }>({
    queryKey: ['admin-products', dSearch, dStoreName, statusFilter, visibleFilter, page, pageSize],
    queryFn: () =>
      api.get('/admin-panel/products/', {
        params: {
          page,
          page_size: pageSize,
          ...(dSearch       && { search:     dSearch }),
          ...(dStoreName    && { store_name: dStoreName }),
          ...(statusFilter  && { status:     statusFilter }),
          ...(visibleFilter && { is_visible: visibleFilter }),
        },
      }).then((r) => r.data),
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const patch = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.patch(`/admin-panel/products/${id}/`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  });

  const products   = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-4xl mb-2">⚠️</p>
        <p className="font-semibold text-gray-800">Failed to load products</p>
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
        {/* Search inputs + page size */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 w-52"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter by store…"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="input pl-9 w-48"
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

        {/* Filter buttons row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status */}
          <div className="flex gap-1">
            {(['', 'active', 'draft', 'inactive'] as const).map((s) => (
              <FilterButton key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
                {s === '' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
              </FilterButton>
            ))}
          </div>

          <div className="w-px h-4 bg-gray-200" />

          {/* Visibility */}
          <div className="flex gap-1">
            {(['', 'true', 'false'] as const).map((v) => (
              <FilterButton key={`v${v}`} active={visibleFilter === v} onClick={() => setVisibleFilter(v)}>
                {v === '' ? 'Any Visibility' : v === 'true' ? 'Visible' : 'Hidden'}
              </FilterButton>
            ))}
          </div>

          <span className="text-sm text-gray-400 ml-auto whitespace-nowrap">
            {isLoading ? 'Loading…' : `${totalCount.toLocaleString()} products`}
          </span>
        </div>
      </div>

      {/* ── Table ── */}
      <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-opacity ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Product</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Store</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Category</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Price</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Visibility</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && products.length === 0
              ? [...Array(8)].map((_, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td colSpan={7} className="px-4 py-3">
                    <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4" />
                  </td>
                </tr>
              ))
              : products.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.image_count} imgs · {p.variant_count} variants</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{p.store_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {p.category}{p.subcategory ? ` / ${p.subcategory}` : ''}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    ₹{parseFloat(p.base_price || '0').toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_BADGE[p.status] ?? 'badge-navy'} capitalize`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${p.is_visible ? 'badge-green' : 'badge-red'}`}>
                      {p.is_visible ? 'Visible' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => patch.mutate({ id: p.id, payload: { is_visible: !p.is_visible } })}
                        disabled={patch.isPending}
                        className="text-xs"
                      >
                        {p.is_visible ? 'Hide' : 'Show'}
                      </Button>
                      {p.status === 'active' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => patch.mutate({ id: p.id, payload: { status: 'inactive' } })}
                          disabled={patch.isPending}
                          className="text-xs"
                        >
                          Deactivate
                        </Button>
                      )}
                      {p.status === 'inactive' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => patch.mutate({ id: p.id, payload: { status: 'active' } })}
                          disabled={patch.isPending}
                          className="text-xs"
                        >
                          Activate
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            }
            {!isLoading && products.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  No products match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
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
                  <span key={`el-${i}`} className="px-1 text-gray-400 text-sm">…</span>
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
                  >{p}</button>
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

export default function AdminProductsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <Inner />
      </AdminShell>
    </QueryClientProvider>
  );
}
