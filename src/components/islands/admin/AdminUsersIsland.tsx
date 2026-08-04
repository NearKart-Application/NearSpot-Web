import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

interface AdminUser {
  id: string;
  phone_number: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  is_staff: boolean;
  is_suspended: boolean;
  suspension_reason: string;
  profile_id: string;
  store_name: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  customer:     'Customer',
  vendor:       'Vendor',
  admin:        'Admin',
  master_admin: 'Master Admin',
};

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

function SuspendDialog({
  user,
  onClose,
  onConfirm,
  loading,
}: {
  user: AdminUser;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState(user.suspension_reason || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card p-6 w-full max-w-sm mx-4">
        <h3 className="font-bold text-sm mb-3 text-gray-900">
          {user.is_suspended ? 'Unsuspend' : 'Suspend'} {user.full_name || user.phone_number}
        </h3>
        {!user.is_suspended && (
          <div className="mb-4">
            <label className="label">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="input"
              placeholder="Enter suspension reason…"
            />
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onConfirm(reason)}
            disabled={loading || (!user.is_suspended && !reason.trim())}
          >
            {loading ? 'Saving…' : user.is_suspended ? 'Unsuspend' : 'Suspend'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Inner() {
  const qc = useQueryClient();

  const [search,          setSearch]          = useState('');
  const [roleFilter,      setRoleFilter]      = useState('');
  const [activeFilter,    setActiveFilter]    = useState<'' | 'true' | 'false'>('');
  const [suspendedFilter, setSuspendedFilter] = useState<'' | 'true' | 'false'>('');
  const [page,            setPage]            = useState(1);
  const [pageSize,        setPageSize]        = useState<20 | 50 | 100>(20);
  const [suspendTarget,   setSuspendTarget]   = useState<AdminUser | null>(null);

  const dSearch = useDebounce(search, 400);

  useEffect(() => { setPage(1); }, [dSearch, roleFilter, activeFilter, suspendedFilter, pageSize]);

  const { data, isLoading, error, refetch } = useQuery<{ count: number; results: AdminUser[] }>({
    queryKey: ['admin-users', dSearch, roleFilter, activeFilter, suspendedFilter, page, pageSize],
    queryFn: () =>
      api.get('/admin-panel/users/', {
        params: {
          page,
          page_size: pageSize,
          ...(dSearch          && { search:       dSearch }),
          ...(roleFilter       && { role:         roleFilter }),
          ...(activeFilter     && { is_active:    activeFilter }),
          ...(suspendedFilter  && { is_suspended: suspendedFilter }),
        },
      }).then((r) => r.data),
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const toggleActive = useMutation({
    mutationFn: (id: string) => api.post(`/admin-panel/users/${id}/toggle-active/`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const suspend = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { suspend: boolean; reason: string } }) =>
      api.post(`/admin-panel/users/${id}/suspend/`, payload).then((r) => r.data),
    onSuccess: () => {
      setSuspendTarget(null);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const users      = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-4xl mb-2">⚠️</p>
        <p className="font-semibold text-gray-800">Failed to load users</p>
        <p className="text-sm text-gray-400 mt-1">
          {(error as any)?.response?.data?.detail ?? 'Check your connection'}
        </p>
        <Button onClick={() => refetch()} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {suspendTarget && (
        <SuspendDialog
          user={suspendTarget}
          onClose={() => setSuspendTarget(null)}
          onConfirm={(reason) =>
            suspend.mutate({ id: suspendTarget.id, payload: { suspend: !suspendTarget.is_suspended, reason } })
          }
          loading={suspend.isPending}
        />
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, phone or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 w-72"
            />
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-gray-400 whitespace-nowrap">Rows:</span>
            {PAGE_SIZES.map((s) => (
              <FilterButton key={s} active={pageSize === s} onClick={() => setPageSize(s)}>
                {s}
              </FilterButton>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {(['', 'customer', 'vendor', 'admin', 'master_admin'] as const).map((r) => (
              <FilterButton key={r} active={roleFilter === r} onClick={() => setRoleFilter(r)}>
                {r === '' ? 'All Roles' : ROLE_LABELS[r]}
              </FilterButton>
            ))}
          </div>

          <div className="w-px h-4 bg-gray-200" />

          <div className="flex gap-1">
            {(['', 'true', 'false'] as const).map((v) => (
              <FilterButton key={`a${v}`} active={activeFilter === v} onClick={() => setActiveFilter(v)}>
                {v === '' ? 'Any Status' : v === 'true' ? 'Active' : 'Inactive'}
              </FilterButton>
            ))}
          </div>

          <div className="w-px h-4 bg-gray-200" />

          <div className="flex gap-1">
            <FilterButton active={suspendedFilter === ''} onClick={() => setSuspendedFilter('')}>
              All
            </FilterButton>
            <FilterButton active={suspendedFilter === 'true'} onClick={() => setSuspendedFilter('true')}>
              Suspended
            </FilterButton>
          </div>

          <span className="text-sm text-gray-400 ml-auto whitespace-nowrap">
            {isLoading ? 'Loading…' : `${totalCount.toLocaleString()} users`}
          </span>
        </div>
      </div>

      {/* ── User list ── */}
      <div className={`space-y-2 transition-opacity ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
        {isLoading && users.length === 0
          ? [...Array(8)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-2xl animate-pulse" />)
          : users.map((user) => (
            <div key={user.id} className="card p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-gray-900">
                    {user.full_name || user.phone_number}
                  </span>
                  <span className={`badge ${user.is_active ? 'badge-green' : 'badge-red'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {user.is_suspended && <span className="badge badge-red">Suspended</span>}
                  <span className="badge badge-navy capitalize">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {user.phone_number}
                  {user.email       ? ` · ${user.email}`      : ''}
                  {user.store_name  ? ` · ${user.store_name}` : ''}
                  {user.profile_id  && (
                    <span className="ml-1 font-mono font-semibold" style={{ color: '#F59E0B' }}>
                      {user.profile_id}
                    </span>
                  )}
                </p>
                {user.is_suspended && user.suspension_reason && (
                  <p className="text-xs text-red-500 mt-0.5">Reason: {user.suspension_reason}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant={user.is_active ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => toggleActive.mutate(user.id)}
                  disabled={toggleActive.isPending}
                >
                  {user.is_active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  variant={user.is_suspended ? 'outline' : 'ghost'}
                  size="sm"
                  onClick={() => setSuspendTarget(user)}
                >
                  {user.is_suspended ? 'Unsuspend' : 'Suspend'}
                </Button>
              </div>
            </div>
          ))
        }
        {!isLoading && users.length === 0 && (
          <div className="card p-12 text-center text-gray-400">No users match your filters</div>
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
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | '…')[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '…' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-gray-400 text-sm">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                      page === p
                        ? 'text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                    style={page === p ? { backgroundColor: '#0F172A' } : {}}
                  >
                    {p}
                  </button>
                )
              )}

            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2">»</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminUsersIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <Inner />
      </AdminShell>
    </QueryClientProvider>
  );
}
