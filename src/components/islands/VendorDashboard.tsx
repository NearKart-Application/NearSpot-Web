import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet, Package, CheckSquare, FileText, XCircle, Video, PlayCircle, Eye,
  Plus, Tag, Upload, Receipt, Megaphone, Ticket, Star, Users, Store,
  type LucideIcon,
} from 'lucide-react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';
import { VendorAuthGuard } from './vendor/VendorAuthGuard';
import { Button } from '@/components/ui/button';

// Field names match actual API: GET /analytics/vendor/
interface ApiStore {
  id: string; name: string; category: string;
  is_active: boolean; is_verified: boolean; is_open: boolean;
  follower_count: number; review_count: number; avg_rating: number;
}
interface ApiWallet    { balance: string; }
interface ApiSub       { plan: string; expires_at: string; is_active: boolean; days_left: number; }
interface ApiPlan      { name: string; display_name: string; video_limit: number; product_limit: number; }
interface ApiProducts  { total: number; active: number; draft: number; inactive: number; }
interface ApiVideos    { total: number; ready: number; processing: number; pending: number; total_likes: number; total_views: number; }
interface DashData {
  store: ApiStore; wallet: ApiWallet; subscription: ApiSub | null;
  current_plan: ApiPlan; products: ApiProducts; videos: ApiVideos;
}

// ─── Animation variants ────────────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show:   { opacity: 1, y: 0,  scale: 1,   transition: { duration: 0.4, ease: 'easeOut' as const } },
};

// ─── AnimatedNumber ────────────────────────────────────────────────────────
function AnimatedNumber({ value }: { value: number | string }) {
  const [display, setDisplay] = useState<number | string>(
    typeof value === 'number' ? 0 : value
  );
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof value !== 'number') {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const duration = 800;
    const from = 0;
    const to = value;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return <>{display}</>;
}

// ─── StatCard ──────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
  gradient,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  gradient: string;
}) {
  const inner = (
    <motion.div
      variants={itemVariants}
      className={`rounded-2xl p-5 shadow-lg overflow-hidden relative bg-gradient-to-br ${gradient}`}
    >
      {/* Decorative circle */}
      <div className="absolute w-16 h-16 rounded-full bg-white/10 -right-3 -top-3 pointer-events-none" />

      {/* Icon */}
      <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center mb-2">
        <Icon className="w-4 h-4 text-white" />
      </div>

      {/* Value */}
      <p className="text-2xl font-black text-white">
        {typeof value === 'number'
          ? <AnimatedNumber value={value} />
          : value}
      </p>

      {/* Sub */}
      {sub && <p className="text-xs text-white/70 mt-0.5">{sub}</p>}

      {/* Label */}
      <p className="text-xs text-white/70 uppercase tracking-wide mt-1">{label}</p>
    </motion.div>
  );

  return href ? <a href={href}>{inner}</a> : inner;
}

// ─── QuickAction ───────────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, href }: { icon: LucideIcon; label: string; href: string }) {
  return (
    <motion.a
      href={href}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      className="card p-4 flex flex-col items-center gap-2.5 text-center group"
    >
      <div className="w-10 h-10 rounded-xl bg-navy/8 flex items-center justify-center">
        <Icon className="w-5 h-5 text-navy" />
      </div>
      <span className="text-xs font-semibold text-gray-700 leading-tight">{label}</span>
    </motion.a>
  );
}

// ─── SectionTitle ──────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-bold text-navy mb-4 flex items-center gap-2">
      <div className="w-1 h-5 bg-gold rounded-full" />
      {children}
    </h3>
  );
}

