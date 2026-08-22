import { useState } from 'react';
import { QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

// ── Types ─────────────────────────────────────────────────────────────────────

interface InvoiceItem {
  name: string;
  price: number | string;
  qty: number;
  product_id?: string;
  variant_id?: string;   // from the invoice — which exact variant was sold
  returned_qty?: number;
}

interface Invoice {
  id: string;
  customer_name: string;
  customer_phone?: string;
  items: InvoiceItem[];
  total: number | string;
  created_at: string;
  is_sent: boolean;
}

interface StockLog {
  id: string;
  product_name: string;
  variant_name: string;
  delta: number;
  note: string;
  created_at: string;
}

// Per-line state — variant is resolved automatically from the invoice, never picked manually
interface LineState {
  selected:     boolean;
  returnQty:    number;
  reason:       string;
  variantId:    string;   // resolved from invoice item
  variantName:  string;   // for display
  currentStock: number;   // fetched to calculate new total
  loading:      boolean;
  ambiguous:    boolean;  // multiple variants but invoice has no variant_id
  maxQty:       number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RETURN_REASONS = [
  'Defective / damaged',
  'Wrong size / variant',
  'Changed mind',
  'Wrong product delivered',
  'Other',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}
function fmtAmt(n: number | string) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function invoiceLabel(inv: Invoice) {
  return `NS-${inv.id.slice(-8).toUpperCase()}`;
}
function defaultLine(originalQty: number): LineState {
  return { selected: false, returnQty: 1, reason: '', variantId: '', variantName: '', currentStock: 0, loading: false, ambiguous: false, maxQty: originalQty };
}

// ── Main component ────────────────────────────────────────────────────────────

function Inner() {
  const qc = useQueryClient();
  const [search,          setSearch]          = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [lines,           setLines]           = useState<LineState[]>([]);
  const [submitting,      setSubmitting]      = useState(false);
  const [successMsg,      setSuccessMsg]      = useState('');
  const [submitError,     setSubmitError]     = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-invoices-for-returns'],
    queryFn:  () => api.get('/stores/mine/invoices/').then(r => r.data),
    staleTime: 60_000,
  });
  const invoices: Invoice[] = data?.results ?? (Array.isArray(data) ? data : []);

  const { data: histData, refetch: refetchHist } = useQuery({
    queryKey: ['vendor-returns-history'],
    queryFn:  () => api.get('/products/vendor/stock-logs/?reason=return_from_customer&page_size=30').then(r => r.data),
  });
  const history: StockLog[] = histData?.results ?? [];

  const filtered = search
    ? invoices.filter(i =>
        i.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        invoiceLabel(i).toLowerCase().includes(search.toLowerCase()) ||
        (i.customer_phone ?? '').includes(search)
      )
    : invoices.slice(0, 20);

  function selectInvoice(inv: Invoice) {
    setSelectedInvoice(inv);
    setLines(inv.items.map(it => defaultLine(it.qty - (it.returned_qty ?? 0))));
    setSuccessMsg('');
    setSubmitError('');
    setSearch('');
  }

  function clearSelection() {
    setSelectedInvoice(null);
    setLines([]);
    setSuccessMsg('');
    setSubmitError('');
  }

  // When user checks an item, resolve its variant automatically from the invoice
  async function toggleLine(idx: number) {
    const item = selectedInvoice!.items[idx];
    const next = !lines[idx].selected;
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, selected: next } : l));

    if (!next || !item.product_id) return;

    // If already loaded, skip
    if (lines[idx].variantId || lines[idx].loading) return;

    setLines(prev => prev.map((l, i) => i === idx ? { ...l, loading: true } : l));

    try {
      if (item.variant_id) {
        // Invoice recorded the exact variant — fetch just that one
        const r = await api.get(`/products/${item.product_id}/variants/${item.variant_id}/`);
        const v = r.data;
        setLines(prev => prev.map((l, i) => i === idx
          ? { ...l, variantId: item.variant_id!, variantName: v.name, currentStock: v.stock_quantity, loading: false }
          : l));
      } else {
        // No variant_id in invoice — fetch all and auto-pick if there's only one
        const r = await api.get(`/products/${item.product_id}/variants/`);
        const variants: { id: string; name: string; stock_quantity: number }[] = r.data?.results ?? r.data ?? [];
        if (variants.length === 1) {
          const v = variants[0];
          setLines(prev => prev.map((l, i) => i === idx
            ? { ...l, variantId: v.id, variantName: v.name, currentStock: v.stock_quantity, loading: false }
            : l));
        } else {
          // Multiple variants, can't auto-determine — warn, treat as manual
          setLines(prev => prev.map((l, i) => i === idx
            ? { ...l, ambiguous: true, loading: false }
            : l));
        }
      }
    } catch {
      setLines(prev => prev.map((l, i) => i === idx ? { ...l, loading: false } : l));
    }
  }

  function setLineField<K extends keyof LineState>(idx: number, field: K, val: LineState[K]) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  }

  const selectedLines = lines
    .map((l, i) => ({ l, i, item: selectedInvoice?.items[i] }))
    .filter(({ l }) => l.selected);

  const canSubmit = !submitting && selectedLines.length > 0 &&
    selectedLines.every(({ l }) => l.reason !== '' && !l.loading);

  async function submit() {
    if (!canSubmit || !selectedInvoice) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await api.post(`/stores/mine/invoices/${selectedInvoice.id}/return/`, {
        items: selectedLines.map(({ l, i }) => ({
          item_index: i,
          return_qty: l.returnQty,
          reason:     l.reason,
        })),
      });

      const { processed, restocked, errors } = res.data;
      if (processed > 0) {
        const parts = [`${processed} item${processed !== 1 ? 's' : ''} returned from ${invoiceLabel(selectedInvoice)}`];
        if (restocked > 0) parts.push(`${restocked} restocked`);
        setSuccessMsg(parts.join(' · '));
        refetchHist();
        qc.invalidateQueries({ queryKey: ['vendor-invoices-for-returns'] });
        qc.invalidateQueries({ queryKey: ['vendor-stock-alerts'] });
        setSelectedInvoice(null);
        setLines([]);
      }
      if (errors?.length) setSubmitError(errors.join(' · '));
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed to process return';
      setSubmitError(msg);
    }

    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Customer Returns</h1>
        <p className="text-sm text-gray-400">Find an invoice, select the items being returned, and inventory updates automatically.</p>
      </div>

      <div className="card p-6 space-y-5">

        {/* Banners */}
        {successMsg && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
            <span className="text-green-500 text-lg">✓</span>
            <p className="text-sm font-semibold text-green-700">{successMsg}</p>
          </div>
        )}
        {submitError && (
          <div className="bg-red-50 rounded-xl px-4 py-3">
            <p className="text-sm text-red-600">{submitError}</p>
          </div>
        )}

        {/* ── Step 1: Invoice search ── */}
        {!selectedInvoice ? (
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Find Invoice</p>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Customer name, phone, or NS-XXXXXXXX…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-navy/40" />
            </div>

            {isLoading ? (
              <p className="text-sm text-gray-400 text-center py-4">Loading invoices…</p>
            ) : isError ? (
              <IslandError error={error} refetch={refetch} />
            ) : filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No invoices found</p>
            ) : (
              <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {filtered.map(inv => (
                  <button key={inv.id} onClick={() => selectInvoice(inv)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-navy font-mono">{invoiceLabel(inv)}</span>
                        {inv.is_sent && <span className="text-xs bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">Sent</span>}
                      </div>
                      <p className="text-xs text-gray-500">{inv.customer_name} · {fmtDate(inv.created_at)}</p>
                      <p className="text-xs text-gray-400">{inv.items.length} item{inv.items.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-navy">{fmtAmt(inv.total)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Select →</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

        ) : (
          /* ── Step 2: Item selection ── */
          <div className="space-y-4">

            {/* Invoice header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-navy font-mono">{invoiceLabel(selectedInvoice)}</span>
                  <span className="text-sm text-gray-500">· {selectedInvoice.customer_name}</span>
                </div>
                <p className="text-xs text-gray-400">{fmtDate(selectedInvoice.created_at)} · {fmtAmt(selectedInvoice.total)}</p>
              </div>
              <button onClick={clearSelection} className="text-xs text-gray-400 hover:text-navy hover:underline">
                ← Change invoice
              </button>
            </div>

            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Select items to return</p>

            {/* Item rows */}
            <div className="space-y-2">
              {selectedInvoice.items.map((item, idx) => {
                const line = lines[idx];
                if (!line) return null;
                const returnedQty   = item.returned_qty ?? 0;
                const remaining     = item.qty - returnedQty;
                const fullyReturned = remaining <= 0;

                return (
                  <div key={idx}
                    className={`rounded-xl border transition-colors ${fullyReturned ? 'border-gray-100 bg-gray-50 opacity-60' : line.selected ? 'border-navy/25 bg-blue-50/30' : 'border-gray-100 bg-gray-50'}`}>

                    {/* Checkbox row */}
                    <label className={`flex items-center gap-3 px-4 py-3 select-none ${fullyReturned ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input type="checkbox" checked={line.selected} onChange={() => !fullyReturned && toggleLine(idx)}
                        disabled={fullyReturned}
                        className="w-4 h-4 rounded accent-navy disabled:opacity-40" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${fullyReturned ? 'text-gray-400' : 'text-gray-800'}`}>{item.name}</p>
                        <p className="text-xs text-gray-400">
                          Sold: {item.qty} unit{item.qty !== 1 ? 's' : ''} · {fmtAmt(parseFloat(String(item.price)) * item.qty)}
                        </p>
                        {fullyReturned
                          ? <p className="text-xs text-green-600 font-semibold mt-0.5">✓ Fully returned</p>
                          : returnedQty > 0
                            ? <p className="text-xs text-amber-600 mt-0.5">{returnedQty} of {item.qty} already returned · {remaining} remaining</p>
                            : null
                        }
                      </div>
                      {fullyReturned && <span className="text-green-500 text-base shrink-0">✓</span>}
                    </label>

                    {/* Expanded controls */}
                    {line.selected && (
                      <div className="px-4 pb-4 pt-2 space-y-3 border-t border-gray-100">

                        {/* Return qty stepper */}
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 font-medium w-20 shrink-0">Return qty</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setLineField(idx, 'returnQty', Math.max(1, line.returnQty - 1))}
                              className="w-7 h-7 rounded-lg border border-gray-200 hover:border-navy/40 text-sm font-bold text-gray-500 flex items-center justify-center">−</button>
                            <span className="w-8 text-center text-sm font-semibold text-navy">{line.returnQty}</span>
                            <button onClick={() => setLineField(idx, 'returnQty', Math.min(remaining, line.returnQty + 1))}
                              className="w-7 h-7 rounded-lg border border-gray-200 hover:border-navy/40 text-sm font-bold text-gray-500 flex items-center justify-center">+</button>
                            <span className="text-xs text-gray-400">of {remaining}</span>
                          </div>
                        </div>

                        {/* Variant info — auto-resolved from invoice, no manual picker */}
                        {item.product_id && (
                          line.loading ? (
                            <p className="text-xs text-gray-400 flex items-center gap-1.5">
                              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                              </svg>
                              Checking inventory…
                            </p>
                          ) : line.variantId ? (
                            <p className="text-xs text-green-600 flex items-center gap-1">
                              <span>✓</span>
                              <span className="font-medium">{line.variantName}</span>
                              <span className="text-gray-400">· stock: {line.currentStock} → {line.currentStock + line.returnQty}</span>
                            </p>
                          ) : line.ambiguous ? (
                            <p className="text-xs text-amber-600 flex items-center gap-1.5">
                              <span>⚠</span>
                              Variant not recorded in this invoice — return will be logged but stock won't change
                            </p>
                          ) : !item.product_id ? (
                            <p className="text-xs text-amber-600 mt-0.5">Manual item — return recorded, no stock change</p>
                          ) : null
                        )}

                        {/* Reason chips */}
                        <div className="space-y-1.5">
                          <span className="text-xs text-gray-500 font-medium">Reason for return</span>
                          <div className="flex flex-wrap gap-1.5">
                            {RETURN_REASONS.map(r => (
                              <button key={r} onClick={() => setLineField(idx, 'reason', r)}
                                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${line.reason === r ? 'bg-navy text-white border-navy' : 'border-gray-200 text-gray-600 hover:border-navy/40'}`}>
                                {r}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Submit */}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              {selectedLines.length > 0 && (
                <p className="text-xs text-gray-400">
                  {selectedLines.length} item{selectedLines.length > 1 ? 's' : ''} selected for return
                </p>
              )}
              <button onClick={submit} disabled={!canSubmit}
                className="w-full py-3 rounded-xl bg-navy text-white text-sm font-bold disabled:opacity-40 hover:bg-navy/90 transition-colors">
                {submitting
                  ? 'Processing…'
                  : selectedLines.length === 0
                    ? 'Select at least one item'
                    : `Process ${selectedLines.length} Return${selectedLines.length > 1 ? 's' : ''} & Restock`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Returns history */}
      {history.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-navy">Returns History</p>
          </div>
          {history.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
              <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center shrink-0 text-green-600 font-bold text-sm">↩</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {entry.product_name}{entry.variant_name ? ` · ${entry.variant_name}` : ''}
                </p>
                {entry.note && <p className="text-xs text-gray-400 truncate">{entry.note}</p>}
                <p className="text-xs text-gray-300">{fmtDate(entry.created_at)}</p>
              </div>
              <span className="text-green-600 font-bold text-sm shrink-0">+{entry.delta}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VendorReturnsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <VendorAuthGuard>
        <Inner />
      </VendorAuthGuard>
    </QueryClientProvider>
  );
}
