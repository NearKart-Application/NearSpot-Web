import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery, keepPreviousData } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';
import { Search, ArrowLeft, Store } from 'lucide-react';

interface StoreOption {
  id: string; name: string; owner_phone: string; locality: string; is_active: boolean;
}

interface StockLog {
  id: string;
  product_name: string; variant_name: string; sku: string;
  old_qty: number; new_qty: number; delta: number;
  reason: string; note: string; changed_by: string; created_at: string;
}

const REASON_META: Record<string, { label: string; color: string }> = {
  manual:      { label: 'Manual',      color: 'bg-blue-100 text-blue-700' },
  reservation: { label: 'Reservation', color: 'bg-purple-100 text-purple-700' },
  restoration: { label: 'Restored',    color: 'bg-green-100 text-green-700' },
  restock:     { label: 'Restock',     color: 'bg-teal-100 text-teal-700' },
  invoice:     { label: 'Invoice',     color: 'bg-orange-100 text-orange-700' },
};

const PAGE_SIZE = 30;

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ── Step 1: Store selector ────────────────────────────────────────────────────
function StoreSelector({ onSelect }: { onSelect: (s: { id: string; name: string }) => void }) {
  const [query, setQuery] = useState('');
  const dQuery = useDebounce(query, 300);

  const { data, isLoading } = useQuery<{ results: StoreOption[] }>({
    queryKey: ['admin-store-search', dQuery],
    queryFn: () =>
      api.get('/admin-panel/stores/', { params: { search: dQuery, page_size: 8 } }).then(r => r.data),
    enabled: dQuery.length >= 1,
  });

  const stores = data?.results ?? [];

  return (
    <div className="max-w-xl mx-auto pt-8 space-y-6">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-navy/5 flex items-center justify-center mx-auto mb-4">
          <Store className="w-7 h-7 text-navy" />
        </div>
        <h2 className="text-lg font-bold text-navy">Select a Store</h2>
        <p className="text-sm text-gray-400 mt-1">Search for a vendor store to inspect its stock change history</p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Store name or owner phone…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
          className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10 bg-white shadow-sm"
        />
      </div>

      {/* Results */}
      {dQuery.length >= 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : stores.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">No stores found for "{dQuery}"</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {stores.map(s => (
                <button
                  key={s.id}
                  onClick={() => onSelect({ id: s.id, name: s.name })}
                  className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-left group"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-navy text-sm truncate">{s.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.owner_phone}{s.locality ? ` · ${s.locality}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-gray-300 group-hover:text-navy transition-colors text-sm">→</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {dQuery.length === 0 && (
        <p className="text-center text-xs text-gray-400">Start typing to search stores</p>
      )}
    </div>
  );
}

// ── Step 2: Log table for a selected store ────────────────────────────────────
function StoreStockLog({ storeId, storeName, onBack }: { storeId: string; storeName: string; onBack: () => void }) {
  const [page, setPage] = useState(1);
  const [reason, setReason] = useState('');

  const { data, isLoading, error, refetch } = useQuery<{ count: number; results: StockLog[] }>({
    queryKey: ['admin-stock-logs', storeId, page, reason],
    queryFn: () =>
      api.get('/admin-panel/stock-logs/', {
        params: {
          store_id: storeId,
          page,
          page_size: PAGE_SIZE,
          ...(reason && { reason }),
        },
      }).then(r => r.data),
    placeholderData: keepPreviousData,
  });

  const logs = data?.results ?? [];
  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-navy truncate">{storeName}</h1>
          <p className="text-xs text-gray-400">Stock change history · {data?.count ?? '…'} entries</p>
        </div>
      </div>

      {/* Reason filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-gray-400">Filter:</span>
        {(['', 'manual', 'reservation', 'restoration', 'restock', 'invoice'] as const).map(r => (
          <button
            key={r || 'all'}
            onClick={() => { setReason(r); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              reason === r ? 'bg-navy text-white border-navy' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {r ? (REASON_META[r]?.label ?? r) : 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-gray-200 rounded-2xl" />)}
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
          <p className="font-semibold text-gray-600">Failed to load logs</p>
          <button onClick={() => refetch()} className="mt-3 px-4 py-2 rounded-xl bg-navy text-white text-xs font-bold">Retry</button>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
          <div className="text-4xl mb-3">📋</div>
          <p className="font-semibold text-gray-600">No stock changes found</p>
          <p className="text-sm text-gray-400 mt-1">{reason ? 'Try a different reason filter' : 'No stock updates have been recorded for this store yet'}</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-5 py-3">Product / Variant</th>
                  <th className="text-center px-4 py-3">Change</th>
                  <th className="text-center px-4 py-3 hidden sm:table-cell">Reason</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Note</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Changed By</th>
                  <th className="text-right px-5 py-3">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => {
                  const isUp   = log.delta > 0;
                  const isDown = log.delta < 0;
                  const rm = REASON_META[log.reason] ?? { label: log.reason, color: 'bg-gray-100 text-gray-600' };
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-navy text-sm truncate max-w-[160px]">{log.product_name}</p>
                        <p className="text-xs text-gray-400">{log.variant_name}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-xs text-gray-400">{log.old_qty}</span>
                          <span className="text-gray-300 text-xs">→</span>
                          <span className="text-xs font-bold text-gray-700">{log.new_qty}</span>
                          <span className={`text-xs font-black ml-1 ${isUp ? 'text-green-600' : isDown ? 'text-red-500' : 'text-gray-400'}`}>
                            {isUp ? `+${log.delta}` : log.delta}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rm.color}`}>{rm.label}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-gray-500 truncate max-w-[120px] block">{log.note || '—'}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs font-mono text-gray-400">{log.changed_by}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-xs text-gray-400 whitespace-nowrap">{fmt(log.created_at)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">{data?.count} entries · page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  ← Prev
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
function Inner() {
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  // Support deep-link: /admin/stock-logs?store_id=xxx&store_name=Yyy
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const sid  = p.get('store_id');
    const name = p.get('store_name');
    if (sid) setSelected({ id: sid, name: name ?? 'Store' });
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1C2E4A' }}>Stock Change Log</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {selected ? `Showing logs for ${selected.name}` : 'Select a store to view its inventory history'}
          </p>
        </div>
      </div>

      {selected ? (
        <StoreStockLog
          storeId={selected.id}
          storeName={selected.name}
          onBack={() => {
            setSelected(null);
            // Clear URL params without reload
            window.history.replaceState({}, '', '/admin/stock-logs');
          }}
        />
      ) : (
        <StoreSelector onSelect={setSelected} />
      )}
    </div>
  );
}

export default function AdminStockLogsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <Inner />
      </AdminShell>
    </QueryClientProvider>
  );
}
