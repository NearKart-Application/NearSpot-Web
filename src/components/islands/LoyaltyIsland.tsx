import { useState, useCallback } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomerAuthGuard } from './CustomerAuthGuard';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';
import { Button } from '@/components/ui/button';

declare global {
  interface Window { Razorpay: any }
}

const TOPUP_AMOUNTS = [100, 200, 500, 1000];

function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

interface TopupModalProps {
  onClose: () => void;
  onSuccess: (pts: number) => void;
}

function TopupModal({ onClose, onSuccess }: TopupModalProps) {
  const [amount, setAmount] = useState<number | ''>('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'verifying' | 'success' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [ptsEarned, setPtsEarned] = useState(0);

  const handleTopup = useCallback(async () => {
    const amt = Number(amount);
    if (!amt || amt < 10) { setErrMsg('Minimum top-up is ₹10.'); return; }
    if (amt > 10000)       { setErrMsg('Maximum top-up is ₹10,000.'); return; }
    setErrMsg(''); setStatus('loading');

    const loaded = await loadRazorpayScript();
    if (!loaded) { setStatus('error'); setErrMsg('Payment gateway failed to load. Check your connection.'); return; }

    let initData: any;
    try {
      const r = await api.post('/wallet/topup/initiate/', { amount: amt });
      initData = r.data;
    } catch {
      setStatus('error'); setErrMsg('Could not initiate payment. Please try again.'); return;
    }

    const rzp = new window.Razorpay({
      key:         initData.key,
      amount:      initData.amount_paise,
      currency:    initData.currency,
      order_id:    initData.order_id,
      name:        'NearSpot',
      description: `Wallet Top-up ₹${amt}`,
      theme:       { color: '#e5405e' },
      handler: async (response: any) => {
        setStatus('verifying');
        try {
          const vr = await api.post('/wallet/topup/verify/', {
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_signature:  response.razorpay_signature,
            amount:              amt,
          });
          const pts = vr.data.points_credited ?? amt * 10;
          setPtsEarned(pts);
          setStatus('success');
          onSuccess(pts);
        } catch {
          setStatus('error'); setErrMsg('Payment received but wallet credit failed. Contact support.');
        }
      },
      modal: { ondismiss: () => setStatus('idle') },
    });
    rzp.open();
  }, [amount, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
        {status === 'success' ? (
          <div className="text-center py-4">
            <div className="text-5xl mb-3">🎉</div>
            <h3 className="text-lg font-black text-navy">Wallet Topped Up!</h3>
            <p className="text-sm text-gray-500 mt-1">+{ptsEarned.toLocaleString('en-IN')} points credited</p>
            <Button className="w-full mt-5" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <>
            <h3 className="text-base font-black text-navy mb-1">Add Money to Wallet</h3>
            <p className="text-xs text-gray-400 mb-4">10 points = ₹1. Top up and earn instantly.</p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {TOPUP_AMOUNTS.map(a => (
                <button key={a} onClick={() => setAmount(a)}
                  className={`rounded-xl py-2 text-xs font-bold border transition-all ${amount === a ? 'bg-rose-600 text-white border-rose-600' : 'border-gray-200 text-navy hover:border-rose-300'}`}>
                  ₹{a}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 mb-4">
              <span className="text-navy font-bold text-lg">₹</span>
              <input type="number" value={amount} onChange={e => { setAmount(e.target.value === '' ? '' : Number(e.target.value)); setErrMsg(''); }}
                placeholder="Or enter amount" min={10} max={10000}
                className="flex-1 bg-transparent py-3 text-sm outline-none placeholder-gray-300" />
              {amount !== '' && (
                <span className="text-xs text-rose-500 font-semibold whitespace-nowrap">+{Number(amount) * 10} pts</span>
              )}
            </div>
            {errMsg && <p className="text-xs text-red-500 mb-3">{errMsg}</p>}
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50">Cancel</button>
              <Button onClick={handleTopup} disabled={status === 'loading' || status === 'verifying' || amount === ''}
                className="flex-1">
                {status === 'loading' ? 'Opening…' : status === 'verifying' ? 'Verifying…' : `Pay ₹${amount || 0}`}
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

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
  tier?: string;
  next_tier_points_needed?: number;
}

const TIER_CONFIG: Record<string, { emoji: string; label: string; color: string; bg: string; next: string }> = {
  bronze: { emoji: '🥉', label: 'Bronze',  color: 'text-amber-700',  bg: 'bg-amber-50  border-amber-200',  next: 'Silver' },
  silver: { emoji: '🥈', label: 'Silver',  color: 'text-slate-600',  bg: 'bg-slate-50  border-slate-200',  next: 'Gold' },
  gold:   { emoji: '🥇', label: 'Gold',    color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200',  next: '' },
};

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
  const [showTopup, setShowTopup] = useState(false);
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
      <AnimatePresence>
        {showTopup && (
          <TopupModal
            onClose={() => setShowTopup(false)}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ['loyalty'] });
              qc.invalidateQueries({ queryKey: ['loyalty-history'] });
            }}
          />
        )}
      </AnimatePresence>

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
          <button onClick={() => setShowTopup(true)}
            className="mt-4 w-full py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all border border-white/20">
            + Add Money to Wallet
          </button>
        </motion.div>
      ) : null}

      {/* Loyalty tier card */}
      {balance && (
        <motion.div variants={card} className={`rounded-2xl border p-5 ${TIER_CONFIG[balance.tier ?? 'bronze']?.bg ?? 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{TIER_CONFIG[balance.tier ?? 'bronze']?.emoji ?? '🥉'}</span>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Loyalty Tier</p>
                <p className={`text-xl font-black ${TIER_CONFIG[balance.tier ?? 'bronze']?.color ?? 'text-amber-700'}`}>
                  {TIER_CONFIG[balance.tier ?? 'bronze']?.label ?? 'Bronze'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">{balance.total_earned.toLocaleString()} pts earned</p>
              {(balance.next_tier_points_needed ?? 0) > 0 && (
                <p className="text-xs font-semibold text-gray-600 mt-0.5">
                  {balance.next_tier_points_needed?.toLocaleString()} more → {TIER_CONFIG[balance.tier ?? 'bronze']?.next}
                </p>
              )}
            </div>
          </div>
          {(balance.next_tier_points_needed ?? 0) > 0 && (
            <div className="mt-3 h-1.5 rounded-full bg-black/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-current transition-all"
                style={{ width: `${Math.min(100, ((balance.total_earned) / (balance.total_earned + (balance.next_tier_points_needed ?? 1))) * 100)}%` }}
              />
            </div>
          )}
        </motion.div>
      )}

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
