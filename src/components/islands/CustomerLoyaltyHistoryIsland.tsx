import { useState } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CustomerAuthGuard } from './CustomerAuthGuard';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';

const list = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0, transition: { duration: 0.28, ease: 'easeOut' as const } } };

interface LoyaltyBalance {
  balance: number;
  total_earned: number;
  total_redeemed: number;
  referral_code: string;
  points_value_rupees: number;
  referrals_count: number;
}

interface HistoryItem {
  id: string;
  transaction_type?: string;
  points: number;
  description?: string;
  created_at: string;
}

type FilterType = 'all' | 'earned' | 'redeemed';

const TYPE_ICONS: Record<string, string> = {
  earned:    '⭐',
  redeemed:  '🎁',
  referral:  '👥',
  bonus:     '🎯',
  refund:    '↩',
  expired:   '⌛',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function BalanceSkeleton() {
  return (
    <div className="bg-navy rounded-2xl p-5 animate-pulse">
      <div className="h-4 bg-white/20 rounded w-1/3 mb-3" />
      <div className="h-10 bg-white/20 rounded w-1/2 mb-2" />
      <div className="flex gap-3 mt-4">
        <div className="h-14 bg-white/10 rounded-xl flex-1" />
        <div className="h-14 bg-white/10 rounded-xl flex-1" />
        <div className="h-14 bg-white/10 rounded-xl flex-1" />
      </div>
    </div>
  );
}

function Inner() {
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ns_access');
  const [filter, setFilter] = useState<FilterType>('all');

  const { data: balance, isLoading: balLoading } = useQuery<LoyaltyBalance>({
    queryKey: ['loyalty-balance-hist'],
    queryFn: () => api.get('/loyalty/').then(r => r.data),
    enabled: isLoggedIn,
  });

  const { data: histData, isLoading: histLoading, isError, refetch } = useQuery({
    queryKey: ['loyalty-history-full'],
    queryFn: () => api.get('/loyalty/history/').then(r => r.data),
    enabled: isLoggedIn,
  });

  const rawHistory: HistoryItem[] = histData?.results ?? (Array.isArray(histData) ? histData : []);

  const history = rawHistory.filter(h => {
    if (filter === 'all') return true;
    if (filter === 'earned') return h.points > 0;
    if (filter === 'redeemed') return h.points < 0;
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-black text-navy">Loyalty History</h1>
        <p className="text-sm text-gray-500 mt-1">Every point earned and spent</p>
      </div>

      {/* Balance card */}
      {balLoading ? <BalanceSkeleton /> : balance && (
        <div className="bg-navy rounded-2xl p-5 mb-5 text-white">
          <p className="text-sm text-white/60 font-medium mb-1">Current Balance</p>
          <p className="text-4xl font-black">
            {balance.balance.toLocaleString('en-IN')}
            <span className="text-lg font-medium text-white/60 ml-1.5">pts</span>
          </p>
          <p className="text-xs text-amber-400 mt-1">≈ ₹{balance.points_value_rupees.toFixed(2)} value</p>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { label: 'Earned', value: balance.total_earned.toLocaleString('en-IN'), color: 'text-green-400' },
              { label: 'Redeemed', value: balance.total_redeemed.toLocaleString('en-IN'), color: 'text-red-400' },
              { label: 'Referrals', value: String(balance.referrals_count), color: 'text-amber-400' },
            ].map(c => (
              <div key={c.label} className="bg-white/10 rounded-xl p-3 text-center">
                <p className={`text-lg font-black ${c.color}`}>{c.value}</p>
                <p className="text-xs text-white/50 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {(['all', 'earned', 'redeemed'] as FilterType[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              filter === f ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {f === 'all' ? 'All' : f === 'earned' ? '⭐ Earned' : '🎁 Redeemed'}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 self-center">{history.length} entries</span>
      </div>

      {/* History list */}
      {histLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 bg-gray-100 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-gray-100 rounded w-2/3" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
              <div className="w-12 h-4 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {isError && !histLoading && (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-3">Failed to load history</p>
          <button onClick={() => refetch()} className="px-6 py-2 bg-navy text-white rounded-xl text-sm font-bold">Retry</button>
        </div>
      )}

      {!histLoading && !isError && history.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">⭐</div>
          <h3 className="font-bold text-navy text-lg">No history yet</h3>
          <p className="text-gray-400 text-sm mt-1">
            {filter === 'all' ? 'Make a reservation to start earning loyalty points' : `No ${filter} points yet`}
          </p>
        </div>
      )}

      {!histLoading && !isError && history.length > 0 && (
        <motion.div className="space-y-2" variants={list} initial="hidden" animate="show">
          {history.map(h => {
            const isPositive = h.points > 0;
            const typeKey = h.transaction_type?.toLowerCase() ?? (isPositive ? 'earned' : 'redeemed');
            const icon = TYPE_ICONS[typeKey] ?? (isPositive ? '⭐' : '🎁');
            return (
              <motion.div
                key={h.id}
                variants={item}
                className="bg-white rounded-xl border border-gray-100 flex items-center gap-3 p-4"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${isPositive ? 'bg-green-50' : 'bg-red-50'}`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">
                    {h.description ?? (isPositive ? 'Points Earned' : 'Points Redeemed')}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmt(h.created_at)}</p>
                </div>
                <span className={`text-base font-black flex-shrink-0 ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                  {isPositive ? '+' : ''}{h.points}
                </span>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

export default function CustomerLoyaltyHistoryIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomerAuthGuard>
        <Inner />
      </CustomerAuthGuard>
    </QueryClientProvider>
  );
}
