import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';
import { Button } from '@/components/ui/button';

interface StaffMember {
  id: string; name: string; phone?: string; profile_id?: string;
  role: string; created_at: string; is_active: boolean;
}

function Inner() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [phone, setPhone]     = useState('');
  const [role, setRole]       = useState('staff');
  const [error, setError]     = useState('');

  const { data, isLoading, isError, error: queryError, refetch } = useQuery({
    queryKey: ['vendor-staff'],
    queryFn: () => api.get('/stores/mine/staff/').then(r => r.data),
  });

  const addMut = useMutation({
    mutationFn: () => api.post('/stores/mine/staff/', { phone, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-staff'] });
      setShowAdd(false); setPhone(''); setError('');
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Failed to add staff member'),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api.delete(`/stores/mine/staff/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-staff'] }),
  });

  const staff: StaffMember[] = Array.isArray(data) ? data : (data?.results ?? []);

  const ROLES = ['owner', 'manager', 'staff', 'cashier'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Staff Management</h1>
          <p className="text-sm text-gray-400">{staff.length} team member{staff.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowAdd(v => !v)} size="sm" className="px-4 py-2 text-sm">
          {showAdd ? '✕ Cancel' : '+ Add Member'}
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card p-5 border-navy/20">
          <h3 className="font-bold text-navy mb-4">Add Staff Member</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Phone Number</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 …"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Role</label>
              <select value={role} onChange={e => setRole(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-navy/40">
                {ROLES.map(r => <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
          <Button onClick={() => addMut.mutate()} disabled={addMut.isPending || !phone.trim()}
            size="sm" className="px-6 py-2.5">
            {addMut.isPending ? 'Adding…' : 'Add Member'}
          </Button>
          <p className="text-xs text-gray-400 mt-2">The user must already have a NearSpot account.</p>
        </div>
      )}

      {isLoading ? (
        <div className="card overflow-hidden">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100 animate-pulse">
              <div className="w-11 h-11 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-200 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <IslandError error={queryError} refetch={refetch} />
      ) : staff.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">👤</div>
          <p className="font-semibold text-gray-600">No staff members yet</p>
          <p className="text-sm mt-1">Add team members to help manage your store</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {staff.map(s => (
            <div key={s.id} className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
              <div className="w-11 h-11 rounded-full bg-navy/10 flex items-center justify-center text-navy font-bold text-sm shrink-0">
                {(s.name ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-navy text-sm">{s.name}</p>
                  {!s.is_active && <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Inactive</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                  {s.phone && <span>{s.phone}</span>}
                  {s.created_at && <span>Since {new Date(s.created_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-bold capitalize px-2.5 py-1 rounded-full bg-navy/8 text-navy">{s.role}</span>
                {s.role !== 'owner' && (
                  <button onClick={() => { if (confirm(`Remove ${s.name} from staff?`)) removeMut.mutate(s.id); }}
                    className="text-sm text-red-500 hover:text-red-700">🗑️</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VendorStaffIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
