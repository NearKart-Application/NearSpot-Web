import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Search, RotateCcw } from 'lucide-react';

interface DeactivatedUser {
  id: string;
  phone_number: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  is_suspended: boolean;
  suspension_reason: string;
  profile_id: string;
  store_name: string | null;
  created_at: string;
}

const PAGE_SIZES = [20, 50, 100] as const;

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
        active
          ? 'text-white border-transparent'
          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
      }`}
      style={active ? { backgroundColor: '#0F172A' } : {}}
    >
      {children}
    </button>
  );
}

function RestoreDialog({
  user,
  onClose,
  onConfirm,
  loading,
  errorMsg,
}: {
  user: DeactivatedUser;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  errorMsg: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card p-6 w-full max-w-sm mx-4">
        <h3 className="font-bold text-sm mb-3 text-gray-900">Restore Account?</h3>

        {/* Account identity summary */}
        <div className="rounded-xl p-3 mb-3 space-y-1" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <p className="text-sm font-semibold text-gray-900">{user.full_name || '—'}</p>
          <p className="text-xs text-gray-500">📞 {user.phone_number}</p>
          {user.email && <p className="text-xs text-gray-400">{user.email}</p>}
          {user.store_name && <p className="text-xs text-gray-500">🏪 {user.store_name}</p>}
          {user.profile_id && (
            <p className="text-xs font-mono" style={{ color: '#F59E0B' }}>{user.profile_id}</p>
          )}
        </div>

        <p className="text-sm text-gray-500 mb-1">
          This account will be fully reactivated with all data intact.
        </p>
        {errorMsg && (
          <p className="text-xs text-red-500 mb-3 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button size="sm" onClick={onConfirm} disabled={loading}>
            {loading ? 'Restoring…' : 'Restore Account'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Inner({ role }: { role: 'vendor' | 'customer' }) {
  const qc = useQueryClient();
  const isVendor = role === 'vendor';

  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [pageSize,     setPageSize]     = useState<20 | 50 | 100>(20);
  const [restoreTarget, setRestoreTarget] = useState<DeactivatedUser | null>(null);
  const [restoreError,  setRestoreError]  = useState('');

  const dSearch = useDebounce(search, 400);
  useEffect(() => { setPage(1); }, [dSearch, pageSize]);

  const { data, isLoading, error, refetch } = useQuery<{ count: number; results: DeactivatedUser[] }>({
    queryKey: ['admin-restore', role, dSearch, page, pageSize],
    queryFn: () =>
      api.get('/admin-panel/users/', {
        params: {
          is_active: 'false',
          role,
          page,
          page_size: pageSize,
          ...(dSearch && { search: dSearch }),
        },
      }).then(r => r.data),
    staleTime: 2 * 60 * 1000,
    placeholderData: prev => prev,
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => api.post(`/admin-panel/users/${id}/toggle-active/`).then(r => r.data),
    onSuccess: () => {
      setRestoreTarget(null);
      setRestoreError('');
      // Refresh both this list and the main Users page
      qc.invalidateQueries({ queryKey: ['admin-restore'] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => {
      setRestoreError(
        err?.response?.data?.detail ??
        err?.response?.data?.message ??
        `Error ${err?.response?.status ?? ''}: Failed to restore account. Please try again.`
      );
    },
  });

  const users      = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (error) {
    const errStatus = (error as any)?.response?.status;
    const errMsg    = (error as any)?.response?.data?.detail
                   ?? (error as any)?.response?.data?.message
                   ?? (error as any)?.message
                   ?? 'Check your connection and try again';
    return (
      <div className="card p-8 text-center">
        <p className="text-4xl mb-2">⚠️</p>
        <p className="font-semibold text-gray-800">Failed to load accounts</p>
        <p className="text-sm text-gray-500 mt-1">{errMsg}</p>
        {errStatus && (
          <p className="text-xs font-mono text-gray-400 mt-1 bg-gray-50 rounded px-2 py-1 inline-block">
            HTTP {errStatus}
          </p>
        )}
        <Button onClick={() => refetch()} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {restoreTarget && (
        <RestoreDialog
          user={restoreTarget}
          onClose={() => { setRestoreTarget(null); setRestoreError(''); }}
          onConfirm={() => restoreMut.mutate(restoreTarget.id)}
          loading={restoreMut.isPending}
          errorMsg={restoreError}
        />
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder={`Search by name or phone…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-9 w-72"
            />
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-gray-400 whitespace-nowrap">Rows:</span>
            {PAGE_SIZES.map(s => (
              <FilterButton key={s} active={pageSize === s} onClick={() => setPageSize(s)}>{s}</FilterButton>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="badge badge-red text-xs">Deactivated accounts only</span>
          <span className="text-sm text-gray-400 ml-auto whitespace-nowrap">
            {isLoading ? 'Loading…' : `${totalCount.toLocaleString()} ${isVendor ? 'vendors' : 'customers'}`}
          </span>
        </div>
      </div>

      {/* ── List ── */}
      <div className={`space-y-2 transition-opacity ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
        {isLoading && users.length === 0
          ? [...Array(6)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-2xl animate-pulse" />)
          : users.map(user => {
            const isAnonymized = user.full_name === 'Deleted User' || user.phone_number?.startsWith('+00');
            const displayName  = isAnonymized ? null : (user.full_name || '—');
            const displayPhone = isAnonymized ? null : user.phone_number;

            return (
              <div
                key={user.id}
                className={`card p-4 flex items-center justify-between gap-4 flex-wrap ${isAnonymized ? 'opacity-60' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isAnonymized ? (
                      <span className="font-semibold text-sm text-gray-400 italic">Data permanently deleted</span>
                    ) : (
                      <span className="font-semibold text-sm text-gray-900">{displayName}</span>
                    )}
                    <span className="badge badge-red">Deactivated</span>
                    {isAnonymized && (
                      <span className="badge text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: '#FEF3C7', color: '#92400E' }}>
                        ⚠️ Anonymized
                      </span>
                    )}
                    {isVendor && user.store_name && (
                      <span className="badge badge-navy">🏪 {user.store_name}</span>
                    )}
                    {user.is_suspended && <span className="badge badge-red">Suspended</span>}
                  </div>

                  {isAnonymized ? (
                    <p className="text-xs text-amber-600 mt-1">
                      This account was permanently deleted — name and phone cannot be recovered.
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-0.5">
                      📞 {displayPhone}
                      {user.email ? ` · ${user.email}` : ''}
                      {user.profile_id && (
                        <span className="ml-1 font-mono font-semibold" style={{ color: '#F59E0B' }}>
                          · {user.profile_id}
                        </span>
                      )}
                    </p>
                  )}

                  <p className="text-xs text-gray-400 mt-0.5">
                    Joined {new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {user.is_suspended && user.suspension_reason && ` · Suspended: ${user.suspension_reason}`}
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() => setRestoreTarget(user)}
                  disabled={restoreMut.isPending || isAnonymized}
                  variant={isAnonymized ? 'ghost' : 'default'}
                  className="shrink-0 gap-1.5"
                  title={isAnonymized ? 'Cannot restore — user data has been permanently deleted' : 'Restore this account'}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {isAnonymized ? 'Deleted' : 'Restore'}
                </Button>
              </div>
            );
          })
        }

        {!isLoading && users.length === 0 && (
          <div className="card p-12 text-center text-gray-400">
            <p className="text-4xl mb-3">{isVendor ? '🏪' : '👤'}</p>
            <p className="font-semibold text-gray-600">
              {dSearch ? 'No results found' : `No deactivated ${isVendor ? 'vendor' : 'customer'} accounts`}
            </p>
            {dSearch
              ? <p className="text-sm mt-1">Try a different name or phone number</p>
              : (
                <div className="mt-3 text-sm text-gray-400 space-y-1">
                  <p>Accounts only appear here after being deactivated.</p>
                  <p>
                    Go to{' '}
                    <a href="/admin/users" className="text-navy underline font-medium hover:opacity-70">
                      Users
                    </a>
                    {' '}→ find a {isVendor ? 'vendor' : 'customer'} → click <strong>Deactivate</strong>.
                  </p>
                </div>
              )
            }
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages} · {((page - 1) * pageSize + 1).toLocaleString()}–{Math.min(page * pageSize, totalCount).toLocaleString()} of {totalCount.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setPage(1)} disabled={page === 1} className="px-2">«</Button>
            <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | '…')[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '…' ? (
                  <span key={`e${i}`} className="px-1 text-gray-400 text-sm">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                      page === p ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                    style={page === p ? { backgroundColor: '#0F172A' } : {}}
                  >
                    {p}
                  </button>
                )
              )}
            <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2">»</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminRestoreAccountsIsland({ role }: { role: 'vendor' | 'customer' }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <Inner role={role} />
      </AdminShell>
    </QueryClientProvider>
  );
}
