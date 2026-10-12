import { useState } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

interface ValuationItem {
  variant_id: string; product_name: string; variant_name: string;
  sku: string; unit: string; qty: number; cost_price: number; total_value: number;
}

interface DeadStockItem {
  variant_id: string; product_name: string; variant_name: string;
  sku: string; unit: string; qty: number; cost_price: number;
}

function Inner() {
  const [deadDays, setDeadDays] = useState(30);

  const { data: valData, isLoading: valLoading, isError: valError, error: valErr, refetch: refetchVal } = useQuery({
    queryKey: ['inventory-valuation'],
    queryFn: () => api.get('/inventory/valuation/').then(r => r.data),
  });

  const { data: deadData, isLoading: deadLoading, isError: deadError, error: deadErr, refetch: refetchDead } = useQuery({
    queryKey: ['inventory-dead-stock', deadDays],
    queryFn: () => api.get('/inventory/dead-stock/', { params: { days: deadDays } }).then(r => r.data),
  });

  const valItems: ValuationItem[] = valData?.items ?? [];
  const grandTotal: number        = valData?.grand_total ?? 0;
  const deadItems: DeadStockItem[] = deadData?.items ?? [];

  const handleExport = () => {
    const token   = localStorage.getItem('ns_access') ?? '';
    const baseUrl = (api.defaults.baseURL ?? '').replace(/\/$/, '');
    fetch(`${baseUrl}/inventory/export/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'inventory_export.csv';
        a.click();
      });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">Inventory Reports</h2>
          <p className="text-sm text-gray-400 mt-0.5">Stock valuation, dead stock analysis, and export</p>
        </div>
        <button onClick={handleExport}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navy text-white text-sm font-bold hover:bg-navy/90 transition-colors">
          ↓ Export CSV
        </button>
      </div>

      {/* Stock Valuation */}
      <div className="card p-5">
        <div className="mb-4">
          <h3 className="font-bold text-navy">Stock Valuation</h3>
          <p className="text-xs text-gray-400">Total inventory value at cost price</p>
        </div>

        {valLoading ? (
          <div className="h-24 animate-pulse bg-gray-100 rounded-xl" />
        ) : valError ? (
          <IslandError error={valErr} refetch={refetchVal} />
        ) : (
          <>
            <div className="bg-navy/5 rounded-xl p-5 mb-5 text-center">
              <p className="text-xs text-gray-500 mb-1">Grand Total Inventory Value</p>
              <p className="text-4xl font-bold text-navy">
                ₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-400 mt-1">{valItems.length} variants</p>
            </div>
            {valItems.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 uppercase tracking-wide border-b">
                      <th className="text-left pb-2">Product</th>
                      <th className="text-right pb-2">Qty</th>
                      <th className="text-right pb-2">Unit</th>
                      <th className="text-right pb-2">Cost</th>
                      <th className="text-right pb-2">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {valItems.slice(0, 25).map(v => (
                      <tr key={v.variant_id} className="text-gray-600">
                        <td className="py-2 pr-2">
                          <p className="font-semibold text-navy truncate max-w-[180px]">{v.product_name}</p>
                          <p className="text-gray-400">{v.variant_name}</p>
                        </td>
                        <td className="text-right py-2">{v.qty}</td>
                        <td className="text-right py-2">{v.unit}</td>
                        <td className="text-right py-2">₹{v.cost_price.toFixed(2)}</td>
                        <td className="text-right py-2 font-bold text-navy">
                          ₹{v.total_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {valItems.length > 25 && (
                  <p className="text-center text-xs text-gray-400 mt-3">
                    +{valItems.length - 25} more variants — export CSV for full list
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Dead Stock */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-navy">Dead Stock</h3>
            <p className="text-xs text-gray-400">Items with no outbound movement in the period</p>
          </div>
          <select value={deadDays} onChange={e => setDeadDays(Number(e.target.value))}
            className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-navy focus:outline-none focus:border-navy/40">
            {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}
          </select>
        </div>

        {deadLoading ? (
          <div className="h-24 animate-pulse bg-gray-100 rounded-xl" />
        ) : deadError ? (
          <IslandError error={deadErr} refetch={refetchDead} />
        ) : deadItems.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <div className="text-3xl mb-2">✅</div>
            <p className="font-semibold text-gray-600">No dead stock in {deadDays} days!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 uppercase tracking-wide border-b">
                  <th className="text-left pb-2">Product</th>
                  <th className="text-right pb-2">Qty</th>
                  <th className="text-right pb-2">Unit</th>
                  <th className="text-right pb-2">Tied-up Value</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {deadItems.map(v => (
                  <tr key={v.variant_id} className="text-gray-600">
                    <td className="py-2 pr-2">
                      <p className="font-semibold text-navy truncate max-w-[180px]">{v.product_name}</p>
                      <p className="text-gray-400">{v.variant_name} · {v.sku}</p>
                    </td>
                    <td className="text-right py-2">{v.qty}</td>
                    <td className="text-right py-2">{v.unit}</td>
                    <td className="text-right py-2 font-bold text-orange-500">
                      {v.cost_price > 0
                        ? `₹${(v.qty * v.cost_price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VendorInventoryReportsIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
