import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';
import Img from '../ui/Img';

interface SizeOption  { size: string; stock: number; variant_id?: string; }
interface ProductDetail {
  id: string; name: string; description?: string;
  category: string; subcategory?: string;
  price: number; sale_price?: number;
  images: string[];
  store: { id: string; name: string; avatar?: string; rating: number; review_count: number; is_verified?: boolean; };
  distance_km?: number;
  sizes: SizeOption[]; colors: string[];
  stock_count: number;
  is_on_sale: boolean; festival_tag?: string;
  is_wishlisted: boolean;
}

function StarRating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <svg key={i} className={`w-3.5 h-3.5 ${i < Math.round(value) ? 'text-gold' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
      ))}
    </span>
  );
}

interface ReservationResult {
  id: string;
  expires_at: string;
  status: string;
}

function Inner({ productId, initialProduct }: { productId: string; initialProduct: ProductDetail | null }) {
  const qc = useQueryClient();
  const [imgIdx, setImgIdx]         = useState(0);
  const [qty, setQty]               = useState(1);
  const [selSize, setSelSize]       = useState<string | null>(null);
  const [selColor, setSelColor]     = useState<string | null>(null);
  const [reserving, setReserving]   = useState(false);
  const [holdHours, setHoldHours]   = useState(2);
  const [wishloading, setWishloading] = useState(false);
  const [reserved, setReserved]     = useState<ReservationResult | null>(null);
  const [discountCode, setDiscount] = useState('');
  const [discountApplied, setDiscountApplied] = useState<string | null>(null);
  const [notifyDone, setNotifyDone] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [redeemPts, setRedeemPts]   = useState(false);

  const { data: product, isLoading: prodLoading } = useQuery<ProductDetail>({
    queryKey: ['product', productId],
    queryFn:  () => api.get(`/products/${productId}/`).then(r => r.data),
    initialData: initialProduct ?? undefined,
    staleTime: 30_000,
  });

  // Must be before any conditional return (React rules of hooks)
  const { data: reviewsData } = useQuery({
    queryKey: ['product-reviews', productId],
    queryFn:  () => api.get(`/products/${productId}/reviews/`).then(r => r.data),
    enabled: !!product,
  });

  const { data: loyalty } = useQuery({
    queryKey: ['loyalty-balance'],
    queryFn:  () => api.get('/loyalty/').then(r => r.data),
    staleTime: 60_000,
  });
  const loyaltyBalance: number = loyalty?.balance ?? 0;

  if (prodLoading || !product) return (
    <div className="min-h-screen bg-white animate-pulse">
      <div className="h-80 bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-6 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-8 bg-gray-200 rounded w-1/3" />
      </div>
    </div>
  );
  const reviews: any[] = reviewsData?.results ?? (Array.isArray(reviewsData) ? reviewsData : []);

  const imgs  = product.images?.length ? product.images : [''];
  const orig  = parseFloat(String(product.price ?? '0'));
  const sale  = product.is_on_sale && product.sale_price != null ? parseFloat(String(product.sale_price)) : null;
  const finalPrice = sale ?? orig;
  const discount = sale ? Math.round((1 - sale / orig) * 100) : 0;
  const inStock = product.stock_count > 0;

  const isWishlisted = product.is_wishlisted;

  async function toggleWishlist() {
    const token = localStorage.getItem('ns_access');
    if (!token) { window.location.href = '/auth/login'; return; }
    setWishloading(true);
    try {
      await api.post(`/products/${productId}/wishlist/`);
      qc.setQueryData(['product', productId], (old: any) => old ? { ...old, is_wishlisted: !old.is_wishlisted } : old);
    } finally { setWishloading(false); }
  }

  async function handleReserve() {
    const token = localStorage.getItem('ns_access');
    if (!token) { window.location.href = '/auth/login'; return; }
    if (!product) return;
    if (product.sizes.length > 0 && !selSize) {
      setReserveError('Please select a size first');
      return;
    }
    setReserveError(null);
    setReserving(true);
    try {
      const selSizeObj = selSize ? product.sizes.find(s => s.size === selSize) : null;
      const res = await api.post(`/products/${productId}/reserve/`, {
        quantity: qty,
        hours: holdHours,
        ...(selSize ? { size: selSize } : {}),
        ...(selSizeObj?.variant_id ? { variant_id: selSizeObj.variant_id } : {}),
        ...(selColor ? { color: selColor } : {}),
        points_to_redeem: redeemPts ? loyaltyBalance : 0,
      });
      setReserved(res.data);
    } catch (err: any) {
      setReserveError(err?.response?.data?.message ?? 'Could not reserve. Try again.');
    } finally { setReserving(false); }
  }

  async function handleNotify() {
    try {
      await api.post(`/products/${productId}/watch/`);
      setNotifyDone(true);
    } catch { setNotifyDone(true); }
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Image gallery */}
      <div className="relative bg-gray-100 overflow-hidden" style={{ height: 'min(340px, 50vh)' }}>
        <Img src={imgs[imgIdx]} alt={product.name} fallback="product" loading="eager"
          className="w-full h-full object-cover" />
        {/* Back */}
        <button onClick={() => history.back()}
          className="absolute top-4 left-4 w-9 h-9 bg-black/40 rounded-full flex items-center justify-center text-white backdrop-blur-sm">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        {/* Wishlist */}
        <button onClick={toggleWishlist} disabled={wishloading}
          className={`absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center shadow-md backdrop-blur-sm transition-colors ${isWishlisted ? 'bg-red-500' : 'bg-white/85'}`}>
          <svg className={`w-5 h-5 ${isWishlisted ? 'text-white' : 'text-gray-700'}`} fill={isWishlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
        </button>
        {/* Discount badge */}
        {sale && <span className="absolute bottom-4 left-4 bg-red-500 text-white text-sm font-black px-3 py-1 rounded-full">{discount}% OFF</span>}
        {/* Image dots */}
        {imgs.length > 1 && (
          <div className="absolute bottom-4 right-4 flex gap-1.5">
            {imgs.map((_, i) => (
              <button key={i} onClick={() => setImgIdx(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === imgIdx ? 'bg-white' : 'bg-white/40'}`} />
            ))}
          </div>
        )}
        {/* Image counter */}
        {imgs.length > 1 && (
          <span className="absolute top-4 right-14 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">{imgIdx + 1}/{imgs.length}</span>
        )}
      </div>

      {/* Thumbnail strip */}
      {imgs.length > 1 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide bg-white border-b border-gray-100">
          {imgs.map((img, i) => (
            <button key={i} onClick={() => setImgIdx(i)}
              className={`w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${i === imgIdx ? 'border-navy' : 'border-transparent'}`}>
              <Img src={img} alt="" fallback="product" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="px-4 py-4 space-y-5">
        {/* Title + price */}
        <div>
          {product.festival_tag && (
            <span className="inline-block bg-amber-50 text-amber-700 text-xs font-bold px-2 py-0.5 rounded mb-2">🎉 {product.festival_tag}</span>
          )}
          <h1 className="text-xl font-extrabold text-navy leading-tight">{product.name}</h1>
          <p className="text-sm text-gray-400 capitalize mt-0.5">{product.category}{product.subcategory ? ` · ${product.subcategory}` : ''}</p>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-2xl font-black text-navy">₹{finalPrice.toLocaleString()}</span>
            {sale && <span className="text-base text-gray-400 line-through">₹{orig.toLocaleString()}</span>}
            {sale && <span className="text-sm font-bold text-green-600">Save ₹{(orig - sale).toLocaleString()}</span>}
          </div>
          {!inStock && (
            <div className="mt-2 bg-red-50 text-red-600 text-sm font-bold px-3 py-1.5 rounded-lg">Out of Stock</div>
          )}
          {inStock && product.stock_count <= 5 && (
            <div className="mt-2 bg-amber-50 text-amber-700 text-sm font-semibold px-3 py-1.5 rounded-lg">⚠️ Only {product.stock_count} left!</div>
          )}
        </div>

        {/* Description */}
        {product.description && (
          <div>
            <h3 className="text-sm font-bold text-navy mb-1">About this product</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
          </div>
        )}

        {/* Size selector */}
        {product.sizes.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-navy mb-2">Size</h3>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map(s => {
                const outOfStock = s.stock === 0;
                const selected   = selSize === s.size;
                return (
                  <button key={s.size}
                    onClick={() => !outOfStock && setSelSize(selected ? null : s.size)}
                    disabled={outOfStock}
                    className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                      selected ? 'bg-navy text-white border-navy' :
                      outOfStock ? 'border-gray-200 text-gray-300 line-through cursor-not-allowed' :
                      'border-gray-200 text-gray-700 hover:border-navy'
                    }`}>
                    {s.size}
                    {s.stock <= 3 && s.stock > 0 && <span className="text-[10px] text-amber-500 ml-1">({s.stock})</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Color selector */}
        {product.colors.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-navy mb-2">
              Color{selColor ? `: ${selColor}` : ''}
            </h3>
            <div className="flex flex-wrap gap-2">
              {product.colors.map(color => {
                const selected = selColor === color;
                const lc = color.toLowerCase().replace(/\s+/g, '');
                const knownColors: Record<string, string> = {
                  red:'#ef4444', blue:'#3b82f6', green:'#22c55e', black:'#111827',
                  white:'#f9fafb', yellow:'#eab308', orange:'#f97316', pink:'#ec4899',
                  purple:'#a855f7', gray:'#9ca3af', grey:'#9ca3af', brown:'#92400e',
                  navy:'#1e3a5f', gold:'#f59e0b', silver:'#d1d5db',
                };
                const bg = knownColors[lc] ?? '#9ca3af';
                return (
                  <button key={color} onClick={() => setSelColor(selected ? null : color)}
                    title={color}
                    className={`w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center ${
                      selected ? 'border-navy scale-110 shadow-md' : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: bg }}>
                    {selected && (
                      <svg className="w-4 h-4" fill="none" stroke={lc === 'white' ? '#1C2E4A' : 'white'} viewBox="0 0 24 24" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quantity */}
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-bold text-navy">Quantity</h3>
          <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-2 py-1">
            <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg flex items-center justify-center text-navy font-bold hover:bg-white transition-colors">−</button>
            <span className="text-navy font-bold text-base w-6 text-center">{qty}</span>
            <button onClick={() => setQty(q => Math.min(product.stock_count, q + 1))} className="w-8 h-8 rounded-lg flex items-center justify-center text-navy font-bold hover:bg-white transition-colors">+</button>
          </div>
        </div>

        {/* Hold duration */}
        {inStock && (
          <div className={`rounded-2xl p-4 border ${product.stock_count <= 5 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-navy">Reserve for pickup</h3>
              <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-lg border border-gray-200">
                Earn 20 pts on pickup
              </span>
            </div>
            {loyaltyBalance > 0 && (
              <label className="flex items-center gap-2 text-xs text-purple-700 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={redeemPts}
                  onChange={e => setRedeemPts(e.target.checked)}
                  className="w-3.5 h-3.5 accent-purple-600 cursor-pointer"
                />
                Redeem {loyaltyBalance} pts (−₹{Math.floor(loyaltyBalance / 10)}) at checkout
              </label>
            )}
            {product.stock_count <= 5 && (
              <p className="text-xs font-semibold text-amber-700 mb-3">
                Only {product.stock_count} left — reserve to secure yours before someone else does!
              </p>
            )}
            <div className="flex gap-2">
              {[1, 2, 3].map(h => (
                <button key={h} onClick={() => setHoldHours(h)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${holdHours === h ? 'bg-navy text-white border-navy' : 'border-gray-200 text-gray-600 hover:border-navy bg-white'}`}>
                  {h}h
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Discount code */}
        <div>
          <h3 className="text-sm font-bold text-navy mb-2">Discount Code</h3>
          <div className="flex gap-2">
            <input value={discountCode} onChange={e => setDiscount(e.target.value)}
              placeholder="Enter code…"
              className="input flex-1 text-sm py-2" />
            <button onClick={async () => {
              if (!discountCode.trim()) return;
              try {
                const r = await api.post(`/stores/${product.store.id}/apply-discount/`, { code: discountCode, order_amount: finalPrice });
                setDiscountApplied(`✓ ${r.data.message ?? 'Code applied'}`);
              } catch (e: any) {
                setDiscountApplied(`✗ ${e?.response?.data?.message ?? 'Invalid code'}`);
              }
            }} className="btn-primary px-4 text-sm">Apply</button>
          </div>
          {discountApplied && (
            <p className={`text-xs mt-1.5 font-semibold ${discountApplied.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{discountApplied}</p>
          )}
        </div>

        {/* Reserve success */}
        {reserved && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">🎉</div>
              <p className="font-bold text-green-800 text-lg">Reserved!</p>
              <p className="text-sm text-green-700 font-semibold mt-0.5">
                Your order will be ready for pickup in ~15-20 mins
              </p>
              <p className="text-xs text-green-600 mt-1">
                The store has been notified to prepare your order
              </p>
            </div>
            <div className="bg-white rounded-xl p-3 mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">Pickup from</p>
                  <p className="text-sm font-bold text-navy truncate">{product.store.name}</p>
                </div>
                <p className="text-xs text-gray-400 shrink-0">within {holdHours}h</p>
              </div>
              <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2">
                <span className="text-sm">⭐</span>
                <p className="text-xs font-semibold text-amber-700">You'll earn 20 loyalty points when you pick up</p>
              </div>
            </div>
            <div className="flex gap-2">
              <a href="/customer/reservations"
                className="flex-1 text-center py-2.5 bg-navy text-white text-sm font-bold rounded-xl hover:bg-navy/90 transition-colors">
                Track Reservation
              </a>
              <a href={`/customer/chat?store=${product.store.id}&product=${product.id}&productName=${encodeURIComponent(product.name)}`}
                className="flex-1 text-center py-2.5 border border-navy text-navy text-sm font-bold rounded-xl hover:bg-navy/5 transition-colors">
                💬 Message Store
              </a>
            </div>
          </div>
        )}

        {/* Sold by store */}
        <a href={`/stores/${product.store.id}`}
           className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-3 shadow-sm hover:shadow-card-hover hover:border-navy/20 transition-all">
          <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0">
            <Img src={product.store.avatar} alt={product.store.name} fallback="store"
              className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400">Sold by</p>
            <div className="flex items-center gap-1">
              <p className="text-sm font-bold text-navy truncate">{product.store.name}</p>
              {product.store.is_verified && <span className="shrink-0 text-blue-500 text-xs font-black">✓</span>}
            </div>
            {product.store.rating > 0 && (
              <div className="flex items-center gap-1 mt-0.5">
                <StarRating value={product.store.rating} />
                <span className="text-xs text-gray-400">({product.store.review_count})</span>
              </div>
            )}
          </div>
          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </a>

        {/* Reviews */}
        {reviews.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-navy mb-3">Reviews</h3>
            <div className="space-y-3">
              {reviews.slice(0, 3).map((r: any) => (
                <div key={r.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-semibold text-navy">{r.reviewer_name ?? r.user_name ?? 'Customer'}</p>
                    <span className="text-[10px] text-gray-400">{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <StarRating value={r.rating} />
                  {(r.content ?? r.comment) && <p className="text-sm text-gray-600 mt-1.5">{r.content ?? r.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-3 z-30">
        <a href={`/customer/chat?store=${product.store.id}&product=${product.id}&productName=${encodeURIComponent(product.name)}`}
           className="w-12 h-12 shrink-0 flex items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:border-navy hover:text-navy transition-colors"
           title="Chat with store">
          💬
        </a>
        {inStock ? (
          <button onClick={handleReserve} disabled={reserving || !!reserved}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-60 ${reserved ? 'bg-green-600 text-white' : product.stock_count <= 5 && !reserved ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-navy text-white hover:bg-navy/90'}`}>
            {reserving ? 'Reserving…' : reserved ? '✓ Reserved' : product.stock_count <= 5 ? `Reserve Now · ₹${(finalPrice * qty).toLocaleString()}` : `Reserve · ₹${(finalPrice * qty).toLocaleString()}`}
          </button>
        ) : notifyDone ? (
          <div className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm text-center">
            ✓ We'll notify you!
          </div>
        ) : (
          <button onClick={handleNotify}
            className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-300 transition-colors">
            🔔 Notify Me When In Stock
          </button>
        )}
      </div>
      {reserveError && (
        <div className="mx-4 mt-2 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-medium">
          {reserveError}
        </div>
      )}
    </div>
  );
}

export default function ProductDetailIsland({ productId, initialProduct }: { productId: string; initialProduct: any }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Inner productId={productId} initialProduct={initialProduct} />
    </QueryClientProvider>
  );
}
