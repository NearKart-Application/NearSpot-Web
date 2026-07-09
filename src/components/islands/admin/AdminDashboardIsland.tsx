import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';

interface DashStats {
  users:    { total: number; vendors: number; customers: number; active: number };
  stores:   { total: number; active: number; verified: number; open: number };
  videos:   { total: number; ready: number; total_views: number; total_likes: number };
  products: { active: number };
  revenue:  { subscription_revenue: string; total_topups: string };
  pending_website_requests: number;
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#1C2E4A' }}>{value}</p>
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ backgroundColor: 'rgba(28,46,74,0.08)' }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function Inner() {
  const { data, isLoading, error, refetch } = useQuery<DashStats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin-panel/stats/').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <p className="text-4xl mb-3">⚠️</p>
        <p className="font-semibold" style={{ color: '#1C2E4A' }}>Failed to load stats</p>
        <p className="text-sm text-gray-500 mt-1">
          {(error as any)?.response?.data?.detail ?? 'Check your connection and try again'}
        </p>
        <button onClick={() => refetch()} className="btn-primary mt-4">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon="🏪" label="Total Stores"             value={data.stores.total} />
          <StatCard icon="✅" label="Active Stores"            value={data.stores.active} />
          <StatCard icon="🔍" label="Verified Stores"          value={data.stores.verified} />
          <StatCard icon="👥" label="Total Users"              value={data.users.total} />
          <StatCard icon="📦" label="Active Products"          value={data.products.active} />
          <StatCard icon="🎬" label="Ready Videos"             value={data.videos.ready} />
          <StatCard icon="👁" label="Total Views"              value={(data.videos.total_views ?? 0).toLocaleString()} />
          <StatCard icon="💰" label="Subscription Revenue"     value={`₹${parseFloat(data.revenue.subscription_revenue || '0').toLocaleString()}`} />
          <StatCard icon="🌐" label="Pending Website Requests" value={data.pending_website_requests} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Stores',           href: '/admin/stores' },
          { label: 'Users',            href: '/admin/users' },
          { label: 'Products',         href: '/admin/products' },
          { label: 'Banners',          href: '/admin/banners' },
          { label: 'Website Requests', href: '/admin/website-requests' },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="card p-4 text-center text-sm font-medium hover:shadow-card-hover transition-shadow"
            style={{ color: '#1C2E4A' }}
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboardIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <Inner />
      </AdminShell>
    </QueryClientProvider>
  );
}
