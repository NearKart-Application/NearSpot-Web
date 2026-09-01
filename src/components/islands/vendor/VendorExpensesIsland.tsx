import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

interface Category { id: string; name: string; is_system: boolean; expense_count: number; }
interface Expense {
  id: string; category: string | null; category_name: string; amount: string;
  gst_amount: string; total_amount: string; description: string; vendor_name: string;
  date: string; receipt_url: string | null; is_recurring: boolean; recurrence_type: string;
  created_at: string;
}
interface Summary {
  today_total: string; month_total: string; month_gst: string;
  category_breakdown: { category: string; total: string }[];
  monthly_trend: { month: string; total: string; gst: string }[];
}
interface PnL {
  month: string; revenue: string; total_expenses: string; total_gst_paid: string;
  gross_profit: string; profit_margin: string;
}

const fmt = (n: string | number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const monthLabel = (s: string) => { const [y, m] = s.split('-'); return `${['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m]} ${y}`; };

type Tab = 'expenses' | 'summary' | 'pnl' | 'categories';

const RECURRENCE = ['', 'daily', 'weekly', 'monthly', 'yearly'];

function Inner() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('expenses');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [pnlMonth, setPnlMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [receiptExpenseId, setReceiptExpenseId] = useState<string | null>(null);

  const blankForm = { category: '', amount: '', gst_amount: '0', description: '', vendor_name: '', date: new Date().toISOString().slice(0, 10), is_recurring: false, recurrence_type: '' };
  const [form, setForm] = useState(blankForm);

  // Queries
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ['exp-categories'], queryFn: () => api.get('/expenses/categories/').then(r => r.data) });
  const { data: expenses = [], isLoading, error } = useQuery<Expense[]>({ queryKey: ['expenses', filterMonth], queryFn: () => api.get(`/expenses/?month=${filterMonth}`).then(r => r.data) });
  const { data: summary } = useQuery<Summary>({ queryKey: ['exp-summary'], queryFn: () => api.get('/expenses/summary/').then(r => r.data), enabled: tab === 'summary' });
  const { data: pnl } = useQuery<PnL>({ queryKey: ['exp-pnl', pnlMonth], queryFn: () => api.get(`/expenses/pnl/?month=${pnlMonth}`).then(r => r.data), enabled: tab === 'pnl' });

  // Mutations
  const saveMut = useMutation({
    mutationFn: () => editId ? api.patch(`/expenses/${editId}/`, form) : api.post('/expenses/', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['exp-summary'] }); qc.invalidateQueries({ queryKey: ['exp-pnl'] }); setShowAdd(false); setEditId(null); setForm(blankForm); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['exp-summary'] }); },
  });

  const addCatMut = useMutation({
    mutationFn: (name: string) => api.post('/expenses/categories/', { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exp-categories'] }),
  });

  const deleteCatMut = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/categories/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exp-categories'] }),
  });

  const initCatsMut = useMutation({
    mutationFn: () => api.post('/expenses/categories/init/'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exp-categories'] }),
  });

  const receiptMut = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData(); fd.append('receipt', file);
      return api.post(`/expenses/${id}/receipt/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setReceiptExpenseId(null); },
  });

  const monthTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const monthGst   = expenses.reduce((s, e) => s + Number(e.gst_amount), 0);

  if (error) return <IslandError message="Failed to load expenses" />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">Expense Tracking</h1>
          <p className="text-sm text-gray-500">Track business expenses, GST, and P&amp;L</p>
        </div>
        <button onClick={() => { setShowAdd(true); setEditId(null); setForm(blankForm); }} className="btn-primary text-sm">+ Add Expense</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['expenses', 'summary', 'pnl', 'categories'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? 'border-rose-500 text-rose-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'pnl' ? 'P&L' : t}
          </button>
        ))}
      </div>

      {/* ── Expenses tab ── */}
      {tab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300" />
            <div className="flex gap-4 text-sm">
              <span className="text-gray-500">Total: <strong className="text-rose-600">{fmt(monthTotal)}</strong></span>
              {monthGst > 0 && <span className="text-gray-400">GST: {fmt(monthGst)}</span>}
            </div>
          </div>

          {isLoading && <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>}

          {!isLoading && expenses.length === 0 && <p className="text-center text-gray-400 py-10">No expenses for this month. Add one above.</p>}

          <div className="space-y-2">
            {expenses.map(e => {
              const cat = categories.find(c => c.id === e.category);
              return (
                <div key={e.id} className="card px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-navy truncate">{e.description || e.vendor_name || 'Expense'}</span>
                      {(cat?.name || e.category_name) && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{cat?.name || e.category_name}</span>
                      )}
                      {e.is_recurring && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">↻ {e.recurrence_type}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                      {e.vendor_name && ` · ${e.vendor_name}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-rose-600">{fmt(e.amount)}</p>
                    {Number(e.gst_amount) > 0 && <p className="text-xs text-gray-400">+{fmt(e.gst_amount)} GST</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setReceiptExpenseId(e.id); }}
                      className={`text-xs px-2 py-1 rounded-lg border ${e.receipt_url ? 'border-green-300 text-green-600' : 'border-gray-200 text-gray-400'} hover:bg-gray-50`}>
                      {e.receipt_url ? '📎' : '+ Receipt'}
                    </button>
                    <button onClick={() => { setEditId(e.id); setForm({ category: e.category || '', amount: e.amount, gst_amount: e.gst_amount, description: e.description, vendor_name: e.vendor_name, date: e.date, is_recurring: e.is_recurring, recurrence_type: e.recurrence_type }); setShowAdd(true); }}
                      className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">Edit</button>
                    <button onClick={() => deleteMut.mutate(e.id)} className="text-xs px-2 py-1 rounded-lg border border-red-100 text-red-400 hover:bg-red-50">Del</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Summary tab ── */}
      {tab === 'summary' && summary && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Today's Expenses", value: fmt(summary.today_total), color: 'text-rose-600' },
              { label: "This Month", value: fmt(summary.month_total), color: 'text-rose-700' },
              { label: "GST This Month", value: fmt(summary.month_gst), color: 'text-amber-600' },
            ].map(card => (
              <div key={card.label} className="card p-4">
                <p className="text-xs text-gray-500">{card.label}</p>
                <p className={`text-xl font-bold mt-1 ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {summary.category_breakdown.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-sm mb-3">By Category (This Month)</h3>
              <div className="space-y-2">
                {summary.category_breakdown.map(b => {
                  const pct = summary.month_total !== '0' ? (Number(b.total) / Number(summary.month_total) * 100).toFixed(0) : 0;
                  return (
                    <div key={b.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{b.category}</span><span className="font-semibold">{fmt(b.total)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full"><div className="h-2 bg-rose-400 rounded-full" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {summary.monthly_trend.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-sm mb-3">Monthly Trend</h3>
              <div className="space-y-2">
                {summary.monthly_trend.map(r => (
                  <div key={r.month} className="flex justify-between text-sm">
                    <span className="text-gray-600">{monthLabel(r.month)}</span>
                    <span className="font-semibold">{fmt(r.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── P&L tab ── */}
      {tab === 'pnl' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input type="month" value={pnlMonth} onChange={e => setPnlMonth(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300" />
          </div>
          {pnl && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Revenue', value: fmt(pnl.revenue), color: 'text-green-600' },
                { label: 'Total Expenses', value: fmt(pnl.total_expenses), color: 'text-rose-600' },
                { label: 'GST Paid (ITC)', value: fmt(pnl.total_gst_paid), color: 'text-amber-600' },
                { label: 'Gross Profit', value: fmt(pnl.gross_profit), color: Number(pnl.gross_profit) >= 0 ? 'text-green-700' : 'text-red-600' },
              ].map(c => (
                <div key={c.label} className="card p-5">
                  <p className="text-sm text-gray-500">{c.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                </div>
              ))}
              <div className="card p-5 md:col-span-2">
                <p className="text-sm text-gray-500">Profit Margin</p>
                <p className="text-3xl font-bold mt-1 text-navy">{pnl.profit_margin}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Categories tab ── */}
      {tab === 'categories' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <button onClick={() => initCatsMut.mutate()} disabled={initCatsMut.isPending}
              className="btn-outline text-sm">{initCatsMut.isPending ? 'Loading…' : 'Load Preset Categories'}</button>
            <AddCategoryInline onAdd={name => addCatMut.mutate(name)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map(c => (
              <div key={c.id} className="card p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.expense_count} expense{c.expense_count !== 1 ? 's' : ''}</p>
                </div>
                {!c.is_system && (
                  <button onClick={() => deleteCatMut.mutate(c.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Add/Edit Expense modal ── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 overflow-y-auto max-h-[90vh]">
            <h2 className="font-bold text-navy text-lg">{editId ? 'Edit Expense' : 'Add Expense'}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Category</label>
                <select className="input mt-1" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  <option value="">— None —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Amount (₹) *</label>
                <input type="number" className="input mt-1" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div>
                <label className="label">GST Amount (₹)</label>
                <input type="number" className="input mt-1" value={form.gst_amount} onChange={e => setForm(p => ({ ...p, gst_amount: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Description</label>
                <input className="input mt-1" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label className="label">Vendor / Payee</label>
                <input className="input mt-1" value={form.vendor_name} onChange={e => setForm(p => ({ ...p, vendor_name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Date *</label>
                <input type="date" className="input mt-1" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <input type="checkbox" id="recurring" checked={form.is_recurring} onChange={e => setForm(p => ({ ...p, is_recurring: e.target.checked }))} />
                <label htmlFor="recurring" className="text-sm">Recurring expense</label>
                {form.is_recurring && (
                  <select className="input flex-1" value={form.recurrence_type} onChange={e => setForm(p => ({ ...p, recurrence_type: e.target.value }))}>
                    <option value="">Select frequency</option>
                    {RECURRENCE.filter(Boolean).map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => saveMut.mutate()} disabled={!form.amount || !form.date || saveMut.isPending} className="btn-primary flex-1 text-sm">
                {saveMut.isPending ? 'Saving…' : editId ? 'Update' : 'Add Expense'}
              </button>
              <button onClick={() => { setShowAdd(false); setEditId(null); }} className="btn-outline flex-1 text-sm">Cancel</button>
            </div>
            {saveMut.isError && <p className="text-xs text-red-500">{(saveMut.error as any)?.response?.data?.detail || 'Failed'}</p>}
          </div>
        </div>
      )}

      {/* ── Receipt upload modal ── */}
      {receiptExpenseId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-bold text-navy text-lg">Upload Receipt</h2>
            <input type="file" accept="image/*" onChange={e => {
              const file = e.target.files?.[0];
              if (file && receiptExpenseId) receiptMut.mutate({ id: receiptExpenseId, file });
            }} className="text-sm" />
            {receiptMut.isPending && <p className="text-sm text-gray-500">Uploading…</p>}
            <button onClick={() => setReceiptExpenseId(null)} className="btn-outline w-full text-sm">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddCategoryInline({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <div className="flex gap-2">
      <input className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
        placeholder="New category name…" value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onAdd(name.trim()); setName(''); } }} />
      <button onClick={() => { if (name.trim()) { onAdd(name.trim()); setName(''); } }} className="btn-primary text-sm">Add</button>
    </div>
  );
}

export default function VendorExpensesIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <VendorAuthGuard>
        <Inner />
      </VendorAuthGuard>
    </QueryClientProvider>
  );
}
