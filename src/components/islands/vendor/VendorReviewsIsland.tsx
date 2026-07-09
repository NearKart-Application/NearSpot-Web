import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

interface Review {
  id: string; user_name: string; rating: number; comment: string;
  is_verified: boolean; vendor_reply?: string; created_at: string;
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} className={`w-3.5 h-3.5 ${i <= value ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
      ))}
    </span>
  );
}

function ReviewRow({ review, storeId }: { review: Review; storeId: string }) {
  const qc = useQueryClient();
  const [reply, setReply] = useState(review.vendor_reply ?? '');
  const [editing, setEditing] = useState(false);

  const replyMut = useMutation({
    mutationFn: (text: string) => api.post(`/stores/${storeId}/reviews/${review.id}/reply/`, { reply: text }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor-reviews'] }); setEditing(false); },
  });

  return (
    <div className="bg-white border-b border-gray-100 last:border-0 p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-navy text-sm">{review.user_name}</span>
            {review.is_verified && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">✓ Verified</span>}
          </div>
          <Stars value={review.rating} />
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
        </span>
      </div>
      {review.comment && <p className="text-sm text-gray-600">{review.comment}</p>}

      {/* Vendor reply */}
      {review.vendor_reply && !editing ? (
        <div className="mt-3 pl-3 border-l-2 border-navy bg-navy/5 rounded-r-xl py-2 pr-3">
          <p className="text-[10px] font-bold text-navy mb-1">Your reply</p>
          <p className="text-xs text-gray-600">{review.vendor_reply}</p>
          <button onClick={() => { setEditing(true); setReply(review.vendor_reply ?? ''); }}
            className="text-[10px] text-navy font-bold mt-1 hover:underline">Edit</button>
        </div>
      ) : editing || !review.vendor_reply ? (
        <div className="mt-3">
          {!editing && !review.vendor_reply && (
            <button onClick={() => setEditing(true)} className="text-xs text-navy font-bold hover:underline">+ Reply to this review</button>
          )}
          {editing && (
            <div className="space-y-2">
              <textarea value={reply} onChange={e => setReply(e.target.value)}
                placeholder="Write a professional reply…" rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10" />
              <div className="flex gap-2">
                <button onClick={() => replyMut.mutate(reply)} disabled={replyMut.isPending || !reply.trim() || !storeId}
                  className="btn-primary btn-sm px-4 py-1.5">{replyMut.isPending ? 'Saving…' : 'Post Reply'}</button>
                <button onClick={() => { setEditing(false); setReply(review.vendor_reply ?? ''); }}
                  className="btn-ghost btn-sm px-4 py-1.5">Cancel</button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Inner() {
  const [filter, setFilter] = useState<'all' | 'unreplied'>('all');
  const [starFilter, setStarFilter] = useState(0);

  const { data: storeData } = useQuery({
    queryKey: ['vendor-store-id'],
    queryFn: () => api.get('/stores/mine/').then(r => r.data),
  });
  const storeId: string = (storeData as any)?.id ?? '';

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-reviews'],
    queryFn: () => api.get('/stores/mine/reviews/').then(r => r.data),
  });

  const reviews: Review[] = data?.results ?? (Array.isArray(data) ? data : []);
  const unreplied = reviews.filter(r => !r.vendor_reply);
  const avgRating = reviews.length ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1) : '—';
  let shown = filter === 'unreplied' ? unreplied : reviews;
  if (starFilter > 0) shown = shown.filter(r => r.rating === starFilter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Reviews</h1>
        <p className="text-sm text-gray-400">{reviews.length} reviews · avg {avgRating} ★ · {unreplied.length} unreplied</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Reviews', value: reviews.length, icon: '⭐' },
          { label: 'Avg Rating', value: avgRating, icon: '📊' },
          { label: 'Unreplied', value: unreplied.length, icon: '💬' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <p className="text-xl font-bold text-navy">{s.value}</p>
            <p className="text-xs text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Rating distribution */}
      {reviews.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-bold text-navy mb-3">Rating Breakdown</h3>
          {[5,4,3,2,1].map(star => {
            const count = reviews.filter(r => r.rating === star).length;
            const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
            return (
              <div key={star} className="flex items-center gap-3 mb-2">
                <span className="text-xs w-3 text-gray-600">{star}</span>
                <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                </svg>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-amber-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-gray-500 w-8">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters row */}
      <div className="flex flex-wrap gap-2">
        {[['all', 'All Reviews'], ['unreplied', 'Unreplied']].map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f as any)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === f ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {label} {f === 'unreplied' && unreplied.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unreplied.length}</span>}
          </button>
        ))}
        <div className="flex gap-1.5 ml-auto">
          {[0,5,4,3,2,1].map(star => (
            <button key={star} onClick={() => setStarFilter(starFilter === star ? 0 : star)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${starFilter === star && star > 0 ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-amber-50'}`}>
              {star === 0 ? 'All ★' : `★${star}`}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="card overflow-hidden">
          {[...Array(3)].map((_, i) => <div key={i} className="p-5 border-b border-gray-100 animate-pulse h-20" />)}
        </div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : shown.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">⭐</div>
          <p className="font-semibold text-gray-600">{filter === 'unreplied' ? 'All reviews replied!' : 'No reviews yet'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {shown.map(r => <ReviewRow key={r.id} review={r} storeId={storeId} />)}
        </div>
      )}
    </div>
  );
}

export default function VendorReviewsIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
