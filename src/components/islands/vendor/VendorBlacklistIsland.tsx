import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

interface BlockedCustomer {
  id: string; customer_name: string; customer_phone: string;
  reason?: string; created_at: string;
}

function Inner() {
  const qc = useQueryClient();
  const [unblockTarget, setUnblockTarget] = useState<BlockedCustomer | null>(null);
  const [search, setSearch] = useState('');

  const { data: storeData } = useQuery({
    queryKey: ['vendor-store-id'],
    queryFn: () => api.get('/stores/mine/').then(r => r.data),
  });
  const storeId = (storeData as any)?.id;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-blacklist', storeId],
    queryFn: () => api.get(`/stores/${storeId}/blacklist/`).then(r => r.data),
    enabled: !!storeId,
  });

  const unblockMut = useMutation({
    mutationFn: (customerId: string) => api.delete(`/stores/${storeId}/blacklist/${customerId}/`),
    onSuccess: () => {
      setUnblockTarget(null);
      qc.invalidateQueries({ queryKey: ['vendor-blacklist', storeId] });
    },
  });

  const customers: BlockedCustomer[] = Array.isArray(data) ? data : (data?.results ?? []);
  const filtered = search.trim()
    ? customers.filter(c =>
        c.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.customer_phone?.includes(search))
    : customers;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Blocked Customers</h1>
        <p className="text-sm text-gray-400">{customers.length} customer{customers.length !== 1 ? 's' : ''} blocked</p>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone…"
          className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card h-20 animate-pulse" />)}</div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">🚫</div>
          <p className="font-semibold text-gray-600">{customers.length === 0 ? 'No blocked customers' : 'No results found'}</p>
          <p className="text-sm mt-1">{customers.length === 0 ? 'Customers you block will appear here' : 'Try a different search'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {filtered.map(c => (
            <div key={c.id} className="flex items-start justify-between gap-4 p-5 border-b border-gray-100 last:border-0">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm shrink-0">
                {(c.customer_name || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-navy text-sm">{c.customer_name || 'Unknown'}</p>
                <p className="text-xs text-gray-400">{c.customer_phone}</p>
                {c.reason && <p className="text-xs text-gray-500 mt-1">Reason: {c.reason}</p>}
                <p className="text-xs text-gray-400 mt-0.5">
                  Blocked {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                </p>
              </div>
              <button onClick={() => setUnblockTarget(c)}
                className="text-sm font-bold text-red-500 hover:underline shrink-0">Unblock</button>
            </div>
          ))}
        </div>
      )}

      {/* Unblock confirm dialog */}
      {unblockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-navy mb-2">Unblock Customer?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Unblock {unblockTarget.customer_name || unblockTarget.customer_phone}? They will be able to interact with your store again.
            </p>
            <div className="flex gap-2">
              <button onClick={() => unblockMut.mutate(unblockTarget.id)} disabled={unblockMut.isPending}
                className="flex-1 btn-primary py-2.5 rounded-xl text-sm font-bold">
                {unblockMut.isPending ? 'Unblocking…' : 'Unblock'}
              </button>
              <button onClick={() => setUnblockTarget(null)}
                className="flex-1 btn-outline py-2.5 rounded-xl text-sm font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VendorBlacklistIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
