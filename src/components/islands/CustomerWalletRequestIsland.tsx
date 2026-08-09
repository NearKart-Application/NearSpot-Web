import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomerAuthGuard } from './CustomerAuthGuard';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';

const list = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 14, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: 'easeOut' as const } } };

interface WalletRequest {
  id: string;
  amount: string | number;
  method: 'upi' | 'bank' | 'wallet';
  upi_id?: string;
  account_number?: string;
  ifsc_code?: string;
  account_name?: string;
  note?: string;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  created_at: string;
  admin_note?: string;
}

interface RequestListResponse { results: WalletRequest[]; count: number; }

const STATUS_PILL: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-800 border-amber-200',
  approved:  'bg-green-100 text-green-800 border-green-200',
  rejected:  'bg-red-100 text-red-700 border-red-200',
  processed: 'bg-blue-100 text-blue-700 border-blue-200',
};

const STATUS_EMOJI: Record<string, string> = {
  pending: '⏳', approved: '✅', rejected: '✗', processed: '💸',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function RequestCard({ req }: { req: WalletRequest }) {
  const pill = STATUS_PILL[req.status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  const emoji = STATUS_EMOJI[req.status] ?? '•';
  return (
    <motion.div variants={item} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xl font-black text-navy">₹{parseFloat(String(req.amount)).toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-400 capitalize mt-0.5">via {req.method}{req.upi_id ? ` · ${req.upi_id}` : ''}</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${pill}`}>
          {emoji} {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
        </span>
      </div>
      {req.note && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mt-2">📝 {req.note}</p>}
      {req.admin_note && <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 mt-1.5">Admin: {req.admin_note}</p>}
      <p className="text-xs text-gray-400 mt-3">{fmt(req.created_at)}</p>
    </motion.div>
  );
}

function RequestForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<'upi' | 'bank'>('upi');
  const [amount, setAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountName, setAccountName] = useState('');
  const [note, setNote] = useState('');
  const [success, setSuccess] = useState(false);

  const mut = useMutation({
    mutationFn: (body: object) => api.post('/wallet/requests/', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-requests'] });
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onSuccess(); }, 2000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const base = { amount: parseFloat(amount), method, note: note.trim() || undefined };
    const payload = method === 'upi'
      ? { ...base, upi_id: upiId.trim() }
      : { ...base, account_number: accountNumber.trim(), ifsc_code: ifsc.trim(), account_name: accountName.trim() };
    mut.mutate(payload);
  };

  const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 placeholder:text-gray-400';
  const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-green-50 border border-green-200 rounded-xl p-4 text-center"
          >
            <div className="text-2xl mb-1">✅</div>
            <p className="text-green-700 font-semibold text-sm">Request submitted successfully!</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <label className={labelCls}>Amount (₹)</label>
        <input
          type="number" min="1" required value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="Enter amount" className={inputCls}
        />
      </div>

      {/* Method tabs */}
      <div>
        <label className={labelCls}>Payment Method</label>
        <div className="flex gap-2">
          {(['upi', 'bank'] as const).map(m => (
            <button
              key={m} type="button" onClick={() => setMethod(m)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                method === m ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {m === 'upi' ? '📱 UPI' : '🏦 Bank Transfer'}
            </button>
          ))}
        </div>
      </div>

      {method === 'upi' ? (
        <div>
          <label className={labelCls}>UPI ID</label>
          <input
            type="text" required value={upiId} onChange={e => setUpiId(e.target.value)}
            placeholder="yourname@upi" className={inputCls}
          />
        </div>
      ) : (
        <>
          <div>
            <label className={labelCls}>Account Holder Name</label>
            <input type="text" required value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Full name" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Account Number</label>
            <input type="text" required value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="XXXXXXXXXXXX" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>IFSC Code</label>
            <input type="text" required value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase())} placeholder="SBIN0001234" className={inputCls} />
          </div>
        </>
      )}

      <div>
        <label className={labelCls}>Note (optional)</label>
        <textarea
          value={note} onChange={e => setNote(e.target.value)}
          placeholder="Any additional info…" rows={2}
          className={`${inputCls} resize-none`}
        />
      </div>

      {mut.isError && (
        <p className="text-sm text-red-500 text-center">Something went wrong. Please try again.</p>
      )}

      <button
        type="submit" disabled={mut.isPending || !amount}
        className="w-full py-3.5 bg-navy text-white rounded-2xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {mut.isPending ? 'Submitting…' : 'Submit Request'}
      </button>
    </form>
  );
}

function Inner() {
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ns_access');
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, refetch } = useQuery<RequestListResponse>({
    queryKey: ['wallet-requests'],
    queryFn: () => api.get('/wallet/requests/').then(r => r.data),
    enabled: isLoggedIn,
  });

  const requests = data?.results ?? (Array.isArray(data) ? data as WalletRequest[] : []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-navy">Wallet Requests</h1>
          <p className="text-sm text-gray-500 mt-1">Request wallet balance withdrawal</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="px-4 py-2 bg-navy text-white rounded-xl text-sm font-bold"
        >
          {showForm ? '✕ Close' : '+ New Request'}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            key="form"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
              <h2 className="text-base font-bold text-navy mb-4">New Wallet Request</h2>
              <RequestForm onSuccess={() => setShowForm(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
              <div className="flex justify-between mb-2">
                <div className="h-6 bg-gray-100 rounded w-1/4" />
                <div className="h-5 bg-gray-100 rounded w-1/5" />
              </div>
              <div className="h-3 bg-gray-100 rounded w-1/3 mt-2" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && requests.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">💳</div>
          <h3 className="font-bold text-navy text-lg">No requests yet</h3>
          <p className="text-gray-400 text-sm mt-1">Submit a new request to withdraw your wallet balance</p>
        </div>
      )}

      {!isLoading && requests.length > 0 && (
        <>
          <p className="text-xs text-gray-400 mb-3">{requests.length} request{requests.length !== 1 ? 's' : ''}</p>
          <motion.div className="space-y-3" variants={list} initial="hidden" animate="show">
            {requests.map(r => <RequestCard key={r.id} req={r} />)}
          </motion.div>
        </>
      )}
    </div>
  );
}

export default function CustomerWalletRequestIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomerAuthGuard>
        <Inner />
      </CustomerAuthGuard>
    </QueryClientProvider>
  );
}