// ─── Inner ─────────────────────────────────────────────────────────────────
function Inner() {
  const { data, isLoading, error } = useQuery<DashData>({
    queryKey: ['vendor-dashboard'],
    queryFn:  () => api.get('/analytics/vendor/').then(r => r.data),
    retry: 1,
    refetchInterval: 60_000,
  });

  // Redirect to login if JWT is invalid
  useEffect(() => {
    if (error) {
      const status = (error as any)?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem('ns_access');
        localStorage.removeItem('ns_refresh');
        localStorage.removeItem('ns_user');
        window.location.href = '/auth/login';
      }
    }
  }, [error]);

  if (isLoading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-24 bg-gray-200 rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="card p-8 text-center">
      <div className="text-4xl mb-3">⚠️</div>
      <p className="font-semibold text-navy">Could not load dashboard</p>
      <p className="text-sm text-gray-500 mt-1">
        {(error as any)?.response?.data?.message ?? 'Check your connection and try again'}
      </p>
      <Button onClick={() => window.location.reload()}
              className="mt-4">Retry</Button>
    </div>
  );

  const { store, wallet, subscription, current_plan, products, videos } = data;
  const daysLeft = subscription?.days_left ?? 0;

  return (
    <div className="space-y-6">

      {/* Store header card */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card p-5 flex items-center gap-4"
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-navy to-navy-700 flex items-center justify-center shrink-0">
          <Store className="w-7 h-7 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-navy text-lg truncate">{store.name}</h2>
            {store.is_verified && <span className="badge badge-blue text-xs">✓ Verified</span>}
            <span className={`badge text-xs ${store.is_open ? 'badge-green' : 'badge-red'}`}>
              {store.is_open ? '● Open' : '○ Closed'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-amber-400" />
              {store.avg_rating > 0 ? store.avg_rating.toFixed(1) : 'New'} ({store.review_count} reviews)
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-gray-400" />
              {store.follower_count} followers
            </span>
            <span>·</span>
            <span className="capitalize">{current_plan.display_name} plan</span>
          </div>
        </div>
        <a href="/vendor/store-setup" className="btn-outline btn-sm shrink-0">Edit Store</a>
      </motion.div>

      {/* Subscription alert */}
      {subscription && daysLeft <= 30 && (
        <div className={`card p-4 border-l-4 flex items-center justify-between gap-4 ${
          daysLeft <= 7 ? 'border-l-red-500 bg-red-50' : 'border-l-yellow-400 bg-yellow-50'
        }`}>
          <div>
            <p className={`font-semibold text-sm ${daysLeft <= 7 ? 'text-red-700' : 'text-yellow-700'}`}>
              {daysLeft <= 0 ? '⚠️ Subscription expired' : `⏰ ${daysLeft} days left on ${subscription.plan}`}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Renew to keep your store visible</p>
          </div>
          <a href="/vendor/plans" className="btn-primary btn-sm shrink-0">Renew Now</a>
        </div>
      )}

      {/* No subscription notice */}
      {!subscription && (
        <div className="card p-4 border-l-4 border-l-navy bg-navy/5 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-sm text-navy">You're on the Free plan</p>
            <p className="text-xs text-gray-500 mt-0.5">Upgrade to get more products, videos and features</p>
          </div>
          <a href="/vendor/plans" className="btn-primary btn-sm shrink-0">Upgrade</a>
        </div>
      )}

      {/* Stats grid — using correct API fields */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard icon={Wallet}      gradient="from-emerald-500 to-emerald-600" label="Wallet Balance"  value={`₹${parseFloat(wallet.balance).toLocaleString()}`}  href="/vendor/wallet"     />
        <StatCard icon={Package}     gradient="from-blue-500 to-blue-600"       label="Total Products"  value={products.total}                                      href="/vendor/products"   />
        <StatCard icon={CheckSquare} gradient="from-violet-500 to-violet-600"   label="Active Products" value={products.active}    sub="live in app"                href="/vendor/products"   />
        <StatCard icon={FileText}    gradient="from-amber-500 to-yellow-400"    label="Draft"           value={products.draft}     sub="not published"              href="/vendor/products"   />
        <StatCard icon={XCircle}     gradient="from-red-500 to-rose-500"        label="Inactive"        value={products.inactive}  sub="hidden"                     href="/vendor/inventory"  />
        <StatCard icon={Video}       gradient="from-teal-500 to-cyan-500"       label="Total Videos"    value={videos.total}                                        href="/vendor/videos"     />
        <StatCard icon={PlayCircle}  gradient="from-indigo-500 to-blue-500"     label="Published"       value={videos.ready}       sub="live in feed"               href="/vendor/videos"     />
        <StatCard icon={Eye}         gradient="from-pink-500 to-rose-500"       label="Total Views"     value={videos.total_views.toLocaleString()}                 href="/vendor/analytics"  />
      </motion.div>

      {/* Quick Actions */}
      <div>
        <SectionTitle>Quick Actions</SectionTitle>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <QuickAction icon={Plus}      label="Add Product"    href="/vendor/products/new"   />
          <QuickAction icon={Tag}       label="Create Offer"   href="/vendor/offers"         />
          <QuickAction icon={Upload}    label="Upload Video"   href="/vendor/videos"         />
          <QuickAction icon={Receipt}   label="New Invoice"    href="/vendor/invoices"       />
          <QuickAction icon={Megaphone} label="Broadcast"      href="/vendor/broadcasts"     />
          <QuickAction icon={Ticket}    label="Discount Code"  href="/vendor/discount-codes" />
        </div>
      </div>

      {/* Store performance summary */}
      <div>
        <SectionTitle>Performance Summary</SectionTitle>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <motion.div variants={itemVariants} className="card p-4 border-l-4 border-l-blue-500">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Products</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Total</span><span className="font-semibold text-navy">{products.total}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Active</span><span className="font-semibold text-green-600">{products.active}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Draft</span><span className="font-semibold text-yellow-600">{products.draft}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Inactive</span><span className="font-semibold text-red-500">{products.inactive}</span></div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="card p-4 border-l-4 border-l-teal-500">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Videos</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Total</span><span className="font-semibold text-navy">{videos.total}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Published</span><span className="font-semibold text-green-600">{videos.ready}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Processing</span><span className="font-semibold text-yellow-600">{videos.processing}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Total Views</span><span className="font-semibold text-navy">{videos.total_views.toLocaleString()}</span></div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="card p-4 border-l-4 border-l-violet-500">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Community</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Followers</span><span className="font-semibold text-navy">{store.follower_count}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Reviews</span><span className="font-semibold text-navy">{store.review_count}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Avg Rating</span><span className="font-semibold text-navy">{store.avg_rating > 0 ? store.avg_rating.toFixed(1) : '—'} ⭐</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Video Likes</span><span className="font-semibold text-navy">{videos.total_likes.toLocaleString()}</span></div>
            </div>
          </motion.div>
        </motion.div>
      </div>

    </div>
  );
}

export default function VendorDashboard() {
  return (
    <QueryClientProvider client={queryClient}>
      <VendorAuthGuard>
        <Inner />
      </VendorAuthGuard>
    </QueryClientProvider>
  );
}
