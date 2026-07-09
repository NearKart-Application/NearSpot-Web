import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';
import Img from '../../ui/Img';

interface Variant { id: string; name: string; sku: string; price: number; stock_quantity: number; }
interface StockAlert {
  id: string; name: string; product_code: string; status: string;
  primary_image?: string;
  low_variants: { id: string; name: string; stock_quantity: number }[];
}

function EditStockModal({ variant, productId, onClose, onSuccess }: {
  variant: Variant; productId: string; onClose: () => void; onSuccess: () => void;
}) {
  const [qty, setQty] = useState(String(variant.stock_quantity));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const updateMut = useMutation({
    mutationFn: () => api.patch(`/products/${productId}/variants/${variant.id}/`, {
      stock_quantity: parseInt(qty), note,
    }),
    onSuccess: () => onSuccess(),
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Failed to update'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-navy">Update Stock — {variant.name}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Current: <span className="font-bold text-navy">{variant.stock_quantity}</span> units</p>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">New Quantity</label>
        <input type="number" min="0" value={qty} onChange={e => setQty(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm mb-3 focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10" />
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Note (optional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. restock, damage, sale"
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm mb-3 focus:outline-none focus:border-navy/40" />
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
        <button onClick={() => updateMut.mutate()} disabled={updateMut.isPending || !qty}
          className="w-full btn-primary py-3 rounded-xl font-bold">
          {updateMut.isPending ? 'Updating…' : 'Update Stock'}
        </button>
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: StockAlert }) {
  const qc = useQueryClient();
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);

  const { data: variantsData } = useQuery({
    queryKey: ['product-variants', alert.id],
    queryFn: () => api.get(`/products/${alert.id}/variants/`).then(r => r.data),
  });

  const variants: Variant[] = variantsData?.results ?? (Array.isArray(variantsData) ? variantsData : []);

  return (
    <div className="card p-5">
      <div className="flex items-start gap-4 mb-3">
        <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0">
          <Img src={alert.primary_image} alt={alert.name} fallback="product" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-navy">{alert.name}</h3>
          <p className="text-xs text-gray-400 font-mono">{alert.product_code}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${
            alert.status === 'out_of_stock' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-700'
          }`}>
            {alert.status === 'out_of_stock' ? '⚠️ Out of Stock' : '⚠️ Low Stock'}
          </span>
        </div>
      </div>

      {/* Variants */}
      {variants.length > 0 && (
        <div className="space-y-2">
          {variants.map(v => (
            <div key={v.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-gray-700">{v.name}</p>
                <p className="text-xs text-gray-400">SKU: {v.sku || '—'}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold ${v.stock_quantity === 0 ? 'text-red-500' : v.stock_quantity <= 5 ? 'text-orange-500' : 'text-gray-700'}`}>
                  {v.stock_quantity} units
                </span>
                <button onClick={() => setEditingVariant(v)}
                  className="text-xs font-bold text-navy hover:underline">Edit</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingVariant && (
        <EditStockModal
          variant={editingVariant} productId={alert.id}
          onClose={() => setEditingVariant(null)}
          onSuccess={() => {
            setEditingVariant(null);
            qc.invalidateQueries({ queryKey: ['product-variants', alert.id] });
            qc.invalidateQueries({ queryKey: ['vendor-stock-alerts'] });
          }}
        />
      )}
    </div>
  );
}

function Inner() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-stock-alerts'],
    queryFn: () => api.get('/products/vendor/stock-alerts/').then(r => r.data),
  });

  const { data: allProducts } = useQuery({
    queryKey: ['vendor-products-inventory'],
    queryFn: () => api.get('/products/vendor/').then(r => r.data),
  });

  const alerts: StockAlert[] = data?.results ?? (Array.isArray(data) ? data : []);
  const products = (allProducts?.results ?? (Array.isArray(allProducts) ? allProducts : [])) as any[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Inventory</h1>
        <p className="text-sm text-gray-400">{alerts.length} product{alerts.length !== 1 ? 's' : ''} need attention</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Products', value: products.length, icon: '📦' },
          { label: 'Low Stock', value: alerts.filter(a => a.status !== 'out_of_stock').length, icon: '⚠️' },
          { label: 'Out of Stock', value: alerts.filter(a => a.status === 'out_of_stock').length, icon: '🚫' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <p className="text-xl font-bold text-navy">{s.value}</p>
            <p className="text-xs text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      <div>
        <h2 className="font-bold text-navy mb-4">Stock Alerts</h2>
        {isLoading ? (
          <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="card h-32 animate-pulse" />)}</div>
        ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : alerts.length === 0 ? (
          <div className="card p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-semibold text-gray-600">All products are well-stocked!</p>
            <p className="text-sm mt-1">You'll see alerts here when stock runs low</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map(a => <AlertCard key={a.id} alert={a} />)}
          </div>
        )}
      </div>

      {/* All products link */}
      <div className="text-center">
        <a href="/vendor/products" className="btn-outline px-6 py-2.5 text-sm">View All Products →</a>
      </div>
    </div>
  );
}

export default function VendorInventoryIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
