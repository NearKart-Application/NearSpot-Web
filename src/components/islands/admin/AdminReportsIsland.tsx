import { useState } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';

interface PlatformStats {
  users:    { total: number; vendors: number; customers: number; active: number; suspended: number };
  stores:   { total: number; active: number; verified: number; open: number; unverified: number; blocked: number; by_category: { category: string; count: number }[] };
  videos:   { total: number; ready: number; total_views: number; total_likes: number };
  products: { active: number };
  revenue:  { subscription_revenue: string; total_topups: string };
  pending_website_requests: number;
}

// Store category slug → label (mirrors backend StoreCategory choices)
const CATEGORY_LABELS: Record<string, string> = {
  fashion: 'Fashion', jewellery: 'Jewellery', footwear: 'Footwear', decor: 'Home Decor',
  furniture: 'Furniture', gifts: 'Gifts', beauty: 'Beauty', food: 'Food',
  electronics: 'Electronics', grocery: 'Grocery', pharmacy: 'Pharmacy',
  books: 'Books & Stationery', sports: 'Sports & Fitness', other: 'Other',
};

function StatCard({ label, value, sub, href }: { label: string; value: string | number; sub?: string; href?: string }) {
  const body = (
    <>
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: '#1C2E4A' }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </>
  );
  return href
    ? <a href={href} className="card p-5 block cursor-pointer transition-all hover:shadow-md hover:ring-2 hover:ring-navy/30 hover:-translate-y-0.5">{body}</a>
    : <div className="card p-5">{body}</div>;
}

function Inner() {
  const [showByCategory, setShowByCategory] = useState(false);
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

        {/* Users */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Users</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Users"     value={(stats.users?.total     ?? 0).toLocaleString()} href="/admin/users" />
            <StatCard label="Vendors"         value={(stats.users?.vendors   ?? 0).toLocaleString()} href="/admin/users?role=vendor" />
            <StatCard label="Customers"       value={(stats.users?.customers ?? 0).toLocaleString()} href="/admin/users?role=customer" />
            <StatCard label="Active Users"    value={(stats.users?.active    ?? 0).toLocaleString()} href="/admin/users?active=true" />
            <StatCard label="Suspended"       value={(stats.users?.suspended ?? 0).toLocaleString()} sub="Blocked from login" href="/admin/users?suspended=true" />
          </div>
        </section>

        {/* Stores */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Stores</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Stores"    value={(stats.stores?.total    ?? 0).toLocaleString()} href="/admin/stores" />
            <StatCard label="Active"          value={(stats.stores?.active   ?? 0).toLocaleString()} href="/admin/stores?active=true" />
            <StatCard label="Verified"        value={(stats.stores?.verified ?? 0).toLocaleString()} href="/admin/stores?verified=true" />
            <StatCard label="Currently Open"  value={(stats.stores?.open     ?? 0).toLocaleString()} href="/admin/stores?open=true" />
            <StatCard label="Unverified"      value={(stats.stores?.unverified ?? 0).toLocaleString()} sub="Not yet verified" href="/admin/stores?verified=false" />
            <StatCard label="Blocked"         value={(stats.stores?.blocked    ?? 0).toLocaleString()} sub="Deactivated" href="/admin/stores?active=false" />
          </div>
        </section>

        {/* Stores by Category — on-demand report (collapsed by default to keep the page clean) */}
        {(stats.stores?.by_category?.length ?? 0) > 0 && (
          <section>
            <button
              onClick={() => setShowByCategory(v => !v)}
              className="w-full card px-5 py-3 flex items-center justify-between cursor-pointer hover:ring-2 hover:ring-navy/20 transition-all"
            >
              <span className="text-sm font-semibold text-navy">📊 Stores by Category</span>
              <span className="text-xs text-gray-400 flex items-center gap-2">
                {showByCategory ? 'Hide' : 'View report'}
                <span className={`transition-transform ${showByCategory ? 'rotate-180' : ''}`}>▾</span>
              </span>
            </button>
            {showByCategory && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                {stats.stores.by_category.map(r => (
                  <a
                    key={r.category}
                    href={`/admin/stores?category=${r.category}`}
                    className="card p-5 block cursor-pointer transition-all hover:shadow-md hover:ring-2 hover:ring-navy/30 hover:-translate-y-0.5"
                  >
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1 truncate">{CATEGORY_LABELS[r.category] ?? r.category}</p>
                    <p className="text-2xl font-bold" style={{ color: '#1C2E4A' }}>{r.count.toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-0.5">vendors</p>
                  </a>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Content */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Content</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Active Products"  value={(stats.products?.active      ?? 0).toLocaleString()} href="/admin/products" />
            <StatCard label="Total Videos"     value={(stats.videos?.total        ?? 0).toLocaleString()} />
            <StatCard label="Total Views"      value={(stats.videos?.total_views  ?? 0).toLocaleString()} />
            <StatCard label="Total Likes"      value={(stats.videos?.total_likes  ?? 0).toLocaleString()} />
          </div>
        </section>

        {/* Revenue */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Revenue</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="Subscription Revenue" value={`₹${Number(stats.revenue?.subscription_revenue ?? 0).toLocaleString('en-IN')}`} sub="All time" />
            <StatCard label="Total Top-ups"         value={`₹${Number(stats.revenue?.total_topups ?? 0).toLocaleString('en-IN')}`} sub="All time" />
            <StatCard label="Pending Requests"      value={stats.pending_website_requests ?? 0} sub="Website signup" href="/admin/website-requests" />
          </div>
        </section>
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
