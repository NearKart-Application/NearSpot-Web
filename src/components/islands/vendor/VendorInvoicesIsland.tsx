import { useState, useEffect, useRef } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';
import { Button } from '@/components/ui/button';

// ── Types ─────────────────────────────────────────────────────────────────────

interface InvoiceItem {
  name: string;
  price: number | string;
  qty: number;
  returned_qty?: number;
  product_id?: string;
}

interface Invoice {
  id: string;
  customer_name: string;
  customer_phone?: string;
  customer_ns_code?: string;
  items: InvoiceItem[];
  notes?: string;
  total: number | string;
  is_sent: boolean;
  created_at: string;
  pdf_url?: string;
  discount_type?: string | null;
  discount_value?: number;
  gstin?: string;
  gst_rate?: number;
  gst_amount?: number;
  due_date?: string;
}

interface VendorProduct {
  id: string;
  name: string;
  base_price: number;
  stock_total: number;
  product_code: string;
}

interface DraftItem {
  name: string;
  price: string;
  qty: string;
  productId: string;
  stockTotal: number;
}

function emptyItem(): DraftItem {
  return { name: '', price: '', qty: '1', productId: '', stockTotal: -1 };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}
function fmtAmt(n: number | string) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function returnStatus(items: InvoiceItem[]): 'none' | 'partial' | 'full' {
  const any = items.some(i => (i.returned_qty ?? 0) > 0);
  if (!any) return 'none';
  const all = items.every(i => (i.returned_qty ?? 0) >= i.qty);
  return all ? 'full' : 'partial';
}

// ── Invoice detail modal ──────────────────────────────────────────────────────

