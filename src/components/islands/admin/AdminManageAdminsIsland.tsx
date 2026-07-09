import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { auth } from '../../../lib/auth';
import { AdminShell } from './AdminShell';

interface AdminUserItem {
  id: string;
  phone_number: string;
  full_name: string;
  profile_id: string;
  role: string;
  is_active: boolean;
  admin_assigned_city: string;
  created_at: string;
}

function CreateAdminForm({
  onClose,
  onSave,
  loading,
}: {
  onClose: () => void;
  onSave: (data: { phone_number: string; full_name?: string; admin_assigned_city: string }) => void;
  loading: boolean;
}) {
  const [phone, setPhone]   = useState('');
  const [name, setName]     = useState('');
  const [city, setCity]     = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card p-6 w-full max-w-sm">
        <h3 className="font-bold text-sm mb-4" style={{ color: '#1C2E4A' }}>Add Admin</h3>
        <div className="space-y-3">
          <div><label className="label">Phone Number</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="+91…" /></div>
          <div><label className="label">Full Name (optional)</label><input value={name} onChange={(e) => setName(e.target.value)} className="input" /></div>
          <div><label className="label">Assigned City</label><input value={city} onChange={(e) => setCity(e.target.value)} className="input" placeholder="e.g. Mumbai" /></div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="btn-ghost btn-sm">Cancel</button>
          <button
            onClick={() => onSave({ phone_number: phone, ...(name && { full_name: name }), admin_assigned_city: city })}
            disabled={loading || !phone || !city}
            className="btn-primary btn-sm"
          >
            {loading ? 'Adding…' : 'Add Admin'}
          </button>
        </div>
      </div>
    </div>
  );
}

function NotMasterGuard({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed]  = useState(false);

  useEffect(() => {
    const user = auth.user() as any;
    const mode = user?.ui_mode ?? user?.role;
    if (mode === 'master_admin') setAllowed(true);
    else window.location.href = '/admin/dashboard';
    setChecked(true);
  }, []);

  if (!checked) return null;
  if (!allowed) return null;
  return <>{children}</>;
}

function Inner() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<AdminUserItem | null>(null);

  const { data, isLoading, error, refetch } = useQuery<{ count: number; results: AdminUserItem[] }>({
    queryKey: ['admin-admins'],
    queryFn: () => api.get('/admin-panel/admins/').then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (payload: { phone_number: string; full_name?: string; admin_assigned_city: string }) =>
      api.post('/admin-panel/admins/', payload).then((r) => r.data),
    onSuccess: () => { setShowForm(false); qc.invalidateQueries({ queryKey: ['admin-admins'] }); },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/admin-panel/admins/${id}/`).then((r) => r.data),
    onSuccess: () => { setRevokeTarget(null); qc.invalidateQueries({ queryKey: ['admin-admins'] }); },
  });

  if (isLoading) {
    return <div className="space-y-3 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-2xl" />)}</div>;
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="font-semibold" style={{ color: '#1C2E4A' }}>Failed to load admins</p>
        <button onClick={() => refetch()} className="btn-primary mt-4">Retry</button>
      </div>
    );
  }

  const admins = data?.results ?? [];

  return (
    <div className="space-y-4">
      {showForm && (
        <CreateAdminForm
          onClose={() => setShowForm(false)}
          onSave={(payload) => create.mutate(payload)}
          loading={create.isPending}
        />
      )}

      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card p-6 w-full max-w-sm">
            <h3 className="font-bold text-sm mb-2" style={{ color: '#1C2E4A' }}>Revoke Admin Access</h3>
            <p className="text-sm text-gray-600 mb-4">
              Remove admin role from {revokeTarget.full_name || revokeTarget.phone_number}?
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRevokeTarget(null)} className="btn-ghost btn-sm">Cancel</button>
              <button
                onClick={() => revoke.mutate(revokeTarget.id)}
                disabled={revoke.isPending}
                className="btn-danger btn-sm"
              >
                {revoke.isPending ? 'Revoking…' : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="section-title mb-0">Admins ({data?.count ?? 0})</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary btn-sm">+ Add Admin</button>
      </div>

      <div className="space-y-2">
        {admins.map((admin) => (
          <div key={admin.id} className="card p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm" style={{ color: '#1C2E4A' }}>
                  {admin.full_name || admin.phone_number}
                </span>
                <span className={`badge ${admin.is_active ? 'badge-green' : 'badge-red'}`}>
                  {admin.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="badge badge-navy capitalize">{admin.role}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {admin.phone_number}{admin.admin_assigned_city ? ` · City: ${admin.admin_assigned_city}` : ''}
              </p>
              <p className="text-xs text-gray-400">Added {new Date(admin.created_at).toLocaleDateString()}</p>
            </div>
            <button onClick={() => setRevokeTarget(admin)} className="btn-danger btn-sm shrink-0">Revoke</button>
          </div>
        ))}
        {admins.length === 0 && <div className="card p-12 text-center text-gray-400">No admins</div>}
      </div>
    </div>
  );
}

export default function AdminManageAdminsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <NotMasterGuard>
          <Inner />
        </NotMasterGuard>
      </AdminShell>
    </QueryClientProvider>
  );
}
