import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

interface Supplier { id: string; name: string; }
interface POItem { product_id?: string; sku: string; qty: number; unit_cost: number; }
interface PurchaseOrder {
  id: string;
  supplier?: string;
  supplier_name?: string;
  status: 'draft' | 'sent' | 'received' | 'cancelled';
  items: POItem[];
  total_cost: number;
  notes: string;
  expected_by: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  received: 'Received',
  cancelled: 'Cancelled',
};

const EMPTY_ITEM: POItem = { sku: '', qty: 1, unit_cost: 0 };

function POModal({
  suppliers,
  suppliersLoading,
  onClose,
  onSuccess,
}: {
  suppliers: Supplier[];
  suppliersLoading?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [expectedBy, setExpectedBy] = useState('');
  const [items, setItems] = useState<POItem[]>([{ ...EMPTY_ITEM }]);
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () =>
      api.post('/inventory/purchase-orders/', {
        supplier: supplier || undefined,
        notes,
        expected_by: expectedBy || undefined,
        items,
        total_cost: items.reduce((sum, it) => sum + it.qty * it.unit_cost, 0),
        status: 'draft',
      }),
    onSuccess: () => onSuccess(),
    onError: (e: any) =>
      setError(e?.response?.data?.detail ?? JSON.stringify(e?.response?.data) ?? 'Failed to create PO'),
  });

  const setItem = (idx: number, key: keyof POItem, val: string | number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it));
  };
  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const total = items.reduce((sum, it) => sum + Number(it.qty) * Number(it.unit_cost), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-navy text-lg">Create Purchase Order</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Supplier</label>
              <select
                value={supplier}
                onChange={e => setSupplier(e.target.value)}
                disabled={suppliersLoading}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40 disabled:opacity-60"
              >
                {suppliersLoading
                  ? <option value="">Loading suppliers…</option>
                  : <>
                      <option value="">— No supplier —</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </>
                }
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Expected By</label>
              <input
                type="date"
                value={expectedBy}
                onChange={e => setExpectedBy(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes about this order"
              rows={2}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40 resize-none"
            />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Items</label>
              <button onClick={addItem} className="text-xs font-bold text-navy hover:underline">+ Add Row</button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1">
                <span>SKU</span><span>Qty</span><span>Unit Cost (₹)</span><span></span>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center">
                  <input
                    value={item.sku}
                    onChange={e => setItem(idx, 'sku', e.target.value)}
                    placeholder="SKU-001"
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-navy/40"
                  />
                  <input
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={e => { const v = parseInt(e.target.value); setItem(idx, 'qty', isNaN(v) ? 1 : Math.max(1, v)); }}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-navy/40"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_cost}
                    onChange={e => setItem(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-navy/40"
                  />
                  <button
                    onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                    className="w-7 h-7 rounded-full bg-red-50 text-red-500 text-xs font-bold flex items-center justify-center disabled:opacity-30"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 text-right">
              <span className="text-sm font-bold text-navy">Total: ₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="flex-1 btn-primary py-2.5 rounded-xl font-bold text-sm"
          >
            {mut.isPending ? 'Creating…' : 'Create PO'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Inner() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-purchase-orders'],
    queryFn: () => api.get('/inventory/purchase-orders/').then(r => r.data),
  });

  const [selectVals, setSelectVals] = useState<Record<string, string>>({});
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const { data: suppliersData, isLoading: suppliersLoading } = useQuery({
    queryKey: ['vendor-suppliers'],
    queryFn: () => api.get('/inventory/suppliers/').then(r => r.data),
    enabled: showCreate,
  });

  const markReceivedMut = useMutation({
    mutationFn: (id: string) => api.patch(`/inventory/purchase-orders/${id}/`, { status: 'received' }),
    onSuccess: () => { setReceivingId(null); qc.invalidateQueries({ queryKey: ['vendor-purchase-orders'] }); },
    onError: () => setReceivingId(null),
  });

  const changeStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/inventory/purchase-orders/${id}/`, { status }),
    onSuccess: () => { setStatusError(null); qc.invalidateQueries({ queryKey: ['vendor-purchase-orders'] }); },
    onError: (e: any) => setStatusError(e?.response?.data?.detail ?? 'Failed to update status'),
  });

  const orders: PurchaseOrder[] = data?.results ?? (Array.isArray(data) ? data : []);
  const suppliers: Supplier[] = suppliersData?.results ?? (Array.isArray(suppliersData) ? suppliersData : []);

  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));

  const filtered = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);

  const handleSuccess = () => {
    setShowCreate(false);
    qc.invalidateQueries({ queryKey: ['vendor-purchase-orders'] });
  };

  return (
    <div className="space-y-6">
      {statusError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center justify-between">
          <span>{statusError}</span>
          <button onClick={() => setStatusError(null)} className="ml-3 text-red-400 hover:text-red-600 font-bold">✕</button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Purchase Orders</h1>
          <p className="text-sm text-gray-400">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary px-5 py-2.5 rounded-xl font-bold text-sm">
          + Create PO
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'draft', 'sent', 'received', 'cancelled'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              statusFilter === s
                ? 'bg-navy text-white border-navy'
                : 'bg-white text-gray-600 border-gray-200 hover:border-navy/40'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="card h-16 animate-pulse" />)}</div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">📋</div>
          <p className="font-semibold text-gray-600">No purchase orders{statusFilter !== 'all' ? ` with status "${STATUS_LABELS[statusFilter]}"` : ''}</p>
          {statusFilter === 'all' && (
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-4 px-6 py-2.5 rounded-xl text-sm font-bold">
              Create First PO
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">PO #</th>
                  <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Supplier</th>
                  <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Total</th>
                  <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Expected By</th>
                  <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Created</th>
                  <th className="px-4 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(po => (
                  <tr key={po.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-navy">{po.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-4 py-3.5 text-gray-700">
                      {po.supplier_name ?? (po.supplier ? supplierMap[po.supplier] : '—') ?? '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[po.status]}`}>
                        {STATUS_LABELS[po.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-gray-800">
                      ₹{Number(po.total_cost).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 text-xs">
                      {po.expected_by ? new Date(po.expected_by).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-gray-400 text-xs">
                      {new Date(po.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        {po.status === 'sent' && (
                          <button
                            onClick={() => { setReceivingId(po.id); markReceivedMut.mutate(po.id); }}
                            disabled={receivingId === po.id}
                            className="text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {receivingId === po.id ? '…' : 'Mark Received'}
                          </button>
                        )}
                        {po.status === 'draft' && (
                          <select
                            value={selectVals[po.id] ?? ''}
                            onChange={e => {
                              const status = e.target.value;
                              if (!status) return;
                              setSelectVals(p => ({ ...p, [po.id]: status }));
                              changeStatusMut.mutate({ id: po.id, status }, {
                                onError: () => setSelectVals(p => ({ ...p, [po.id]: '' })),
                              });
                            }}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-navy/40"
                          >
                            <option value="" disabled>Change status</option>
                            <option value="sent">Mark Sent</option>
                            <option value="cancelled">Cancel</option>
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <POModal suppliers={suppliers} suppliersLoading={suppliersLoading} onClose={() => setShowCreate(false)} onSuccess={handleSuccess} />
      )}
    </div>
  );
}

export default function VendorPurchaseOrdersIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
