import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { auth } from '../../../lib/auth';
import { VendorAuthGuard } from './VendorAuthGuard';

interface UserProfile {
  id: string; phone_number: string; full_name: string | null;
  email: string | null; avatar: string | null; created_at: string;
  profile_id: string;
}

interface Session {
  id: string; device_type: string; device_name: string;
  os: string; browser: string; city: string; created_at: string;
}

function DeviceIcon({ type }: { type: string }) {
  if (type === 'mobile') return <span className="text-lg">📱</span>;
  if (type === 'tablet')  return <span className="text-lg">📟</span>;
  return <span className="text-lg">💻</span>;
}

function Inner() {
  const [showSessions, setShowSessions] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const { data: user, isLoading } = useQuery<UserProfile>({
    queryKey: ['vendor-me'],
    queryFn:  () => api.get('/auth/me/').then(r => r.data),
  });

  useEffect(() => {
    if (user) { setName(user.full_name ?? ''); setEmail(user.email ?? ''); }
  }, [user?.id]);

  const updateMut = useMutation({
    mutationFn: (payload: { full_name?: string; email?: string }) => api.patch('/auth/me/', payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendor-me'] }); setEditMode(false); },
  });

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery<{ results: Session[] }>({
    queryKey: ['vendor-sessions'],
    queryFn:  () => api.get('/auth/me/sessions/').then(r => r.data),
    enabled:  showSessions,
  });

  const signoutAllMut = useMutation({
    mutationFn: () => api.delete('/auth/me/sessions/', { data: { refresh: localStorage.getItem('ns_refresh') } }),
    onSuccess: () => {
      ['ns_access', 'ns_refresh', 'ns_user'].forEach(k => localStorage.removeItem(k));
      window.location.href = '/auth/login';
    },
  });

  if (isLoading) return (
    <div className="animate-pulse space-y-4 max-w-2xl">
      <div className="bg-white rounded-2xl p-6 flex gap-4 items-center border border-gray-100">
        <div className="w-20 h-20 bg-gray-200 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-200 rounded-full w-2/3" />
          <div className="h-3 bg-gray-200 rounded-full w-1/2" />
        </div>
      </div>
    </div>
  );

  if (!user) return null;

  const initials = (user.full_name || user.phone_number).slice(0, 2).toUpperCase();
  const joined = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="space-y-4 max-w-2xl">

      {/* Avatar card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="h-16 bg-gradient-to-r from-navy to-navy/70" />
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between -mt-10 mb-3">
            <div className="w-20 h-20 rounded-full border-4 border-white bg-navy flex items-center justify-center shadow text-2xl font-black text-amber-400">
              {initials}
            </div>
            {!editMode && (
              <button onClick={() => setEditMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-navy hover:bg-gray-50 transition-colors">
                ✏️ Edit
              </button>
            )}
          </div>

          {editMode ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-navy/40" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-navy/40" />
              </div>
              {updateMut.isError && (
                <p className="text-xs text-red-500">{(updateMut.error as any)?.response?.data?.detail ?? 'Failed to save'}</p>
              )}
              <div className="flex gap-2">
                <button onClick={() => updateMut.mutate({ full_name: name, email })}
                  disabled={updateMut.isPending}
                  className="flex-1 py-2 rounded-xl bg-navy text-white text-sm font-bold hover:bg-navy/90 transition-colors disabled:opacity-60">
                  {updateMut.isPending ? 'Saving…' : 'Save Changes'}
                </button>
                <button onClick={() => { setEditMode(false); setName(user.full_name ?? ''); setEmail(user.email ?? ''); }}
                  className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="font-bold text-navy text-lg">{user.full_name || '—'}</h2>
              <p className="text-sm text-gray-500">{user.phone_number}</p>
              {user.email && <p className="text-sm text-gray-400">{user.email}</p>}
              {joined && <p className="text-xs text-gray-400 mt-1">Member since {joined}</p>}
              {user.profile_id && (
                <p className="text-xs font-mono font-semibold mt-1" style={{ color: '#C8973A' }}>{user.profile_id}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Session History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          onClick={() => setShowSessions(v => !v)}
          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: 'rgba(28,46,74,0.08)' }}>
            🖥️
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-navy">Session History</p>
            <p className="text-xs text-gray-400">Devices logged into your account</p>
          </div>
          <svg className={`w-4 h-4 text-gray-300 transition-transform ${showSessions ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>

        {showSessions && (
          <div className="border-t border-gray-100 px-4 py-3 space-y-2">
            {sessionsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : (sessionsData?.results ?? []).length === 0 ? (
              <p className="text-xs text-gray-400 py-2">No login history found.</p>
            ) : (
              <>
                {(sessionsData?.results ?? []).map(s => (
                  <div key={s.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <DeviceIcon type={s.device_type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-navy truncate">
                        {s.device_name || s.browser || 'Unknown device'}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {[s.os, s.city].filter(Boolean).join(' · ')} · {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => signoutAllMut.mutate()}
                  disabled={signoutAllMut.isPending}
                  className="w-full text-xs text-red-500 font-semibold border border-red-200 rounded-xl py-2 mt-2 hover:bg-red-50 transition-colors"
                >
                  {signoutAllMut.isPending ? 'Signing out…' : 'Sign Out All Devices'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Sign Out */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          onClick={() => {
            api.post('/auth/logout/', { refresh: localStorage.getItem('ns_refresh') }).finally(() => {
              ['ns_access', 'ns_refresh', 'ns_user'].forEach(k => localStorage.removeItem(k));
              window.location.href = '/auth/login';
            });
          }}
          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-red-50 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl shrink-0">🚪</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-600">Sign Out</p>
            <p className="text-xs text-gray-400">Sign out of your account</p>
          </div>
        </button>
      </div>

    </div>
  );
}

export default function VendorProfileIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <VendorAuthGuard>
        <Inner />
      </VendorAuthGuard>
    </QueryClientProvider>
  );
}
