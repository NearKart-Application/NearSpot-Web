import Img from './Img';

export interface ProductData {
  id: string;
  name: string;
  category?: string;
  subcategory?: string;
  store_name?: string;
  store?: { id: string; name: string; avatar?: string };
  base_price?: string;
  min_price?: string;
  price?: number | string;  // API sends as number (Double)
  sale_price?: number | null;
  primary_image?: string;
  image?: string;
  is_on_sale?: boolean;
  festival_tag?: string;
  status?: string;
  distance_km?: number;
  avg_rating?: number;
  review_count?: number;
  stock_count?: number;
}

function toNum(v: number | string | undefined | null): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  return 0;
}

function calcDiscount(base: number, sale: number | null | undefined) {
  if (!sale || !base || sale >= base) return 0;
  return Math.round((1 - sale / base) * 100);
}

function distLabel(km?: number) {
  if (km == null) return '';
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

/* ── Grid card (default) ─────────────────────────────────────────────────── */
export function ProductCardGrid({
  product,
  wishlisted = false,
  onWishlist,
}: {
  product: ProductData;
  wishlisted?: boolean;
  onWishlist?: () => void;
}) {
  const img    = product.primary_image ?? product.image;
  const base   = toNum(product.price ?? product.base_price);
  const sale   = product.sale_price ?? null;
  const price  = sale ?? toNum(product.min_price ?? product.price ?? product.base_price ?? 0);
  const disc   = calcDiscount(base, sale);
  const oos    = product.status === 'out_of_stock';
  const storeName = product.store_name ?? product.store?.name;
  const dist   = distLabel(product.distance_km);

  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      {/* Image container */}
      <a href={`/products/${product.id}`} className="block relative aspect-square bg-gray-50 overflow-hidden">
        <Img src={img} alt={product.name} loading="lazy" fallback="product"
          className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${oos ? 'opacity-50' : ''}`} />

        {/* Discount badge */}
        {disc >= 5 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
            {disc}% off
          </div>
        )}

        {/* Festival tag */}
        {product.festival_tag && (
          <div className="absolute bottom-2 left-2 bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
            🏷️ {product.festival_tag}
          </div>
        )}

        {/* Out of stock overlay */}
        {oos && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-gray-900/70 text-white text-xs font-bold px-3 py-1.5 rounded-xl">Out of stock</span>
          </div>
        )}

        {/* Hover action strip — slides up from bottom */}
        <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200 flex bg-navy/95 backdrop-blur-sm">
          <a href={`/products/${product.id}`}
            className="flex-1 py-2.5 text-center text-white text-xs font-bold hover:bg-white/10 transition-colors">
            {oos ? '🔔 Notify Me' : '📌 Reserve'}
          </a>
          {onWishlist && (
            <>
              <div className="w-px bg-white/20" />
              <button onClick={e => { e.preventDefault(); onWishlist(); }}
                className="px-3 py-2.5 hover:bg-white/10 transition-colors">
                <svg className={`w-4 h-4 ${wishlisted ? 'text-red-400' : 'text-white'}`}
                  fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Always-visible wishlist on mobile (top-right corner) */}
        {onWishlist && (
          <button onClick={e => { e.preventDefault(); onWishlist(); }}
            className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-all md:opacity-0 group-hover:opacity-0 ${
              wishlisted ? 'bg-red-500' : 'bg-white/90'
            }`}>
            <svg className={`w-3.5 h-3.5 ${wishlisted ? 'text-white' : 'text-gray-500'}`}
              fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
            </svg>
          </button>
        )}
      </a>

      {/* Info */}
      <div className="p-3">
        {storeName && (
          <p className="text-[10px] text-gray-400 truncate font-medium">{storeName}</p>
        )}
        <a href={`/products/${product.id}`}>
          <h3 className="text-[13px] font-bold text-navy line-clamp-2 leading-snug mt-0.5">
            {product.name}
          </h3>
        </a>

        {/* Rating */}
        {product.avg_rating != null && product.avg_rating > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <div className="flex">
              {[1,2,3,4,5].map(s => (
                <svg key={s} className={`w-3 h-3 ${s <= Math.round(product.avg_rating!) ? 'text-amber-400' : 'text-gray-200'}`}
                  fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
              ))}
            </div>
            {product.review_count != null && (
              <span className="text-[10px] text-gray-400">({product.review_count})</span>
            )}
          </div>
        )}

        {/* Price — Amazon style */}
        <div className="mt-1.5">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-base font-black text-navy">₹{price.toLocaleString('en-IN')}</span>
            {disc >= 5 && (
              <>
                <span className="text-xs text-gray-400 line-through">₹{base.toLocaleString('en-IN')}</span>
                <span className="text-xs font-bold text-green-600">{disc}% off</span>
              </>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {dist && (
            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              {dist}
            </span>
          )}
          {product.stock_count != null && product.stock_count > 0 && product.stock_count <= 5 && (
            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-md">
              Only {product.stock_count} left!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── List card (search results style) ───────────────────────────────────── */
export function ProductCardList({
  product,
  wishlisted = false,
  onWishlist,
}: {
  product: ProductData;
  wishlisted?: boolean;
  onWishlist?: () => void;
}) {
  const img   = product.primary_image ?? product.image;
  const base  = toNum(product.price ?? product.base_price);
  const sale  = product.sale_price ?? null;
  const price = sale ?? toNum(product.min_price ?? product.price ?? product.base_price ?? 0);
  const disc  = calcDiscount(base, sale);
  const oos   = product.status === 'out_of_stock';
  const storeName = product.store_name ?? product.store?.name;
  const dist  = distLabel(product.distance_km);

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex gap-4 p-3.5 overflow-hidden">
      {/* Image */}
      <a href={`/products/${product.id}`}
        className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-gray-50 overflow-hidden shrink-0">
        <Img src={img} alt={product.name} loading="lazy" fallback="product"
          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${oos ? 'opacity-50' : ''}`} />
        {disc >= 5 && (
          <div className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
            {disc}% off
          </div>
        )}
      </a>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col">
        {storeName && (
          <a href={product.store?.id ? `/stores/${product.store.id}` : '#'}
            className="text-[10px] text-navy/60 font-semibold hover:text-navy transition-colors w-fit">
            {storeName}
          </a>
        )}
        <a href={`/products/${product.id}`}>
          <h3 className="text-sm font-bold text-navy line-clamp-2 leading-snug mt-0.5">
            {product.name}
          </h3>
        </a>

        {product.category && (
          <p className="text-[10px] text-gray-400 capitalize mt-0.5">{product.category}</p>
        )}

        {/* Rating */}
        {product.avg_rating != null && product.avg_rating > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <div className="flex">
              {[1,2,3,4,5].map(s => (
                <svg key={s} className={`w-3 h-3 ${s <= Math.round(product.avg_rating!) ? 'text-amber-400' : 'text-gray-200'}`}
                  fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
              ))}
            </div>
            {product.review_count != null && (
              <span className="text-[10px] text-gray-400">({product.review_count})</span>
            )}
          </div>
        )}

        <div className="mt-auto pt-2 flex items-end justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-lg font-black text-navy">₹{price.toLocaleString('en-IN')}</span>
              {disc >= 5 && (
                <>
                  <span className="text-xs text-gray-400 line-through">₹{base.toLocaleString('en-IN')}</span>
                  <span className="text-xs font-bold text-green-600">{disc}% off</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {dist && <span className="text-[10px] text-gray-400">📍 {dist} away</span>}
              {product.stock_count != null && product.stock_count > 0 && product.stock_count <= 5 && (
                <span className="text-[10px] font-bold text-orange-600">Only {product.stock_count} left!</span>
              )}
              {oos && <span className="text-[10px] font-bold text-red-500">Out of stock</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onWishlist && (
              <button onClick={onWishlist}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                  wishlisted ? 'bg-red-50 border-red-200 text-red-500' : 'border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-400'
                }`}>
                <svg className="w-4 h-4" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
              </button>
            )}
            <a href={`/products/${product.id}`}
              className="px-4 py-2 bg-navy text-white text-xs font-bold rounded-xl hover:bg-navy/90 transition-colors">
              {oos ? 'Notify' : 'Reserve'}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
