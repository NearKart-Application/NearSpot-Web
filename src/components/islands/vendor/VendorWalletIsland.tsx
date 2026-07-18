import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

interface Transaction {
  id: string; type: string; amount: number | string; description: string; created_at: string;
}
interface WalletData {
  balance: number | string; currency: string; transactions?: Transaction[];
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function Inner() {
  const { data: wallet, isLoading: walletLoading } = useQuery<WalletData>({
    queryKey: ['vendor-wallet'],
    queryFn: () => api.get('/billing/wallet/').then(r => r.data),
  });

  const { data: txData, isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ['vendor-transactions'],
    queryFn: () => api.get('/billing/transactions/').then(r => r.data),
  });

  const transactions: Transaction[] = Array.isArray(txData) ? txData : (txData as any)?.results ?? [];
  const balance = parseFloat(String(wallet?.balance ?? '0'));

  const typeIcon: Record<string, string> = {
    credit: '⬆️', debit: '⬇️', refund: '↩️',
    subscription: '🚀', commission: '💰', withdrawal: '💸',
  };
  const typeColor: Record<string, string> = {
    credit: 'text-green-600', debit: 'text-red-500',
    refund: 'text-blue-600', subscription: 'text-purple-600',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Wallet</h1>
        <p className="text-sm text-gray-400">Your NearSpot billing wallet</p>
      </div>

      {/* Balance card */}
      <div className="card p-6 bg-gradient-to-br from-navy to-navy/80 text-white overflow-hidden relative">
        <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-white/5 rounded-full" />
        <p className="text-sm text-white/70 font-medium mb-1">Available Balance</p>
        <p className="text-4xl font-black">
          {walletLoading ? '…' : `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
        </p>
        <p className="text-xs text-white/60 mt-2">NearSpot Vendor Wallet</p>
      </div>

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
              const isCredit = ['credit', 'refund'].includes(tx.type);
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
