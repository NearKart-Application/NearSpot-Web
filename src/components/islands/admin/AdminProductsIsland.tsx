import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';

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

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const STATUS_BADGE: Record<string, string> = {
  active: 'badge-green',
  draft: 'badge-yellow',
  inactive: 'badge-red',
};

function Inner() {
  const qc = useQueryClient();
  const [search, setSearch]         = useState('');
  const [status, setStatus]         = useState('');
  const [storeName, setStoreName]   = useState('');
  const dSearch    = useDebounce(search, 400);
  const dStoreName = useDebounce(storeName, 400);

  const { data, isLoading, error, refetch } = useQuery<{ count: number; results: AdminProduct[] }>({
    queryKey: ['admin-products', dSearch, status, dStoreName],
    queryFn: () =>
      api.get('/admin-panel/products/', {
        params: {
          ...(dSearch    && { search:     dSearch }),
          ...(status     && { status }),
          ...(dStoreName && { store_name: dStoreName }),
        },
      }).then((r) => r.data),
  });

  const patch = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.patch(`/admin-panel/products/${id}/`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  });

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[...Array(8)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-2xl" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-4xl mb-2">⚠️</p>
        <p className="font-semibold" style={{ color: '#1C2E4A' }}>Failed to load products</p>
        <button onClick={() => refetch()} className="btn-primary mt-4">Retry</button>
      </div>
    );
  }

  const products = data?.results ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input max-w-xs"
        />
        <input
          type="text"
          placeholder="Filter by store…"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          className="input max-w-xs"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-auto">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="inactive">Inactive</option>
        </select>
        <span className="text-sm text-gray-400 ml-auto">{data?.count ?? 0} products</span>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Product</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Store</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Category</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Price</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Visible</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium" style={{ color: '#1C2E4A' }}>{p.name}</p>
                  <p className="text-xs text-gray-400">{p.image_count} imgs · {p.variant_count} variants</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{p.store_name}</td>
                <td className="px-4 py-3 text-gray-500">{p.category}{p.subcategory ? ` / ${p.subcategory}` : ''}</td>
                <td className="px-4 py-3 font-medium" style={{ color: '#1C2E4A' }}>₹{parseFloat(p.base_price || '0').toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${STATUS_BADGE[p.status] ?? 'badge-navy'} capitalize`}>{p.status}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${p.is_visible ? 'badge-green' : 'badge-red'}`}>
                    {p.is_visible ? 'Visible' : 'Hidden'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => patch.mutate({ id: p.id, payload: { is_visible: !p.is_visible } })}
                    disabled={patch.isPending}
                    className="btn-ghost btn-sm"
                  >
                    {p.is_visible ? 'Hide' : 'Show'}
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">No products found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
