import { useState } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

interface Batch {
  id: string;
  variant: string;
  variant_name: string;
  batch_number: string;
  quantity: string;
  remaining_qty: string;
  unit: string;
  expiry_date: string | null;
  days_to_expiry: number | null;
  is_expired: boolean;
  is_perishable: boolean;
  temperature_zone: string;
  notes: string;
}

const DAY_OPTIONS = [3, 7, 14, 30];

function urgencyLabel(days: number | null, expired: boolean) {
  if (expired || days === 0) return { label: 'Expired', color: 'bg-red-100 text-red-700 border-red-200' };
  if (days !== null && days <= 3)  return { label: 'Critical (≤3d)', color: 'bg-red-50 text-red-600 border-red-100' };
  if (days !== null && days <= 7)  return { label: 'Warning (≤7d)', color: 'bg-orange-50 text-orange-600 border-orange-100' };
  return { label: 'Soon', color: 'bg-amber-50 text-amber-600 border-amber-100' };
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Inner() {
  const [days, setDays] = useState(7);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['near-expiry', days],
    queryFn: () => api.get('/inventory/grocery-batches/near-expiry/', { params: { days } }).then(r => r.data),
  });

  const batches: Batch[] = data?.batches ?? [];
  const count: number = data?.count ?? 0;

  const expired   = batches.filter(b => b.is_expired || (b.days_to_expiry !== null && b.days_to_expiry <= 0));
  const critical  = batches.filter(b => !b.is_expired && b.days_to_expiry !== null && b.days_to_expiry > 0  && b.days_to_expiry <= 3);
  const warning   = batches.filter(b => !b.is_expired && b.days_to_expiry !== null && b.days_to_expiry > 3  && b.days_to_expiry <= 7);
  const upcoming  = batches.filter(b => !b.is_expired && b.days_to_expiry !== null && b.days_to_expiry > 7);

  const sections = [
    { title: '🚨 Expired', items: expired,  bg: 'bg-red-50',    headerColor: 'text-red-700' },
    { title: '⚠️ Critical (≤3 days)', items: critical, bg: 'bg-orange-50', headerColor: 'text-orange-700' },
    { title: '⏳ Warning (4–7 days)', items: warning,  bg: 'bg-amber-50',  headerColor: 'text-amber-700' },
    { title: '📅 Upcoming',           items: upcoming, bg: 'bg-blue-50',   headerColor: 'text-blue-700' },
  ].filter(s => s.items.length > 0);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">Near Expiry</h2>
          <p className="text-sm text-gray-400 mt-0.5">Batches expiring within the selected window</p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
          ↺ Refresh
        </button>
      </div>

      {/* Day filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide mr-1">Show next</span>
        {DAY_OPTIONS.map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
              days === d ? 'bg-navy text-white border-navy' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {d}d
          </button>
        ))}
      </div>

      {/* Count badge */}
      {!isLoading && !isError && (
        <p className="text-sm font-semibold text-gray-500">
          {count === 0 ? 'No batches expiring soon' : `${count} batch${count !== 1 ? 'es' : ''} found`}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="card h-16 animate-pulse" />)}
        </div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : batches.length === 0 ? (
        <div className="card p-16 text-center text-gray-400">
          <div className="text-5xl mb-4">✅</div>
          <p className="font-semibold text-gray-600 text-lg">All good for the next {days} days!</p>
          <p className="text-sm mt-1">No batches expiring within this window</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map(section => (
            <div key={section.title}>
              <h3 className={`text-sm font-bold uppercase tracking-wide mb-3 ${section.headerColor}`}>
                {section.title} ({section.items.length})
              </h3>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100">
                    <tr className="text-[11px] text-gray-400 uppercase tracking-wide">
                      <th className="text-left px-4 py-3">Variant / Batch</th>
                      <th className="text-right px-4 py-3">Qty Left</th>
                      <th className="text-center px-4 py-3">Expiry</th>
                      <th className="text-center px-4 py-3 hidden sm:table-cell">Days</th>
                      <th className="text-center px-4 py-3 hidden md:table-cell">Zone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {section.items.map(batch => {
                      const { label, color } = urgencyLabel(batch.days_to_expiry, batch.is_expired);
                      return (
                        <tr key={batch.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-navy truncate max-w-[180px]">{batch.variant_name}</p>
                            {batch.batch_number && (
                              <p className="text-xs text-gray-400 font-mono">{batch.batch_number}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-gray-700">{batch.remaining_qty}</span>
                            <span className="text-xs text-gray-400 ml-1">{batch.unit}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs text-gray-600">
                              {batch.expiry_date ? fmt(batch.expiry_date) : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center hidden sm:table-cell">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${color}`}>
                              {label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center hidden md:table-cell">
                            <span className="text-xs text-gray-400 capitalize">{batch.temperature_zone}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VendorNearExpiryIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
