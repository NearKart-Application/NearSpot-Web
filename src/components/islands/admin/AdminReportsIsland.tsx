import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';

interface PlatformStats {
  total_users: number;
  total_stores: number;
  total_products: number;
  total_reservations: number;
  active_subscriptions: number;
  total_revenue: string;
  new_users_today: number;
  new_stores_today: number;
  reservations_today: number;
  reservations_this_week: number;
  reservations_this_month: number;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: '#1C2E4A' }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Inner() {
  const { data: stats, isLoading, isError } = useQuery<PlatformStats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin-panel/stats/').then(r => r.data),
  });

  if (isLoading) {
    return (
      <AdminShell>
        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#1C2E4A' }}>Reports</h1>
            <p className="text-sm text-gray-400">Platform statistics overview</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="card p-5 h-20 animate-pulse bg-gray-50" />
            ))}
          </div>
        </div>
      </AdminShell>
    );
  }

  if (isError || !stats) {
    return (
      <AdminShell>
        <div className="text-center py-20 text-gray-400">Failed to load stats.</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1C2E4A' }}>Reports</h1>
          <p className="text-sm text-gray-400">Platform statistics overview</p>
        </div>

        {/* Growth today */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Today</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="New Users" value={stats.new_users_today ?? 0} />
            <StatCard label="New Stores" value={stats.new_stores_today ?? 0} />
            <StatCard label="Reservations" value={stats.reservations_today ?? 0} />
          </div>
        </section>

        {/* Reservation trends */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Reservations</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="This Week" value={stats.reservations_this_week ?? 0} />
            <StatCard label="This Month" value={stats.reservations_this_month ?? 0} />
            <StatCard label="All Time" value={(stats.total_reservations ?? 0).toLocaleString()} />
          </div>
        </section>

        {/* Platform totals */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Platform Totals</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <StatCard label="Total Users" value={(stats.total_users ?? 0).toLocaleString()} />
            <StatCard label="Total Stores" value={(stats.total_stores ?? 0).toLocaleString()} />
            <StatCard label="Total Products" value={(stats.total_products ?? 0).toLocaleString()} />
            <StatCard label="Active Subscriptions" value={stats.active_subscriptions ?? 0} />
          </div>
        </section>

        {stats.total_revenue && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Revenue</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="Total Revenue" value={`₹${Number(stats.total_revenue).toLocaleString('en-IN')}`} sub="All time subscription revenue" />
            </div>
          </section>
        )}
      </div>
    </AdminShell>
  );
}

export default function AdminReportsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <Inner />
    </QueryClientProvider>
  );
}
