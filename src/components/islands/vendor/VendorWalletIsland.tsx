import { useState, useRef } from 'react';
import { QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

interface Transaction {
  id: string; type: string; amount: number | string; description: string; created_at: string;
}
interface WalletData {
  balance: number | string; currency: string; transactions?: Transaction[];
}
interface PagedTransactions { count: number; results: Transaction[]; }

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function loadRazorpay() {
  if ((window as any).Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error('Razorpay load failed'));
    document.head.appendChild(s);
  });
}

const PRESET_AMOUNTS = [200, 500, 1000, 2000];

function Inner() {
  const qc = useQueryClient();
  const [showTopup,   setShowTopup]   = useState(false);
  const [topupAmt,    setTopupAmt]    = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupMsg,    setTopupMsg]    = useState<string | null>(null);

  const { data: wallet, isLoading: walletLoading } = useQuery<WalletData>({
    queryKey: ['vendor-wallet'],
    queryFn: () => api.get('/billing/wallet/').then(r => r.data),
  });

  const { data: txData, isLoading: txLoading } = useQuery<PagedTransactions>({
    queryKey: ['vendor-transactions'],
    queryFn: () => api.get('/billing/transactions/').then(r => r.data),
  });

  const transactions: Transaction[] = txData?.results ?? [];
  const balance = parseFloat(String(wallet?.balance ?? '0'));

  const typeIcon: Record<string, string> = {
    credit: '⬆️', debit: '⬇️', refund: '↩️', topup: '💳',
    subscription: '🚀', commission: '💰', withdrawal: '💸',
  };

  async function handleTopup() {
    const amount = parseFloat(topupAmt);
    if (!amount || amount < 100 || amount > 10000) {
      setTopupMsg('❌ Enter an amount between ₹100 and ₹10,000.');
      return;
    }
    setTopupLoading(true);
    setTopupMsg(null);
    try {
      const { data: order } = await api.post('/billing/wallet/topup/initiate/', { amount });
      await loadRazorpay();
      const rzp = new (window as any).Razorpay({
        key:      order.razorpay_key_id,
        amount:   order.amount,
        currency: order.currency || 'INR',
        order_id: order.order_id,
        name:     'NearSpot',
        description: `Wallet top-up ₹${amount}`,
        handler: async (response: any) => {
          try {
            await api.post('/billing/wallet/topup/verify/', {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              amount,
            });
            qc.invalidateQueries({ queryKey: ['vendor-wallet'] });
            qc.invalidateQueries({ queryKey: ['vendor-transactions'] });
            setTopupMsg(`✅ ₹${amount} added to your wallet!`);
            setShowTopup(false);
            setTopupAmt('');
          } catch {
            setTopupMsg('❌ Payment verification failed. Contact support if money was deducted.');
          } finally {
            setTopupLoading(false);
          }
        },
        modal: { ondismiss: () => setTopupLoading(false) },
      });
      rzp.open();
    } catch (e: any) {
      setTopupMsg('❌ ' + (e?.response?.data?.message ?? 'Could not initiate payment. Try again.'));
      setTopupLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Wallet</h1>
        <p className="text-sm text-gray-400">Your NearSpot billing wallet</p>
      </div>

      {topupMsg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-semibold ${topupMsg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {topupMsg}
        </div>
      )}

      {/* Balance card */}
      <div className="card p-6 bg-gradient-to-br from-navy to-navy/80 text-white overflow-hidden relative">
        <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-white/5 rounded-full" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-sm text-white/70 font-medium mb-1">Available Balance</p>
            <p className="text-4xl font-black">
              {walletLoading ? '…' : `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
            </p>
            <p className="text-xs text-white/60 mt-2">NearSpot Vendor Wallet</p>
          </div>
          <button
            onClick={() => { setShowTopup(v => !v); setTopupMsg(null); }}
            className="bg-white/20 hover:bg-white/30 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors shrink-0 mt-1">
            + Add Funds
          </button>
        </div>
      </div>

      {/* Top-up panel */}
      {showTopup && (
        <div className="card p-5 space-y-4">
          <h3 className="font-bold text-navy">Add Funds via Razorpay</h3>
          <div className="flex flex-wrap gap-2">
            {PRESET_AMOUNTS.map(a => (
              <button key={a}
                onClick={() => setTopupAmt(String(a))}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${topupAmt === String(a) ? 'bg-navy text-white border-navy' : 'border-gray-200 text-gray-700 hover:border-navy hover:text-navy'}`}>
                ₹{a.toLocaleString('en-IN')}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Custom Amount (₹100 – ₹10,000)</label>
            <input
              type="number" min="100" max="10000" step="50"
              value={topupAmt}
              onChange={e => setTopupAmt(e.target.value)}
              placeholder="e.g. 750"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleTopup}
              disabled={topupLoading || !topupAmt}
              className="flex-1 py-2.5 rounded-xl bg-navy text-white text-sm font-bold disabled:opacity-60 hover:bg-navy/90 transition-colors">
              {topupLoading ? 'Processing…' : `Pay ₹${topupAmt || '0'} via Razorpay`}
            </button>
            <button
              onClick={() => { setShowTopup(false); setTopupAmt(''); setTopupMsg(null); }}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:border-navy hover:text-navy transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Transaction history */}
      <div>
        <h2 className="font-bold text-navy mb-4">Transaction History</h2>
        {txLoading ? (
          <div className="card overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
                <div className="h-5 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="card p-10 text-center text-gray-400">
            <div className="text-4xl mb-3">💳</div>
            <p className="font-semibold text-gray-600">No transactions yet</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {transactions.map(tx => {
              const isCredit = ['credit', 'refund', 'topup'].includes(tx.type);
              return (
                <div key={tx.id} className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-lg shrink-0">
                    {typeIcon[tx.type] ?? '💰'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy truncate">{tx.description}</p>
                    <p className="text-xs text-gray-400 capitalize">{tx.type} · {fmtDate(tx.created_at)}</p>
                  </div>
                  <p className={`text-sm font-bold shrink-0 ${isCredit ? 'text-green-600' : 'text-red-500'}`}>
                    {isCredit ? '+' : '-'}₹{Math.abs(parseFloat(String(tx.amount ?? '0'))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function VendorWalletIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
