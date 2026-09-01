import { useState, useEffect, useCallback, useRef } from 'react';
import { QueryClientProvider, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';
import { ProductCardGrid, type ProductData } from '../ui/ProductCard';
import Img from '../ui/Img';
import { Button } from '@/components/ui/button';

/* ─────────────────────────────────────────────────────────────────────────────
   Types (match actual API field names)
───────────────────────────────────────────────────────────────────────────── */
interface Coords { lat: number; lng: number }
interface Store {
  id: string; name: string; category: string; location: string;
  avatar?: string; cover_image?: string;
  is_open: boolean; is_verified: boolean; holiday_mode?: boolean;
  rating?: number; avg_rating?: number; review_count?: number;
  distance_km?: number; follower_count?: number;
  active_offer_labels?: string[]; top_offer_label?: string; has_offer?: boolean;
  store_type?: string; open_status_label?: string;
}
interface Product {
  id: string; name: string;
  price?: number; base_price?: string; sale_price?: number;
  primary_image?: string; image?: string;
  store_name?: string; store?: { id: string; name: string; avatar?: string };
  is_on_sale?: boolean; festival_tag?: string; stock_count?: number;
}
interface Category { id: string; name: string; slug: string; icon?: string }
interface Banner { id: string; title: string; subtitle?: string; image_url?: string; badge_text?: string; link_value?: string }

/* ─────────────────────────────────────────────────────────────────────────────
   Location helpers
   - Default to Hyderabad so content loads immediately
   - Upgrade silently to real GPS
───────────────────────────────────────────────────────────────────────────── */
const FALLBACK: Coords = { lat: 17.385, lng: 78.4867 }; // Hyderabad

function loadSavedCoords(): Coords {
  try {
    const raw = localStorage.getItem('ns_coords');
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return FALLBACK;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const d = await r.json();
    const a = d.address ?? {};
    return a.suburb ?? a.neighbourhood ?? a.town ?? a.city_district ?? a.city ?? a.county ?? 'Your Area';
  } catch { return 'Your Area'; }
}

function timeGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/* ─────────────────────────────────────────────────────────────────────────────
   Recently-viewed helpers (localStorage, capped at 10)
───────────────────────────────────────────────────────────────────────────── */
interface RecentProduct { id: string; name: string; price: number; image?: string }

function loadRecentlyViewed(): RecentProduct[] {
  try {
    const raw = localStorage.getItem('ns_recently_viewed');
    if (raw) return JSON.parse(raw) as RecentProduct[];
  } catch { /* */ }
  return [];
}

function trackRecentlyViewed(product: Product) {
  try {
    const list = loadRecentlyViewed().filter(p => p.id !== product.id);
    const price = typeof product.price === 'number' ? product.price : parseFloat(product.base_price ?? '0');
    list.unshift({ id: product.id, name: product.name, price, image: product.primary_image ?? product.image });
    localStorage.setItem('ns_recently_viewed', JSON.stringify(list.slice(0, 10)));
  } catch { /* */ }
}

const CAT_ICONS: Record<string, string> = {
  fashion: '👔', footwear: '👟', jewellery: '💍', electronics: '📱',
  beauty: '💄', food: '🍽️', gifts: '🎁', decor: '🛋️', books: '📚',
  sports: '⚽', grocery: '🛒', pharmacy: '💊', others: '🏷️',
};
const CAT_COLORS: Record<string, string> = {
  fashion: 'bg-purple-50 text-purple-600', footwear: 'bg-orange-50 text-orange-600',
  jewellery: 'bg-yellow-50 text-yellow-600', electronics: 'bg-blue-50 text-blue-600',
  beauty: 'bg-pink-50 text-pink-600', food: 'bg-red-50 text-red-600',
  gifts: 'bg-emerald-50 text-emerald-600', decor: 'bg-teal-50 text-teal-600',
  others: 'bg-gray-100 text-gray-600',
};

/* ─────────────────────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────────────────────── */

const gridContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const gridItem = {
  hidden: { opacity: 0, y: 22, scale: 0.96 },
  show:   { opacity: 1, y: 0,  scale: 1,   transition: { duration: 0.38, ease: 'easeOut' as const } },
};

// Store card — Zomato/Swiggy style with full cover image
function StoreCard({ store }: { store: Store }) {
  const rating = store.rating ?? store.avg_rating ?? 0;
  const dist   = store.distance_km;
  const distTxt = dist == null ? '' : dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)} km`;
  const offers  = store.active_offer_labels ?? (store.top_offer_label ? [store.top_offer_label] : []);

  return (
    <motion.a
      href={`/stores/${store.id}`}
      variants={gridItem}
      whileHover={{ y: -4, boxShadow: '0 12px 32px rgb(15 23 42 / 0.15)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="block bg-white rounded-2xl overflow-hidden border border-gray-100 group"
    >
      {/* Cover image */}
      <div className="relative h-40 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
        <Img src={store.cover_image} alt={store.name} fallback="store" loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        {/* Dim overlay for closed stores */}
        {!store.is_open && <div className="absolute inset-0 bg-black/25 z-[1]" />}
        {/* Open/Closed pill */}
        <div className="absolute top-2.5 right-2.5 z-[2]">
          {store.is_open ? (
            <span className="bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm">OPEN</span>
          ) : (
            <span className="bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm">CLOSED</span>
          )}
        </div>
        {/* Top offer badge */}
        {offers.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-4">
            <p className="text-white text-[11px] font-semibold truncate">🎉 {offers[0]}</p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-xl bg-white border-2 border-white overflow-hidden shrink-0 shadow-sm -mt-5 ml-3 relative z-10">
            <Img src={store.avatar} alt={store.name} fallback="avatar"
              className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0 mt-0.5">
            <div className="flex items-start justify-between gap-1">
              <h3 className="font-bold text-navy text-sm leading-tight truncate">{store.name}</h3>
              {store.is_verified && <span className="text-blue-500 text-xs shrink-0">✓</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <p className="text-gray-400 text-xs capitalize">{store.category}</p>
              {store.store_type && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                  store.store_type === 'service' ? 'bg-amber-50 text-amber-600 border-amber-200'
                  : store.store_type === 'home'  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-blue-50 text-blue-600 border-blue-200'
                }`}>
                  {store.store_type === 'service' ? '🛠 Service' : store.store_type === 'home' ? '🏠 Home Biz' : '🛍 Products'}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          {rating > 0 ? (
            <span className="flex items-center gap-0.5 font-semibold text-gray-700">
              <span className="text-amber-400 text-sm">★</span>{rating.toFixed(1)}
              {store.review_count ? <span className="text-gray-400 font-normal">({store.review_count})</span> : null}
            </span>
          ) : (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">NEW</span>
          )}
          {distTxt && <><span className="text-gray-200">•</span><span>{distTxt}</span></>}
          {store.location && <><span className="text-gray-200">•</span><span className="truncate">{store.location}</span></>}
        </div>
        {store.holiday_mode && (
          <div className="mt-1.5 text-[11px] font-semibold text-orange-600 bg-orange-50 rounded-lg px-2 py-0.5 w-fit">🌴 On Holiday</div>
        )}
        {!store.is_open && !store.holiday_mode && store.open_status_label && (
          <p className="text-[11px] text-gray-400 mt-1">🕐 {store.open_status_label}</p>
        )}
      </div>
    </motion.a>
  );
}

