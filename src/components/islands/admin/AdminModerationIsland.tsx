import { useEffect, useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';
import { Button } from '@/components/ui/button';

interface FlaggedReview {
  id: string;
  store_name: string;
  user_phone: string;
  rating: number;
  comment: string;
  flag_reason: string;
  is_flagged: boolean;
  created_at: string;
  // Only present on the Deleted tab (backup rows)
  deleted_at?: string;
  deleted_by_name?: string;
}

type ModTab = 'flagged' | 'all' | 'deleted';

const TAB_LABEL: Record<ModTab, string> = { flagged: 'Flagged', all: 'All reviews', deleted: 'Deleted' };

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400 text-xs">
      {'★'.repeat(Math.max(0, Math.min(5, rating)))}{'☆'.repeat(5 - Math.max(0, Math.min(5, rating)))}
    </span>
  );
}

function Inner() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [tab, setTab]   = useState<ModTab>('flagged');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');

  // Debounce typing so the API is called once the admin pauses, not on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError, refetch } = useQuery<{ count: number; results: FlaggedReview[] }>({
    queryKey: ['admin-flagged-reviews', tab, page, search],
    queryFn: () =>
      api.get('/admin-panel/moderation/reviews/', {
        params: {
          page,
          ...(tab !== 'flagged' ? { status: tab } : {}),
          ...(search ? { search } : {}),
        },
      }).then((r) => r.data),
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/admin-panel/moderation/reviews/${id}/`, { action: 'approve' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-flagged-reviews'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/admin-panel/moderation/reviews/${id}/`, { action: 'delete' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-flagged-reviews'] }),
  });

  const flagMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/admin-panel/reviews/${id}/flag/`, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-flagged-reviews'] }),
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/admin-panel/moderation/reviews/${id}/`, { action: 'restore' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-flagged-reviews'] }),
    onError: (err: any) =>
      window.alert(err?.response?.data?.message ?? 'Could not restore this review.'),
  });

  const busy = approveMut.isPending || deleteMut.isPending || flagMut.isPending || restoreMut.isPending;

  function switchTab(t: ModTab) {
    setTab(t);
    setPage(1);
  }

  function handleFlag(id: string) {
    const reason = window.prompt('Reason for flagging this review:', 'Flagged by admin');
    if (reason === null) return;
    flagMut.mutate({ id, reason: reason.trim() || 'Flagged by admin' });
  }

  function handleDelete(id: string) {
    if (!window.confirm('Delete this review? Customers will no longer see it. A backup is kept under the Deleted tab and it can be restored.')) return;
    deleteMut.mutate(id);
  }

  const reviews    = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / 30));

  if (isLoading && reviews.length === 0) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="card p-5 h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card p-8 text-center">
        <p className="text-4xl mb-2">⚠️</p>
        <p className="font-semibold text-gray-800">Failed to load reviews</p>
        <Button onClick={() => refetch()} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">Content Moderation</h1>
          <p className="text-sm text-gray-400">
            {isLoading
              ? 'Loading…'
              : `${totalCount.toLocaleString()} ${tab === 'all' ? '' : `${tab} `}review${totalCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
          {(['flagged', 'all', 'deleted'] as ModTab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === t ? 'text-white' : 'text-gray-500'
              }`}
              style={tab === t ? { backgroundColor: '#1C2E4A' } : {}}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <input
        type="search"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search by store name or review text…"
        className="input w-full sm:max-w-sm"
      />

      {reviews.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">✅</div>
          <p className="font-semibold">
            {search
              ? 'No reviews match your search'
              : tab === 'flagged' ? 'No flagged reviews' : tab === 'deleted' ? 'No deleted reviews' : 'No reviews yet'}
          </p>
          <p className="text-sm mt-1">
            {search
              ? 'Try a different store name or word.'
              : tab === 'flagged'
              ? 'All clear — nothing needs moderation right now.'
              : tab === 'deleted'
                ? 'Reviews you delete here are backed up in this tab and can be restored.'
                : 'Store reviews will appear here once customers post them.'}
          </p>
        </div>
      ) : (
        <div className={`space-y-3 transition-opacity ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
          {reviews.map((review) => (
            <div key={review.id} className="card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm text-gray-900">{review.user_phone}</span>
                    <Stars rating={review.rating} />
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500">{review.store_name}</span>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-3">{review.comment}</p>
                  {review.flag_reason && (
                    <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                      <span>🚩</span>
                      <span>{review.flag_reason}</span>
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {tab === 'deleted' && review.deleted_at && (
                    <p className="text-xs text-gray-500 mt-1">
                      🗑 Deleted {new Date(review.deleted_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {review.deleted_by_name ? ` by ${review.deleted_by_name}` : ''}
                    </p>
                  )}
                </div>
                {tab === 'deleted' ? (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restoreMut.mutate(review.id)}
                      disabled={busy}
                    >
                      Restore
                    </Button>
                  </div>
                ) : tab === 'flagged' ? (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => approveMut.mutate(review.id)}
                      disabled={busy}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(review.id)}
                      disabled={busy}
                    >
                      Delete
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2 shrink-0 items-center">
                    {review.is_flagged ? (
                      <>
                        <span className="text-xs font-semibold text-red-500 bg-red-50 rounded-lg px-2 py-1">🚩 Flagged</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => approveMut.mutate(review.id)}
                          disabled={busy}
                        >
                          Unflag
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFlag(review.id)}
                        disabled={busy}
                      >
                        Flag
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(review.id)}
                      disabled={busy}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Prev
          </Button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AdminModerationIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <Inner />
      </AdminShell>
    </QueryClientProvider>
  );
}
