import { useEffect, useState, type ComponentType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Store,
  Users,
  Package,
  Image,
  Tag,
  TicketPercent,
  Globe,
  ClipboardList,
  Shield,
  CreditCard,
  Link2,
  LogOut,
  ChevronRight,
  ChevronDown,
  History,
  LogIn,
  Activity,
  MousePointerClick,
  RotateCcw,
  User,
  BarChart2,
  CalendarCheck,
} from 'lucide-react';
import { auth } from '../../../lib/auth';

type NavChild = { label: string; href: string; icon: string };
type NavItem  = { label: string; icon: string } & (
  | { href: string; children?: never }
  | { href?: never; children: NavChild[] }
);

const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  dashboard:    LayoutDashboard,
  stores:       Store,
  users:        Users,
  products:     Package,
  image:        Image,
  tag:          Tag,
  ticket:       TicketPercent,
  globe:        Globe,
  clipboard:    ClipboardList,
  shield:       Shield,
  'credit-card': CreditCard,
  link:         Link2,
  history:      History,
  login:        LogIn,
  activity:     Activity,
  click:        MousePointerClick,
  restore:      RotateCcw,
  store:        Store,
  user:         User,
  reports:      BarChart2,
  reservations: CalendarCheck,
};

const NAV_ALL: NavItem[] = [
  { label: 'Dashboard',         href: '/admin/dashboard',           icon: 'dashboard' },
  { label: 'Stores',            href: '/admin/stores',              icon: 'stores' },
  { label: 'Users',             href: '/admin/users',               icon: 'users' },
  { label: 'Products',          href: '/admin/products',            icon: 'products' },
  { label: 'Reports',           href: '/admin/reports',             icon: 'reports' },
  { label: 'Banners',           href: '/admin/banners',             icon: 'image' },
  { label: 'Categories',        href: '/admin/categories',          icon: 'tag' },
  { label: 'Offer Templates',   href: '/admin/offer-templates',     icon: 'ticket' },
  { label: 'Coupons',           href: '/admin/coupons',             icon: 'ticket' },
  { label: 'Website Requests',  href: '/admin/website-requests',    icon: 'globe' },
  { label: 'Reservations',      href: '/admin/reservations',        icon: 'reservations' },
  { label: 'Activity Log',      href: '/admin/activity-log',        icon: 'clipboard' },
  { label: 'Stock Change Log',  href: '/admin/stock-logs',          icon: 'history' },
  { label: 'Login Logs',        href: '/admin/login-logs',          icon: 'login' },
  { label: 'Vendor Actions',    href: '/admin/vendor-action-logs',  icon: 'activity' },
  { label: 'Customer Activity', href: '/admin/customer-activity',   icon: 'click' },
  {
    label: 'Restore Accounts',
    icon: 'restore',
    children: [
      { label: 'Vendors',   href: '/admin/restore-accounts/vendors',   icon: 'store' },
      { label: 'Customers', href: '/admin/restore-accounts/customers', icon: 'user'  },
    ],
  },
];

const NAV_MASTER = [
  { label: 'Manage Admins',   href: '/admin/admins',          icon: 'shield' },
  { label: 'Plans',           href: '/admin/plans',           icon: 'credit-card' },
  { label: 'Referral Config', href: '/admin/referral-config', icon: 'link' },
];

