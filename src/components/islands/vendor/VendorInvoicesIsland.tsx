import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

// Actual API field names from mobile app
interface InvoiceItem {
  name: string;
  price: number;
  qty: number;
  product_id?: string;
}

interface Invoice {
  id: string;
  customer_name: string;
  customer_phone?: string;
  customer_ns_code?: string;
  items: InvoiceItem[];
  notes?: string;
  total: number;
  is_sent: boolean;
  created_at: string;
  pdf_url?: string;
  discount_type?: string | null;
  discount_value?: number;
  gstin?: string;
  gst_rate?: number;
  gst_amount?: number;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}
function fmtAmt(n: number) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Invoice detail modal ──────────────────────────────────────────────────────
function InvoiceDetail({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const subtotal = invoice.items.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = invoice.discount_type === 'percentage'
    ? subtotal * (invoice.discount_value ?? 0) / 100
    : (invoice.discount_value ?? 0);
  const gstAmt = invoice.gst_amount ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
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
          {/* Customer info */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Bill To</p>
            <p className="font-semibold text-navy">{invoice.customer_name}</p>
            {invoice.customer_phone && <p className="text-sm text-gray-500">{invoice.customer_phone}</p>}
            {invoice.customer_ns_code && <p className="text-xs text-gray-400 font-mono">NS: {invoice.customer_ns_code}</p>}
            {invoice.gstin && <p className="text-xs text-gray-400">GSTIN: {invoice.gstin}</p>}
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Items</p>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              {invoice.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                    <p className="text-xs text-gray-400">Qty {item.qty} × {fmtAmt(item.price)}</p>
                  </div>
                  <p className="text-sm font-bold text-navy">{fmtAmt(item.price * item.qty)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
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
interface DraftItem { name: string; price: string; qty: string; }

function CreateInvoiceModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNsCode, setCustomerNsCode] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [gstin, setGstin] = useState('');
  const [gstRate, setGstRate] = useState('');
  const [discountType, setDiscountType] = useState<'' | 'percentage' | 'flat'>('');
  const [discountValue, setDiscountValue] = useState('');
  const [items, setItems] = useState<DraftItem[]>([{ name: '', price: '', qty: '1' }]);
  const [formError, setFormError] = useState('');

  const addItem = () => setItems(p => [...p, { name: '', price: '', qty: '1' }]);
  const removeItem = (idx: number) => setItems(p => p.filter((_, i) => i !== idx));
  const setItem = (idx: number, field: keyof DraftItem, val: string) =>
    setItems(p => p.map((it, i) => i === idx ? { ...it, [field]: val } : it));

  const subtotal = items.reduce((s, it) => s + (parseFloat(it.price) || 0) * (parseInt(it.qty) || 0), 0);
  const discAmt = discountType === 'percentage'
    ? subtotal * (parseFloat(discountValue) || 0) / 100
    : discountType === 'flat' ? (parseFloat(discountValue) || 0) : 0;
  const gstAmt = (subtotal - discAmt) * (parseFloat(gstRate) || 0) / 100;
  const total = subtotal - discAmt + gstAmt;

  const createMut = useMutation({
    mutationFn: () => {
      const payload: any = {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_ns_code: customerNsCode,
        notes,
        gstin,
        gst_rate: parseFloat(gstRate) || 0,
        items: items.map(it => ({
          name: it.name,
          price: parseFloat(it.price) || 0,
          qty: parseInt(it.qty) || 1,
        })),
      };
      if (dueDate) payload.due_date = dueDate;
      if (discountType) {
        payload.discount_type = discountType;
        payload.discount_value = parseFloat(discountValue) || 0;
      }
      return api.post('/stores/mine/invoices/', payload);
    },
    onSuccess: () => onSuccess(),
    onError: (e: any) => {
      const msg = e?.response?.data?.detail ?? e?.response?.data?.message ?? JSON.stringify(e?.response?.data) ?? 'Failed to create invoice';
      setFormError(msg);
    },
  });

  const valid = customerName.trim() && items.every(it => it.name.trim() && it.price);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-navy">Create Invoice</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Customer */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Customer</p>
            <div className="space-y-3">
              <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                placeholder="Customer name *" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
              <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                placeholder="Phone (optional)" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
              <input value={customerNsCode} onChange={e => setCustomerNsCode(e.target.value)}
                placeholder="NearSpot customer code (optional)" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40 font-mono" />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Items</p>
              <button onClick={addItem} className="text-xs font-bold text-navy hover:underline">+ Add item</button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input value={it.name} onChange={e => setItem(idx, 'name', e.target.value)}
                    placeholder="Item name *" className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-navy/40" />
                  <input type="number" value={it.price} onChange={e => setItem(idx, 'price', e.target.value)}
                    placeholder="Price" className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-navy/40" />
                  <input type="number" value={it.qty} onChange={e => setItem(idx, 'qty', e.target.value)}
                    placeholder="Qty" min="1" className="w-16 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-navy/40" />
                  {items.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-lg shrink-0">×</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* GST & Discount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">GST Rate (%)</label>
              <input type="number" value={gstRate} onChange={e => setGstRate(e.target.value)}
                placeholder="0" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">GSTIN</label>
              <input value={gstin} onChange={e => setGstin(e.target.value)}
                placeholder="Optional" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-navy/40 font-mono uppercase" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">Discount</label>
              <select value={discountType} onChange={e => setDiscountType(e.target.value as any)}
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
                  placeholder="0" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">Due Date (optional)</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Any notes for the customer…"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-navy/40" />
          </div>

          {/* Total preview */}
          {subtotal > 0 && (
            <div className="bg-navy/5 rounded-xl px-4 py-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span><span>{fmtAmt(subtotal)}</span>
              </div>
              {discAmt > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>−{fmtAmt(discAmt)}</span></div>}
              {gstAmt > 0 && <div className="flex justify-between text-gray-600"><span>GST ({gstRate}%)</span><span>+{fmtAmt(gstAmt)}</span></div>}
              <div className="flex justify-between font-bold text-navy pt-1 border-t border-navy/10">
                <span>Total</span><span>{fmtAmt(total)}</span>
              </div>
            </div>
          )}

          {formError && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-4 py-2">{formError}</p>}

          <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !valid}
            className="w-full btn-primary py-3 rounded-xl font-bold disabled:opacity-50">
            {createMut.isPending ? 'Creating…' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main island ───────────────────────────────────────────────────────────────
function Inner() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-invoices'],
    queryFn: () => api.get('/stores/mine/invoices/').then(r => r.data),
  });

  const invoices: Invoice[] = data?.results ?? (Array.isArray(data) ? data : []);

  const shown = search
    ? invoices.filter(i =>
        i.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        (i.customer_phone ?? '').includes(search) ||
        (i.customer_ns_code ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : invoices;

  const totalRevenue = invoices.reduce((s, i) => s + i.total, 0);
  const sentCount = invoices.filter(i => i.is_sent).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Invoices</h1>
          <p className="text-sm text-gray-400">{invoices.length} invoices · {fmtAmt(totalRevenue)} total</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary px-4 py-2 text-sm rounded-xl font-bold">
          + Create Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: invoices.length, icon: '🧾' },
          { label: 'Sent', value: sentCount, icon: '✅' },
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
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{inv.items.length} item{inv.items.length !== 1 ? 's' : ''}</td>
                  <td className="px-4 py-3 font-bold text-navy">{fmtAmt(inv.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${inv.is_sent ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {inv.is_sent ? 'Sent' : 'Draft'}
                    </span>
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

      {selected && <InvoiceDetail invoice={selected} onClose={() => setSelected(null)} />}
      {showCreate && (
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
