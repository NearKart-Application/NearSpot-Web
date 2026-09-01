import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';
import { Button } from '@/components/ui/button';

interface FlaggedReview {
  id: string;
  store_name: string;
  author_name: string;
  rating: number;
  comment: string;
  flag_reason: string;
  created_at: string;
}

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

  const { data, isLoading, isError, refetch } = useQuery<{ count: number; results: FlaggedReview[] }>({
    queryKey: ['admin-flagged-reviews', page],
    queryFn: () =>
      api.get('/admin-panel/moderation/reviews/', { params: { page } }).then((r) => r.data),
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

  const reviews    = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / 20));

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
        <p className="font-semibold text-gray-800">Failed to load flagged reviews</p>
        <Button onClick={() => refetch()} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Content Moderation</h1>
          <p className="text-sm text-gray-400">
            {isLoading ? 'Loading…' : `${totalCount.toLocaleString()} flagged review${totalCount !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">✅</div>
          <p className="font-semibold">No flagged reviews</p>
          <p className="text-sm mt-1">All clear — nothing needs moderation right now.</p>
        </div>
      ) : (
        <div className={`space-y-3 transition-opacity ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
          {reviews.map((review) => (
            <div key={review.id} className="card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm text-gray-900">{review.author_name}</span>
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
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => approveMut.mutate(review.id)}
                    disabled={approveMut.isPending || deleteMut.isPending}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteMut.mutate(review.id)}
                    disabled={approveMut.isPending || deleteMut.isPending}
                  >
                    Delete
                  </Button>
                </div>
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
