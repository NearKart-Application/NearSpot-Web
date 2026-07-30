import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

interface AuditItem {
  variant_id?: string;
  sku: string;
  system_qty: number;
  counted_qty: number;
  discrepancy: number;
}

interface Audit {
  id: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  items: AuditItem[];
  total_discrepancy: number;
  notes: string;
  completed_at: string | null;
  conducted_by_phone?: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
};

const STATUS_LABELS: Record<string, string> = {
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const EMPTY_ITEM: AuditItem = { sku: '', system_qty: 0, counted_qty: 0, discrepancy: 0 };

function AuditDetail({
  audit,
  onBack,
}: {
  audit: Audit;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const [items, setItems] = useState<AuditItem[]>(
    audit.items?.length ? audit.items : [{ ...EMPTY_ITEM }],
  );
  const [notes, setNotes] = useState(audit.notes ?? '');
  const [error, setError] = useState('');

  const isLocked = audit.status === 'completed' || audit.status === 'cancelled';

  const saveMut = useMutation({
    mutationFn: () => {
      const totalDisc = items.reduce((sum, it) => sum + it.discrepancy, 0);
      return api.patch(`/inventory/audits/${audit.id}/`, {
        items,
        notes,
        total_discrepancy: totalDisc,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-audits'] });
      setError('');
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Failed to save'),
  });

  const completeMut = useMutation({
    mutationFn: () =>
      api.patch(`/inventory/audits/${audit.id}/`, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        items,
        notes,
        total_discrepancy: items.reduce((sum, it) => sum + it.discrepancy, 0),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-audits'] });
      onBack();
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Failed to complete'),
  });

  const cancelMut = useMutation({
    mutationFn: () => api.patch(`/inventory/audits/${audit.id}/`, { status: 'cancelled' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-audits'] });
      onBack();
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Failed to cancel'),
  });

  const setItem = (idx: number, key: keyof AuditItem, val: string | number) => {
    setItems(prev =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, [key]: val };
        if (key === 'system_qty' || key === 'counted_qty') {
          updated.discrepancy = Number(updated.counted_qty) - Number(updated.system_qty);
        }
        return updated;
      }),
    );
  };

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const totalDisc = items.reduce((sum, it) => sum + Number(it.discrepancy), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors">
          ←
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-navy">Audit Detail</h1>
          <p className="text-xs text-gray-400 font-mono">{audit.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_COLORS[audit.status]}`}>
          {STATUS_LABELS[audit.status]}
        </span>
      </div>

      <div className="card p-5 space-y-4">
        {/* Items table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-navy text-sm">Items</h2>
            {!isLocked && (
              <button onClick={addItem} className="text-xs font-bold text-navy hover:underline">+ Add Row</button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left pb-2 text-xs font-bold text-gray-400 uppercase tracking-wide pr-4">SKU</th>
                  <th className="text-right pb-2 text-xs font-bold text-gray-400 uppercase tracking-wide pr-4">System Qty</th>
                  <th className="text-right pb-2 text-xs font-bold text-gray-400 uppercase tracking-wide pr-4">Counted Qty</th>
                  <th className="text-right pb-2 text-xs font-bold text-gray-400 uppercase tracking-wide">Discrepancy</th>
                  {!isLocked && <th className="pb-2 w-8"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 pr-4">
                      {isLocked ? (
                        <span className="font-mono text-xs">{item.sku || '—'}</span>
                      ) : (
                        <input
                          value={item.sku}
                          onChange={e => setItem(idx, 'sku', e.target.value)}
                          placeholder="SKU-001"
                          className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-navy/40"
                        />
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {isLocked ? (
                        <span className="block text-right text-xs">{item.system_qty}</span>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          value={item.system_qty}
                          onChange={e => setItem(idx, 'system_qty', parseInt(e.target.value) || 0)}
                          className="w-20 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-right focus:outline-none focus:border-navy/40 ml-auto block"
                        />
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {isLocked ? (
                        <span className="block text-right text-xs">{item.counted_qty}</span>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          value={item.counted_qty}
                          onChange={e => setItem(idx, 'counted_qty', parseInt(e.target.value) || 0)}
                          className="w-20 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-right focus:outline-none focus:border-navy/40 ml-auto block"
                        />
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <span className={`text-xs font-bold ${item.discrepancy > 0 ? 'text-green-600' : item.discrepancy < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {item.discrepancy > 0 ? '+' : ''}{item.discrepancy}
                      </span>
                    </td>
                    {!isLocked && (
                      <td className="py-2 pl-2">
                        <button
                          onClick={() => removeItem(idx)}
                          disabled={items.length === 1}
                          className="w-6 h-6 rounded-full bg-red-50 text-red-400 text-xs flex items-center justify-center disabled:opacity-30 hover:bg-red-100"
                        >
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-xs text-gray-400">{items.length} items</span>
            <span className={`text-sm font-bold ${totalDisc > 0 ? 'text-green-600' : totalDisc < 0 ? 'text-red-500' : 'text-gray-600'}`}>
              Total discrepancy: {totalDisc > 0 ? '+' : ''}{totalDisc}
            </span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Notes</label>
          {isLocked ? (
            <p className="text-sm text-gray-600">{notes || '—'}</p>
          ) : (
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Observations, discrepancies, etc."
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40 resize-none"
            />
          )}
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {!isLocked && (
          <div className="flex gap-3">
            <button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="flex-1 py-2.5 rounded-xl border border-navy text-navy text-sm font-bold hover:bg-navy/5 transition-colors"
            >
              {saveMut.isPending ? 'Saving…' : 'Save Progress'}
            </button>
            <button
              onClick={() => { if (confirm('Complete this audit? This cannot be undone.')) completeMut.mutate(); }}
              disabled={completeMut.isPending || isLocked}
              className="flex-1 btn-primary py-2.5 rounded-xl font-bold text-sm"
            >
              {completeMut.isPending ? 'Completing…' : 'Complete Audit'}
            </button>
            <button
              onClick={() => { if (confirm('Cancel this audit?')) cancelMut.mutate(); }}
              disabled={cancelMut.isPending || isLocked}
              className="px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-bold hover:bg-red-50 transition-colors"
            >
              {cancelMut.isPending ? '…' : 'Cancel'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Inner() {
  const qc = useQueryClient();
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-audits'],
    queryFn: () => api.get('/inventory/audits/').then(r => r.data),
  });

  const newAuditMut = useMutation({
    mutationFn: () =>
      api.post('/inventory/audits/', { status: 'in_progress', items: [], notes: '', total_discrepancy: 0 }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['vendor-audits'] });
      setSelectedAudit(res.data);
    },
  });

  const audits: Audit[] = data?.results ?? (Array.isArray(data) ? data : []);

  if (selectedAudit) {
    return (
      <AuditDetail
        audit={selectedAudit}
        onBack={() => setSelectedAudit(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Stock Audits</h1>
          <p className="text-sm text-gray-400">{audits.length} audit{audits.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => newAuditMut.mutate()}
          disabled={newAuditMut.isPending}
          className="btn-primary px-5 py-2.5 rounded-xl font-bold text-sm"
        >
          {newAuditMut.isPending ? 'Creating…' : '+ New Audit'}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="card h-20 animate-pulse" />)}</div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : audits.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">🔍</div>
          <p className="font-semibold text-gray-600">No audits conducted yet</p>
          <p className="text-sm mt-1">Run a stock audit to compare system vs physical inventory</p>
          <button
            onClick={() => newAuditMut.mutate()}
            disabled={newAuditMut.isPending}
            className="btn-primary mt-4 px-6 py-2.5 rounded-xl text-sm font-bold"
          >
            Start First Audit
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {audits.map(audit => (
            <div key={audit.id} className="card p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedAudit(audit)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-navy">{audit.id.slice(0, 8).toUpperCase()}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[audit.status]}`}>
                    {STATUS_LABELS[audit.status]}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  {audit.created_at ? new Date(audit.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  {audit.conducted_by_phone && ` · ${audit.conducted_by_phone}`}
                </p>
                {audit.notes && <p className="text-xs text-gray-500 mt-1 truncate">{audit.notes}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className={`text-lg font-bold ${audit.total_discrepancy > 0 ? 'text-green-600' : audit.total_discrepancy < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {audit.total_discrepancy > 0 ? '+' : ''}{audit.total_discrepancy}
                </p>
                <p className="text-xs text-gray-400">discrepancy</p>
              </div>
              <span className="text-gray-300">›</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VendorStockAuditIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
