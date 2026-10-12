import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';
import { Button } from '@/components/ui/button';

interface Invoice {
  invoice_number: string; store_name: string; plan: string;
  amount: string; gst_rate: number; gst_amount: string;
  started_at: string; expires_at: string;
}

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
  const [couponCode,    setCouponCode]    = useState('');
  const [couponPlan,    setCouponPlan]    = useState('');   // which plan to validate against
  const [couponMsg,     setCouponMsg]     = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; planName: string } | null>(null);
  const [payingPlan,    setPayingPlan]    = useState<string | null>(null);
  const [payMsg,        setPayMsg]        = useState<string | null>(null);

  const { data: sub, isLoading: subLoading } = useQuery<Subscription>({
    queryKey: ['vendor-subscription'],
    queryFn: () => api.get('/billing/subscription/').then(r => r.data),
  });

  const { data: plansData, isLoading: plansLoading, error: plansError, refetch: refetchPlans } = useQuery<Plan[]>({
    queryKey: ['billing-plans'],
    queryFn: () => api.get('/billing/plans/').then(r => r.data),
  });

  const plans: Plan[] = Array.isArray(plansData) ? plansData : [];

  // ── Razorpay payment ────────────────────────────────────────────────────────
  const payMut = useMutation({
    mutationFn: ({ planName, couponCode: cc }: { planName: string; couponCode?: string }) =>
      api.post('/billing/payment/initiate/', {
        plan_name: planName,
        ...(cc ? { coupon_code: cc } : {}),
      }).then(r => r.data),

    onSuccess: async (data: any, vars) => {
      // Free path: coupon (or wallet) reduced price to ₹0 — no Razorpay needed
      if (data.coupon_free) {
        qc.invalidateQueries({ queryKey: ['vendor-subscription'] });
        setPayMsg('✅ Free subscription activated!');
        setAppliedCoupon(null);
        setCouponCode('');
        setCouponMsg('');
        setPayingPlan(null);
        return;
      }

      try {
        await loadRazorpay();
        const rzp = new (window as any).Razorpay({
          key:      data.razorpay_key_id,
          amount:   data.amount,
          currency: data.currency || 'INR',
          order_id: data.order_id,
          name:     'NearSpot',
          description: `${vars.planName} subscription`,
          handler: async (response: any) => {
            try {
              await api.post('/billing/payment/verify/', {
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                plan_name:           vars.planName,
                ...(vars.couponCode ? { coupon_code: vars.couponCode } : {}),
              });
              qc.invalidateQueries({ queryKey: ['vendor-subscription'] });
              setPayMsg('✅ Subscription activated successfully!');
              setAppliedCoupon(null);
              setCouponCode('');
              setCouponMsg('');
            } catch {
              setPayMsg('❌ Payment verification failed. Please contact support.');
            } finally {
              setPayingPlan(null);
            }
          },
          modal: {
            ondismiss: () => setPayingPlan(null),
          },
        });
        rzp.open();
      } catch {
        setPayMsg('❌ Could not open payment. Please try again.');
        setPayingPlan(null);
      }
    },

    onError: (e: any) => {
      const msg = e?.response?.data?.message ?? 'Could not initiate payment. Please try again.';
      setPayMsg(`❌ ${msg}`);
      setPayingPlan(null);
    },
  });

  function handleSubscribe(plan: Plan) {
    setPayMsg(null);
    setPayingPlan(plan.name);
    const cc = appliedCoupon?.planName === plan.name ? appliedCoupon.code : undefined;
    payMut.mutate({ planName: plan.name, couponCode: cc });
  }

  // ── Coupon validation ───────────────────────────────────────────────────────
  const validateCoupon = useMutation({
    mutationFn: () => api.post('/billing/coupon/validate/', { code: couponCode.trim(), plan_name: couponPlan }),
    onSuccess: (r: any) => {
      const msg = r.data?.message ?? '';
      setCouponMsg(`✅ ${msg}`);
      setAppliedCoupon({ code: couponCode.trim(), planName: couponPlan });
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message ?? 'Invalid or expired coupon';
      setCouponMsg(`❌ ${msg}`);
      setAppliedCoupon(null);
    },
  });

  const [refundReason,    setRefundReason]    = useState('');
  const [showRefundForm,  setShowRefundForm]  = useState(false);
  const [refundMsg,       setRefundMsg]       = useState<string | null>(null);
  const [showInvoice,     setShowInvoice]     = useState(false);

  const { data: invoiceData } = useQuery<Invoice>({
    queryKey: ['subscription-invoice'],
    queryFn: () => api.get('/billing/subscription/invoice/').then(r => r.data),
    enabled: showInvoice,
  });

  const refundMut = useMutation({
    mutationFn: () => api.post('/billing/subscription/refund/', { reason: refundReason }),
    onSuccess: () => {
      setRefundMsg('✅ Refund request submitted. We\'ll review within 2–3 business days.');
      setShowRefundForm(false);
      setRefundReason('');
    },
    onError: (e: any) => {
      setRefundMsg('❌ ' + (e?.response?.data?.message ?? 'Could not submit refund request.'));
    },
  });

  const paidPlans = plans.filter(p => parseFloat(String(p.price)) > 0);

  // Auto-select the only paid plan so vendors with one plan don't see the dropdown
  useEffect(() => {
    if (paidPlans.length === 1 && !couponPlan) setCouponPlan(paidPlans[0].name);
  }, [paidPlans.length]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Plans & Subscription</h1>
        <p className="text-sm text-gray-400">Manage your NearSpot plan</p>
      </div>

      {payMsg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-semibold ${payMsg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
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
        ) : plansError ? (
          <IslandError error={plansError} refetch={refetchPlans} />
        ) : plans.length === 0 ? (
          <div className="card p-8 text-center text-gray-400">
            <p>No plans available at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map(plan => {
              const isCurrent  = sub?.plan === plan.name;
              const isPaying   = payingPlan === plan.name;
              const hasCoupon  = appliedCoupon?.planName === plan.name;

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

                  {hasCoupon && (
                    <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 mb-3 font-medium">
                      🎟 Coupon applied: {appliedCoupon!.code}
                    </p>
                  )}

                  {!isCurrent && (
                    <Button
                      onClick={() => handleSubscribe(plan)}
                      disabled={!!payingPlan}
                      className="w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">
                      {isPaying ? 'Processing…' : sub?.is_active ? 'Upgrade' : 'Subscribe'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Subscription management actions */}
      {sub?.is_active && (
        <div className="card p-5 space-y-3">
          <h3 className="font-bold text-navy">Subscription Actions</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowInvoice(v => !v)}
              className="btn-secondary text-sm px-4 py-2"
            >
              📄 {showInvoice ? 'Hide' : 'Download'} Invoice
            </button>
            <button
              onClick={() => { setShowRefundForm(v => !v); setRefundMsg(null); }}
              className="text-sm text-red-500 hover:underline"
            >
              Request Refund
            </button>
          </div>

          {showInvoice && invoiceData && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm space-y-1">
              <p className="font-bold text-navy text-base">Tax Invoice — {invoiceData.invoice_number}</p>
              <p className="text-gray-500">{invoiceData.store_name}</p>
              <div className="mt-2 space-y-0.5">
                <div className="flex justify-between"><span className="text-gray-500">Plan</span><span className="font-semibold">{invoiceData.plan}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-semibold">₹{invoiceData.amount}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">GST ({invoiceData.gst_rate}%)</span><span>₹{invoiceData.gst_amount}</span></div>
                <div className="flex justify-between border-t border-gray-200 pt-1 mt-1"><span className="font-bold">Total</span><span className="font-bold">₹{(Number(invoiceData.amount) + Number(invoiceData.gst_amount)).toFixed(2)}</span></div>
              </div>
              <p className="text-xs text-gray-400 mt-2">Valid: {new Date(invoiceData.started_at).toLocaleDateString('en-IN')} → {new Date(invoiceData.expires_at).toLocaleDateString('en-IN')}</p>
            </div>
          )}

          {showRefundForm && (
            <div className="space-y-2">
              <textarea
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
                placeholder="Reason for refund request…"
                rows={3}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40"
              />
              <Button
                onClick={() => refundMut.mutate()}
                disabled={!refundReason.trim() || refundMut.isPending}
                variant="destructive" size="sm"
              >
                {refundMut.isPending ? 'Submitting…' : 'Submit Refund Request'}
              </Button>
            </div>
          )}
          {refundMsg && (
            <p className={`text-sm font-medium ${refundMsg.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>{refundMsg}</p>
          )}
        </div>
      )}

      {/* Coupon */}
      <div className="card p-5">
        <h3 className="font-bold text-navy mb-3">Apply Coupon</h3>
        <div className="space-y-3">
          {/* Plan selector — required so backend knows which plan to validate against */}
          {paidPlans.length > 1 && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Apply to plan</label>
              <select
                value={couponPlan}
                onChange={e => { setCouponPlan(e.target.value); setCouponMsg(''); setAppliedCoupon(null); }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-navy/40"
              >
                <option value="">Select a plan…</option>
                {paidPlans.map(p => (
                  <option key={p.name} value={p.name}>{p.display_name} — ₹{parseFloat(String(p.price)).toLocaleString('en-IN')}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={couponCode}
              onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponMsg(''); setAppliedCoupon(null); }}
              placeholder="Enter coupon code"
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-navy/40"
            />
            <Button
              onClick={() => validateCoupon.mutate()}
              disabled={validateCoupon.isPending || !couponCode.trim() || (!couponPlan && paidPlans.length > 1)}
              variant="outline" size="sm" className="px-5 py-2.5">
              {validateCoupon.isPending ? 'Checking…' : 'Validate'}
            </Button>
          </div>
          {couponMsg && (
            <p className={`text-sm font-medium ${couponMsg.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>{couponMsg}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VendorPlansIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
