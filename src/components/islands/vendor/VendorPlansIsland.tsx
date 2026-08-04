import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';
import { Button } from '@/components/ui/button';

interface Plan {
  id: string; name: string; display_name: string; price: number | string;
  billing_cycle?: string; duration_days?: number;
  video_limit: number; product_limit: number; features?: string[];
  is_popular?: boolean; store_type?: string;
  video_limit_display?: string; product_limit_display?: string;
}
interface Subscription {
  plan: string; display_name?: string; is_active: boolean;
  expires_at: string; days_left: number; product_limit: number; video_limit: number;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
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

function Inner() {
  const qc = useQueryClient();
  const [coupon, setCoupon]   = useState('');
  const [couponMsg, setCouponMsg] = useState('');
  const [payMsg, setPayMsg]   = useState<string | null>(null);

  const { data: sub, isLoading: subLoading } = useQuery<Subscription>({
    queryKey: ['vendor-subscription'],
    queryFn: () => api.get('/billing/subscription/').then(r => r.data),
  });

  const { data: plansData, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ['billing-plans'],
    queryFn: () => api.get('/billing/plans/').then(r => r.data),
  });

  const payMut = useMutation({
    mutationFn: (planName: string) =>
      api.post('/billing/payment/initiate/', { plan_name: planName }).then(r => r.data),
    onSuccess: async (data: any, planName: string) => {
      try {
        await loadRazorpay();
        const rzp = new (window as any).Razorpay({
          key:      data.razorpay_key_id,
          amount:   data.amount,
          currency: data.currency || 'INR',
          order_id: data.order_id ?? data.razorpay_order_id,
          name:     'NearSpot',
          description: `${planName} subscription`,
          handler: async (response: any) => {
            try {
              await api.post('/billing/payment/verify/', {
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                plan_name: planName,
              });
              qc.invalidateQueries({ queryKey: ['vendor-subscription'] });
              setPayMsg('✅ Subscription activated successfully!');
            } catch {
              setPayMsg('❌ Payment verification failed. Please contact support.');
            }
          },
          modal: { ondismiss: () => {} },
        });
        rzp.open();
      } catch {
        setPayMsg('❌ Could not open payment. Please try again.');
      }
    },
    onError: () => setPayMsg('❌ Could not initiate payment. Please try again.'),
  });

  const validateCoupon = useMutation({
    mutationFn: () => api.post('/billing/coupon/validate/', { code: coupon }),
    onSuccess: (r: any) => setCouponMsg(`✅ Valid! ${r.data?.discount_display ?? ''}`),
    onError: () => setCouponMsg('❌ Invalid or expired coupon'),
  });

  const plans: Plan[] = Array.isArray(plansData) ? plansData : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Plans & Subscription</h1>
        <p className="text-sm text-gray-400">Manage your NearSpot plan</p>
      </div>

      {payMsg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-semibold ${payMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {payMsg}
        </div>
      )}

      {/* Current subscription */}
      {!subLoading && sub && (
        <div className={`card p-6 ${sub.is_active ? 'border-navy/30 bg-navy/5' : 'border-red-200 bg-red-50'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Current Plan</p>
              <h2 className="text-2xl font-black text-navy">{sub.display_name ?? sub.plan}</h2>
              <div className="flex gap-4 mt-2 text-sm text-gray-500">
                <span>📦 {sub.product_limit <= 0 ? 'Unlimited' : sub.product_limit} products</span>
                <span>🎬 {sub.video_limit <= 0 ? 'Unlimited' : sub.video_limit} videos</span>
              </div>
            </div>
            <div className="text-right">
              {sub.is_active ? (
                <>
                  <span className="text-xs font-bold text-green-600 bg-green-100 px-2.5 py-1 rounded-full">Active</span>
                  <p className="text-xs text-gray-400 mt-2">Expires {fmtDate(sub.expires_at)}</p>
                  <p className="text-xs text-navy font-semibold">{sub.days_left} days left</p>
                </>
              ) : (
                <span className="text-xs font-bold text-red-600 bg-red-100 px-2.5 py-1 rounded-full">Expired</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Available plans */}
      <div>
        <h2 className="font-bold text-navy mb-4">Available Plans</h2>
        {plansLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="card h-64 animate-pulse" />)}
          </div>
        ) : plans.length === 0 ? (
          <div className="card p-8 text-center text-gray-400">
            <p>No plans available at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map(plan => {
              const isCurrent = sub?.plan === plan.name;
              return (
                <div key={plan.id} className={`card p-6 relative ${plan.is_popular ? 'border-navy ring-2 ring-navy/20' : ''} ${isCurrent ? 'border-green-300 bg-green-50/50' : ''}`}>
                  {plan.is_popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-navy text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wide">Most Popular</span>
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-3 right-4">
                      <span className="bg-green-500 text-white text-[10px] font-black px-3 py-1 rounded-full">Current</span>
                    </div>
                  )}
                  <h3 className="font-black text-navy text-lg">{plan.display_name}</h3>
                  <p className="text-3xl font-black text-navy mt-2">
                    ₹{parseFloat(String(plan.price)).toLocaleString('en-IN')}
                    <span className="text-sm font-normal text-gray-400">
                      /{plan.billing_cycle ?? (plan.duration_days === 30 ? 'month' : plan.duration_days === 365 ? 'year' : `${plan.duration_days}d`)}
                    </span>
                  </p>
                  <div className="mt-4 space-y-2 mb-5">
                    <p className="text-xs text-gray-600 flex items-center gap-1.5">
                      <span className="text-green-500">✓</span>
                      {plan.product_limit_display ?? (plan.product_limit <= 0 ? 'Unlimited products' : `${plan.product_limit} products`)}
                    </p>
                    <p className="text-xs text-gray-600 flex items-center gap-1.5">
                      <span className="text-green-500">✓</span>
                      {plan.video_limit_display ?? (plan.video_limit <= 0 ? 'Unlimited videos' : `${plan.video_limit} videos`)}
                    </p>
                    {(plan.features ?? []).map((f, i) => (
                      <p key={i} className="text-xs text-gray-600 flex items-center gap-1.5">
                        <span className="text-green-500">✓</span>{f}
                      </p>
                    ))}
                  </div>
                  {!isCurrent && (
                    <Button
                      onClick={() => { setPayMsg(null); payMut.mutate(plan.name); }}
                      disabled={payMut.isPending}
                      className="w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">
                      {payMut.isPending ? 'Processing…' : sub?.is_active ? 'Upgrade' : 'Subscribe'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Coupon */}
      <div className="card p-5">
        <h3 className="font-bold text-navy mb-3">Apply Coupon</h3>
        <div className="flex gap-2">
          <input value={coupon} onChange={e => setCoupon(e.target.value.toUpperCase())}
            placeholder="Enter coupon code"
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-navy/40" />
          <Button onClick={() => validateCoupon.mutate()} disabled={validateCoupon.isPending || !coupon.trim()}
            variant="outline" size="sm" className="px-5 py-2.5">Validate</Button>
        </div>
        {couponMsg && <p className="text-sm mt-2">{couponMsg}</p>}
      </div>
    </div>
  );
}

export default function VendorPlansIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
