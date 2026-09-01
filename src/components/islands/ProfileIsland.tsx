import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';
import { auth } from '../../lib/auth';
import Img from '../ui/Img';
import { Button } from '@/components/ui/button';

const sectionVariants = { hidden: { opacity: 0, y: 18, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.38, ease: 'easeOut' as const } } };
const pageContainer = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };

interface User {
  id: string; profile_id?: string; phone_number: string; role: string;
  full_name?: string; email?: string; avatar?: string;
  is_suspended?: boolean; created_at?: string;
}

const MENU_ICONS: Record<string, string> = {
  reservations:  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  wishlist:      'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  notifications: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.006 6.006 0 00-5.655-5.978A2 2 0 0010 6v.022A6.006 6.006 0 004 12v2.159c0 .537-.214 1.054-.595 1.436L2 17h5m8 0v1a3 3 0 11-6 0v-1m6 0H9',
  messages:      'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  loyalty:       'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  referral:      'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7',
  map:           'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
  groups:        'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  wallet:        'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  logout:        'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
};

function MenuItem({ iconKey, label, sub, href, danger }: {
  iconKey: string; label: string; sub?: string; href: string; danger?: boolean;
}) {
  const d = MENU_ICONS[iconKey] ?? MENU_ICONS['map'];
  return (
    <a href={href}
      className={`flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${danger ? 'bg-red-50' : 'bg-gray-100'}`}>
        <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75"
          className={danger ? 'text-red-500' : 'text-navy/70'}>
          <path strokeLinecap="round" strokeLinejoin="round" d={d}/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${danger ? 'text-red-500' : 'text-navy'}`}>{label}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
      <svg className={`w-4 h-4 ${danger ? 'text-red-300' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
      </svg>
    </a>
  );
}

interface Session {
  id: string; device_type: string; device_name: string;
  os: string; browser: string; city: string; created_at: string;
}

function DeviceIcon({ type }: { type: string }) {
  if (type === 'mobile') return <span className="text-base">📱</span>;
  if (type === 'tablet')  return <span className="text-base">📟</span>;
  return <span className="text-base">💻</span>;
}

function Inner() {
  const [editMode,       setEditMode]       = useState(false);
  const [name,           setName]           = useState('');
  const [email,          setEmail]          = useState('');
  const [showSessions,   setShowSessions]   = useState(false);
  const [deleteConfirm,  setDeleteConfirm]  = useState(false);
  const [deleteInput,    setDeleteInput]    = useState('');
  const qc = useQueryClient();
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ns_access');

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['me'],
    queryFn:  () => api.get('/auth/me/').then(r => r.data),
    enabled:  isLoggedIn,
  });

  // Sync form fields when user data loads (onSuccess removed in TanStack Query v5)
  useEffect(() => {
    if (user) { setName(user.full_name ?? ''); setEmail(user.email ?? ''); }
  }, [user?.id]);

  const updateMut = useMutation({
    mutationFn: (payload: { full_name?: string; email?: string }) =>
      api.patch('/auth/me/', payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['me'] });
      // Keep navbar avatar initial in sync without requiring re-login
      if (res.data?.full_name) {
        localStorage.setItem('ns_display_name', res.data.full_name);
        const avatarEl = document.getElementById('nav-avatar');
        if (avatarEl) avatarEl.textContent = res.data.full_name[0].toUpperCase();
      }
      setEditMode(false);
    },
  });
  const updateError = updateMut.isError ? ((updateMut.error as any)?.response?.data?.detail ?? 'Failed to save changes') : null;

  const logoutMut = useMutation({
    mutationFn: () => api.post('/auth/logout/', { refresh: localStorage.getItem('ns_refresh') }),
    onSettled: () => {
      localStorage.removeItem('ns_access');
      localStorage.removeItem('ns_refresh');
      localStorage.removeItem('ns_user');
      window.location.href = '/auth/login';
    },
  });

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery<{ results: Session[] }>({
    queryKey: ['my-sessions'],
    queryFn:  () => api.get('/auth/me/sessions/').then(r => r.data),
    enabled:  showSessions && isLoggedIn,
  });

  const signoutAllMut = useMutation({
    mutationFn: () => api.delete('/auth/me/sessions/', { data: { refresh: localStorage.getItem('ns_refresh') } }),
    onSuccess: () => {
      localStorage.removeItem('ns_access');
      localStorage.removeItem('ns_refresh');
      localStorage.removeItem('ns_user');
      window.location.href = '/auth/login';
    },
  });

  const deleteAccountMut = useMutation({
    mutationFn: () => api.delete('/auth/me/delete/', { data: { refresh: localStorage.getItem('ns_refresh') } }),
    onSuccess: () => {
      localStorage.clear();
      window.location.href = '/auth/login';
    },
  });

  if (!isLoggedIn) return (
    <div className="flex flex-col items-center py-24 text-center px-6">
      <div className="w-24 h-24 rounded-full bg-navy/10 flex items-center justify-center mb-5 text-5xl">👤</div>
      <h2 className="text-xl font-black text-navy">Sign in to view profile</h2>
      <p className="text-gray-400 text-sm mt-2">Manage your account, reservations, and preferences.</p>
      <a href="/auth/login" className="mt-6 btn-primary px-10 py-3">Sign In</a>
    </div>
  );

  if (isLoading) return (
    <div className="animate-pulse space-y-4">
      <div className="bg-white rounded-2xl p-6 flex gap-4 items-center">
        <div className="w-20 h-20 bg-gray-200 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-200 rounded-full w-2/3" />
          <div className="h-3 bg-gray-200 rounded-full w-1/2" />
        </div>
      </div>
    </div>
  );

  if (!user) return null;

  // Use localStorage ui_mode (set at login time) as authoritative session role.
  // The /auth/me/ API may return a different 'role' if the account has multiple roles.
  const localUser   = auth.user();
  const sessionRole = localUser?.ui_mode ?? (localUser as any)?.role ?? user.role ?? 'customer';

  const initials = (user.full_name ?? user.phone_number).slice(0, 2).toUpperCase();
  const joined   = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : '';

  return (
    <motion.div className="space-y-4 max-w-2xl mx-auto" variants={pageContainer} initial="hidden" animate="show">
      {/* Avatar card */}
      <motion.div variants={sectionVariants} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-navy to-navy/70" />
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between -mt-10 mb-3">
            <div className="w-20 h-20 rounded-full border-4 border-white bg-navy flex items-center justify-center overflow-hidden shadow">
              {user.avatar
                ? <Img src={user.avatar} alt={user.full_name ?? initials} fallback="avatar"
                    className="w-full h-full object-cover" />
                : <span className="text-2xl font-black text-gold">{initials}</span>
              }
            </div>
            {!editMode && (
              <button onClick={() => setEditMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-navy hover:bg-gray-50 transition-colors">
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                </svg>
                Edit
              </button>
            )}
          </div>

          {editMode ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="input w-full" placeholder="Your full name" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                  className="input w-full" placeholder="your@email.com" />
              </div>
              {updateError && <p className="text-xs text-red-500 font-semibold">{updateError}</p>}
              <div className="flex gap-2">
                <Button onClick={() => updateMut.mutate({ full_name: name, email })}
                  disabled={updateMut.isPending}
                  className="flex-1 py-2.5">
                  {updateMut.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
                <Button variant="outline" onClick={() => setEditMode(false)}
                  className="flex-1 py-2.5">Cancel</Button>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-black text-navy">{user.full_name || 'Add your name'}</h2>
              <p className="text-sm text-gray-400">{user.phone_number}</p>
              {user.email && <p className="text-sm text-gray-400">{user.email}</p>}
              {user.profile_id && (
                <p className="text-xs font-mono font-semibold mt-1" style={{ color: '#C8973A' }}>{user.profile_id}</p>
              )}
              {joined && <p className="text-xs text-gray-300 mt-1">Member since {joined}</p>}
              <span className={`inline-block mt-2 text-[11px] font-bold px-2 py-0.5 rounded-full border capitalize ${
                user.role === 'vendor' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>{user.role}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Menu sections — role-aware (uses session role from localStorage, not API) */}
      {sessionRole === 'vendor' ? (
        <>
          <motion.div variants={sectionVariants} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-4 pt-3 pb-1">Store</p>
            <MenuItem iconKey="map"           label="Dashboard"        sub="Sales and performance"    href="/vendor/dashboard" />
            <MenuItem iconKey="reservations"  label="Reservations"     sub="Manage product holds"     href="/vendor/reservations" />
            <MenuItem iconKey="notifications" label="Notifications"    sub="Alerts and updates"       href="/vendor/notifications" />
            <MenuItem iconKey="messages"      label="Settings"         sub="Store settings & QR code" href="/vendor/settings" />
          </motion.div>
          <motion.div variants={sectionVariants} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-4 pt-3 pb-1">Finance</p>
            <MenuItem iconKey="wallet"   label="Wallet"   sub="Store wallet balance"  href="/vendor/wallet" />
            <MenuItem iconKey="referral" label="Plans"    sub="Subscription plans"    href="/vendor/plans" />
          </motion.div>
        </>
      ) : (
        <>
          <motion.div variants={sectionVariants} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-4 pt-3 pb-1">Orders & Activity</p>
            <MenuItem iconKey="reservations"  label="My Reservations"   sub="Track your product holds"    href="/customer/reservations" />
            <MenuItem iconKey="reservations"  label="Purchase History"  sub="All past reservations"       href="/customer/purchase-history" />
            <MenuItem iconKey="wishlist"      label="Wishlist"          sub="Saved products"              href="/customer/wishlist" />
            <MenuItem iconKey="wishlist"      label="Stock Watchlist"   sub="Get notified when items restock" href="/customer/watchlist" />
            <MenuItem iconKey="notifications" label="Notifications"     sub="Alerts and updates"          href="/customer/notifications" />
            <MenuItem iconKey="messages"      label="Messages"          sub="Chat with stores"            href="/customer/chat" />
          </motion.div>
          <motion.div variants={sectionVariants} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-4 pt-3 pb-1">Rewards</p>
            <MenuItem iconKey="loyalty"  label="Loyalty Points"   sub="Earn & redeem points"       href="/customer/loyalty" />
            <MenuItem iconKey="loyalty"  label="Loyalty History"  sub="Full points transaction log" href="/customer/loyalty-history" />
            <MenuItem iconKey="referral" label="Refer & Earn"     sub="Invite friends for rewards"  href="/customer/referral" />
          </motion.div>
          <motion.div variants={sectionVariants} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-4 pt-3 pb-1">Account</p>
            <MenuItem iconKey="wallet" label="Wallet"          sub="Your NearSpot wallet"    href="/customer/wallet" />
            <MenuItem iconKey="wallet" label="Wallet Requests" sub="Withdrawal requests"      href="/customer/wallet-request" />
            <MenuItem iconKey="map"    label="Nearby Map" sub="Find stores on map"   href="/map" />
            <MenuItem iconKey="groups" label="Groups"     sub="Your store groups"    href="/customer/groups" />
          </motion.div>
        </>
      )}

      {/* Security — Active Sessions */}
      <motion.div variants={sectionVariants} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <button onClick={() => setShowSessions(s => !s)}
          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left">
          <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
            <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" className="text-navy/70">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-navy">Active Sessions</p>
            <p className="text-xs text-gray-400">Devices logged into your account</p>
          </div>
          <svg className={`w-4 h-4 text-gray-300 transition-transform ${showSessions ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>

        {showSessions && (
          <div className="border-t border-gray-100 px-4 py-3 space-y-2">
            {sessionsLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : (sessionsData?.results ?? []).length === 0 ? (
              <p className="text-xs text-gray-400 py-2">No login history found.</p>
            ) : (
              <>
                {(sessionsData?.results ?? []).map(s => (
                  <div key={s.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <DeviceIcon type={s.device_type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-navy truncate">{s.device_name || (s.browser || 'Unknown device')}</p>
                      <p className="text-[11px] text-gray-400">{[s.os, s.city].filter(Boolean).join(' · ')} · {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    </div>
                  </div>
                ))}
                <button onClick={() => signoutAllMut.mutate()}
                  disabled={signoutAllMut.isPending}
                  className="w-full text-xs text-red-500 font-semibold border border-red-200 rounded-xl py-2 mt-2 hover:bg-red-50 transition-colors">
                  {signoutAllMut.isPending ? 'Signing out…' : 'Sign Out All Devices'}
                </button>
              </>
            )}
          </div>
        )}
      </motion.div>

      {/* Sign Out + Delete Account */}
      <motion.div variants={sectionVariants} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
        <button onClick={() => logoutMut.mutate()}
          disabled={logoutMut.isPending}
          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 transition-colors text-left">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" className="text-red-500">
              <path strokeLinecap="round" strokeLinejoin="round" d={MENU_ICONS['logout']}/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-500">
              {logoutMut.isPending ? 'Signing out…' : 'Sign Out'}
            </p>
          </div>
        </button>

        {!deleteConfirm ? (
          <button onClick={() => setDeleteConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 transition-colors text-left">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" className="text-red-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-400">Delete Account</p>
              <p className="text-xs text-gray-400">Permanently remove your account and data</p>
            </div>
          </button>
        ) : (
          <div className="px-4 py-4 bg-red-50 space-y-3">
            <p className="text-sm font-bold text-red-700">Are you sure? This cannot be undone.</p>
            <p className="text-xs text-red-500">Type <strong>DELETE</strong> to confirm</p>
            <input value={deleteInput} onChange={e => setDeleteInput(e.target.value.toUpperCase())}
              placeholder="Type DELETE"
              className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-red-400 bg-white" />
            {deleteAccountMut.isError && (
              <p className="text-xs text-red-600">{(deleteAccountMut.error as any)?.response?.data?.message ?? 'Failed to delete account'}</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setDeleteConfirm(false); setDeleteInput(''); }}
                className="flex-1 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-white transition-colors">
                Cancel
              </button>
              <button
                onClick={() => deleteAccountMut.mutate()}
                disabled={deleteInput !== 'DELETE' || deleteAccountMut.isPending}
                className="flex-1 py-2 text-sm font-bold text-white bg-red-500 rounded-xl disabled:opacity-40 hover:bg-red-600 transition-colors">
                {deleteAccountMut.isPending ? 'Deleting…' : 'Delete Forever'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function ProfileIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <Inner />
    </QueryClientProvider>
  );
}
