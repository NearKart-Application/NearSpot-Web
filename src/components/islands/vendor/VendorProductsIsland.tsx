import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import Img from '../../ui/Img';
import { VendorAuthGuard } from './VendorAuthGuard';

interface Product {
  id: string; name: string; category: string; product_code: string;
  base_price: number; sale_price?: number; status: string;
  is_visible: boolean; primary_image?: string; stock_total: number;
  view_count: number; last_updated_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  active:       'bg-green-100 text-green-700',
  draft:        'bg-gray-100 text-gray-600',
  inactive:     'bg-red-100 text-red-600',
  out_of_stock: 'bg-orange-100 text-orange-700',
};

function fmt(n: number) { return `₹${Number(n).toLocaleString('en-IN')}`; }
function fmtDate(s: string) { return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }); }

function Inner() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-products'],
    queryFn: () => api.get('/products/vendor/').then(r => r.data),
  });

  const toggleVisible = useMutation({
    mutationFn: ({ id, visible }: { id: string; visible: boolean }) =>
      api.patch(`/products/${id}/`, { is_visible: visible }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-products'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-products'] }),
  });

  const products: Product[] = data?.results ?? (Array.isArray(data) ? data : []);

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.product_code ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total:      products.length,
    active:     products.filter(p => p.status === 'active').length,
    draft:      products.filter(p => p.status === 'draft').length,
    outOfStock: products.filter(p => p.status === 'out_of_stock').length,
  };

  if (isError) {
    const msg = (error as any)?.response?.data?.message ?? (error as any)?.response?.data?.detail ?? (error as any)?.message ?? 'Unknown error';
    const status = (error as any)?.response?.status;
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-navy">Products</h1>
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="font-bold text-navy mb-1">Failed to load products</p>
          <p className="text-sm text-gray-500 mb-1">{msg}</p>
          {status && <p className="text-xs text-gray-400 mb-4">HTTP {status}</p>}
          {status === 401 && (
            <p className="text-sm text-red-500 mb-4">Your session expired. Please <a href="/auth/login" className="underline font-bold">log in again</a>.</p>
          )}
          <button onClick={() => refetch()} className="btn-primary px-6 py-2.5 rounded-xl text-sm font-bold">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Products</h1>
          <p className="text-sm text-gray-400">{stats.total} total · {stats.active} active · {stats.outOfStock} out of stock</p>
        </div>
        <a href="/vendor/products/new" className="btn-primary btn-sm px-4 py-2 text-sm">+ Add Product</a>
      </div>

      {/* Stat pills */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',        value: stats.total,      bg: 'bg-navy/8 text-navy' },
          { label: 'Active',       value: stats.active,     bg: 'bg-green-50 text-green-700' },
          { label: 'Draft',        value: stats.draft,      bg: 'bg-gray-100 text-gray-600' },
          { label: 'Out of Stock', value: stats.outOfStock, bg: 'bg-orange-50 text-orange-700' },
        ].map(s => (
          <div key={s.label} className={`card p-4 text-center ${s.bg}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or code…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'active', 'draft', 'inactive', 'out_of_stock'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all ${statusFilter === s ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s === 'out_of_stock' ? 'Out of Stock' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="card overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100 animate-pulse">
              <div className="w-12 h-12 bg-gray-200 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-200 rounded w-1/4" />
              </div>
              <div className="h-6 bg-gray-200 rounded-full w-16" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">📦</div>
          <p className="font-semibold text-gray-600">{search ? 'No products match your search' : 'No products yet'}</p>
          {!search && (
            <p className="text-sm mt-1">
              Add your first product to get started.{' '}
              <a href="/vendor/products/new" className="text-navy font-bold hover:underline">+ Add Product</a>
            </p>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Visible</th>
                  <th className="px-4 py-3">Views</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                          <Img src={p.primary_image} alt={p.name} fallback="product" className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="font-semibold text-navy line-clamp-1">{p.name}</p>
                          <p className="text-xs text-gray-400 capitalize">{p.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{p.product_code || '—'}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-navy">{fmt(p.base_price)}</p>
                      {p.sale_price && <p className="text-xs text-green-600">{fmt(p.sale_price)} sale</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${(p.stock_total ?? 0) === 0 ? 'text-red-500' : (p.stock_total ?? 0) <= 5 ? 'text-orange-500' : 'text-gray-700'}`}>
                        {p.stock_total ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${STATUS_BADGE[p.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {(p.status ?? '').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleVisible.mutate({ id: p.id, visible: !p.is_visible })}
                        className="relative rounded-full transition-colors"
                        style={{ width: '40px', height: '22px', background: p.is_visible ? '#1C2E4A' : '#e5e7eb' }}>
                        <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${p.is_visible ? 'translate-x-[18px]' : ''}`}
                          style={{ width: '18px', height: '18px' }} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{(p.view_count ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <a href={`/vendor/products/${p.id}/edit`} className="text-xs text-navy font-bold hover:underline">Edit</a>
                        <a href="/vendor/inventory" className="text-xs text-amber-700 font-bold hover:underline">Stock</a>
                        <button onClick={() => {
                          if (confirm(`Delete "${p.name}"?`)) deleteMut.mutate(p.id);
                        }} className="text-xs text-red-500 font-bold hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VendorProductsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <VendorAuthGuard>
        <Inner />
      </VendorAuthGuard>
    </QueryClientProvider>
  );
}
