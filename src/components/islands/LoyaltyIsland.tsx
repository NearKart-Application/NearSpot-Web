import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CustomerAuthGuard } from './CustomerAuthGuard';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';
import { Button } from '@/components/ui/button';

const card = { hidden: { opacity: 0, y: 18, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.38, ease: 'easeOut' as const } } };
const page = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const rowContainer = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const row = { hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' as const } } };

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
  type?: string;
  points: number;
  description?: string;
  note?: string;
  created_at: string;
}

function Inner() {
  const [referralInput, setReferralInput] = useState('');
  const [copied, setCopied] = useState(false);
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ns_access');
  const qc = useQueryClient();

  const { data: balance, isLoading: balLoading } = useQuery<LoyaltyBalance>({
    queryKey: ['loyalty'],
    queryFn:  () => api.get('/loyalty/').then(r => r.data),
    enabled:  isLoggedIn,
  });

  const { data: histData, isLoading: histLoading } = useQuery({
    queryKey: ['loyalty-history'],
    queryFn:  () => api.get('/loyalty/history/').then(r => r.data),
    enabled:  isLoggedIn,
  });

  const applyMut = useMutation({
    mutationFn: (code: string) => api.post('/loyalty/apply-referral/', { referral_code: code }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty'] });
      setReferralInput('');
    },
  });

  if (!isLoggedIn) return (
    <div className="flex flex-col items-center py-24 text-center px-6">
      <div className="w-24 h-24 rounded-full bg-amber-50 flex items-center justify-center mb-5 text-5xl">⭐</div>
      <h2 className="text-xl font-black text-navy">Sign in to view loyalty points</h2>
      <p className="text-gray-400 text-sm mt-2 max-w-xs">Earn points on every reservation and redeem them for discounts.</p>
      <a href="/auth/login" className="mt-6 btn-primary px-10 py-3">Sign In</a>
    </div>
  );

  const history: HistoryItem[] = histData?.results ?? (Array.isArray(histData) ? histData : []);

  const copyCode = () => {
    if (!balance?.referral_code) return;
    navigator.clipboard.writeText(balance.referral_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div className="max-w-2xl mx-auto space-y-5" variants={page} initial="hidden" animate="show">
      <motion.h1 variants={card} className="text-xl font-black text-navy">Loyalty & Rewards</motion.h1>

      {/* Balance card */}
      {balLoading ? (
        <div className="bg-navy rounded-2xl p-6 animate-pulse">
          <div className="h-12 bg-white/20 rounded-xl w-1/3 mb-3" />
          <div className="h-4 bg-white/20 rounded-full w-1/2" />
        </div>
      ) : balance ? (
        <motion.div variants={card} className="bg-gradient-to-br from-navy to-navy/80 rounded-2xl p-6 text-white">
          <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Available Points</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-gold">{balance.balance.toLocaleString('en-IN')}</span>
            <span className="text-white/60 text-sm">pts</span>
          </div>
          <p className="text-white/60 text-xs mt-1">
            Worth ₹{balance.points_value_rupees.toFixed(2)}
          </p>
          <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-white/20">
            <div>
              <p className="text-white/50 text-xs">Total Earned</p>
              <p className="text-white font-bold text-lg">{balance.total_earned.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-white/50 text-xs">Total Redeemed</p>
              <p className="text-white font-bold text-lg">{balance.total_redeemed.toLocaleString()}</p>
            </div>
          </div>
        </motion.div>
      ) : null}

      {/* Referral card */}
      {balance?.referral_code && (
        <motion.div variants={card} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🎁</span>
            <div>
              <h3 className="font-bold text-navy text-sm">Refer & Earn</h3>
              <p className="text-xs text-gray-400">{balance.referrals_count} friend{balance.referrals_count !== 1 ? 's' : ''} referred</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-3">Share your code with friends. You both earn bonus points when they sign up!</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="font-black text-navy tracking-widest text-sm">{balance.referral_code}</span>
            </div>
            <button onClick={copyCode}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                copied ? 'bg-green-500 text-white' : 'bg-navy text-white hover:bg-navy/90'
              }`}>
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Apply referral */}
      <motion.div variants={card} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-navy text-sm mb-1">Have a referral code?</h3>
        <p className="text-xs text-gray-400 mb-3">Enter a friend's code to earn bonus points</p>
        <div className="flex gap-2">
          <input value={referralInput} onChange={e => setReferralInput(e.target.value.toUpperCase())}
            className="input flex-1 font-mono tracking-widest" placeholder="NS-XX-XXXX" maxLength={12} />
          <Button onClick={() => referralInput && applyMut.mutate(referralInput)}
            disabled={applyMut.isPending || !referralInput}
            className="px-4">
            {applyMut.isPending ? '…' : 'Apply'}
          </Button>
        </div>
        {applyMut.isSuccess && (
          <p className="text-xs text-green-600 font-semibold mt-2">✓ Referral applied! Points added.</p>
        )}
        {applyMut.isError && (
          <p className="text-xs text-red-500 mt-2">Invalid or already used code.</p>
        )}
      </motion.div>

      {/* History */}
      <motion.div variants={card} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-gray-100">
          <h3 className="font-bold text-navy text-sm">Points History</h3>
        </div>
        {histLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex justify-between animate-pulse">
                <div className="h-4 bg-gray-200 rounded-full w-2/3" />
                <div className="h-4 bg-gray-200 rounded-full w-12" />
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-400 text-sm">No points history yet.</p>
            <p className="text-xs text-gray-300 mt-1">Earn points by making reservations!</p>
          </div>
        ) : (
          <motion.div className="divide-y divide-gray-100" variants={rowContainer} initial="hidden" animate="show">
            {history.map(h => (
              <motion.div key={h.id} variants={row} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-navy">{h.description ?? h.note ?? h.type ?? 'Points earned'}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(h.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span className={`text-sm font-black ${h.points >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {h.points >= 0 ? '+' : ''}{h.points}
                </span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function LoyaltyIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomerAuthGuard>
        <Inner />
      </CustomerAuthGuard>
    </QueryClientProvider>
  );
}
