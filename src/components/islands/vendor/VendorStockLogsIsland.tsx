import { useState } from 'react';
import { QueryClientProvider, useQuery, keepPreviousData } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

interface StockLog {
  id: string;
  product_id: string; product_name: string;
  variant_id: string; variant_name: string; sku: string;
  old_qty: number; new_qty: number; delta: number;
  reason: string; note: string; changed_by: string; created_at: string;
}

const LOG_PAGE_SIZE = 25;

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  manual:               { label: 'Manual',          color: 'bg-blue-100 text-blue-700' },
  reservation:          { label: 'Reservation',     color: 'bg-purple-100 text-purple-700' },
  restoration:          { label: 'Restored',        color: 'bg-green-100 text-green-700' },
  restock:              { label: 'Restock',         color: 'bg-teal-100 text-teal-700' },
  invoice:              { label: 'Invoice',         color: 'bg-orange-100 text-orange-700' },
  damage:               { label: 'Damage',          color: 'bg-red-100 text-red-700' },
  return_from_customer: { label: 'Customer Return', color: 'bg-cyan-100 text-cyan-700' },
  audit_adjustment:     { label: 'Audit Adj.',      color: 'bg-gray-100 text-gray-600' },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function Inner() {
  const [page, setPage]     = useState(1);
  const [reason, setReason] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-stock-logs', page, reason],
    queryFn: () => api.get('/products/vendor/stock-logs/', {
      params: { page, page_size: LOG_PAGE_SIZE, ...(reason ? { reason } : {}) },
    }).then(r => r.data),
    placeholderData: keepPreviousData,
  });

  const logs: StockLog[]  = data?.results ?? [];
  const totalCount: number = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / LOG_PAGE_SIZE);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">Stock Logs</h2>
          <p className="text-sm text-gray-400 mt-0.5">Complete history of every stock movement in your store</p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
          ↺ Refresh
        </button>
      </div>

      {/* Reason filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide mr-1">Filter</span>
        {['', 'manual', 'reservation', 'restoration', 'restock', 'invoice', 'damage', 'return_from_customer', 'audit_adjustment'].map(r => (
          <button key={r || 'all'} onClick={() => { setReason(r); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              reason === r
                ? 'bg-navy text-white border-navy'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {r ? (REASON_LABELS[r]?.label ?? r) : 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-14 card animate-pulse" />)}</div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : logs.length === 0 ? (
        <div className="card p-14 text-center text-gray-400">
          <div className="text-4xl mb-3">📋</div>
          <p className="font-semibold text-gray-600">No stock changes yet</p>
          <p className="text-sm mt-1">Every stock update will be recorded here automatically</p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Product / Variant</th>
                  <th className="text-center px-4 py-3">Change</th>
                  <th className="text-center px-4 py-3 hidden sm:table-cell">Reason</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Note</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">By</th>
                  <th className="text-right px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => {
                  const isUp   = log.delta > 0;
                  const isDown = log.delta < 0;
                  const info   = REASON_LABELS[log.reason] ?? { label: log.reason, color: 'bg-gray-100 text-gray-600' };
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-navy text-sm truncate max-w-[140px]">{log.product_name}</p>
                        <p className="text-xs text-gray-400">{log.variant_name}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-xs text-gray-400">{log.old_qty}</span>
                          <span className="text-gray-300">→</span>
                          <span className="text-xs font-bold text-gray-700">{log.new_qty}</span>
                          <span className={`text-xs font-black ml-1 ${isUp ? 'text-green-600' : isDown ? 'text-red-500' : 'text-gray-400'}`}>
                            {isUp ? `+${log.delta}` : log.delta}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${info.color}`}>
                          {info.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-gray-500 truncate max-w-[120px] block">{log.note || '—'}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-gray-400 font-mono">{log.changed_by}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs text-gray-400 whitespace-nowrap">{fmt(log.created_at)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">{totalCount} entries · page {page} of {totalPages}</p>
            {totalPages > 1 && (
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  ← Prev
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  Next →
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function VendorStockLogsIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
