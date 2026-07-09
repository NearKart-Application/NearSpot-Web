import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';
import Img from '../../ui/Img';

interface DashData {
  store: { id: string; name: string; follower_count: number; avg_rating: number; review_count: number };
  products: { total: number; active: number; draft: number; inactive: number };
  videos: { total: number; ready: number; total_likes: number; total_views: number };
  subscription?: { plan: string; days_left: number };
  current_plan?: { display_name: string };
}

interface ProductStat {
  id: string; name: string; primary_image?: string;
  view_count: number; reservation_count: number; wishlist_count: number;
}

interface VideoStat {
  id: string; title: string; thumbnail?: string;
  view_count: number; like_count: number; status: string;
}

function StatCard({ icon, label, value, sub, color = 'bg-navy/8' }: {
  icon: string; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-navy mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

function Inner() {
  const { data: dash, isLoading, isError, error, refetch } = useQuery<DashData>({
    queryKey: ['vendor-analytics'],
    queryFn: () => api.get('/analytics/vendor/').then(r => r.data),
  });

  const { data: productStats } = useQuery<ProductStat[]>({
    queryKey: ['vendor-product-stats'],
    queryFn: () => api.get('/analytics/vendor/products/').then(r => r.data),
  });

  const { data: videoStats } = useQuery<VideoStat[]>({
    queryKey: ['vendor-video-stats'],
    queryFn: () => api.get('/analytics/vendor/videos/').then(r => r.data),
  });

  if (isLoading) return (
    <div className="space-y-6">
      <div className="h-8 bg-gray-200 rounded-xl w-48 animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <div key={i} className="card p-5 h-24 animate-pulse" />)}
      </div>
    </div>
  );

  if (isError) return <IslandError error={error} refetch={refetch} />;

  const topProducts: ProductStat[] = Array.isArray(productStats) ? productStats.slice(0, 5) : [];
  const topVideos: VideoStat[] = Array.isArray(videoStats) ? videoStats.slice(0, 5) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Analytics</h1>
        <p className="text-sm text-gray-400">{dash?.store?.name}</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="👥" label="Followers" value={dash?.store?.follower_count ?? 0} color="bg-blue-50" />
        <StatCard icon="⭐" label="Avg Rating" value={dash?.store?.avg_rating?.toFixed(1) ?? '—'} sub={`${dash?.store?.review_count ?? 0} reviews`} color="bg-amber-50" />
        <StatCard icon="📦" label="Active Products" value={dash?.products?.active ?? 0} sub={`${dash?.products?.total ?? 0} total`} color="bg-green-50" />
        <StatCard icon="🎬" label="Videos" value={dash?.videos?.ready ?? 0} sub={`${dash?.videos?.total ?? 0} total`} color="bg-purple-50" />
        <StatCard icon="👁️" label="Video Views" value={(dash?.videos?.total_views ?? 0).toLocaleString()} color="bg-indigo-50" />
        <StatCard icon="❤️" label="Video Likes" value={(dash?.videos?.total_likes ?? 0).toLocaleString()} color="bg-rose-50" />
        <StatCard icon="🚀" label="Plan" value={dash?.current_plan?.display_name ?? 'Free'} sub={dash?.subscription?.days_left != null ? `${dash.subscription.days_left}d left` : ''} color="bg-navy/8" />
        <StatCard icon="📋" label="Draft Products" value={dash?.products?.draft ?? 0} color="bg-gray-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-navy">Top Products</h2>
            <a href="/vendor/products" className="text-xs font-bold text-gold hover:underline">View all</a>
          </div>
          {topProducts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <div className="text-3xl mb-2">📦</div>
              <p className="text-sm">No product stats yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {topProducts.map((p, i) => (
                <div key={p.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="text-xs font-bold text-gray-400 w-4">#{i + 1}</span>
                  <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                    <Img src={p.primary_image} alt={p.name} fallback="product" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.view_count} views · {p.reservation_count} reservations</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">❤️ {p.wishlist_count}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Videos */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-navy">Top Videos</h2>
            <a href="/vendor/videos" className="text-xs font-bold text-gold hover:underline">View all</a>
          </div>
          {topVideos.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <div className="text-3xl mb-2">🎬</div>
              <p className="text-sm">No video stats yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {topVideos.map((v, i) => (
                <div key={v.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="text-xs font-bold text-gray-400 w-4">#{i + 1}</span>
                  <div className="w-10 h-10 rounded-xl bg-gray-900 overflow-hidden shrink-0">
                    <Img src={v.thumbnail} alt={v.title} fallback="generic" className="w-full h-full object-cover opacity-80" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy truncate">{v.title}</p>
                    <p className="text-xs text-gray-400">{v.view_count.toLocaleString()} views</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">❤️ {v.like_count}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VendorAnalyticsIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