// Flash deal card — compact horizontal scroll card with big discount badge
function FlashDealCard({ product, wishlisted, onWishlist }: {
  product: Product; wishlisted: boolean; onWishlist: () => void;
}) {
  const img    = product.primary_image ?? product.image;
  const base   = typeof product.price === 'number' ? product.price : parseFloat(product.base_price ?? '0');
  const sale   = product.sale_price ?? null;
  const price  = sale ?? base;
  const disc   = (sale && base && sale < base) ? Math.round((1 - sale / base) * 100) : 0;

  return (
    <motion.div
      className="relative w-40 shrink-0 group"
      variants={gridItem}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.2 }}
    >
      <a href={`/products/${product.id}`}
        className="block bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-shadow duration-200">
        {/* Image */}
        <div className="relative h-40 bg-gray-50 overflow-hidden">
          <Img src={img} alt={product.name} fallback="product" loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          {disc >= 5 && (
            <div className="absolute top-0 left-0 bg-red-500 text-white text-[11px] font-black px-2.5 py-1 rounded-br-xl">
              {disc}% OFF
            </div>
          )}
          {product.festival_tag && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center">
              <span className="bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">🏷️ {product.festival_tag}</span>
            </div>
          )}
          {/* Hover reserve button */}
          <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-navy/95 backdrop-blur-sm py-2.5 text-center text-white text-xs font-bold">
            📌 Reserve
          </div>
        </div>
        {/* Info */}
        <div className="p-2.5">
          <p className="text-[10px] text-gray-400 truncate">{product.store_name ?? product.store?.name}</p>
          <h4 className="text-xs font-bold text-gray-800 mt-0.5 line-clamp-2 leading-snug">{product.name}</h4>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-sm font-black text-gray-900">₹{price.toLocaleString('en-IN')}</span>
            {disc >= 5 && <span className="text-[10px] text-gray-400 line-through">₹{base.toLocaleString('en-IN')}</span>}
          </div>
        </div>
      </a>
      {/* Wishlist button */}
      <button onClick={e => { e.preventDefault(); onWishlist(); }}
        className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-all ${
          wishlisted ? 'bg-red-500' : 'bg-white/90 hover:bg-white'
        } md:opacity-0 group-hover:opacity-100`}>
        <svg className={`w-3.5 h-3.5 ${wishlisted ? 'text-white' : 'text-gray-500'}`}
          fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
        </svg>
      </button>
    </motion.div>
  );
}

// Banner carousel
function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % banners.length), 3500);
    return () => clearInterval(t);
  }, [banners.length]);
  if (!banners.length) return null;
  const b = banners[idx];
  return (
    <div className="relative mx-4 h-44 rounded-2xl overflow-hidden shadow-sm cursor-pointer"
      onClick={() => { if (b.link_value) window.location.href = b.link_value; }}>
      <div className="absolute inset-0 bg-gradient-to-r from-navy to-navy/80" />
      <AnimatePresence mode="popLayout">
        {b.image_url && (
          <motion.div
            key={idx}
            className="absolute inset-0"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
          >
            <Img src={b.image_url} alt={b.title} fallback="banner" loading="eager"
              className="w-full h-full object-cover" />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-r from-navy/90 via-navy/60 to-transparent" />
      <div className="absolute inset-0 p-5 flex flex-col justify-center">
        {b.badge_text && (
          <span className="inline-block bg-gold text-navy text-[10px] font-black px-3 py-1 rounded-full mb-2 w-fit uppercase tracking-widest shadow-sm">{b.badge_text}</span>
        )}
        <h3 className="text-white font-extrabold text-2xl leading-tight">{b.title}</h3>
        {b.subtitle && <p className="text-white/80 text-sm mt-1">{b.subtitle}</p>}
      </div>
      {banners.length > 1 && (
        <div className="absolute bottom-3 right-4 flex gap-1.5 items-center">
          {banners.map((_, i) => (
            <button key={i} onClick={e => { e.stopPropagation(); setIdx(i); }}
              className={`rounded-full transition-all ${i === idx ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// Skeleton cards
function StoreSkeletons() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100">
          <div className="h-40 animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer" />
          <div className="p-3 space-y-2">
            <div className="h-3.5 animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-full w-3/4" />
            <div className="h-3 animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-full w-1/2" />
            <div className="h-3 animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-full w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductSkeletons() {
  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="w-36 shrink-0 bg-white rounded-2xl overflow-hidden border border-gray-100">
          <div className="h-36 animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer" />
          <div className="p-2.5 space-y-2">
            <div className="h-3 animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-full w-full" />
            <div className="h-3 animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-full w-2/3" />
            <div className="h-4 animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-full w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Section header
function SectionHead({ title, subtitle, href }: { title: string; subtitle?: string; href?: string }) {
  return (
    <div className="flex items-end justify-between mb-4 px-4">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 bg-gold rounded-full" />
        <h2 className="text-base font-extrabold text-navy leading-none">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400">• {subtitle}</p>}
      </div>
      {href && <a href={href} className="text-[11px] font-bold text-navy/50 hover:text-navy transition-colors uppercase tracking-wider">See all →</a>}
    </div>
  );
}

// Following tab
function FollowingTab({ wishlisted, onWishlist }: { wishlisted: Set<string>; onWishlist: (id: string) => void }) {
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ns_access');
  const { data, isLoading } = useQuery({
    queryKey: ['following-products'],
    queryFn:  () => api.get('/products/following/').then(r => r.data),
    enabled:  isLoggedIn,
  });
  const products: Product[] = data?.results ?? (Array.isArray(data) ? data : []);

  if (!isLoggedIn) return (
    <div className="flex flex-col items-center py-24 px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-navy/10 flex items-center justify-center mb-4 text-4xl">🏪</div>
      <h3 className="font-bold text-navy text-lg">Sign in to see your feed</h3>
      <p className="text-sm text-gray-400 mt-2 max-w-xs">Follow stores to see their latest products, offers, and updates here.</p>
      <a href="/auth/login" className="mt-5 btn-primary px-8">Sign In</a>
    </div>
  );

  if (isLoading) return <div className="px-4 pt-4"><ProductSkeletons /></div>;

  if (!products.length) return (
    <div className="flex flex-col items-center py-24 px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-navy/10 flex items-center justify-center mb-4 text-4xl">🏪</div>
      <h3 className="font-bold text-navy text-lg">No followed stores yet</h3>
      <p className="text-sm text-gray-400 mt-2">Follow stores from the Stores tab to see their latest products here.</p>
    </div>
  );

  const grouped = products.reduce((acc, p) => {
    const key = p.store?.id ?? 'unknown';
    (acc[key] ??= []).push(p);
    return acc;
  }, {} as Record<string, Product[]>);

  return (
    <div className="py-4 space-y-5">
      {Object.entries(grouped).map(([sid, prods]) => {
        const store = prods[0].store;
        return (
          <div key={sid} className="mx-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <a href={`/stores/${sid}`} className="flex items-center gap-3 p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                <Img src={store?.avatar} alt={store?.name ?? ''} fallback="avatar"
                  className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-navy text-sm truncate">{store?.name}</p>
                <p className="text-xs text-gray-400">Latest products</p>
              </div>
              <span className="text-xs font-bold text-navy bg-navy/10 px-3 py-1 rounded-full">Visit →</span>
            </a>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide px-3 py-3">
              {prods.map(p => (
                <FlashDealCard key={p.id} product={p}
                  wishlisted={wishlisted.has(p.id)} onWishlist={() => onWishlist(p.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main Inner component
───────────────────────────────────────────────────────────────────────────── */
function Inner({ initBanners, initCategories }: { initBanners: Banner[]; initCategories: Category[] }) {
  const qc = useQueryClient();

  // Load saved coords immediately — NO blocking on GPS
  const [coords, setCoords]       = useState<Coords>(loadSavedCoords);
  const [locName, setLocName]     = useState('');
  const [realGPS, setRealGPS]     = useState(false);
  // Prevents GPS auto-update from overwriting a location the user manually selected
  const userPickedRef = useRef(false);
  const [tab, setTab]             = useState<'stores' | 'following'>('stores');
  const [radius, setRadius]         = useState(5);
  const [category, setCategory]     = useState<string | null>(null);
  const [showRadius, setShowRadius] = useState(false);
  const [wishlisted, setWishlisted] = useState<Set<string>>(new Set());
  const [recentlyViewed, setRecentlyViewed] = useState<RecentProduct[]>(() => loadRecentlyViewed());

  // Reverse geocode saved coords on mount, then upgrade with real GPS
  useEffect(() => {
    reverseGeocode(coords.lat, coords.lng).then(setLocName);

    // Only auto-detect GPS if the user has never saved a location before
    const hasSavedLocation = !!localStorage.getItem('ns_coords');
    if (!hasSavedLocation) {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          if (userPickedRef.current) return; // picker fired during GPS window
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(c);
          setRealGPS(true);
          try { localStorage.setItem('ns_coords', JSON.stringify(c)); } catch { /* */ }
          const name = await reverseGeocode(c.lat, c.lng);
          if (!userPickedRef.current) setLocName(name);
        },
        () => { /* keep default */ },
        { timeout: 10000 },
      );
    }

    // Load wishlist ids
    const token = localStorage.getItem('ns_access');
    if (token) {
      api.get('/products/wishlist/').then(r => {
        const items = r.data?.results ?? r.data ?? [];
        setWishlisted(new Set(items.map((p: any) => p.id)));
      }).catch(() => { });
    }
  }, []);

  const toggleWishlist = useCallback((id: string) => {
    const token = localStorage.getItem('ns_access');
    if (!token) { window.location.href = '/auth/login'; return; }
    const wasIn = wishlisted.has(id);
    setWishlisted(prev => { const s = new Set(prev); wasIn ? s.delete(id) : s.add(id); return s; });
    api.post(`/products/${id}/wishlist/`).catch(() =>
      setWishlisted(prev => { const s = new Set(prev); wasIn ? s.add(id) : s.delete(id); return s; })
    );
  }, [wishlisted]);

  // Listen for global location changes dispatched by LocationPickerIsland
  useEffect(() => {
    const handle = (e: Event) => {
      const { coords: c, name } = (e as CustomEvent).detail;
      userPickedRef.current = true; // lock out GPS override from this point on
      setCoords(c);
      setLocName(name);
      setRealGPS(false);
    };
    document.addEventListener('ns:location-changed', handle);
    return () => document.removeEventListener('ns:location-changed', handle);
  }, []);

  // Queries — always have coords (default or real)
  const storeQ = useQuery({
    queryKey: ['nearby-stores', coords, radius, category],
    queryFn:  () => api.get('/stores/nearby/', { params: { lat: coords.lat, lng: coords.lng, radius, ...(category ? { category } : {}) } }).then(r => r.data),
    staleTime: 60_000,
  });
  const prodQ = useInfiniteQuery({
    queryKey:  ['nearby-products', coords, radius],
    queryFn:   ({ pageParam = 1 }) =>
      api.get('/products/nearby/', { params: { lat: coords.lat, lng: coords.lng, radius, page: pageParam, page_size: 20 } }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage: any) => lastPage.next ?? undefined,
    staleTime: 60_000,
  });
  const recQ = useQuery({
    queryKey: ['recommended-products', coords, radius],
    queryFn:  () => api.get('/products/recommended/', { params: { lat: coords.lat, lng: coords.lng, radius } }).then(r => r.data),
    staleTime: 300_000,
  });
  const dealsQ = useQuery({
    queryKey: ['flash-deals', coords, radius],
    queryFn:  () => api.get('/products/nearby/', { params: { lat: coords.lat, lng: coords.lng, radius, is_on_sale: true } }).then(r => r.data),
    staleTime: 120_000,
  });
  const catQ = useQuery({
    queryKey: ['categories'],
    queryFn:  () => api.get('/products/categories/').then(r => r.data?.results ?? r.data ?? []),
    initialData: initCategories.length ? initCategories : undefined,
    staleTime: Infinity,
  });
  const bannerQ = useQuery({
    queryKey: ['banners'],
    queryFn:  () => api.get('/admin-panel/banners/active/').then(r => r.data?.results ?? r.data ?? []),
    initialData: initBanners.length ? initBanners : undefined,
    staleTime: 300_000,
  });

  const stores:     Store[]    = storeQ.data?.results  ?? (Array.isArray(storeQ.data)  ? storeQ.data  : []);
  const products:   Product[]  = (prodQ.data?.pages ?? []).flatMap((p: any) => p.results ?? (Array.isArray(p) ? p : []));
  const recommended: Product[] = recQ.data?.results ?? (Array.isArray(recQ.data) ? recQ.data : []);
  const deals:      Product[]  = (dealsQ.data?.results ?? (Array.isArray(dealsQ.data) ? dealsQ.data : []))
    .filter((p: Product) => {
      const base = typeof p.price === 'number' ? p.price : parseFloat(p.base_price ?? '0');
      return p.is_on_sale && p.sale_price != null && p.sale_price < base;
    });
  const categories: Category[] = Array.isArray(catQ.data) ? catQ.data : [];
  const banners:    Banner[]   = Array.isArray(bannerQ.data) ? bannerQ.data : [];

  const RADII: [number, string][] = [[1, 'Very close'], [2, 'Walking distance'], [5, 'Short drive'], [10, 'Wider area']];

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">

      {/* ── Home Sub-header ─────────────────────────────────────────────── */}
      <div
        className="sticky top-16 z-30 shadow-md border-b border-white/10"
        style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1a2e52 100%)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center gap-2">

          {/* Location button */}
          <button
            onClick={() => { setShowRadius(false); document.dispatchEvent(new Event('ns:open-location-picker')); }}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-full px-3.5 py-1.5 transition-colors min-w-0 flex-1 max-w-[200px] sm:max-w-xs">
            <svg className="w-3.5 h-3.5 text-gold shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span className="text-white text-sm font-medium truncate leading-none">
              {locName || 'Set location…'}
            </span>
            <svg className="w-3.5 h-3.5 text-white/50 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-white/15 shrink-0" />

          {/* Radius chip */}
          <button onClick={() => setShowRadius(!showRadius)}
            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5 text-white text-sm font-semibold transition-colors shrink-0">
            <svg className="w-3.5 h-3.5 text-white/60 shrink-0 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/><path strokeLinecap="round" d="M12 5v1M12 18v1M5 12H4M20 12h-1M7.05 7.05l-.7-.7M17.65 17.65l-.7-.7M17.65 6.35l.7-.7M7.05 16.95l-.7.7"/>
            </svg>
            {radius}km
            <svg className="w-3.5 h-3.5 text-white/50 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
          </button>

          <div className="flex-1" />

          {/* Search shortcut */}
          <a href="/search"
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-full px-3.5 py-1.5 transition-colors shrink-0 group">
            <svg className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <span className="text-white/70 group-hover:text-white text-sm font-medium transition-colors hidden sm:inline">Search</span>
          </a>
        </div>

        {/* Radius dropdown */}
        {showRadius && (
          <div className="absolute top-full left-0 right-0 bg-white shadow-xl z-50 border-t border-gray-100 p-4">
            <p className="text-sm font-bold text-navy mb-1">Search Radius</p>
            <p className="text-xs text-gray-400 mb-3">Stores and products within this distance</p>
            <div className="grid grid-cols-2 gap-2 max-w-sm">
              {RADII.map(([km, label]) => (
                <button key={km} onClick={() => { setRadius(km); setShowRadius(false); }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                    radius === km ? 'border-navy bg-navy/5 text-navy' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${radius === km ? 'bg-navy' : 'bg-gray-300'}`} />
                  <div>
                    <p className="text-xs font-bold">{km}km</p>
                    <p className="text-[10px] text-gray-400">{label}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="max-w-7xl mx-auto px-4 pb-0">
          <div className="flex">
            {(['stores', 'following'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-2.5 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${
                  tab === t
                    ? 'border-gold text-gold'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === 'following' ? (
        <FollowingTab wishlisted={wishlisted} onWishlist={toggleWishlist} />
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-5 space-y-8">

          {/* Categories */}
          {categories.length > 0 && (
            <section>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
                <motion.button
                  onClick={() => setCategory(null)}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0 }}
                  className="flex flex-col items-center gap-1.5 shrink-0 w-16 group"
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl transition-all ${
                    !category
                      ? 'bg-navy text-white shadow-sm scale-105'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-navy/30 hover:text-navy'
                  }`}>🔍</div>
                  <span className="text-[11px] font-semibold text-gray-500">All</span>
                </motion.button>
                {categories.map((cat, index) => {
                  const sel = category === cat.slug;
                  const clr = CAT_COLORS[cat.slug] ?? 'bg-gray-100 text-gray-600';
                  return (
                    <motion.button
                      key={cat.id}
                      onClick={() => setCategory(sel ? null : cat.slug)}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: (index + 1) * 0.03 }}
                      className="flex flex-col items-center gap-1.5 shrink-0 w-16"
                    >
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl transition-all ${
                        sel
                          ? 'bg-navy text-white shadow-sm scale-105'
                          : `${clr} bg-white border border-gray-200 hover:border-navy/30 hover:text-navy`
                      }`}>
                        {cat.icon ?? CAT_ICONS[cat.slug] ?? '🏷️'}
                      </div>
                      <span className="text-[11px] font-semibold text-gray-500 truncate w-full text-center">{cat.name}</span>
                    </motion.button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Banners */}
          {banners.length > 0 && (
            <section className="-mx-4">
              <BannerCarousel banners={banners} />
            </section>
          )}

          {/* Nearby Stores */}
          <section>
            <SectionHead
              title={locName ? `Stores in ${locName}` : 'Stores near you'}
              subtitle={`Within ${radius}km${category ? ` · ${category}` : ''}`}
              href="/stores"
            />
            {storeQ.isLoading ? <StoreSkeletons /> : stores.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="text-5xl mb-4">📍</div>
                <h3 className="font-bold text-navy">No stores found</h3>
                <p className="text-sm text-gray-400 mt-1">Try increasing the radius or changing category</p>
                {radius < 10 && (
                  <Button variant="outline" onClick={() => setRadius(r => Math.min(r * 2, 10))} className="mt-4">
                    Increase to {Math.min(radius * 2, 10)}km
                  </Button>
                )}
              </div>
            ) : (
              <motion.div
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                variants={gridContainer}
                initial="hidden"
                animate="show"
              >
                {stores.map(s => <StoreCard key={s.id} store={s} />)}
              </motion.div>
            )}
          </section>

          {/* Flash Deals */}
          {(dealsQ.isLoading || deals.length > 0) && (
            <section>
              <div className="flex items-end justify-between mb-4 px-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-red-500 rounded-full" />
                  <div>
                    <h2 className="text-base font-extrabold text-navy leading-none">Flash Deals</h2>
                    <p className="text-xs text-red-500 font-semibold mt-0.5">Limited time offers near you</p>
                  </div>
                </div>
                <a href="/products" className="text-[11px] font-bold text-navy/50 hover:text-navy transition-colors uppercase tracking-wider">
                  See all →
                </a>
              </div>
              {dealsQ.isLoading
                ? <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="w-40 shrink-0 bg-white rounded-2xl border border-gray-100">
                        <div className="h-40 animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-t-2xl" />
                        <div className="p-2.5 space-y-2">
                          <div className="h-3 animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-full w-full" />
                          <div className="h-4 animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-full w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                : <motion.div
                    className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2"
                    variants={gridContainer}
                    initial="hidden"
                    animate="show"
                  >
                    {deals.map(p => (
                      <FlashDealCard key={p.id} product={p}
                        wishlisted={wishlisted.has(p.id)} onWishlist={() => toggleWishlist(p.id)} />
                    ))}
                  </motion.div>
              }
            </section>
          )}

          {/* Recently Viewed */}
          {recentlyViewed.length > 0 && (
            <section>
              <SectionHead title="Recently Viewed" />
              <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
                {recentlyViewed.map(p => (
                  <a key={p.id} href={`/products/${p.id}`}
                    className="w-28 shrink-0 bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="h-28 bg-gray-50 overflow-hidden">
                      {p.image
                        ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                        : <div className="w-full h-full flex items-center justify-center text-2xl">🛍️</div>}
                    </div>
                    <div className="p-2">
                      <p className="text-[11px] font-semibold text-gray-800 line-clamp-2 leading-snug">{p.name}</p>
                      <p className="text-xs font-black text-gray-900 mt-1">₹{p.price.toLocaleString('en-IN')}</p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Recommended for You */}
          {recommended.length > 0 && (
            <section>
              <SectionHead title="Recommended for You" subtitle="Based on your interests" />
              <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
                {recommended.map(p => (
                  <FlashDealCard key={p.id} product={p}
                    wishlisted={wishlisted.has(p.id)} onWishlist={() => toggleWishlist(p.id)} />
                ))}
              </div>
            </section>
          )}

          {/* Trending Products — Amazon-style grid */}
          {(prodQ.isLoading || products.length > 0) && (
            <section>
              <SectionHead title="Products near you" subtitle="Explore what's available" href="/products" />
              {prodQ.isLoading && products.length === 0
                ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="bg-white rounded-2xl border border-gray-100">
                        <div className="aspect-square animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-t-2xl" />
                        <div className="p-3 space-y-2">
                          <div className="h-3 animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-full w-2/3" />
                          <div className="h-4 animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-full" />
                          <div className="h-4 animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-full w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                : <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {products.map(p => (
                        <div key={p.id} onClick={() => { trackRecentlyViewed(p); setRecentlyViewed(loadRecentlyViewed()); }}>
                          <ProductCardGrid product={p as ProductData}
                            wishlisted={wishlisted.has(p.id)} onWishlist={() => toggleWishlist(p.id)} />
                        </div>
                      ))}
                    </div>
                    {prodQ.hasNextPage && (
                      <div className="mt-5 text-center">
                        <Button variant="outline" onClick={() => prodQ.fetchNextPage()}
                          disabled={prodQ.isFetchingNextPage} className="px-8">
                          {prodQ.isFetchingNextPage ? 'Loading…' : 'Load more products'}
                        </Button>
                      </div>
                    )}
                  </>
              }
            </section>
          )}
        </div>
      )}

    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Export
───────────────────────────────────────────────────────────────────────────── */
export default function HomeIsland({ banners = [], categories = [] }: { banners?: Banner[]; categories?: Category[] }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Inner initBanners={banners} initCategories={categories} />
    </QueryClientProvider>
  );
}
