import { useEffect, useRef, type ComponentType } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  Store,
  CheckCircle,
  ShieldCheck,
  Users,
  Package,
  Video,
  Eye,
  DollarSign,
  Globe,
  ChevronRight,
} from 'lucide-react';
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

// ── Animated number counter ──────────────────────────────────────────────────
function AnimatedNumber({ value }: { value: string | number }) {
  const ref = useRef<HTMLSpanElement>(null);

  // For non-numeric or currency strings, render as-is
  const raw = typeof value === 'number' ? value : value;
  const isNumeric =
    typeof raw === 'number' ||
    (typeof raw === 'string' && !raw.startsWith('₹') && !isNaN(Number(raw)));

  const numericTarget = isNumeric ? Number(raw) : 0;

  useEffect(() => {
    if (!isNumeric || !ref.current) return;
    const el = ref.current;
    const start = performance.now();
    const duration = 800;

    function tick(now: number) {
      const elapsed = Math.min(now - start, duration);
      const progress = elapsed / duration;
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * numericTarget);
      el.textContent = current.toLocaleString();
      if (elapsed < duration) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [numericTarget, isNumeric]);

  if (!isNumeric) {
    return <span>{value}</span>;
  }

  return <span ref={ref}>0</span>;
}

// ── Stagger animation variants ───────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  show:   { opacity: 1, y: 0,  scale: 1,    transition: { duration: 0.35, ease: 'easeOut' as const } },
};

// ── StatCard ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  gradient: string;
}

function StatCard({ icon: Icon, label, value, gradient }: StatCardProps) {
  return (
    <motion.div variants={itemVariants}>
      <div
        className={`rounded-2xl p-5 shadow-lg overflow-hidden relative bg-gradient-to-br ${gradient}`}
      >
        {/* Decoration circle */}
        <div className="absolute w-20 h-20 rounded-full bg-white/10 -right-4 -top-4 pointer-events-none" />

        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
          <Icon className="w-5 h-5 text-white" />
        </div>

        {/* Value */}
        <p className="text-3xl font-black text-white leading-none">
          <AnimatedNumber value={value} />
        </p>

        {/* Label */}
        <p className="text-sm text-white/75 mt-0.5">{label}</p>
      </div>
    </motion.div>
  );
}

// ── Inner dashboard ───────────────────────────────────────────────────────────
function Inner() {
  const { data, isLoading, error, refetch } = useQuery<DashStats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin-panel/stats/').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="h-28 bg-gray-200 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <p className="text-4xl mb-3">⚠️</p>
        <p className="font-semibold" style={{ color: '#0F172A' }}>Failed to load stats</p>
        <p className="text-sm text-gray-500 mt-1">
          {(error as any)?.response?.data?.detail ?? 'Check your connection and try again'}
        </p>
        <Button onClick={() => refetch()} className="mt-4">Retry</Button>
      </div>
    );
  }

  const quickLinks = [
    { label: 'Stores',           href: '/admin/stores' },
    { label: 'Users',            href: '/admin/users' },
    { label: 'Products',         href: '/admin/products' },
    { label: 'Banners',          href: '/admin/banners' },
    { label: 'Website Requests', href: '/admin/website-requests' },
  ];

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Platform Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">Live snapshot of your NearSpot platform</p>
      </div>

      {/* Stats grid */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <StatCard
          icon={Store}
          label="Total Stores"
          value={data.stores.total}
          gradient="from-blue-500 to-blue-600"
        />
        <StatCard
          icon={CheckCircle}
          label="Active Stores"
          value={data.stores.active}
          gradient="from-emerald-500 to-emerald-600"
        />
        <StatCard
          icon={ShieldCheck}
          label="Verified Stores"
          value={data.stores.verified}
          gradient="from-violet-500 to-violet-600"
        />
        <StatCard
          icon={Users}
          label="Total Users"
          value={data.users.total}
          gradient="from-pink-500 to-rose-500"
        />
        <StatCard
          icon={Package}
          label="Active Products"
          value={data.products.active}
          gradient="from-orange-500 to-amber-500"
        />
        <StatCard
          icon={Video}
          label="Ready Videos"
          value={data.videos.ready}
          gradient="from-teal-500 to-cyan-500"
        />
        <StatCard
          icon={Eye}
          label="Total Views"
          value={(data.videos.total_views ?? 0).toLocaleString()}
          gradient="from-indigo-500 to-blue-500"
        />
        <StatCard
          icon={DollarSign}
          label="Subscription Revenue"
          value={`₹${parseFloat(data.revenue.subscription_revenue || '0').toLocaleString()}`}
          gradient="from-amber-500 to-yellow-400"
        />
        <StatCard
          icon={Globe}
          label="Pending Website Requests"
          value={data.pending_website_requests}
          gradient="from-red-500 to-rose-500"
        />
      </motion.div>

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Quick Access
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickLinks.map((link) => (
            <motion.a
              key={link.href}
              href={link.href}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="card p-4 flex items-center justify-between gap-2 text-sm font-medium text-gray-700 hover:shadow-md transition-shadow"
            >
              <span>{link.label}</span>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </motion.a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Default export ────────────────────────────────────────────────────────────
export default function AdminDashboardIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <Inner />
      </AdminShell>
    </QueryClientProvider>
  );
}
