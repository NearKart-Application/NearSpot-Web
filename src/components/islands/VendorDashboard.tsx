import { useEffect } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';
import { VendorAuthGuard } from './vendor/VendorAuthGuard';

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

function StatCard({ icon, label, value, sub, href }: {
  icon: string; label: string; value: string | number; sub?: string; href?: string;
}) {
  const inner = (
    <div className="card p-5 hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-navy mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center text-xl shrink-0">{icon}</div>
      </div>
    </div>
  );
  return href ? <a href={href}>{inner}</a> : inner;
}

function QuickAction({ icon, label, href }: { icon: string; label: string; href: string }) {
  return (
    <a href={href} className="card p-4 flex flex-col items-center gap-2 hover:shadow-card-hover hover:border-navy transition-all text-center">
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-medium text-gray-600 leading-tight">{label}</span>
    </a>
  );
}

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
      <button onClick={() => window.location.reload()}
              className="btn-primary mt-4">Retry</button>
    </div>
  );

  const { store, wallet, subscription, current_plan, products, videos } = data;
  const daysLeft = subscription?.days_left ?? 0;

  return (
    <div className="space-y-6">

      {/* Store header card */}
      <div className="card p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 text-3xl">
          🏪
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
            <span>⭐ {store.avg_rating > 0 ? store.avg_rating.toFixed(1) : 'New'} ({store.review_count} reviews)</span>
            <span>·</span>
            <span>👥 {store.follower_count} followers</span>
            <span>·</span>
            <span className="capitalize">{current_plan.display_name} plan</span>
          </div>
        </div>
        <a href="/vendor/store-setup" className="btn-outline btn-sm shrink-0">Edit Store</a>
      </div>

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="💰" label="Wallet Balance"  value={`₹${parseFloat(wallet.balance).toLocaleString()}`}  href="/vendor/wallet"     />
        <StatCard icon="📦" label="Total Products"  value={products.total}                                      href="/vendor/products"   />
        <StatCard icon="✅" label="Active Products" value={products.active}    sub="live in app"                href="/vendor/products"   />
        <StatCard icon="📝" label="Draft"           value={products.draft}     sub="not published"              href="/vendor/products"   />
        <StatCard icon="🚫" label="Inactive"        value={products.inactive}  sub="hidden"                     href="/vendor/inventory"  />
        <StatCard icon="🎬" label="Total Videos"    value={videos.total}                                        href="/vendor/videos"     />
        <StatCard icon="▶️" label="Published"       value={videos.ready}       sub="live in feed"               href="/vendor/videos"     />
        <StatCard icon="👁" label="Total Views"     value={videos.total_views.toLocaleString()}                 href="/vendor/analytics"  />
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="section-title">Quick Actions</h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <QuickAction icon="➕"  label="Add Product"    href="/vendor/products/new"   />
          <QuickAction icon="🏷️"  label="Create Offer"   href="/vendor/offers"         />
          <QuickAction icon="🎬"  label="Upload Video"   href="/vendor/videos"         />
          <QuickAction icon="🧾"  label="New Invoice"    href="/vendor/invoices"       />
          <QuickAction icon="📢"  label="Broadcast"      href="/vendor/broadcasts"     />
          <QuickAction icon="🎟️"  label="Discount Code"  href="/vendor/discount-codes" />
        </div>
      </div>

      {/* Store performance summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Products</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm"><span className="text-gray-600">Total</span><span className="font-semibold text-navy">{products.total}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">Active</span><span className="font-semibold text-green-600">{products.active}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">Draft</span><span className="font-semibold text-yellow-600">{products.draft}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">Inactive</span><span className="font-semibold text-red-500">{products.inactive}</span></div>
          </div>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Videos</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm"><span className="text-gray-600">Total</span><span className="font-semibold text-navy">{videos.total}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">Published</span><span className="font-semibold text-green-600">{videos.ready}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">Processing</span><span className="font-semibold text-yellow-600">{videos.processing}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">Total Views</span><span className="font-semibold text-navy">{videos.total_views.toLocaleString()}</span></div>
          </div>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Community</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm"><span className="text-gray-600">Followers</span><span className="font-semibold text-navy">{store.follower_count}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">Reviews</span><span className="font-semibold text-navy">{store.review_count}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">Avg Rating</span><span className="font-semibold text-navy">{store.avg_rating > 0 ? store.avg_rating.toFixed(1) : '—'} ⭐</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">Video Likes</span><span className="font-semibold text-navy">{videos.total_likes.toLocaleString()}</span></div>
          </div>
        </div>
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
