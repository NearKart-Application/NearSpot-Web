import { useState } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';

interface Loyalty {
  balance: number;
  total_earned: number;
  total_redeemed: number;
  referral_code: string;
  points_value_rupees: number;
  referrals_count: number;
}

interface Purchase {
  id: string;
  product_name?: string;
  store_name?: string;
  store?: { name: string };
  total_amount?: string;
  amount?: string;
  created_at: string;
  status?: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 30) return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (d > 0) return `${d}d ago`;
  const h = Math.floor(diff / 3600000);
  if (h > 0) return `${h}h ago`;
  const m = Math.floor(diff / 60000);
  return m > 0 ? `${m}m ago` : 'Just now';
}

function Inner() {
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ns_access');
  const [tab, setTab] = useState<'activity' | 'points'>('activity');

  const loyaltyQ = useQuery<Loyalty>({
    queryKey: ['loyalty-wallet'],
    queryFn: () => api.get('/loyalty/').then(r => r.data),
    enabled: isLoggedIn,
  });

  const purchasesQ = useQuery<{ results: Purchase[]; count: number }>({
    queryKey: ['purchases'],
    queryFn: () => api.get('/stores/purchases/').then(r => r.data),
    enabled: isLoggedIn,
  });

  const loyaltyHistQ = useQuery<{ results: any[] }>({
    queryKey: ['loyalty-history-wallet'],
    queryFn: () => api.get('/loyalty/history/').then(r => r.data),
    enabled: isLoggedIn && tab === 'points',
    staleTime: 30_000,
  });

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
        <div className="text-6xl mb-4">💳</div>
        <h2 className="text-xl font-bold text-navy mb-2">Sign in to view your wallet</h2>
        <p className="text-gray-500 text-sm mb-6">Track your purchases and loyalty points</p>
        <a href="/auth/login" className="px-6 py-3 bg-navy text-white rounded-xl font-bold text-sm hover:bg-navy/90 transition-colors">
          Sign In
        </a>
      </div>
    );
  }

  const loyalty = loyaltyQ.data;
  const purchases = purchasesQ.data?.results ?? [];
  const historyItems = loyaltyHistQ.data?.results ?? [];

  return (
    <div className="max-w-lg mx-auto px-4 pb-24 pt-2">

      {/* Balance card */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl mb-6"
        style={{ background: 'linear-gradient(135deg, #1C2E4A 0%, #2d4a73 60%, #1a3a5c 100%)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #F7B731 0%, transparent 50%)' }} />
        <div className="relative px-6 py-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">NearSpot Wallet</p>
              <div className="flex items-baseline gap-1">
                <span className="text-white/80 text-lg">₹</span>
                <span className="text-white text-4xl font-black">
                  {loyaltyQ.isLoading ? '—' : (loyalty?.points_value_rupees ?? 0).toFixed(2)}
                </span>
              </div>
              <p className="text-white/50 text-xs mt-1">from {loyalty?.balance ?? 0} loyalty points</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <span className="text-2xl">💳</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
            <div className="text-center">
              <p className="text-white/50 text-[10px] uppercase tracking-wider mb-0.5">Earned</p>
              <p className="text-white font-bold text-sm">{loyalty?.total_earned ?? 0}</p>
              <p className="text-white/40 text-[10px]">pts</p>
            </div>
            <div className="text-center border-x border-white/10">
              <p className="text-white/50 text-[10px] uppercase tracking-wider mb-0.5">Redeemed</p>
              <p className="text-white font-bold text-sm">{loyalty?.total_redeemed ?? 0}</p>
              <p className="text-white/40 text-[10px]">pts</p>
            </div>
            <div className="text-center">
              <p className="text-white/50 text-[10px] uppercase tracking-wider mb-0.5">Referrals</p>
              <p className="text-white font-bold text-sm">{loyalty?.referrals_count ?? 0}</p>
              <p className="text-white/40 text-[10px]">friends</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <a href="/customer/loyalty"
          className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 hover:border-navy hover:shadow-md transition-all">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-xl">⭐</div>
          <div>
            <p className="text-xs font-bold text-navy">Loyalty Points</p>
            <p className="text-[10px] text-gray-400">Earn & redeem</p>
          </div>
        </a>
        <a href="/customer/referral"
          className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 hover:border-navy hover:shadow-md transition-all">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-xl">🎁</div>
          <div>
            <p className="text-xs font-bold text-navy">Refer & Earn</p>
            <p className="text-[10px] text-gray-400">Get bonus points</p>
          </div>
        </a>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
        {(['activity', 'points'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === t ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}>
            {t === 'activity' ? '🛍️ Purchases' : '⭐ Points History'}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'activity' ? (
        purchasesQ.isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🛍️</div>
            <p className="font-bold text-gray-600 mb-1">No purchases yet</p>
            <p className="text-gray-400 text-sm">Your purchase history will appear here</p>
            <a href="/" className="mt-4 inline-block px-5 py-2 bg-navy text-white rounded-xl text-sm font-bold hover:bg-navy/90 transition-colors">
              Explore Stores
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {purchases.map(p => {
              const storeName = p.store_name ?? p.store?.name ?? 'Unknown Store';
              const amount = parseFloat(p.total_amount ?? p.amount ?? '0');
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-4">
                  <div className="w-10 h-10 bg-navy/5 rounded-xl flex items-center justify-center text-lg shrink-0">🛍️</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-navy truncate">{p.product_name ?? 'Purchase'}</p>
                    <p className="text-[11px] text-gray-400 truncate">{storeName} · {timeAgo(p.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-gray-800">₹{amount.toLocaleString('en-IN')}</p>
                    {p.status && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        p.status === 'completed' ? 'bg-green-50 text-green-700' :
                        p.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{p.status}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        loyaltyHistQ.isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : historyItems.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">⭐</div>
            <p className="font-bold text-gray-600 mb-1">No points history yet</p>
            <p className="text-gray-400 text-sm">Earn points by shopping and referring friends</p>
          </div>
        ) : (
          <div className="space-y-2">
            {historyItems.map((h: any, i: number) => (
              <div key={h.id ?? i} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 ${
                  h.type === 'earned' || h.points > 0 ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  {h.type === 'earned' || h.points > 0 ? '➕' : '➖'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 truncate">{h.description ?? h.reason ?? 'Points update'}</p>
                  <p className="text-[10px] text-gray-400">{timeAgo(h.created_at ?? new Date().toISOString())}</p>
                </div>
                <p className={`text-sm font-black shrink-0 ${h.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {h.points > 0 ? '+' : ''}{h.points} pts
                </p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default function WalletIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <Inner />
    </QueryClientProvider>
  );
}