function InvoiceDetail({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const subtotal = invoice.items.reduce((s, i) => s + parseFloat(String(i.price ?? '0')) * i.qty, 0);
  const discount = invoice.discount_type === 'percentage'
    ? subtotal * (invoice.discount_value ?? 0) / 100
    : (invoice.discount_value ?? 0);
  const gstAmt = invoice.gst_amount ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-navy">Invoice</h3>
              {invoice.is_sent && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Sent</span>}
            </div>
            <p className="text-sm text-gray-500">{fmtDate(invoice.created_at)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-gray-50 rounded-xl p-4 space-y-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Bill To</p>
            <p className="font-semibold text-navy">{invoice.customer_name}</p>
            {invoice.customer_phone && <p className="text-sm text-gray-500">{invoice.customer_phone}</p>}
            {invoice.customer_ns_code && <p className="text-xs text-gray-400 font-mono">NS: {invoice.customer_ns_code}</p>}
            {invoice.gstin && <p className="text-xs text-gray-400">GSTIN: {invoice.gstin}</p>}
          </div>

          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Items</p>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              {invoice.items.map((item, idx) => {
                const retQty = item.returned_qty ?? 0;
                return (
                  <div key={idx} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-400">Qty {item.qty} × {fmtAmt(parseFloat(String(item.price ?? '0')))}</p>
                      {retQty > 0 && (
                        <p className="text-xs text-amber-600 mt-0.5">↩ {retQty} of {item.qty} returned</p>
                      )}
                    </div>
                    <p className="text-sm font-bold text-navy">{fmtAmt(parseFloat(String(item.price ?? '0')) * item.qty)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span><span className="font-semibold">{fmtAmt(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount {invoice.discount_type === 'percentage' ? `(${invoice.discount_value}%)` : ''}</span>
                <span className="font-semibold">−{fmtAmt(discount)}</span>
              </div>
            )}
            {gstAmt > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>GST ({invoice.gst_rate}%)</span><span className="font-semibold">+{fmtAmt(gstAmt)}</span>
              </div>
            )}
            <div className="flex justify-between bg-navy/5 rounded-xl px-4 py-3 mt-2">
              <span className="font-bold text-navy">Total</span>
              <span className="font-black text-navy text-lg">{fmtAmt(invoice.total)}</span>
            </div>
          </div>

          {invoice.due_date && (
            <p className="text-xs text-gray-500">Due: {new Date(invoice.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          )}

          {invoice.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-xs font-bold text-amber-700 mb-1">Notes</p>
              <p className="text-sm text-gray-700">{invoice.notes}</p>
            </div>
          )}

          {invoice.pdf_url && (
            <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer"
              className="w-full btn-outline py-3 rounded-xl text-sm font-bold text-center block">
              📄 Download PDF
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create invoice modal ──────────────────────────────────────────────────────

type NsState = 'idle' | 'searching' | 'found' | 'not_found';

function CreateInvoiceModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [customerName,  setCustomerName]  = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNsCode, setCustomerNsCode] = useState('');
  const [nsState, setNsState] = useState<NsState>('idle');
  const [nsFoundName, setNsFoundName]  = useState('');
  const [notes,       setNotes]        = useState('');
  const [dueDate,     setDueDate]      = useState('');
  const [gstin,       setGstin]        = useState('');
  const [gstRate,     setGstRate]      = useState('');
  const [discountType,  setDiscountType]  = useState<'' | 'percentage' | 'flat'>('');
  const [discountValue, setDiscountValue] = useState('');
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [formError, setFormError] = useState('');
  const [activeAutoIdx, setActiveAutoIdx] = useState(-1);
  const nsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load vendor products for autocomplete
  const { data: productsData } = useQuery({
    queryKey: ['vendor-products-for-invoice'],
    queryFn:  () => api.get('/products/vendor/?page_size=200&status=active').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const products: VendorProduct[] = productsData?.results ?? [];

  // NS code debounced lookup
  useEffect(() => {
    if (nsTimerRef.current) clearTimeout(nsTimerRef.current);
    const code = customerNsCode.trim().toUpperCase();
    if (code.length < 10) { setNsState('idle'); setNsFoundName(''); return; }
    setNsState('searching');
    nsTimerRef.current = setTimeout(async () => {
      try {
        const r = await api.get(`/auth/users/search/?profile_id=${encodeURIComponent(code)}`);
        const name = r.data?.full_name ?? '';
        if (name) {
          setNsFoundName(name);
          setNsState('found');
          setCustomerName(prev => prev || name);
        } else {
          setNsState('not_found');
        }
      } catch {
        setNsState('not_found');
      }
    }, 400);
    return () => { if (nsTimerRef.current) clearTimeout(nsTimerRef.current); };
  }, [customerNsCode]);

  const addItem    = () => setItems(p => [...p, emptyItem()]);
  const removeItem = (idx: number) => setItems(p => p.filter((_, i) => i !== idx));

  function setItemField(idx: number, field: keyof DraftItem, val: string | number) {
    setItems(p => p.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  }

  function pickProduct(idx: number, p: VendorProduct) {
    setItems(prev => prev.map((it, i) => i === idx
      ? { ...it, name: p.name, price: String(p.base_price), productId: p.id, stockTotal: p.stock_total }
      : it
    ));
    setActiveAutoIdx(-1);
  }

  const subtotal = items.reduce((s, it) => s + (parseFloat(it.price) || 0) * (parseInt(it.qty) || 0), 0);
  const discAmt  = discountType === 'percentage'
    ? subtotal * (parseFloat(discountValue) || 0) / 100
    : discountType === 'flat' ? (parseFloat(discountValue) || 0) : 0;
  const gstAmt   = (subtotal - discAmt) * (parseFloat(gstRate) || 0) / 100;
  const total    = subtotal - discAmt + gstAmt;

  const createMut = useMutation({
    mutationFn: () => {
      const payload: any = {
        customer_name:    customerName,
        customer_phone:   customerPhone,
        customer_ns_code: customerNsCode.trim().toUpperCase() || undefined,
        notes,
        gstin,
        gst_rate: parseFloat(gstRate) || 0,
        items: items
          .filter(it => it.name.trim() && it.price)
          .map(it => ({
            name:       it.name.trim(),
            price:      parseFloat(it.price) || 0,
            qty:        parseInt(it.qty) || 1,
            product_id: it.productId || undefined,
          })),
      };
      if (dueDate)       payload.due_date       = dueDate;
      if (discountType)  payload.discount_type  = discountType;
      if (discountType)  payload.discount_value = parseFloat(discountValue) || 0;
      return api.post('/stores/mine/invoices/', payload);
    },
    onSuccess: () => onSuccess(),
    onError:   (e: any) => {
      const d = e?.response?.data;
      setFormError(d?.detail ?? d?.message ?? JSON.stringify(d) ?? 'Failed to create invoice');
    },
  });

  const valid = customerName.trim() && items.some(it => it.name.trim() && it.price);

  const nsBorderFocus   = nsState === 'found' ? 'focus:border-green-400' : nsState === 'not_found' ? 'focus:border-red-400' : 'focus:border-navy/40';
  const nsBorderNoFocus = nsState === 'found' ? 'border-green-300' : nsState === 'not_found' ? 'border-red-300' : 'border-gray-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <h3 className="text-lg font-bold text-navy">Create Invoice</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">✕</button>
        </div>

        <div className="p-6 space-y-6">

          {/* ── Customer ──────────────────────────────────────────────── */}
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Customer</p>
            <div className="space-y-3">

              {/* NS code with live lookup */}
              <div>
                <div className="relative">
                  <input
                    value={customerNsCode}
                    onChange={e => setCustomerNsCode(e.target.value.toUpperCase())}
                    placeholder="NearSpot customer code (e.g. NSC-AK-HY-4X2B)"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm font-mono pr-10 focus:outline-none ${nsBorderNoFocus} ${nsBorderFocus}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                    {nsState === 'searching' && (
                      <svg className="animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                    )}
                    {nsState === 'found'     && <span className="text-green-500">✓</span>}
                    {nsState === 'not_found' && <span className="text-red-400">✗</span>}
                  </span>
                </div>
                {nsState === 'found' && (
                  <p className="text-xs text-green-600 mt-1 pl-1">
                    Found: <span className="font-semibold">{nsFoundName}</span> — invoice will be sent to their NearSpot app
                  </p>
                )}
                {nsState === 'not_found' && (
                  <p className="text-xs text-red-500 mt-1 pl-1">No NearSpot user found with this code</p>
                )}
              </div>

              <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                placeholder="Customer name *"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />

              {nsState !== 'found' && (
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
              )}
            </div>
          </section>

          {/* ── Items ──────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Items</p>
              <button onClick={addItem} className="text-xs font-bold text-navy hover:underline">+ Add item</button>
            </div>
            <div className="space-y-3">
              {items.map((it, idx) => {
                const suggestions = (activeAutoIdx === idx && it.name.length > 1 && !it.productId)
                  ? products.filter(p => p.name.toLowerCase().includes(it.name.toLowerCase())).slice(0, 6)
                  : [];
                const linked = it.productId ? products.find(p => p.id === it.productId) : null;

                return (
                  <div key={idx} className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                    {/* Item name with autocomplete */}
                    <div className="relative">
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 relative">
                          <input
                            value={it.name}
                            onChange={e => {
                              setItemField(idx, 'name', e.target.value);
                              setItemField(idx, 'productId', '');
                              setItemField(idx, 'stockTotal', -1);
                              setActiveAutoIdx(idx);
                            }}
                            onFocus={() => setActiveAutoIdx(idx)}
                            onBlur={() => setTimeout(() => setActiveAutoIdx(-1), 150)}
                            placeholder="Item name or search products…"
                            className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none ${it.productId ? 'border-green-300 focus:border-green-400 bg-green-50/40' : 'border-gray-200 focus:border-navy/40 bg-white'}`}
                          />
                          {/* Autocomplete dropdown */}
                          {suggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-30 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                              {suggestions.map(p => (
                                <button key={p.id}
                                  onMouseDown={() => pickProduct(idx, p)}
                                  className="w-full text-left px-3 py-2.5 hover:bg-navy/5 flex items-center justify-between gap-3 border-b border-gray-100 last:border-0">
                                  <div>
                                    <p className="text-sm font-semibold text-gray-800 leading-tight">{p.name}</p>
                                    {p.product_code && <p className="text-xs text-rose-500 font-mono">{p.product_code}</p>}
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-sm font-bold text-navy">₹{p.base_price.toLocaleString('en-IN')}</p>
                                    <p className={`text-xs ${p.stock_total > 0 ? 'text-green-600' : 'text-red-400'}`}>
                                      {p.stock_total > 0 ? `${p.stock_total} in stock` : 'Out of stock'}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {items.length > 1 && (
                          <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-400 text-xl shrink-0 leading-none">×</button>
                        )}
                      </div>
                    </div>

                    {/* Price / qty row */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                        <input type="number" value={it.price}
                          onChange={e => setItemField(idx, 'price', e.target.value)}
                          placeholder="Price"
                          className="w-full rounded-xl border border-gray-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-navy/40 bg-white" />
                      </div>
                      <input type="number" value={it.qty}
                        onChange={e => {
                          const max = linked && linked.stock_total > 0 ? linked.stock_total : 9999;
                          const v = Math.min(parseInt(e.target.value) || 1, max);
                          setItemField(idx, 'qty', String(v));
                        }}
                        min="1" placeholder="Qty"
                        className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-navy/40 bg-white" />
                      {it.price && it.qty && (
                        <div className="flex items-center px-2 text-sm font-semibold text-navy shrink-0">
                          = {fmtAmt((parseFloat(it.price) || 0) * (parseInt(it.qty) || 0))}
                        </div>
                      )}
                    </div>

                    {/* Stock badge for linked product */}
                    {linked && (
                      <p className={`text-xs pl-1 ${linked.stock_total > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {linked.stock_total > 0
                          ? `${linked.stock_total} in stock${(parseInt(it.qty) || 0) > linked.stock_total ? ' — qty exceeds stock' : ''}`
                          : 'Product is out of stock'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── GST & Discount ─────────────────────────────────────────── */}
          <section className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">GST Rate (%)</label>
                <input type="number" value={gstRate} onChange={e => setGstRate(e.target.value)}
                  placeholder="0 / 5 / 12 / 18 / 28"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">GSTIN</label>
                <input value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())}
                  placeholder="Optional" maxLength={15}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-navy/40 font-mono uppercase" />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">Discount type</label>
                <select value={discountType} onChange={e => { setDiscountType(e.target.value as any); setDiscountValue(''); }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none">
                  <option value="">None</option>
                  <option value="percentage">Percentage (%)</option>
                  <option value="flat">Flat (₹)</option>
                </select>
              </div>
              {discountType && (
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">
                    {discountType === 'percentage' ? 'Discount %' : 'Discount ₹'}
                  </label>
                  <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
                </div>
              )}
            </div>
          </section>

          {/* ── Due date & Notes ───────────────────────────────────────── */}
          <section className="space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">Due Date (optional)</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Payment terms, additional info…"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-navy/40" />
            </div>
          </section>

          {/* ── Total preview ──────────────────────────────────────────── */}
          {subtotal > 0 && (
            <div className="bg-navy/5 rounded-xl px-4 py-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span><span className="font-semibold">{fmtAmt(subtotal)}</span>
              </div>
              {discAmt > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount {discountType === 'percentage' ? `(${discountValue}%)` : ''}</span>
                  <span className="font-semibold">−{fmtAmt(discAmt)}</span>
                </div>
              )}
              {gstAmt > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>GST ({gstRate}%)</span><span className="font-semibold">+{fmtAmt(gstAmt)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-navy pt-1.5 border-t border-navy/10">
                <span>Total</span><span className="text-lg">{fmtAmt(total)}</span>
              </div>
            </div>
          )}

          {formError && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-4 py-2">{formError}</p>}

          <Button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !valid}
            className="w-full py-3 rounded-xl font-bold disabled:opacity-50">
            {createMut.isPending
              ? 'Creating…'
              : nsState === 'found'
                ? '📤 Generate & send to customer app'
                : '🧾 Generate invoice PDF'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Export dialog ─────────────────────────────────────────────────────────────

function ExportDialog({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function doExport() {
    setLoading(true); setErr('');
    try {
      const r = await api.get(`/stores/mine/invoices/export/?period=${period}&format=${format}`, {
        responseType: 'blob',
      });
      const ext      = format === 'pdf' ? 'pdf' : 'csv';
      const mime     = format === 'pdf' ? 'application/pdf' : 'text/csv';
      const url      = URL.createObjectURL(new Blob([r.data], { type: mime }));
      const a        = document.createElement('a');
      a.href         = url;
      a.download     = `NearSpot_Sales_${period}_${new Date().toISOString().slice(0, 10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      setErr('Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-navy">Download Sales Report</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-sm">✕</button>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Period</p>
          <div className="flex gap-2">
            {(['daily', 'weekly', 'monthly'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${period === p ? 'bg-navy text-white border-navy' : 'border-gray-200 text-gray-600 hover:border-navy/40'}`}>
                {p === 'daily' ? 'Today' : p === 'weekly' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Format</p>
          <div className="flex gap-2">
            {(['csv', 'pdf'] as const).map(f => (
              <button key={f} onClick={() => setFormat(f)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${format === f ? 'bg-navy text-white border-navy' : 'border-gray-200 text-gray-600 hover:border-navy/40'}`}>
                {f === 'csv' ? 'CSV (Excel)' : 'PDF'}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {format === 'csv' ? 'Opens in Google Sheets or Excel — best for filtering by product.' : 'Formatted report — best for printing or sharing.'}
          </p>
        </div>

        {err && <p className="text-xs text-red-500">{err}</p>}

        <button onClick={doExport} disabled={loading}
          className="w-full py-2.5 rounded-xl bg-navy text-white text-sm font-bold disabled:opacity-50 hover:bg-navy/90 transition-colors">
          {loading ? 'Downloading…' : '⬇ Download'}
        </button>
      </div>
    </div>
  );
}

// ── Main island ───────────────────────────────────────────────────────────────

function Inner() {
  const qc = useQueryClient();
  const [selected,    setSelected]    = useState<Invoice | null>(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [showExport,  setShowExport]  = useState(false);
  const [search,      setSearch]      = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-invoices'],
    queryFn:  () => api.get('/stores/mine/invoices/').then(r => r.data),
  });

  const invoices: Invoice[] = data?.results ?? (Array.isArray(data) ? data : []);

  const shown = search
    ? invoices.filter(i =>
        i.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        (i.customer_phone ?? '').includes(search) ||
        (i.customer_ns_code ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : invoices;

  const totalRevenue = invoices.reduce((s, i) => s + parseFloat(String(i.total ?? '0')), 0);
  const sentCount    = invoices.filter(i => i.is_sent).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Invoices</h1>
          <p className="text-sm text-gray-400">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''} · {fmtAmt(totalRevenue)} total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowExport(true)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:border-navy/40 hover:text-navy transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export
          </button>
          <Button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm rounded-xl font-bold">
            + Create Invoice
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total',   value: invoices.length,      icon: '🧾' },
          { label: 'Sent',    value: sentCount,             icon: '✅' },
          { label: 'Revenue', value: fmtAmt(totalRevenue), icon: '💰' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <div className="text-xl mb-1">{s.icon}</div>
            <p className="text-lg font-bold text-navy">{s.value}</p>
            <p className="text-xs text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone or NS code…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10" />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="card overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100 animate-pulse">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-200 rounded w-1/4" />
              </div>
              <div className="h-5 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : shown.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">🧾</div>
          <p className="font-semibold text-gray-600">{search ? 'No matching invoices' : 'No invoices yet'}</p>
          {!search && (
            <p className="text-sm mt-1">
              Create your first invoice.{' '}
              <button onClick={() => setShowCreate(true)} className="text-navy font-bold hover:underline">+ Create Invoice</button>
            </p>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map(inv => (
                <tr key={inv.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-navy">{inv.customer_name}</p>
                    {inv.customer_phone && <p className="text-xs text-gray-400">{inv.customer_phone}</p>}
                    {inv.customer_ns_code && <p className="text-xs text-gray-300 font-mono">{inv.customer_ns_code}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{inv.items.length} item{inv.items.length !== 1 ? 's' : ''}</td>
                  <td className="px-4 py-3 font-bold text-navy">{fmtAmt(inv.total)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${inv.is_sent ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {inv.is_sent ? 'Sent' : 'Draft'}
                      </span>
                      {returnStatus(inv.items) === 'full' && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600">Returned</span>
                      )}
                      {returnStatus(inv.items) === 'partial' && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Part. Returned</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(inv.created_at)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelected(inv)} className="text-xs text-navy font-bold hover:underline">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected    && <InvoiceDetail invoice={selected} onClose={() => setSelected(null)} />}
      {showExport  && <ExportDialog onClose={() => setShowExport(false)} />}
      {showCreate  && (
        <CreateInvoiceModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ['vendor-invoices'] });
          }}
        />
      )}
    </div>
  );
}

export default function VendorInvoicesIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <VendorAuthGuard>
        <Inner />
      </VendorAuthGuard>
    </QueryClientProvider>
  );
}
