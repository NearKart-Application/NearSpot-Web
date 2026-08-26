import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';

interface AdminReservationCustomer { id: string; full_name: string; phone_number: string; }
interface AdminReservationStore    { id: string; name: string; locality: string; phone: string; }
interface AdminReservationProduct  { id: string; name: string; base_price: string; }

interface AdminReservation {
  id: string;
  customer: AdminReservationCustomer;
  store: AdminReservationStore;
  product: AdminReservationProduct;
  variant_name: string | null;
  quantity: number;
  status: string;
  discount_amount: string;
  expires_at: string;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  ready:     'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
  expired:   'bg-gray-100 text-gray-500',
};

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function Inner() {
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('');
  const dSearch = useDebounce(search, 400);

  const { data, isLoading, isError } = useQuery<{ count: number; results: AdminReservation[] }>({
    queryKey: ['admin-reservations', dSearch, statusFilter],
    queryFn: () =>
      api.get('/reservations/', {
        params: {
          ...(dSearch && { search: dSearch }),
          ...(statusFilter && { status: statusFilter }),
          page_size: 50,
        },
      }).then(r => r.data),
  });

  const rows: AdminReservation[] = data?.results ?? [];

  return (
    <AdminShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#1C2E4A' }}>Reservations</h1>
            <p className="text-sm text-gray-400">{data?.count ?? 0} total</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customer, store, product…"
            className="input text-sm py-2 px-3 rounded-lg flex-1 min-w-48"
          />
          <select
            value={statusFilter}
            onChange={e => setStatus(e.target.value)}
            className="input text-sm py-2 px-3 rounded-lg"
          >
            <option value="">All Statuses</option>
            {['pending', 'confirmed', 'ready', 'completed', 'cancelled', 'expired'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Customer</th>
                  <th className="text-left px-4 py-3">Store</th>
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-left px-4 py-3">Qty</th>
                  <th className="text-left px-4 py-3">Discount</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Reserved At</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {[...Array(7)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                )}
                {!isLoading && isError && (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">Failed to load reservations.</td></tr>
                )}
                {!isLoading && !isError && rows.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">No reservations found.</td></tr>
                )}
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium" style={{ color: '#1C2E4A' }}>
                      <div>{r.customer.full_name}</div>
                      <div className="text-xs text-gray-400">{r.customer.phone_number}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.store.name}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">
                      {r.product.name}{r.variant_name ? ` · ${r.variant_name}` : ''}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.quantity}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#1C2E4A' }}>
                      {parseFloat(r.discount_amount) > 0 ? `-₹${r.discount_amount}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

export default function AdminReservationsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <Inner />
    </QueryClientProvider>
  );
}