const INACTIVITY_MS  = 30 * 60 * 1000; // 30 minutes
const WARNING_MS     = 25 * 60 * 1000; // warn at 25 minutes

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [status, setStatus]           = useState<'loading' | 'ok' | 'denied'>('loading');
  const [userName, setUserName]       = useState('');
  const [isMaster, setIsMaster]       = useState(false);
  const [path, setPath]               = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [openGroup, setOpenGroup]     = useState<string | null>(null);

  useEffect(() => {
    const user = auth.user();
    const mode = (user as any)?.ui_mode ?? (user as any)?.role;
    if (!user || !auth.isLoggedIn() || (mode !== 'admin' && mode !== 'master_admin')) {
      window.location.href = '/admin/login';
      setStatus('denied');
      return;
    }
    const currentPath = window.location.pathname;
    setUserName(user.full_name || user.phone_number);
    setIsMaster(mode === 'master_admin');
    setPath(currentPath);
    setStatus('ok');
    if (currentPath.startsWith('/admin/restore-accounts')) {
      setOpenGroup('Restore Accounts');
    }

    // ── Inactivity timeout (30 min) ──────────────────────────────────────────
    let warnTimer:   ReturnType<typeof setTimeout>;
    let logoutTimer: ReturnType<typeof setTimeout>;

    function resetTimers() {
      clearTimeout(warnTimer);
      clearTimeout(logoutTimer);
      setShowWarning(false);
      warnTimer   = setTimeout(() => setShowWarning(true),     WARNING_MS);
      logoutTimer = setTimeout(() => { auth.logout(); window.location.href = '/admin/login'; }, INACTIVITY_MS);
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach(ev => document.addEventListener(ev, resetTimers, { passive: true }));
    resetTimers();

    return () => {
      clearTimeout(warnTimer);
      clearTimeout(logoutTimer);
      events.forEach(ev => document.removeEventListener(ev, resetTimers));
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="w-10 h-10 spinner" />
          <p className="text-xs text-gray-400 font-medium">Loading…</p>
        </motion.div>
      </div>
    );
  }

  if (status === 'denied') return null;

  const navItems: NavItem[] = isMaster ? [...NAV_ALL, ...NAV_MASTER] : NAV_ALL;

  // ── Inactivity warning overlay ───────────────────────────────────────────────
  const warningOverlay = showWarning && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl"
      >
        <div className="text-4xl mb-3">⏱️</div>
        <h3 className="text-lg font-bold text-navy mb-2">Session Expiring Soon</h3>
        <p className="text-sm text-gray-500 mb-6">
          You will be automatically logged out in <strong>5 minutes</strong> due to inactivity.
        </p>
        <button
          onClick={() => setShowWarning(false)}
          className="w-full py-3 rounded-xl bg-navy text-white font-bold text-sm hover:bg-navy/90 transition-colors"
        >
          I'm still here
        </button>
      </motion.div>
    </div>
  );
  const activeItem = navItems.find(n => {
    if (n.children) return n.children.some(c => path === c.href || path.startsWith(c.href + '/'));
    return path === n.href || path.startsWith((n.href ?? '') + '/');
  });
  const activeChild = navItems.flatMap(n => n.children ?? []).find(c => path === c.href || path.startsWith(c.href + '/'));

  return (
    <>
    {warningOverlay}
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-y-0 left-0 w-[260px] flex flex-col z-30"
        style={{ background: 'linear-gradient(180deg, #0B1120 0%, #0F172A 40%, #070C18 100%)' }}
      >
        {/* Logo / Header */}
        <div className="h-16 flex items-center gap-3 px-5 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <motion.div
            whileHover={{ rotate: 8, scale: 1.1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)', color: '#0F172A' }}
          >
            N
          </motion.div>
          <span className="text-white font-bold text-base tracking-tight flex-1">NearSpot</span>
          <span
            className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 tracking-wide uppercase"
            style={{ background: isMaster ? 'linear-gradient(135deg, #F59E0B, #FBBF24)' : 'rgba(255,255,255,0.12)', color: isMaster ? '#0F172A' : 'rgba(255,255,255,0.7)' }}
          >
            {isMaster ? 'Master' : 'Admin'}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 scrollbar-hide">
          {navItems.map((item, index) => {
            const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;

            /* ── Expandable group (has children) ── */
            if (item.children) {
              const isGroupActive = item.children.some(c => path === c.href || path.startsWith(c.href + '/'));
              const isOpen = openGroup === item.label;
              return (
                <div key={item.label}>
                  <motion.button
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.035, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setOpenGroup(isOpen ? null : item.label)}
                    className="w-full flex items-center gap-3 rounded-xl text-sm transition-all duration-200 mx-1"
                    style={{
                      padding: '10px 12px',
                      color: isGroupActive || isOpen ? 'white' : 'rgba(255,255,255,0.52)',
                      background: isGroupActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                      fontWeight: isGroupActive ? 600 : 500,
                      boxShadow: isGroupActive ? 'inset 3px 0 0 #F59E0B' : 'none',
                      width: 'calc(100% - 8px)',
                    }}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    </motion.div>
                  </motion.button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="children"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="ml-4 mt-0.5 mb-1 space-y-0.5 pl-3" style={{ borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                          {item.children.map(child => {
                            const ChildIcon = ICON_MAP[child.icon] ?? Users;
                            const isChildActive = path === child.href || path.startsWith(child.href + '/');
                            return (
                              <motion.a
                                key={child.href}
                                href={child.href}
                                whileHover={{ x: 2 }}
                                whileTap={{ scale: 0.97 }}
                                className="flex items-center gap-2.5 rounded-xl text-xs transition-all duration-200 px-3 py-2"
                                style={{
                                  color: isChildActive ? 'white' : 'rgba(255,255,255,0.5)',
                                  background: isChildActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                                  fontWeight: isChildActive ? 600 : 400,
                                  boxShadow: isChildActive ? 'inset 3px 0 0 #F59E0B' : 'none',
                                }}
                              >
                                <ChildIcon className="w-3.5 h-3.5 shrink-0" />
                                <span>{child.label}</span>
                                {isChildActive && (
                                  <span className="w-1.5 h-1.5 rounded-full ml-auto shrink-0" style={{ backgroundColor: '#F59E0B' }} />
                                )}
                              </motion.a>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            /* ── Flat link ── */
            const isActive = path === item.href || path.startsWith((item.href ?? '') + '/');
            return (
              <motion.a
                key={item.href}
                href={item.href}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.035, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ x: isActive ? 0 : 3 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-3 rounded-xl text-sm transition-all duration-200 mx-1 relative"
                style={{
                  padding: '10px 12px',
                  color: isActive ? 'white' : 'rgba(255,255,255,0.52)',
                  background: isActive ? 'rgba(255,255,255,0.13)' : 'transparent',
                  fontWeight: isActive ? 600 : 500,
                  boxShadow: isActive ? 'inset 3px 0 0 #F59E0B' : 'none',
                }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: '#F59E0B' }}
                  />
                )}
              </motion.a>
            );
          })}
        </nav>

        {/* Bottom: user + logout */}
        <div className="px-3 py-4 shrink-0 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ring-2"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', color: '#0F172A' }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{userName}</p>
              <p className="text-white/35 text-[10px]">{isMaster ? 'Master Admin' : 'Admin'}</p>
            </div>
          </div>
          <motion.button
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => auth.logout()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200"
            style={{ color: 'rgba(248,113,113,0.8)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'; (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(248,113,113,0.8)'; }}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Logout
          </motion.button>
        </div>
      </motion.aside>

      {/* Main area */}
      <div className="flex-1 ml-[260px] flex flex-col min-h-screen">
        {/* Top header */}
        <header className="h-16 bg-white/90 backdrop-blur-xl border-b border-gray-100/80 flex items-center justify-between px-6 sticky top-0 z-20" style={{ boxShadow: '0 1px 0 rgba(15,23,42,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(to bottom, #F59E0B, #D97706)' }} />
              <motion.h1
                key={activeItem?.label}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="text-sm font-bold text-gray-800"
              >
                {activeChild ? `${activeItem?.label} › ${activeChild.label}` : (activeItem?.label ?? 'Admin Panel')}
              </motion.h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-offset-1"
              style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1e3a5f 100%)', color: 'white', outline: '2px solid rgba(15,23,42,0.15)', outlineOffset: '2px' }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-700 hidden sm:block">{userName}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">
          <motion.div
            key={path}
            initial={{ opacity: 0, y: 14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
    </>

  );
}
