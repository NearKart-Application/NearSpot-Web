import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';
import Img from '../../ui/Img';
import { Button } from '@/components/ui/button';

interface Variant { id: string; name: string; sku: string; price: number; stock_quantity: number; }
interface StockAlert {
  id: string; name: string; product_code: string; status: string;
  primary_image?: string;
  low_variants: { id: string; name: string; stock_quantity: number }[];
}
interface Product {
  id: string; name: string; product_code: string;
  primary_image?: string; status: string;
  total_stock?: number; variants_count?: number;
}

const PAGE_SIZE = 15;

const STOCK_REASONS = [
  { value: 'restock',              label: '📦 Restock',         hint: 'Goods received' },
  { value: 'damage',               label: '🔴 Damage',          hint: 'Write-off' },
  { value: 'return_from_customer', label: '↩️ Customer Return', hint: 'Returned goods' },
  { value: 'manual',               label: '✏️ Manual',          hint: 'Direct edit' },
];

function EditStockModal({ variant, productId, onClose, onSuccess }: {
  variant: Variant; productId: string; onClose: () => void; onSuccess: () => void;
}) {
  const [qty, setQty]       = useState(String(variant.stock_quantity));
  const [reason, setReason] = useState('manual');
  const [note, setNote]     = useState('');
  const [error, setError]   = useState('');

  const updateMut = useMutation({
    mutationFn: () => api.patch(`/products/${productId}/variants/${variant.id}/`, {
      stock_quantity: parseInt(qty), reason, note: note.trim() || undefined,
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

        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Reason</label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {STOCK_REASONS.map(r => (
            <button key={r.value} onClick={() => setReason(r.value)}
              className={`py-2 px-3 rounded-xl border text-xs font-bold text-left transition-all ${
                reason === r.value ? 'bg-navy text-white border-navy' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              <div>{r.label}</div>
              <div className={`text-[10px] font-normal ${reason === r.value ? 'text-white/70' : 'text-gray-400'}`}>{r.hint}</div>
            </button>
          ))}
        </div>

        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">New Quantity</label>
        <input type="number" min="0" value={qty} onChange={e => setQty(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm mb-3 focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10" />

        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Note (optional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Any extra detail"
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm mb-3 focus:outline-none focus:border-navy/40" />

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
        <Button onClick={() => updateMut.mutate()} disabled={updateMut.isPending || !qty}
          className="w-full py-3 rounded-xl font-bold">
          {updateMut.isPending ? 'Updating…' : 'Update Stock'}
        </Button>
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
  const isOut = alert.status === 'out_of_stock';

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isOut ? 'border-red-100' : 'border-orange-100'}`}>
      {/* Single-line header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden shrink-0">
          <Img src={alert.primary_image} alt={alert.name} fallback="product" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-navy text-sm truncate">{alert.name}</p>
          <p className="text-[11px] text-gray-400 font-mono">{alert.product_code}</p>
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${
          isOut ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-700'
        }`}>
          {isOut ? 'Out of Stock' : 'Low Stock'}
        </span>
      </div>

      {/* Variant chips — horizontal scrollable row, each chip = click to edit */}
      {variants.length > 0 && (
        <div className={`px-4 pb-3 pt-0.5 border-t ${isOut ? 'border-red-50' : 'border-orange-50'}`}>
          <p className="text-[10px] text-gray-400 mb-1.5 mt-2">Tap to update stock</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 flex-wrap" style={{ scrollbarWidth: 'none' }}>
            {variants.map(v => {
              const isEmpty = v.stock_quantity === 0;
              const isLow = !isEmpty && v.stock_quantity <= 5;
              return (
                <button
                  key={v.id}
                  onClick={() => setEditingVariant(v)}
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all active:scale-95 ${
                    isEmpty
                      ? 'bg-red-50 border-red-200 hover:bg-red-100'
                      : isLow
                      ? 'bg-orange-50 border-orange-200 hover:bg-orange-100'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span className="font-semibold text-gray-600">{v.name}</span>
                  <span className={`font-black ${isEmpty ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-gray-700'}`}>
                    {v.stock_quantity}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="text-[10px] text-gray-400">edit</span>
                </button>
              );
            })}
          </div>
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

function StockBadge({ status, stock }: { status: string; stock?: number }) {
  if (stock === 0 || status === 'out_of_stock') {
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Out of Stock</span>;
  }
  if (typeof stock === 'number' && stock <= 5) {
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Low Stock</span>;
  }
  if (status === 'active') {
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>;
  }
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">{status}</span>;
}

function AllProductsTab() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-products-paged', page, search],
    queryFn: () => api.get('/products/vendor/', {
      params: { page, page_size: PAGE_SIZE, ...(search ? { search } : {}) },
    }).then(r => r.data),
    placeholderData: keepPreviousData,
  });

  const products: Product[] = data?.results ?? (Array.isArray(data) ? data : []);
  const totalCount: number = data?.count ?? products.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
    .reduce<(number | '…')[]>((acc, n, i, arr) => {
      if (i > 0 && typeof arr[i - 1] === 'number' && (n as number) - (arr[i - 1] as number) > 1) acc.push('…');
      acc.push(n);
      return acc;
    }, []);

  return (
    <div className="space-y-4">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          placeholder="Search products…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10 bg-gray-50 focus:bg-white transition-colors"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <div key={i} className="h-[60px] card animate-pulse" />)}
        </div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : products.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="font-semibold text-gray-600">
            {search ? `No products matching "${search}"` : 'No products yet'}
          </p>
          {!search && <p className="text-sm mt-1">Add your first product to get started</p>}
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-center px-4 py-3 hidden md:table-cell">Code</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3 hidden sm:table-cell">Stock</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                          <Img src={p.primary_image} alt={p.name} fallback="product" className="w-full h-full object-cover" />
                        </div>
                        <span className="font-semibold text-navy text-sm max-w-[160px] truncate block">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <span className="font-mono text-xs text-gray-400">{p.product_code || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StockBadge status={p.status} stock={p.total_stock} />
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className="text-sm font-bold text-gray-700">{p.total_stock ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a href={`/vendor/products/${p.id}`}
                        className="text-xs font-bold text-navy hover:underline whitespace-nowrap">View →</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {totalCount} products · page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  ← Prev
                </button>
                {pageNumbers.map((n, i) =>
                  n === '…' ? (
                    <span key={`el-${i}`} className="px-1 text-xs text-gray-400">…</span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setPage(n as number)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                        page === n ? 'bg-navy text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {n}
                    </button>
                  )
                )}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
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

interface StockLog {
  id: string; product_id: string; product_name: string;
  variant_id: string; variant_name: string; sku: string;
  old_qty: number; new_qty: number; delta: number;
  reason: string; note: string; changed_by: string; created_at: string;
}

const LOG_PAGE_SIZE = 25;

function StockHistoryTab() {
  const [page, setPage] = useState(1);
  const [reason, setReason] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-stock-logs', page, reason],
    queryFn: () => api.get('/products/vendor/stock-logs/', {
      params: { page, page_size: LOG_PAGE_SIZE, ...(reason ? { reason } : {}) },
    }).then(r => r.data),
    placeholderData: keepPreviousData,
  });

  const logs: StockLog[] = data?.results ?? [];
  const totalCount: number = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / LOG_PAGE_SIZE);

  function fmt(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  }

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Filter by</span>
        {['', 'manual', 'reservation', 'restoration', 'restock', 'invoice', 'damage', 'return_from_customer', 'audit_adjustment'].map(r => (
          <button
            key={r || 'all'}
            onClick={() => { setReason(r); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              reason === r
                ? 'bg-navy text-white border-navy'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {r ? (REASON_LABELS[r]?.label ?? r) : 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-14 card animate-pulse" />)}</div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : logs.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
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
                  const isUp = log.delta > 0;
                  const isDown = log.delta < 0;
                  const reasonInfo = REASON_LABELS[log.reason] ?? { label: log.reason, color: 'bg-gray-100 text-gray-600' };
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
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${reasonInfo.color}`}>
                          {reasonInfo.label}
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">{totalCount} entries · page {page} of {totalPages}</p>
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
            </div>
          )}
        </>
      )}
    </div>
  );
}

const MOVEMENT_REASONS = [
  { value: 'restock',              label: '📦 Restock',         desc: 'Units received — added to stock',    delta: +1 },
  { value: 'damage',               label: '🔴 Damage',          desc: 'Units written off — subtracted',     delta: -1 },
  { value: 'return_from_customer', label: '↩️ Customer Return', desc: 'Units returned — added to stock',    delta: +1 },
  { value: 'manual',               label: '✏️ Manual Adj.',     desc: 'Set an exact new total quantity',    delta:  0 },
] as const;

function LogMovementModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const qc = useQueryClient();
  const [productId, setProductId]   = useState('');
  const [variantId, setVariantId]   = useState('');
  const [reason, setReason]         = useState<string>('restock');
  const [qty, setQty]               = useState('');
  const [note, setNote]             = useState('');
  const [error, setError]           = useState('');

  const { data: productsData } = useQuery({
    queryKey: ['vendor-products-log-picker'],
    queryFn: () => api.get('/products/vendor/', { params: { page_size: 200 } }).then(r => r.data),
  });
  const products: any[] = productsData?.results ?? [];

  const { data: variantsData } = useQuery({
    queryKey: ['product-variants-log', productId],
    queryFn: () => api.get(`/products/${productId}/variants/`).then(r => r.data),
    enabled: !!productId,
  });
  const variants: any[] = variantsData?.results ?? (Array.isArray(variantsData) ? variantsData : []);
  const selectedVariant = variants.find(v => v.id === variantId);

  const reasonMeta = MOVEMENT_REASONS.find(r => r.value === reason)!;
  const isManual   = reason === 'manual';
  const unitsNum   = parseInt(qty) || 0;
  const previewQty = isManual
    ? unitsNum
    : reasonMeta.delta === -1
      ? Math.max(0, (selectedVariant?.stock_quantity ?? 0) - unitsNum)
      : (selectedVariant?.stock_quantity ?? 0) + unitsNum;

  const qtyLabel = {
    restock:              'Units received (will be added to stock)',
    damage:               'Units damaged (will be subtracted)',
    return_from_customer: 'Units returned (will be added to stock)',
    manual:               'New total quantity (absolute)',
  }[reason] ?? 'Quantity';

  const mut = useMutation({
    mutationFn: () =>
      api.patch(`/products/${productId}/variants/${variantId}/`, {
        stock_quantity: previewQty,
        reason,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-stock-logs'] });
      qc.invalidateQueries({ queryKey: ['vendor-stock-alerts'] });
      onSuccess();
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Failed to log movement'),
  });

  const canSubmit = !!productId && !!variantId && unitsNum > 0 && !mut.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-navy text-lg">Log Stock Movement</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>

        <div className="space-y-4">
          {/* Reason */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Reason *</label>
            <div className="grid grid-cols-2 gap-2">
              {MOVEMENT_REASONS.map(r => (
                <button key={r.value} onClick={() => setReason(r.value)}
                  className={`py-2.5 px-3 rounded-xl border text-sm font-bold text-left transition-all ${
                    reason === r.value ? 'bg-navy text-white border-navy' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}>
                  <div>{r.label}</div>
                  <div className={`text-[10px] font-normal mt-0.5 ${reason === r.value ? 'text-white/70' : 'text-gray-400'}`}>{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Product *</label>
            <select value={productId} onChange={e => { setProductId(e.target.value); setVariantId(''); setQty(''); }}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40">
              <option value="">— Select product —</option>
              {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Variant */}
          {productId && (
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Variant *</label>
              <select value={variantId} onChange={e => { setVariantId(e.target.value); setQty(''); }}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40">
                <option value="">— Select variant —</option>
                {variants.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name}  (current: {v.stock_quantity})</option>
                ))}
              </select>
            </div>
          )}

          {/* Qty */}
          {variantId && (
            <>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">{qtyLabel} *</label>
                <input type="number" min="0" value={qty} onChange={e => setQty(e.target.value)}
                  placeholder={isManual ? String(selectedVariant?.stock_quantity ?? '0') : '0'}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
                {!isManual && unitsNum > 0 && selectedVariant && (
                  <p className={`text-xs mt-1 font-semibold ${previewQty === 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    New total: {previewQty} units
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Note</label>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
              </div>
            </>
          )}
        </div>

        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <Button onClick={() => mut.mutate()} disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50">
            {mut.isPending ? 'Saving…' : 'Log Movement'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Serial Numbers Tab ────────────────────────────────────────────────────────

interface SerialNumber {
  id: string; serial_number: string; status: string;
  product?: { id: string; name: string };
  variant?: { id: string; name: string };
  notes?: string; created_at: string;
}

function SerialNumbersTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ serial_number: '', product_id: '', variant_id: '', notes: '', status: 'available' });
  const [adding, setAdding] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['serial-numbers'],
    queryFn: () => api.get('/inventory/serial-numbers/').then(r => r.data),
  });

  const { data: productsData } = useQuery({
    queryKey: ['vendor-products-all'],
    queryFn: () => api.get('/products/vendor/', { params: { page_size: 200 } }).then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post('/inventory/serial-numbers/', {
      serial_number: form.serial_number.trim(),
      product: form.product_id || undefined,
      variant: form.variant_id || undefined,
      notes: form.notes.trim() || undefined,
      status: form.status,
    }),
    onSuccess: () => { refetch(); setAdding(false); setForm({ serial_number: '', product_id: '', variant_id: '', notes: '', status: 'available' }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/serial-numbers/${id}/`),
    onSuccess: () => refetch(),
  });

  const serials: SerialNumber[] = data?.results ?? (Array.isArray(data) ? data : []);
  const products = productsData?.results ?? [];

  const STATUS_COLORS: Record<string, string> = {
    available: 'bg-green-100 text-green-700',
    sold:      'bg-gray-100 text-gray-600',
    returned:  'bg-amber-100 text-amber-700',
    defective: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)} className="px-5 py-2.5 rounded-xl font-bold text-sm">+ Add Serial Number</Button>
      </div>

      {adding && (
        <div className="card p-5 space-y-3">
          <h4 className="font-bold text-navy text-sm">New Serial Number</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Serial Number *</label>
              <input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                placeholder="SN123456789" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-navy/40" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none">
                {['available', 'sold', 'returned', 'defective'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Product</label>
            <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value, variant_id: '' }))}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none">
              <option value="">— Select product —</option>
              {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="IMEI, tag number, etc." className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.serial_number.trim()} className="flex-1">
              {createMut.isPending ? 'Saving…' : 'Save'}
            </Button>
            <button onClick={() => setAdding(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="card h-14 animate-pulse" />)}</div>
      ) : serials.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">🔢</div>
          <p className="font-semibold text-gray-600">No serial numbers tracked yet</p>
          <p className="text-sm mt-1">Add IMEI numbers, tag numbers, or any unit-level IDs</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Serial #', 'Product', 'Status', 'Notes', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {serials.map(sn => (
                <tr key={sn.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-navy font-semibold">{sn.serial_number}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{sn.product?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold capitalize ${STATUS_COLORS[sn.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {sn.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">{sn.notes ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => { if (confirm('Delete this serial number?')) deleteMut.mutate(sn.id); }}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Bundles / Composite Products Tab ─────────────────────────────────────────

interface Bundle {
  id: string; name: string; description?: string;
  components: { product: { id: string; name: string }; quantity: number }[];
  created_at: string;
}

function BundlesTab() {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', components: [{ product_id: '', quantity: '1' }] });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bundles'],
    queryFn: () => api.get('/inventory/bundles/').then(r => r.data),
  });

  const { data: productsData } = useQuery({
    queryKey: ['vendor-products-all'],
    queryFn: () => api.get('/products/vendor/', { params: { page_size: 200 } }).then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post('/inventory/bundles/', {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      components: form.components.filter(c => c.product_id).map(c => ({ product: c.product_id, quantity: parseInt(c.quantity) || 1 })),
    }),
    onSuccess: () => { refetch(); setShowAdd(false); setForm({ name: '', description: '', components: [{ product_id: '', quantity: '1' }] }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/bundles/${id}/`),
    onSuccess: () => refetch(),
  });

  const bundles: Bundle[] = data?.results ?? (Array.isArray(data) ? data : []);
  const products = productsData?.results ?? [];

  const addComponent = () => setForm(f => ({ ...f, components: [...f.components, { product_id: '', quantity: '1' }] }));
  const removeComponent = (i: number) => setForm(f => ({ ...f, components: f.components.filter((_, j) => j !== i) }));
  const setComponent = (i: number, key: 'product_id' | 'quantity', val: string) =>
    setForm(f => ({ ...f, components: f.components.map((c, j) => j === i ? { ...c, [key]: val } : c) }));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowAdd(true)} className="px-5 py-2.5 rounded-xl font-bold text-sm">+ Create Bundle</Button>
      </div>

      {showAdd && (
        <div className="card p-5 space-y-4">
          <h4 className="font-bold text-navy text-sm">New Bundle / Combo</h4>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Bundle Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Phone + Cover Combo" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-navy/40" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional description" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Components</label>
            <div className="space-y-2">
              {form.components.map((comp, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={comp.product_id} onChange={e => setComponent(i, 'product_id', e.target.value)}
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none">
                    <option value="">— Select product —</option>
                    {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" min="1" value={comp.quantity} onChange={e => setComponent(i, 'quantity', e.target.value)}
                    className="w-16 rounded-xl border border-gray-200 px-3 py-2 text-sm text-center focus:outline-none" />
                  {form.components.length > 1 && (
                    <button onClick={() => removeComponent(i)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                  )}
                </div>
              ))}
              <button onClick={addComponent} className="text-xs text-navy font-semibold hover:underline">+ Add component</button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.name.trim()} className="flex-1">
              {createMut.isPending ? 'Creating…' : 'Create Bundle'}
            </Button>
            <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card h-24 animate-pulse" />)}</div>
      ) : bundles.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">📦</div>
          <p className="font-semibold text-gray-600">No bundles yet</p>
          <p className="text-sm mt-1">Group products into bundles or combos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bundles.map(b => (
            <div key={b.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-navy text-sm">{b.name}</h4>
                  {b.description && <p className="text-xs text-gray-400 mt-0.5">{b.description}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {b.components.map((c, i) => (
                      <span key={i} className="px-2 py-1 bg-navy/8 text-navy text-[11px] font-semibold rounded-full">
                        {c.product.name} ×{c.quantity}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => { if (confirm('Delete this bundle?')) deleteMut.mutate(b.id); }}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold shrink-0 ml-4">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Inner() {
  const [tab, setTab] = useState<'alerts' | 'all' | 'history' | 'serials' | 'bundles'>('alerts');
  const [showLogMovement, setShowLogMovement] = useState(false);

  const { data: alertsData, isLoading: alertsLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-stock-alerts'],
    queryFn: () => api.get('/products/vendor/stock-alerts/').then(r => r.data),
  });

  const { data: summaryData } = useQuery({
    queryKey: ['vendor-products-summary'],
    queryFn: () => api.get('/products/vendor/', { params: { page: 1, page_size: 1 } }).then(r => r.data),
  });

  const alerts: StockAlert[] = alertsData?.results ?? (Array.isArray(alertsData) ? alertsData : []);
  const totalProducts: number = summaryData?.count ?? 0;
  const lowStockCount = alerts.filter(a => a.status !== 'out_of_stock').length;
  const outOfStockCount = alerts.filter(a => a.status === 'out_of_stock').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Inventory</h1>
        <p className="text-sm text-gray-400">Manage stock levels across your products</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Products', value: totalProducts, icon: '📦' },
          { label: 'Low Stock', value: lowStockCount, icon: '⚠️' },
          { label: 'Out of Stock', value: outOfStockCount, icon: '🚫' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <p className="text-xl font-bold text-navy">{s.value}</p>
            <p className="text-xs text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-wrap">
        {([
          { key: 'alerts' as const, label: alerts.length > 0 ? `Alerts (${alerts.length})` : 'Alerts' },
          { key: 'all' as const, label: 'Products' },
          { key: 'history' as const, label: 'Log' },
          { key: 'serials' as const, label: 'Serials' },
          { key: 'bundles' as const, label: 'Bundles' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all min-w-[60px] ${
              tab === t.key
                ? 'bg-white text-navy shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Alerts tab */}
      {tab === 'alerts' && (
        alertsLoading ? (
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
        )
      )}

      {/* All products tab */}
      {tab === 'all' && <AllProductsTab />}

      {/* Change log tab */}
      {tab === 'history' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowLogMovement(true)} className="px-5 py-2.5 rounded-xl font-bold text-sm">
              + Log Movement
            </Button>
          </div>
          <StockHistoryTab />
        </div>
      )}

      {tab === 'serials' && <SerialNumbersTab />}
      {tab === 'bundles' && <BundlesTab />}

      {showLogMovement && (
        <LogMovementModal
          onClose={() => setShowLogMovement(false)}
          onSuccess={() => setShowLogMovement(false)}
        />
      )}
    </div>
  );
}

export default function VendorInventoryIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
