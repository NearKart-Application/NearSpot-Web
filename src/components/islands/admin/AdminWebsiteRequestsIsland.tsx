import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';

interface WebsiteRequest {
  id: string;
  store_id: string;
  store_name: string;
  status: 'pending' | 'approved' | 'rejected';
  domain_preference: string;
  notes: string;
  admin_notes: string;
  reviewed_at: string | null;
  created_at: string;
}

const STATUS_TABS = ['', 'pending', 'approved', 'rejected'] as const;
type StatusFilter = typeof STATUS_TABS[number];

const STATUS_BADGE: Record<string, string> = { pending: 'badge-yellow', approved: 'badge-green', rejected: 'badge-red' };

function ReviewPanel({
  req,
  onClose,
  onSave,
  loading,
}: {
  req: WebsiteRequest;
  onClose: () => void;
  onSave: (status: 'approved' | 'rejected', notes: string) => void;
  loading: boolean;
}) {
  const [notes, setNotes] = useState(req.admin_notes || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card p-6 w-full max-w-md">
        <h3 className="font-bold text-sm mb-1" style={{ color: '#1C2E4A' }}>Review: {req.store_name}</h3>
        {req.domain_preference && (
          <p className="text-xs text-gray-500 mb-1">Domain preference: {req.domain_preference}</p>
        )}
        {req.notes && <p className="text-xs text-gray-500 mb-3">Notes from vendor: {req.notes}</p>}
        <div className="mb-4">
          <label className="label">Admin Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="input" placeholder="Optional notes…" />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost btn-sm">Cancel</button>
          <button onClick={() => onSave('rejected', notes)} disabled={loading} className="btn-danger btn-sm">Reject</button>
          <button onClick={() => onSave('approved', notes)} disabled={loading} className="btn-primary btn-sm">Approve</button>
        </div>
      </div>
    </div>
  );
}

function Inner() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [reviewTarget, setReviewTarget] = useState<WebsiteRequest | null>(null);

  const { data, isLoading, error, refetch } = useQuery<{ count: number; results: WebsiteRequest[] }>({
    queryKey: ['admin-website-requests', statusFilter],
    queryFn: () =>
      api.get('/admin-panel/website-requests/', { params: statusFilter ? { status: statusFilter } : {} }).then((r) => r.data),
  });

  const patch = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { status: 'approved' | 'rejected'; admin_notes?: string } }) =>
      api.patch(`/admin-panel/website-requests/${id}/`, payload).then((r) => r.data),
    onSuccess: () => { setReviewTarget(null); qc.invalidateQueries({ queryKey: ['admin-website-requests'] }); },
  });

  if (isLoading) {
    return <div className="space-y-3 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}</div>;
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="font-semibold" style={{ color: '#1C2E4A' }}>Failed to load requests</p>
        <button onClick={() => refetch()} className="btn-primary mt-4">Retry</button>
      </div>
    );
  }

  const requests = data?.results ?? [];

  return (
    <div className="space-y-4">
      {reviewTarget && (
        <ReviewPanel
          req={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSave={(status, admin_notes) => patch.mutate({ id: reviewTarget.id, payload: { status, admin_notes } })}
          loading={patch.isPending}
        />
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border capitalize transition-all ${
              statusFilter === s ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600'
            }`}
            style={statusFilter === s ? { backgroundColor: '#1C2E4A' } : {}}
          >
            {s || 'All'}
          </button>
        ))}
        <span className="text-sm text-gray-400 ml-auto">{data?.count ?? 0} requests</span>
      </div>

      <div className="space-y-3">
        {requests.map((req) => (
          <div key={req.id} className="card p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm" style={{ color: '#1C2E4A' }}>{req.store_name}</span>
                  <span className={`badge ${STATUS_BADGE[req.status] ?? 'badge-navy'} capitalize`}>{req.status}</span>
                </div>
                {req.domain_preference && (
                  <p className="text-xs text-gray-500 mt-0.5">Domain: {req.domain_preference}</p>
                )}
                {req.notes && <p className="text-xs text-gray-500 mt-0.5">Notes: {req.notes}</p>}
                {req.admin_notes && <p className="text-xs text-blue-600 mt-0.5">Admin: {req.admin_notes}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  Submitted {new Date(req.created_at).toLocaleDateString()}
                  {req.reviewed_at ? ` · Reviewed ${new Date(req.reviewed_at).toLocaleDateString()}` : ''}
                </p>
              </div>
              {req.status === 'pending' && (
                <button onClick={() => setReviewTarget(req)} className="btn-primary btn-sm shrink-0">Review</button>
              )}
            </div>
          </div>
        ))}
        {requests.length === 0 && <div className="card p-12 text-center text-gray-400">No requests</div>}
      </div>
    </div>
  );
}

export default function AdminWebsiteRequestsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <Inner />
      </AdminShell>
    </QueryClientProvider>
  );
}
