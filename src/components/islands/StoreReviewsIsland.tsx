import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomerAuthGuard } from './CustomerAuthGuard';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';
import { auth } from '../../lib/auth';

const list = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 14, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: 'easeOut' as const } } };

interface Review {
  id: string;
  user_name: string;
  rating: number;
  comment: string;
  is_verified_purchase?: boolean;
  vendor_reply?: string;
  created_at: string;
}

interface StoreInfo {
  id: string;
  name: string;
  category?: string;
  locality?: string;
  average_rating?: number | string;
  total_reviews?: number;
}

interface ReviewsResponse {
  results: Review[];
  count: number;
  average_rating?: number | string;
}

function Stars({ rating, size = 'sm', interactive = false, onChange }: {
  rating: number;
  size?: 'sm' | 'lg';
  interactive?: boolean;
  onChange?: (r: number) => void;
}) {
  const sz = size === 'lg' ? 'text-2xl' : 'text-sm';
  return (
    <div className={`flex gap-0.5 ${sz}`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          className={interactive ? 'cursor-pointer select-none' : ''}
          onClick={() => interactive && onChange?.(n)}
        >
          {n <= rating ? '⭐' : '☆'}
        </span>
      ))}
    </div>
  );
}

function RatingBreakdown({ reviews }: { reviews: Review[] }) {
  const counts = [5, 4, 3, 2, 1].map(r => ({
    star: r,
    count: reviews.filter(v => v.rating === r).length,
    pct: reviews.length ? Math.round((reviews.filter(v => v.rating === r).length / reviews.length) * 100) : 0,
  }));
  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0';
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex gap-5 items-center">
      <div className="text-center">
        <p className="text-4xl font-black text-navy">{avg}</p>
        <Stars rating={Math.round(parseFloat(avg))} size="sm" />
        <p className="text-xs text-gray-400 mt-1">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex-1 space-y-1.5">
        {counts.map(c => (
          <div key={c.star} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-4">{c.star}★</span>
            <div className="flex-1 bg-gray-100 rounded-full h-2">
              <div className="bg-amber-400 h-2 rounded-full transition-all" style={{ width: `${c.pct}%` }} />
            </div>
            <span className="text-xs text-gray-400 w-6 text-right">{c.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WriteReviewModal({ storeId, onClose, onSuccess }: { storeId: string; onClose: () => void; onSuccess: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () => api.post(`/stores/${storeId}/reviews/`, { rating, comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store-reviews', storeId] });
      onSuccess();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl">
        <h3 className="text-lg font-bold text-navy mb-4">Write a Review</h3>
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Your rating</p>
          <Stars rating={rating} size="lg" interactive onChange={setRating} />
        </div>
        <textarea
          value={comment} onChange={e => setComment(e.target.value)}
          placeholder="Share your experience…" rows={4}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-navy/20 mb-4"
        />
        {mut.isError && <p className="text-sm text-red-500 mb-3 text-center">Failed to submit. Please try again.</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
          <button
            onClick={() => mut.mutate()} disabled={mut.isPending || !comment.trim()}
            className="flex-1 py-3 rounded-xl bg-navy text-white text-sm font-bold disabled:opacity-50"
          >
            {mut.isPending ? 'Posting…' : 'Post Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const initials = review.user_name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) ?? '?';
  return (
    <motion.div variants={item} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center text-xs font-black text-navy flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-navy truncate">{review.user_name}</p>
            {review.is_verified_purchase && (
              <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex-shrink-0">✓ Verified</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Stars rating={review.rating} size="sm" />
            <span className="text-xs text-gray-400">{new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </div>
      {review.comment && <p className="text-sm text-gray-700 mt-3 leading-relaxed">{review.comment}</p>}
      {review.vendor_reply && (
        <div className="mt-3 ml-4 bg-navy/5 border-l-2 border-navy/20 rounded-r-xl px-3 py-2">
          <p className="text-xs font-semibold text-navy mb-0.5">Store reply</p>
          <p className="text-xs text-gray-600">{review.vendor_reply}</p>
        </div>
      )}
    </motion.div>
  );
}

function Inner() {
  const storeId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('store') ?? '' : '';
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [written, setWritten] = useState(false);

  const storeQ = useQuery<StoreInfo>({
    queryKey: ['store-info', storeId],
    queryFn: () => api.get(`/stores/${storeId}/`).then(r => r.data),
    enabled: !!storeId,
  });

  const reviewsQ = useQuery<ReviewsResponse>({
    queryKey: ['store-reviews', storeId],
    queryFn: () => api.get(`/stores/${storeId}/reviews/`).then(r => r.data),
    enabled: !!storeId,
  });

  if (!storeId) {
    return (
      <div className="text-center py-24 px-4">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-navy font-bold text-lg">No store specified</h2>
        <p className="text-gray-400 text-sm mt-1">Please navigate from a store page to view reviews</p>
      </div>
    );
  }

  const allReviews: Review[] = reviewsQ.data?.results ?? [];
  const reviews = ratingFilter ? allReviews.filter(r => r.rating === ratingFilter) : allReviews;
  const store = storeQ.data;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <button onClick={() => window.history.back()} className="mt-0.5 p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black text-navy">
            {storeQ.isLoading ? <span className="inline-block h-6 w-48 bg-gray-100 rounded animate-pulse" /> : (store?.name ?? 'Store Reviews')}
          </h1>
          {store?.locality && <p className="text-xs text-gray-400 mt-0.5">📍 {store.locality}</p>}
        </div>
        {!written && (
          <button
            onClick={() => setShowWriteModal(true)}
            className="flex-shrink-0 px-4 py-2 bg-navy text-white rounded-xl text-sm font-bold"
          >
            + Review
          </button>
        )}
      </div>

      {/* Rating breakdown */}
      {reviewsQ.isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse mb-4">
          <div className="h-16 bg-gray-100 rounded-xl" />
        </div>
      ) : allReviews.length > 0 ? (
        <div className="mb-4">
          <RatingBreakdown reviews={allReviews} />
        </div>
      ) : null}

      {/* Rating filter */}
      {allReviews.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <button
            onClick={() => setRatingFilter(null)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              !ratingFilter ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            All ({allReviews.length})
          </button>
          {[5, 4, 3, 2, 1].map(r => {
            const cnt = allReviews.filter(v => v.rating === r).length;
            if (!cnt) return null;
            return (
              <button
                key={r}
                onClick={() => setRatingFilter(ratingFilter === r ? null : r)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                  ratingFilter === r ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {r}★ ({cnt})
              </button>
            );
          })}
        </div>
      )}

      {/* Success banner */}
      <AnimatePresence>
        {written && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-green-50 border border-green-200 rounded-xl p-3 text-center text-sm text-green-700 font-semibold mb-4"
          >
            ✅ Review submitted! Thank you for your feedback.
          </motion.div>
        )}
      </AnimatePresence>

      {reviewsQ.isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!reviewsQ.isLoading && reviews.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">💬</div>
          <h3 className="font-bold text-navy text-lg">
            {ratingFilter ? `No ${ratingFilter}-star reviews` : 'No reviews yet'}
          </h3>
          <p className="text-gray-400 text-sm mt-1">
            {ratingFilter ? 'Try a different rating filter' : 'Be the first to review this store!'}
          </p>
          {!ratingFilter && !written && (
            <button onClick={() => setShowWriteModal(true)} className="mt-5 px-8 py-3 bg-navy text-white rounded-2xl text-sm font-bold">
              Write a Review
            </button>
          )}
        </div>
      )}

      {!reviewsQ.isLoading && reviews.length > 0 && (
        <motion.div className="space-y-3" variants={list} initial="hidden" animate="show">
          {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
        </motion.div>
      )}

      <AnimatePresence>
        {showWriteModal && (
          <WriteReviewModal
            storeId={storeId}
            onClose={() => setShowWriteModal(false)}
            onSuccess={() => { setShowWriteModal(false); setWritten(true); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function StoreReviewsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomerAuthGuard>
        <Inner />
      </CustomerAuthGuard>
    </QueryClientProvider>
  );
}
