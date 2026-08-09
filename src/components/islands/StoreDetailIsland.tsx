import { useState, useRef } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';
import Img from '../ui/Img';
import { Button } from '@/components/ui/button';

interface StoreDetail {
  id: string; name: string; avatar?: string; cover_image?: string;
  category: string; location: string; distance_km?: number;
  is_open: boolean; open_status_label?: string; todays_hours?: string;
  closes_at?: string; next_open?: string;
  rating: number; review_count: number; follower_count: number; is_followed: boolean;
  is_verified?: boolean; holiday_mode?: boolean;
  active_offer_labels?: string[]; top_offer_label?: string;
  description?: string; phone?: string; address?: string;
  store_type?: string;
}
interface Product {
  id: string; name: string;
  price?: number; base_price?: string;
  sale_price?: number; primary_image?: string; image?: string;
  is_on_sale?: boolean; festival_tag?: string; stock_count?: number;
  category?: string;
}
interface Review {
  id: string; user_name: string; rating: number; comment: string;
  is_verified: boolean; vendor_reply?: string; created_at: string;
}

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[...Array(max)].map((_, i) => (
        <svg key={i} className={`w-3.5 h-3.5 ${i < Math.round(value) ? 'text-gold' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
      ))}
    </span>
  );
}

function ProductCard({ product }: { product: Product }) {
  const img   = product.primary_image ?? product.image;
  const orig  = typeof product.price === 'number' ? product.price : parseFloat(product.base_price ?? '0');
  const price = product.sale_price ?? orig;
  const hasOff = product.is_on_sale && product.sale_price != null && product.sale_price < orig;
  const disc  = hasOff ? Math.round((1 - product.sale_price! / orig) * 100) : 0;

  return (
    <a href={`/products/${product.id}`} className="block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-card-hover transition-shadow">
      <div className="relative h-36 bg-gray-100">
        <Img src={img} alt={product.name} fallback="product" loading="lazy"
          className="w-full h-full object-cover" />
        {hasOff && <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded">{disc}% OFF</span>}
        {product.festival_tag && <span className="absolute bottom-2 left-2 bg-gold text-navy text-[10px] font-bold px-1.5 py-0.5 rounded">{product.festival_tag}</span>}
        {product.stock_count === 0 && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-xs font-bold bg-black/60 px-2 py-1 rounded">Out of Stock</span>
          </div>
        )}
      </div>
      <div className="p-2.5">
        <h4 className="text-xs font-bold text-navy line-clamp-2 leading-tight">{product.name}</h4>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-sm font-black text-navy">₹{price.toLocaleString()}</span>
          {hasOff && <span className="text-[10px] text-gray-400 line-through">₹{orig.toLocaleString()}</span>}
        </div>
      </div>
    </a>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-semibold text-navy">{review.user_name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <StarRating value={review.rating} />
            {review.is_verified && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">✓ Verified</span>}
          </div>
        </div>
        <span className="text-[10px] text-gray-400 shrink-0">{new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
      </div>
      {review.comment && <p className="text-sm text-gray-600">{review.comment}</p>}
      {review.vendor_reply && (
        <div className="mt-2.5 pl-3 border-l-2 border-navy">
          <p className="text-[10px] font-bold text-navy mb-0.5">Owner's reply</p>
          <p className="text-xs text-gray-500">{review.vendor_reply}</p>
        </div>
      )}
    </div>
  );
}

function WriteReviewModal({ storeId, storeName, onClose, onSuccess }: {
  storeId: string; storeName: string; onClose: () => void; onSuccess: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover]   = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (rating === 0) { setError('Please select a rating.'); return; }
    setSubmitting(true); setError('');
    try {
      await api.post(`/stores/${storeId}/reviews/`, { rating, comment });
      onSuccess();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to submit. Please try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-extrabold text-navy">Write a Review</h3>
            <p className="text-xs text-gray-400 mt-0.5">{storeName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">✕</button>
        </div>
        {/* Star picker */}
        <div className="flex gap-2 mb-4 justify-center">
          {[1,2,3,4,5].map(n => (
            <button key={n} onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
              className={`text-3xl transition-transform hover:scale-110 ${n <= (hover || rating) ? 'text-amber-400' : 'text-gray-200'}`}>★</button>
          ))}
        </div>
        <div className="text-center text-sm font-semibold text-gray-500 mb-4">
          {rating === 1 ? 'Poor' : rating === 2 ? 'Fair' : rating === 3 ? 'Good' : rating === 4 ? 'Very Good' : rating === 5 ? 'Excellent' : 'Tap a star to rate'}
        </div>
        <textarea value={comment} onChange={e => setComment(e.target.value)}
          placeholder="Share your experience (optional)…"
          rows={4}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10 resize-none mb-4" />
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
        <button onClick={submit} disabled={submitting}
          className="w-full py-3.5 rounded-xl bg-navy text-white font-bold text-sm hover:bg-navy/90 active:scale-95 transition-all disabled:opacity-60">
          {submitting ? 'Submitting…' : 'Submit Review'}
        </button>
      </div>
    </div>
  );
}

function Inner({ storeId, initialStore }: { storeId: string; initialStore: StoreDetail | null }) {
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [followLoading, setFollowLoading]     = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewDone, setReviewDone]           = useState(false);
  const [showAllReviews, setShowAllReviews]   = useState(false);

  const { data: store, isLoading: storeLoading, isError: storeError } = useQuery<StoreDetail>({
    queryKey: ['store', storeId],
    queryFn:  () => api.get(`/stores/${storeId}/`).then(r => r.data),
    initialData: initialStore ?? undefined,
    staleTime: 30_000,
  });

  // All hooks must run before any conditional return (React rules of hooks)
  const { data: productsData, isLoading: prodsLoading } = useQuery({
    queryKey: ['store-products', storeId, activeCategory],
    queryFn: () => {
      const saved = (() => { try { const r = localStorage.getItem('ns_coords'); return r ? JSON.parse(r) : null; } catch { return null; } })();
      const coords = saved ?? { lat: 17.385, lng: 78.4867 };
      return api.get('/products/nearby/', {
        params: { store: storeId, lat: coords.lat, lng: coords.lng, radius: 50, status: 'active', ...(activeCategory ? { category: activeCategory } : {}) }
      }).then(r => r.data);
    },
    enabled: !!store,
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['store-reviews', storeId],
    queryFn: () => api.get(`/stores/${storeId}/reviews/`).then(r => r.data),
    enabled: !!store,
  });

  const { data: similarData } = useQuery({
    queryKey: ['store-similar', storeId],
    queryFn: () => api.get(`/stores/${storeId}/similar/`).then(r => r.data),
    enabled: !!store,
  });

  if (storeError) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-lg font-bold text-navy mb-2">Could not load store</h2>
        <p className="text-sm text-gray-500 mb-4">The store may not exist or there was a network error.</p>
        <Button onClick={() => history.back()} className="px-6">Go Back</Button>
      </div>
    </div>
  );

  if (storeLoading || !store) return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      <div className="h-64 bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-6 bg-gray-200 rounded w-2/3" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  );

  const products: Product[] = productsData?.results ?? (Array.isArray(productsData) ? productsData : []);
  const reviews: Review[]   = reviewsData?.results ?? (Array.isArray(reviewsData) ? reviewsData : []);
  const similar: any[]      = similarData?.results ?? (Array.isArray(similarData) ? similarData : []);

  // Unique categories from products
  const cats = [...new Set(products.map(p => p.category).filter((c): c is string => !!c))];

  const isFollowed = store.is_followed;

  async function toggleFollow() {
    const token = localStorage.getItem('ns_access');
    if (!token) { window.location.href = '/auth/login'; return; }
    setFollowLoading(true);
    try {
      await api.post(`/stores/${storeId}/follow/`);
      qc.setQueryData(['store', storeId], (old: any) => old ? { ...old, is_followed: !isFollowed, follower_count: isFollowed ? old.follower_count - 1 : old.follower_count + 1 } : old);
    } finally { setFollowLoading(false); }
  }

  const dist = store.distance_km;
  const distText = dist == null ? '' : dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)} km`;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-6">
      {/* Cover image */}
      <div className="relative h-48 sm:h-64 bg-navy overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-navy to-navy/80" />
        {store.cover_image && (
          <Img src={store.cover_image} alt={store.name} fallback="banner"
            className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Back button */}
        <button onClick={() => history.back()} className="absolute top-4 left-4 w-9 h-9 bg-black/40 rounded-full flex items-center justify-center text-white backdrop-blur-sm hover:bg-black/60">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>

        {/* Store avatar + info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end gap-3">
          <div className="w-16 h-16 rounded-2xl border-2 border-white bg-white overflow-hidden shadow-lg shrink-0 mb-1">
            <Img src={store.avatar} alt={store.name} fallback="store"
              className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-white font-extrabold text-lg leading-tight">{store.name}</h1>
              {store.is_verified && <span className="text-[10px] font-bold text-blue-200 bg-blue-500/30 px-1.5 py-0.5 rounded">✓</span>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white/80 text-xs capitalize">{store.category} · {store.location}</p>
              {store.store_type && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                  {store.store_type === 'service' ? '🛠 Service' : store.store_type === 'home' ? '🏠 Home Biz' : '🛍 Products'}
                </span>
              )}
            </div>
          </div>
          <span className={`shrink-0 text-xs font-black px-2.5 py-1 rounded-full mb-1 shadow-sm ${store.is_open ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
            {store.is_open ? 'OPEN' : 'CLOSED'}
          </span>
        </div>
      </div>

      {/* Info + action row */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          {store.rating > 0 && (
            <div className="flex items-center gap-1.5">
              <StarRating value={store.rating} />
              <span className="text-sm font-bold text-navy">{parseFloat(String(store.rating ?? '0')).toFixed(1)}</span>
              <span className="text-xs text-gray-400">({store.review_count})</span>
            </div>
          )}
          {distText && <span className="text-sm text-gray-600 font-medium">📍 {distText} away</span>}
          {store.follower_count > 0 && <span className="text-sm text-gray-600">👥 {store.follower_count} followers</span>}
          {store.open_status_label && <span className="text-xs text-gray-500">🕐 {store.open_status_label}</span>}
        </div>

        {store.holiday_mode && (
          <div className="mt-2 bg-orange-50 rounded-lg px-3 py-1.5 text-sm font-semibold text-orange-700">🌴 Store is on holiday</div>
        )}

        <div className="flex gap-2 mt-3">
          <button onClick={toggleFollow} disabled={followLoading}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
              isFollowed ? 'bg-navy/10 text-navy border border-navy' : 'bg-navy text-white'
            }`}>
            {followLoading ? '…' : isFollowed ? '✓ Following' : '+ Follow'}
          </button>
          <a href={`/customer/chat?store=${storeId}`}
             className="flex-1 py-2 rounded-xl text-sm font-bold border border-gray-200 text-gray-700 text-center hover:border-navy hover:text-navy transition-colors">
            💬 Chat
          </a>
          {store.location && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(store.name + ' ' + store.location)}`}
               target="_blank" rel="noopener"
               className="py-2 px-3 rounded-xl text-sm font-bold border border-gray-200 text-gray-700 hover:border-navy hover:text-navy transition-colors">
              🗺️
            </a>
          )}
        </div>
      </div>

      {/* Description */}
      {store.description && (
        <div className="mx-4 mt-4">
          <p className="text-sm text-gray-600 leading-relaxed">{store.description}</p>
        </div>
      )}

      {/* Offers */}
      {(store.active_offer_labels ?? []).length > 0 && (
        <div className="mx-4 mt-4 space-y-2">
          {(store.active_offer_labels ?? []).map((offer, i) => (
            <div key={i} className="bg-gold/15 border border-gold/30 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <span className="text-lg">🎉</span>
              <span className="text-sm font-semibold text-amber-800">{offer}</span>
            </div>
          ))}
        </div>
      )}

      {/* Products section */}
      <div className="mt-4">
        <div className="flex items-center justify-between px-4 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-0.5 h-4 bg-gold rounded-full" />
            <h2 className="text-sm font-bold text-navy">Products</h2>
          </div>
        </div>

        {/* Category filter */}
        {cats.length > 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-3">
            <button onClick={() => setActiveCategory(null)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${!activeCategory ? 'bg-navy text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
              All
            </button>
            {cats.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${activeCategory === cat ? 'bg-navy text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                {cat}
              </button>
            ))}
          </div>
        )}

        {prodsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-52 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <div className="text-4xl mb-2">📦</div>
            <p className="text-sm">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 px-4">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>

      {/* Reviews */}
      <div className="mt-6 px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-0.5 h-4 bg-gold rounded-full" />
            <h2 className="text-sm font-bold text-navy">Reviews {store.review_count > 0 ? `(${store.review_count})` : ''}</h2>
          </div>
          {typeof window !== 'undefined' && !!localStorage.getItem('ns_access') && !reviewDone && (
            <button onClick={() => setShowReviewModal(true)}
              className="text-[11px] font-black text-navy bg-gold/20 hover:bg-gold/40 px-3 py-1 rounded-full transition-colors">
              ✏️ Write Review
            </button>
          )}
        </div>
        {reviewDone && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-3 text-sm text-green-700 font-semibold">
            ✅ Review submitted! Thank you.
          </div>
        )}
        {reviews.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-3xl mb-2">💬</div>
            <p className="text-sm">No reviews yet. Be the first!</p>
            {typeof window !== 'undefined' && !localStorage.getItem('ns_access') && (
              <a href="/auth/login" className="mt-3 inline-block text-navy text-sm font-bold underline">Login to review</a>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {(showAllReviews ? reviews : reviews.slice(0, 3)).map(r => <ReviewCard key={r.id} review={r} />)}
            {reviews.length > 3 && !showAllReviews && (
              <div className="flex gap-2">
                <button onClick={() => setShowAllReviews(true)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:border-navy hover:text-navy transition-colors">
                  Show all {reviews.length} reviews
                </button>
                <a href={`/customer/store-reviews?store=${storeId}`}
                  className="flex-shrink-0 py-2.5 px-4 rounded-xl bg-navy/5 text-navy text-sm font-semibold hover:bg-navy/10 transition-colors">
                  Full page ↗
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {showReviewModal && (
        <WriteReviewModal
          storeId={storeId}
          storeName={store.name}
          onClose={() => setShowReviewModal(false)}
          onSuccess={() => {
            setShowReviewModal(false);
            setReviewDone(true);
            qc.invalidateQueries({ queryKey: ['store-reviews', storeId] });
            qc.invalidateQueries({ queryKey: ['store', storeId] });
          }}
        />
      )}

      {/* Similar stores */}
      {similar.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 px-4 mb-3">
            <div className="w-0.5 h-4 bg-gold rounded-full" />
            <h2 className="text-sm font-bold text-navy">Similar Stores</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-4">
            {similar.map((s: any) => (
              <a key={s.id} href={`/stores/${s.id}`}
                 className="w-36 shrink-0 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-card-hover transition-shadow overflow-hidden">
                <div className="h-20 bg-gray-100 relative overflow-hidden">
                  <Img src={s.avatar} alt={s.name} fallback="store"
                    className="w-full h-full object-cover" />
                  <div className="absolute top-1.5 right-1.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.is_open ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                      {s.is_open ? 'OPEN' : 'CLOSED'}
                    </span>
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs font-bold text-navy truncate">{s.name}</p>
                  <p className="text-[10px] text-gray-400 capitalize">{s.category}</p>
                  {s.rating > 0 && <p className="text-[10px] text-gray-600 mt-0.5">⭐ {parseFloat(String(s.rating ?? '0')).toFixed(1)}</p>}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StoreDetailIsland({ storeId, initialStore }: { storeId: string; initialStore: any }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Inner storeId={storeId} initialStore={initialStore} />
    </QueryClientProvider>
  );
}
