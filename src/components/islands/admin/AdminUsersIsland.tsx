import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';

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

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
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
        <h3 className="font-bold text-sm mb-3" style={{ color: '#1C2E4A' }}>
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
          <button onClick={onClose} className="btn-ghost btn-sm">Cancel</button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading || (!user.is_suspended && !reason.trim())}
            className="btn-danger btn-sm"
          >
            {loading ? 'Saving…' : user.is_suspended ? 'Unsuspend' : 'Suspend'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Inner() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const dSearch = useDebounce(search, 400);

  const { data, isLoading, error, refetch } = useQuery<{ count: number; results: AdminUser[] }>({
    queryKey: ['admin-users', dSearch, roleFilter],
    queryFn: () =>
      api.get('/admin-panel/users/', {
        params: {
          ...(dSearch && { search: dSearch }),
          ...(roleFilter && { role: roleFilter }),
        },
      }).then((r) => r.data),
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

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(8)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-2xl" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-4xl mb-2">⚠️</p>
        <p className="font-semibold" style={{ color: '#1C2E4A' }}>Failed to load users</p>
        <button onClick={() => refetch()} className="btn-primary mt-4">Retry</button>
      </div>
    );
  }

  const users = data?.results ?? [];

  return (
    <div className="space-y-4">
      {suspendTarget && (
        <SuspendDialog
          user={suspendTarget}
          onClose={() => setSuspendTarget(null)}
          onConfirm={(reason) =>
            suspend.mutate({
              id: suspendTarget.id,
              payload: { suspend: !suspendTarget.is_suspended, reason },
            })
          }
          loading={suspend.isPending}
        />
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input max-w-xs"
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input w-auto">
          <option value="">All Roles</option>
          <option value="customer">Customer</option>
          <option value="vendor">Vendor</option>
          <option value="admin">Admin</option>
          <option value="master_admin">Master Admin</option>
        </select>
        <span className="text-sm text-gray-400 ml-auto">{data?.count ?? 0} users</span>
      </div>

      <div className="space-y-2">
        {users.map((user) => (
          <div key={user.id} className="card p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm" style={{ color: '#1C2E4A' }}>
                  {user.full_name || user.phone_number}
                </span>
                <span className={`badge ${user.is_active ? 'badge-green' : 'badge-red'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
                {user.is_suspended && <span className="badge badge-red">Suspended</span>}
                <span className="badge badge-navy capitalize">{user.role}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {user.phone_number}{user.email ? ` · ${user.email}` : ''}{user.store_name ? ` · ${user.store_name}` : ''}
              </p>
              {user.is_suspended && user.suspension_reason && (
                <p className="text-xs text-red-500 mt-0.5">Reason: {user.suspension_reason}</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => toggleActive.mutate(user.id)}
                disabled={toggleActive.isPending}
                className={user.is_active ? 'btn-danger btn-sm' : 'btn-outline btn-sm'}
              >
                {user.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => setSuspendTarget(user)}
                className={user.is_suspended ? 'btn-outline btn-sm' : 'btn-ghost btn-sm'}
              >
                {user.is_suspended ? 'Unsuspend' : 'Suspend'}
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <div className="card p-12 text-center text-gray-400">No users found</div>
        )}
      </div>
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
