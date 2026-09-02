import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

interface CreditAccount {
  id: string;
  name: string;
  phone: string;
  credit_limit: string;
  notes: string;
  balance: string;
  available_credit: string | null;
  days_oldest_unpaid: number;
  last_transaction: { type: string; amount: string; date: string } | null;
  created_at: string;
}

interface Transaction {
  id: string;
  transaction_type: 'credit' | 'payment';
  amount: string;
  note: string;
  payment_method: string;
  created_at: string;
}

interface AccountDetail extends CreditAccount {
  transactions: Transaction[];
}

interface AgingEntry { id: string; name: string; phone: string; balance: number; days: number; }
interface AgingReport {
  total_outstanding: number;
  buckets: { '0_30': AgingEntry[]; '31_60': AgingEntry[]; '61_90': AgingEntry[]; '90_plus': AgingEntry[]; };
}

interface ReminderResponse {
  account_id: string; name: string; phone: string; balance: string;
  message: string; whatsapp_url: string | null; reminder_sent: boolean;
}

interface StatementEntry { date: string; type: string; amount: string; note: string; method: string; balance: string; }
interface Statement {
  store_name: string; customer_name: string; customer_phone: string;
  credit_limit: string; outstanding: string; generated_at: string;
  ledger: StatementEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: string | number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

type Tab = 'customers' | 'aging';

// ── Main component ────────────────────────────────────────────────────────────
function Inner() {
  const qc = useQueryClient();
  const [tab, setTab]                       = useState<Tab>('customers');
  const [search, setSearch]                 = useState('');
  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddTx, setShowAddTx]           = useState<'credit' | 'payment' | null>(null);
  const [reminder, setReminder]             = useState<ReminderResponse | null>(null);
  const [statement, setStatement]           = useState<Statement | null>(null);
  const [actionLoading, setActionLoading]   = useState<string | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: accounts = [], isLoading, error } = useQuery<CreditAccount[]>({
    queryKey: ['credit-accounts'],
    queryFn: () => api.get('/credit/customers/').then(r => r.data),
  });

  const { data: detail } = useQuery<AccountDetail>({
    queryKey: ['credit-account', selectedId],
    queryFn: () => api.get(`/credit/customers/${selectedId}/`).then(r => r.data),
    enabled: !!selectedId,
  });

  const { data: aging } = useQuery<AgingReport>({
    queryKey: ['credit-aging'],
    queryFn: () => api.get('/credit/aging/').then(r => r.data),
    enabled: tab === 'aging',
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', credit_limit: '', notes: '' });
  const addCustomerMut = useMutation({
    mutationFn: () => api.post('/credit/customers/', newCustomer),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['credit-accounts'] }); setShowAddCustomer(false); setNewCustomer({ name: '', phone: '', credit_limit: '', notes: '' }); },
  });

  const [txForm, setTxForm] = useState({ amount: '', note: '', payment_method: '' });
  const addTxMut = useMutation({
    mutationFn: () => api.post(`/credit/customers/${selectedId}/transactions/`, { ...txForm, transaction_type: showAddTx }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credit-accounts'] });
      qc.invalidateQueries({ queryKey: ['credit-account', selectedId] });
      qc.invalidateQueries({ queryKey: ['credit-aging'] });
      setShowAddTx(null);
      setTxForm({ amount: '', note: '', payment_method: '' });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/credit/customers/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['credit-accounts'] }); setSelectedId(null); },
  });

  const sendReminder = async (accountId: string) => {
    setActionLoading('remind-' + accountId);
    try {
      const r = await api.post(`/credit/customers/${accountId}/remind/`);
      setReminder(r.data);
    } catch { /* ignore */ }
    finally { setActionLoading(null); }
  };

  const loadStatement = async (accountId: string) => {
    setActionLoading('stmt-' + accountId);
    try {
      const r = await api.get(`/credit/customers/${accountId}/statement/`);
      setStatement(r.data);
    } catch { /* ignore */ }
    finally { setActionLoading(null); }
  };

  const filtered = accounts.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.phone.includes(search)
  );

  if (isLoading) return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (error) return <IslandError message="Failed to load credit accounts" />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Customer Credit (Udhar)</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {accounts.length} customer{accounts.length !== 1 ? 's' : ''} ·{' '}
            Total outstanding: <span className="font-semibold text-rose-600">{fmt(accounts.reduce((s, a) => s + Number(a.balance), 0))}</span>
          </p>
        </div>
        <button onClick={() => setShowAddCustomer(true)} className="btn-primary text-sm">+ Add Customer</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['customers', 'aging'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-rose-500 text-rose-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'customers' ? 'Customers' : 'Aging Report'}
          </button>
        ))}
      </div>

      {/* ── Customers tab ── */}
      {tab === 'customers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: customer list */}
          <div className="lg:col-span-1 space-y-3">
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
              placeholder="Search by name or phone…"
              value={search} onChange={e => setSearch(e.target.value)}
            />
            {filtered.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No customers yet. Add one to start tracking credit.</p>
            )}
            <div className="space-y-2">
              {filtered.map(acc => {
                const bal = Number(acc.balance);
                return (
                  <button key={acc.id} onClick={() => setSelectedId(acc.id)}
                    className={`w-full text-left card px-4 py-3 rounded-xl transition-all ${selectedId === acc.id ? 'ring-2 ring-rose-400' : 'hover:shadow-md'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-navy text-sm">{acc.name}</p>
                        {acc.phone && <p className="text-xs text-gray-400">{acc.phone}</p>}
                      </div>
                      <div className="text-right">
                        <p className={`font-bold text-sm ${bal > 0 ? 'text-rose-600' : 'text-green-600'}`}>{fmt(bal)}</p>
                        {acc.days_oldest_unpaid > 0 && (
                          <p className={`text-xs ${acc.days_oldest_unpaid > 60 ? 'text-red-500' : acc.days_oldest_unpaid > 30 ? 'text-amber-500' : 'text-gray-400'}`}>
                            {acc.days_oldest_unpaid}d overdue
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: detail / ledger */}
          <div className="lg:col-span-2">
            {!selectedId && (
              <div className="card p-10 text-center text-gray-400">
                <p className="text-4xl mb-3">📒</p>
                <p className="font-semibold">Select a customer to view their ledger</p>
              </div>
            )}
            {selectedId && detail && (
              <div className="space-y-4">
                {/* Customer header */}
                <div className="card px-5 py-4 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-navy">{detail.name}</h2>
                    {detail.phone && <p className="text-sm text-gray-500">{detail.phone}</p>}
                    {detail.credit_limit && Number(detail.credit_limit) > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Limit: {fmt(detail.credit_limit)} · Available: {detail.available_credit != null ? fmt(detail.available_credit) : '—'}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`text-2xl font-bold ${Number(detail.balance) > 0 ? 'text-rose-600' : 'text-green-600'}`}>
                      {fmt(detail.balance)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setShowAddTx('credit')}
                        className="btn-primary text-xs px-3 py-1.5">+ Credit Sale</button>
                      <button onClick={() => setShowAddTx('payment')}
                        className="bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors">↩ Record Payment</button>
                      <button
                        onClick={() => sendReminder(detail.id)}
                        disabled={actionLoading === 'remind-' + detail.id}
                        className="bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50">
                        {actionLoading === 'remind-' + detail.id ? '…' : '🔔 Remind'}
                      </button>
                      <button
                        onClick={() => loadStatement(detail.id)}
                        disabled={actionLoading === 'stmt-' + detail.id}
                        className="border border-rose-400 text-rose-600 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-50">
                        {actionLoading === 'stmt-' + detail.id ? '…' : '📄 Statement'}
                      </button>
                      <button onClick={() => deleteMut.mutate(detail.id)}
                        className="text-xs text-red-400 hover:text-red-600 px-2">Delete</button>
                    </div>
                  </div>
                </div>

                {/* Transaction ledger */}
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <h3 className="font-semibold text-navy text-sm">Ledger</h3>
                  </div>
                  {(detail.transactions ?? []).length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-8">No transactions yet.</p>
                  )}
                  <div className="divide-y divide-gray-50">
                    {(detail.transactions ?? []).map(tx => (
                      <div key={tx.id} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <p className="text-sm font-medium text-navy">
                            {tx.transaction_type === 'credit' ? '🛍️ Credit Sale' : '💰 Payment'}
                            {tx.payment_method && <span className="ml-1 text-xs text-gray-400">({tx.payment_method})</span>}
                          </p>
                          {tx.note && <p className="text-xs text-gray-400">{tx.note}</p>}
                          <p className="text-xs text-gray-300">{fmtDate(tx.created_at)}</p>
                        </div>
                        <p className={`font-bold text-sm ${tx.transaction_type === 'credit' ? 'text-rose-600' : 'text-green-600'}`}>
                          {tx.transaction_type === 'credit' ? '+' : '-'}{fmt(tx.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Aging report tab ── */}
      {tab === 'aging' && aging && (
        <div className="space-y-5">
          <div className="card px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Outstanding</p>
              <p className="text-2xl font-bold text-rose-600">{fmt(aging.total_outstanding)}</p>
            </div>
          </div>
          {([ ['0_30', '0–30 days', 'bg-yellow-50 border-yellow-200 text-yellow-800'],
               ['31_60', '31–60 days', 'bg-orange-50 border-orange-200 text-orange-800'],
               ['61_90', '61–90 days', 'bg-red-50 border-red-300 text-red-800'],
               ['90_plus', '90+ days', 'bg-red-100 border-red-400 text-red-900'],
          ] as [string, string, string][]).map(([key, label, cls]) => {
            const entries = aging.buckets[key as keyof typeof aging.buckets] ?? [];
            if (entries.length === 0) return null;
            return (
              <div key={key} className={`rounded-xl border p-4 ${cls} space-y-2`}>
                <h3 className="font-semibold text-sm">{label} — {entries.length} customer{entries.length !== 1 ? 's' : ''}</h3>
                <div className="space-y-1">
                  {entries.map(e => (
                    <div key={e.id} className="flex justify-between items-center text-sm">
                      <span>{e.name} {e.phone && <span className="opacity-60">· {e.phone}</span>}</span>
                      <span className="font-bold">{fmt(e.balance)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Customer modal ── */}
      {showAddCustomer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-bold text-navy text-lg">Add Customer</h2>
            {['name', 'phone', 'credit_limit'].map(field => (
              <div key={field}>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {field === 'credit_limit' ? 'Credit Limit (₹, 0 = unlimited)' : field.charAt(0).toUpperCase() + field.slice(1)}
                </label>
                <input
                  className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                  type={field === 'credit_limit' ? 'number' : 'text'}
                  value={(newCustomer as any)[field]}
                  onChange={e => setNewCustomer(p => ({ ...p, [field]: e.target.value }))}
                />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={() => addCustomerMut.mutate()} disabled={!newCustomer.name || addCustomerMut.isPending}
                className="btn-primary flex-1 text-sm">
                {addCustomerMut.isPending ? 'Saving…' : 'Add Customer'}
              </button>
              <button onClick={() => setShowAddCustomer(false)} className="btn-outline flex-1 text-sm">Cancel</button>
            </div>
            {addCustomerMut.isError && <p className="text-xs text-red-500">{(addCustomerMut.error as any)?.response?.data?.detail || 'Failed'}</p>}
          </div>
        </div>
      )}

      {/* ── Reminder modal ── */}
      {reminder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-bold text-navy text-lg">🔔 Send Reminder</h2>
            <p className="text-sm"><span className="font-semibold">{reminder.name}</span> · Outstanding: <span className="text-rose-600 font-bold">{fmt(reminder.balance)}</span></p>
            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap">{reminder.message}</div>
            {reminder.whatsapp_url && (
              <a href={reminder.whatsapp_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-green-700 transition-colors">
                <span>💬</span> Open in WhatsApp
              </a>
            )}
            <button onClick={() => setReminder(null)} className="btn-outline w-full text-sm">Close</button>
          </div>
        </div>
      )}

      {/* ── Statement modal ── */}
      {statement && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-navy text-lg">📄 Credit Statement</h2>
                <p className="text-sm text-gray-500">{statement.customer_name} · {statement.customer_phone}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Outstanding</p>
                <p className="font-bold text-rose-600 text-lg">{fmt(statement.outstanding)}</p>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Type</th>
                    <th className="text-right py-2">Amount</th>
                    <th className="text-right py-2">Note</th>
                    <th className="text-right py-2">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {statement.ledger.map((entry, i) => (
                    <tr key={i}>
                      <td className="py-1.5">{entry.date}</td>
                      <td className={`py-1.5 font-medium ${entry.type === 'credit' ? 'text-rose-600' : 'text-green-600'}`}>
                        {entry.type === 'credit' ? 'Sale' : 'Payment'}
                      </td>
                      <td className="py-1.5 text-right">₹{entry.amount}</td>
                      <td className="py-1.5 text-right text-gray-400">{entry.note}</td>
                      <td className="py-1.5 text-right font-semibold">₹{entry.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400">Generated: {statement.generated_at} · {statement.store_name}</p>
            <button onClick={() => setStatement(null)} className="btn-outline w-full text-sm">Close</button>
          </div>
        </div>
      )}

      {/* ── Add Transaction modal ── */}
      {showAddTx && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-bold text-navy text-lg">
              {showAddTx === 'credit' ? '🛍️ Record Credit Sale' : '💰 Record Payment'}
            </h2>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Amount (₹)</label>
              <input type="number" className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                value={txForm.amount} onChange={e => setTxForm(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Note (optional)</label>
              <input className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                value={txForm.note} onChange={e => setTxForm(p => ({ ...p, note: e.target.value }))} />
            </div>
            {showAddTx === 'payment' && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Payment Method</label>
                <select className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                  value={txForm.payment_method} onChange={e => setTxForm(p => ({ ...p, payment_method: e.target.value }))}>
                  <option value="">Select…</option>
                  {['cash', 'upi', 'card', 'other'].map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => addTxMut.mutate()} disabled={!txForm.amount || addTxMut.isPending}
                className={`flex-1 text-sm font-semibold py-2.5 rounded-xl text-white transition-colors ${showAddTx === 'credit' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-green-600 hover:bg-green-700'}`}>
                {addTxMut.isPending ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setShowAddTx(null); setTxForm({ amount: '', note: '', payment_method: '' }); }} className="btn-outline flex-1 text-sm">Cancel</button>
            </div>
            {addTxMut.isError && <p className="text-xs text-red-500">{(addTxMut.error as any)?.response?.data?.detail || 'Failed'}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VendorCreditIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <VendorAuthGuard>
        <Inner />
      </VendorAuthGuard>
    </QueryClientProvider>
  );
}
