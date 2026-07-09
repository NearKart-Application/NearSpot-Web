import { useEffect, useState } from 'react';
import { auth } from '../../../lib/auth';

const NAV_ALL = [
  { label: 'Dashboard',         href: '/admin/dashboard',         icon: '📊' },
  { label: 'Stores',            href: '/admin/stores',            icon: '🏪' },
  { label: 'Users',             href: '/admin/users',             icon: '👥' },
  { label: 'Products',          href: '/admin/products',          icon: '📦' },
  { label: 'Banners',           href: '/admin/banners',           icon: '🖼' },
  { label: 'Categories',        href: '/admin/categories',        icon: '🗂' },
  { label: 'Offer Templates',   href: '/admin/offer-templates',   icon: '🏷' },
  { label: 'Coupons',           href: '/admin/coupons',           icon: '🎟' },
  { label: 'Website Requests',  href: '/admin/website-requests',  icon: '🌐' },
  { label: 'Activity Log',      href: '/admin/activity-log',      icon: '📋' },
];

const NAV_MASTER = [
  { label: 'Manage Admins',  href: '/admin/admins',          icon: '🛡' },
  { label: 'Plans',          href: '/admin/plans',           icon: '💳' },
  { label: 'Referral Config',href: '/admin/referral-config', icon: '🔗' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'denied'>('loading');
  const [userName, setUserName] = useState('');
  const [isMaster, setIsMaster] = useState(false);
  const [path, setPath] = useState('');

  useEffect(() => {
    const user = auth.user();
    const mode = (user as any)?.ui_mode ?? (user as any)?.role;
    if (!user || !auth.isLoggedIn() || (mode !== 'admin' && mode !== 'master_admin')) {
      window.location.href = '/auth/login';
      setStatus('denied');
      return;
    }
    setUserName(user.full_name || user.phone_number);
    setIsMaster(mode === 'master_admin');
    setPath(window.location.pathname);
    setStatus('ok');
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="w-8 h-8 spinner" />
      </div>
    );
  }

  if (status === 'denied') return null;

  const navItems = isMaster ? [...NAV_ALL, ...NAV_MASTER] : NAV_ALL;

  return (
    <div className="flex min-h-screen bg-surface">
      <aside
        className="fixed inset-y-0 left-0 w-[260px] flex flex-col z-30"
        style={{ backgroundColor: '#1C2E4A' }}
      >
        <div className="h-16 flex items-center px-5 border-b border-white/10 shrink-0">
          <span className="text-white font-bold text-lg tracking-tight">NearSpot</span>
          <span
            className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: '#F7B731', color: '#1C2E4A' }}
          >
            {isMaster ? 'Master' : 'Admin'}
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = path === item.href || path.startsWith(item.href + '/');
            return (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={
                  isActive
                    ? { backgroundColor: '#F7B731', color: '#1C2E4A' }
                    : { color: 'rgba(255,255,255,0.75)' }
                }
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.1)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = '';
                }}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-3 px-3 py-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: '#F7B731', color: '#1C2E4A' }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-white text-sm font-medium truncate flex-1">{userName}</span>
          </div>
          <button
            onClick={() => auth.logout()}
            className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-red-400 hover:bg-white/10 hover:text-red-300 transition-all"
          >
            <span>🚪</span> Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 ml-[260px] flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-20">
          <h1 className="text-sm font-semibold text-gray-500">
            {navItems.find((n) => path === n.href || path.startsWith(n.href + '/'))?.label ?? 'Admin Panel'}
          </h1>
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: '#1C2E4A', color: 'white' }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-700">{userName}</span>
          </div>
        </header>

        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
