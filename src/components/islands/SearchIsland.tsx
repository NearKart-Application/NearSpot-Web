import { useState, useMemo, useCallback, useEffect } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';
import { ProductCardGrid, ProductCardList, type ProductData } from '../ui/ProductCard';
import Img from '../ui/Img';
import { Button } from '@/components/ui/button';

const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.02 } },
};
const listItem = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  show:   { opacity: 1, y: 0,  scale: 1,   transition: { duration: 0.35, ease: 'easeOut' as const } },
};

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface Store {
  id: string; name: string; category: string; location?: string;
  avatar?: string; cover_image?: string;
  is_open: boolean; rating?: number; avg_rating?: number; review_count?: number;
  distance_km?: number; top_offer_label?: string; active_offer_labels?: string[];
  follower_count?: number; store_type?: string; is_verified?: boolean;
  open_status_label?: string;
}

type Tab      = 'products' | 'stores' | 'services';
type ViewMode = 'grid' | 'list';
type SortKey  = 'distance' | 'price_asc' | 'price_desc' | 'rating' | 'name';

const CATS = ['fashion','footwear','jewellery','electronics','beauty','food','gifts','decor','books','sports'];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'distance',   label: 'Nearest first'   },
  { key: 'price_asc',  label: 'Price: Low to High' },
  { key: 'price_desc', label: 'Price: High to Low' },
  { key: 'rating',     label: 'Top Rated'       },
  { key: 'name',       label: 'Name A–Z'        },
];

function loadCoords() {
  try { const r = localStorage.getItem('ns_coords'); if (r) return JSON.parse(r); } catch { /**/ }
  return { lat: 17.385, lng: 78.4867 };
}

/* ─── Store card ─────────────────────────────────────────────────────────── */
function StoreCard({ store, view }: { store: Store; view: ViewMode }) {
  const rating = store.rating ?? store.avg_rating ?? 0;
  const dist   = store.distance_km;
  const dTxt   = dist == null ? '' : dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`;
  const offers = store.active_offer_labels ?? (store.top_offer_label ? [store.top_offer_label] : []);

  if (view === 'list') return (
    <a href={`/stores/${store.id}`}
      className="flex gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md p-3.5 transition-shadow">
      <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden shrink-0">
        <Img src={store.cover_image ?? store.avatar} alt={store.name} fallback="store" loading="lazy"
          className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-navy text-sm flex items-center gap-1 min-w-0">
            <span className="truncate">{store.name}</span>
            {store.is_verified && <span className="shrink-0 text-blue-500 text-[10px] font-black">✓</span>}
          </h3>
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            store.is_open ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
          }`}>{store.is_open ? 'OPEN' : 'CLOSED'}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <p className="text-xs text-gray-400 capitalize">{store.category}{store.location ? ` · ${store.location}` : ''}</p>
          {store.store_type && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
              store.store_type === 'service' ? 'bg-amber-50 text-amber-600 border-amber-200'
              : store.store_type === 'home'  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-blue-50 text-blue-600 border-blue-200'
            }`}>{store.store_type === 'service' ? '🛠 Service' : store.store_type === 'home' ? '🏠 Home Biz' : '🛍 Products'}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
          {rating > 0 && (
            <span className="flex items-center gap-0.5 font-semibold text-gray-700">
              <span className="text-amber-400">★</span>{rating.toFixed(1)}
              {store.review_count ? <span className="text-gray-400 font-normal ml-0.5">({store.review_count})</span> : null}
            </span>
          )}
          {dTxt && <><span className="text-gray-200">·</span><span>📍 {dTxt}</span></>}
          {store.follower_count != null && <><span className="text-gray-200">·</span><span>{store.follower_count} followers</span></>}
        </div>
        {offers.length > 0 && (
          <p className="text-[11px] text-purple-600 font-semibold mt-1 truncate">🎉 {offers[0]}</p>
        )}
        {!store.is_open && store.open_status_label && (
          <p className="text-[11px] text-gray-400 mt-0.5">🕐 {store.open_status_label}</p>
        )}
      </div>
    </a>
  );

  return (
    <a href={`/stores/${store.id}`}
      className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden block">
      <div className="relative h-32 bg-gray-100 overflow-hidden">
        <Img src={store.cover_image} alt={store.name} fallback="store" loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        {!store.is_open && <div className="absolute inset-0 bg-black/25 z-[1]" />}
        <span className={`absolute top-2 right-2 z-[2] text-[10px] font-black px-2 py-0.5 rounded-full shadow ${
          store.is_open ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>{store.is_open ? 'OPEN' : 'CLOSED'}</span>
        {offers.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 pb-1.5 pt-4">
            <p className="text-white text-[10px] font-semibold truncate">🎉 {offers[0]}</p>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden shrink-0">
            <Img src={store.avatar} alt={store.name} fallback="avatar"
              className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-0.5 min-w-0">
              <p className="font-bold text-navy text-xs truncate">{store.name}</p>
              {store.is_verified && <span className="shrink-0 text-blue-500 text-[9px] font-black">✓</span>}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <p className="text-[10px] text-gray-400 capitalize">{store.category}</p>
              {store.store_type && (
                <span className={`text-[9px] font-bold px-1 py-0.5 rounded-full border ${
                  store.store_type === 'service' ? 'bg-amber-50 text-amber-600 border-amber-200'
                  : store.store_type === 'home'  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-blue-50 text-blue-600 border-blue-200'
                }`}>{store.store_type === 'service' ? '🛠' : store.store_type === 'home' ? '🏠' : '🛍'}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-gray-500">
          {rating > 0 && <span className="font-bold text-gray-700">★ {rating.toFixed(1)}</span>}
          {dTxt && <><span className="text-gray-200">·</span><span>{dTxt}</span></>}
        </div>
        {!store.is_open && store.open_status_label && (
          <p className="text-[10px] text-gray-400 mt-0.5">🕐 {store.open_status_label}</p>
        )}
      </div>
    </a>
  );
}

/* ─── Filter sidebar content ─────────────────────────────────────────────── */
function FilterPanel({
  tab, category, setCategory, radius, setRadius, onSale, setOnSale,
  isOpenOnly, setIsOpenOnly, minRating, setMinRating, maxPrice, setMaxPrice,
}: {
  tab: Tab; category: string | null; setCategory: (c: string | null) => void;
  radius: number; setRadius: (r: number) => void;
  onSale: boolean; setOnSale: (v: boolean) => void;
  isOpenOnly: boolean; setIsOpenOnly: (v: boolean) => void;
  minRating: number; setMinRating: (v: number) => void;
  maxPrice: number; setMaxPrice: (v: number) => void;
}) {
  return (
    <div className="space-y-6 text-sm">
      {/* Radius */}
      <div>
        <p className="font-black text-navy text-xs uppercase tracking-widest mb-3">Search Radius</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[1, 2, 5, 10].map(r => (
            <button key={r} onClick={() => setRadius(r)}
              className={`py-2 rounded-xl text-xs font-bold transition-all ${
                radius === r ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>{r}km</button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div>
        <p className="font-black text-navy text-xs uppercase tracking-widest mb-3">Category</p>
        <div className="space-y-1">
          <button onClick={() => setCategory(null)}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              !category ? 'bg-navy text-white' : 'hover:bg-gray-100 text-gray-600'
            }`}>All Categories</button>
          {CATS.map(c => (
            <button key={c} onClick={() => setCategory(category === c ? null : c)}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${
                category === c ? 'bg-navy text-white' : 'hover:bg-gray-100 text-gray-600'
              }`}>{c}</button>
          ))}
        </div>
      </div>

      {/* Rating */}
      <div>
        <p className="font-black text-navy text-xs uppercase tracking-widest mb-3">Min. Rating</p>
        <div className="space-y-1">
          {[0, 3, 3.5, 4, 4.5].map(r => (
            <button key={r} onClick={() => setMinRating(r)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                minRating === r ? 'bg-navy text-white' : 'hover:bg-gray-100 text-gray-600'
              }`}>
              {r === 0 ? 'Any rating' : (
                <>
                  {'★'.repeat(Math.floor(r))}
                  {r % 1 ? '½' : ''}
                  <span className="opacity-60">& above</span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div>
        <p className="font-black text-navy text-xs uppercase tracking-widest mb-3">Filters</p>
        <div className="space-y-2.5">
          {tab === 'products' && (
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-semibold text-gray-600">On sale only</span>
              <button onClick={() => setOnSale(!onSale)}
                className={`w-10 h-5 rounded-full relative transition-colors ${onSale ? 'bg-navy' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${onSale ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </label>
          )}
          {tab === 'stores' && (
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-semibold text-gray-600">Open now only</span>
              <button onClick={() => setIsOpenOnly(!isOpenOnly)}
                className={`w-10 h-5 rounded-full relative transition-colors ${isOpenOnly ? 'bg-navy' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isOpenOnly ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main inner ─────────────────────────────────────────────────────────── */
function Inner({ initTab }: { initTab: Tab }) {
  const qc = useQueryClient();
  const [tab,       setTab]       = useState<Tab>(initTab);
  const [query,     setQuery]     = useState('');
  const [view,      setView]      = useState<ViewMode>('grid');
  const [sort,      setSort]      = useState<SortKey>('distance');
  const [radius,    setRadius]    = useState(5);
  const [category,  setCategory]  = useState<string | null>(null);
  const [onSale,    setOnSale]    = useState(false);
  const [isOpenOnly,setIsOpenOnly]= useState(false);
  const [minRating, setMinRating] = useState(0);
  const [maxPrice,  setMaxPrice]  = useState(0);
  const [showFilter,setShowFilter]= useState(false);
  const [wishlisted,setWishlisted]= useState<Set<string>>(new Set());

  const [coords, setCoords] = useState(loadCoords);
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ns_access');

  // React to global location changes
  useEffect(() => {
    const handle = (e: Event) => {
      const { coords: c } = (e as CustomEvent).detail;
      setCoords(c);
    };
    document.addEventListener('ns:location-changed', handle);
    return () => document.removeEventListener('ns:location-changed', handle);
  }, []);

  const storeQ = useQuery({
    queryKey: ['search-stores', coords, radius],
    queryFn:  () => api.get('/stores/nearby/', { params: { lat: coords.lat, lng: coords.lng, radius } }).then(r => r.data),
    enabled:  tab === 'stores' || tab === 'services',
    staleTime: 60_000,
  });

  // Use /products/search/ for text queries (real backend search), /products/nearby/ for location-only
  const prodQ = useQuery({
    queryKey: ['search-products', coords, radius, query],
    queryFn: () => {
      const trimmed = query.trim();
      if (trimmed) {
        return api.get('/products/search/', {
          params: { q: trimmed, lat: coords.lat, lng: coords.lng }
        }).then(r => r.data);
      }
      return api.get('/products/nearby/', {
        params: { lat: coords.lat, lng: coords.lng, radius }
      }).then(r => r.data);
    },
    enabled:  tab === 'products',
    staleTime: 30_000,
  });

  const toggleWishlist = useCallback((id: string) => {
    if (!isLoggedIn) { window.location.href = '/auth/login'; return; }
    const wasIn = wishlisted.has(id);
    setWishlisted(prev => { const s = new Set(prev); wasIn ? s.delete(id) : s.add(id); return s; });
    api.post(`/products/${id}/wishlist/`).catch(() =>
      setWishlisted(prev => { const s = new Set(prev); wasIn ? s.add(id) : s.delete(id); return s; })
    );
  }, [wishlisted, isLoggedIn]);

  // Client-side filter + sort
  const rawStores: Store[]   = storeQ.data?.results ?? (Array.isArray(storeQ.data) ? storeQ.data : []);
  const rawProds:  ProductData[] = prodQ.data?.results ?? (Array.isArray(prodQ.data) ? prodQ.data : []);

  const filterStores = useCallback((src: Store[], serviceOnly?: boolean) => {
    let s = serviceOnly != null ? src.filter(x => serviceOnly ? x.store_type === 'service' : x.store_type !== 'service') : src;
    const q = query.trim().toLowerCase();
    if (q) s = s.filter(x => x.name.toLowerCase().includes(q) || x.category?.toLowerCase().includes(q));
    if (category) s = s.filter(x => x.category === category);
    if (isOpenOnly) s = s.filter(x => x.is_open);
    if (minRating > 0) s = s.filter(x => (x.rating ?? x.avg_rating ?? 0) >= minRating);
    return [...s].sort((a, b) => {
      if (sort === 'distance') return (a.distance_km ?? 99) - (b.distance_km ?? 99);
      if (sort === 'rating')   return (b.rating ?? b.avg_rating ?? 0) - (a.rating ?? a.avg_rating ?? 0);
      if (sort === 'name')     return a.name.localeCompare(b.name);
      return 0;
    });
  }, [rawStores, query, category, isOpenOnly, minRating, sort]);

  const stores   = useMemo(() => filterStores(rawStores, false), [filterStores, rawStores]);
  const services = useMemo(() => filterStores(rawStores, true),  [filterStores, rawStores]);

  const products = useMemo(() => {
    let p = rawProds;
    const q = query.trim().toLowerCase();
    // Skip client-side text filtering when backend already searched (products/search endpoint)
    if (q && p.length < 20) { /* results already filtered by backend */ }
    else if (q) p = p.filter(x => x.name.toLowerCase().includes(q) || x.category?.toLowerCase().includes(q) || (x.store_name ?? x.store?.name ?? '').toLowerCase().includes(q));
    if (category) p = p.filter(x => x.category === category);
    if (onSale)   p = p.filter(x => x.is_on_sale);
    if (minRating > 0) p = p.filter(x => (x.avg_rating ?? 0) >= minRating);
    const toN = (v: number | string | undefined | null) => typeof v === 'number' ? v : parseFloat(v as string || '0') || 0;
    if (maxPrice > 0)  p = p.filter(x => {
      const price = x.sale_price ?? toN(x.price ?? x.base_price);
      return price <= maxPrice;
    });
    return [...p].sort((a, b) => {
      const pa = a.sale_price ?? toN(a.price ?? a.base_price);
      const pb = b.sale_price ?? toN(b.price ?? b.base_price);
      if (sort === 'distance')  return (a.distance_km ?? 99) - (b.distance_km ?? 99);
      if (sort === 'price_asc') return pa - pb;
      if (sort === 'price_desc')return pb - pa;
      if (sort === 'rating')    return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
      if (sort === 'name')      return a.name.localeCompare(b.name);
      return 0;
    });
  }, [rawProds, query, category, onSale, minRating, sort]);

  const isLoading = tab === 'products' ? prodQ.isLoading : storeQ.isLoading;
  const resultCount = tab === 'products' ? products.length : tab === 'services' ? services.length : stores.length;
  const activeFilterCount = [
    category, onSale && tab === 'products', isOpenOnly && tab !== 'products',
    minRating > 0, radius !== 5,
  ].filter(Boolean).length;

  return (
    <div>
      {/* ── Top search bar ───────────────────────────────────────────────── */}
      <div className="sticky top-16 z-30 bg-white border-b border-gray-100 shadow-sm px-4 sm:px-6 lg:px-8 py-3 -mx-0">
        {/* Search input */}
        <div className="relative mb-3">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${tab}…`}
            className="w-full pl-10 pr-10 py-2.5 bg-gray-100 rounded-2xl text-sm border-0 outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white transition-all"
            autoFocus />
          {query && (
            <button onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-gray-400 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          )}
        </div>

        {/* Toolbar row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tab pills */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200 shrink-0">
            {([
              { key: 'products', label: '🛍 Products' },
              { key: 'stores',   label: '🏪 Stores'   },
              { key: 'services', label: '🛠 Services'  },
            ] as { key: Tab; label: string }[]).map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`px-4 py-1.5 text-xs font-bold transition-all ${
                  tab === key ? 'bg-navy text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}>{label}</button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="relative shrink-0">
            <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
              className="appearance-none pl-3 pr-7 py-1.5 bg-gray-100 rounded-xl text-xs font-bold text-gray-700 border-0 outline-none cursor-pointer hover:bg-gray-200 transition-colors">
              {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </div>

          {/* Filter button (mobile — sidebar always visible on desktop) */}
          <button onClick={() => setShowFilter(!showFilter)}
            className={`lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              showFilter || activeFilterCount > 0 ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600'
            }`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 bg-gold text-navy rounded-full text-[9px] font-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* View toggle (products only) */}
          {tab === 'products' && (
            <div className="flex rounded-xl overflow-hidden border border-gray-200 shrink-0 ml-auto">
              <button onClick={() => setView('grid')}
                className={`p-1.5 transition-colors ${view === 'grid' ? 'bg-navy text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                title="Grid view">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z"/>
                </svg>
              </button>
              <button onClick={() => setView('list')}
                className={`p-1.5 transition-colors ${view === 'list' ? 'bg-navy text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                title="List view">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Mobile filter panel */}
        {showFilter && (
          <div className="lg:hidden mt-3 p-4 bg-gray-50 rounded-2xl border border-gray-200">
            <FilterPanel tab={tab} category={category} setCategory={setCategory}
              radius={radius} setRadius={setRadius} onSale={onSale} setOnSale={setOnSale}
              isOpenOnly={isOpenOnly} setIsOpenOnly={setIsOpenOnly}
              minRating={minRating} setMinRating={setMinRating}
              maxPrice={maxPrice} setMaxPrice={setMaxPrice} />
          </div>
        )}
      </div>

      {/* ── Body: sidebar + results ──────────────────────────────────────── */}
      <div className="flex gap-6 px-4 sm:px-6 lg:px-8 pt-5">

        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-[9.5rem] bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-black text-navy text-sm">Filters</p>
              {activeFilterCount > 0 && (
                <button onClick={() => {
                  setCategory(null); setOnSale(false); setIsOpenOnly(false);
                  setMinRating(0); setMaxPrice(0); setRadius(5);
                }} className="text-xs text-red-500 font-bold hover:underline">
                  Clear all
                </button>
              )}
            </div>
            <FilterPanel tab={tab} category={category} setCategory={setCategory}
              radius={radius} setRadius={setRadius} onSale={onSale} setOnSale={setOnSale}
              isOpenOnly={isOpenOnly} setIsOpenOnly={setIsOpenOnly}
              minRating={minRating} setMinRating={setMinRating}
              maxPrice={maxPrice} setMaxPrice={setMaxPrice} />
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0 pb-20 md:pb-8">
          {/* Results count */}
          {!isLoading && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                <span className="font-bold text-navy">{resultCount}</span>
                {' '}{tab === 'services' ? 'service stores' : tab} found within {radius}km
                {query ? <> for <span className="font-bold text-navy">"{query}"</span></> : ''}
                {category ? <> in <span className="font-bold text-navy capitalize">{category}</span></> : ''}
              </p>
              {activeFilterCount > 0 && (
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {category && (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-navy/10 text-navy px-2 py-0.5 rounded-full capitalize">
                      {category}
                      <button onClick={() => setCategory(null)} className="opacity-60 hover:opacity-100">✕</button>
                    </span>
                  )}
                  {onSale && (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      On sale <button onClick={() => setOnSale(false)} className="opacity-60 hover:opacity-100">✕</button>
                    </span>
                  )}
                  {isOpenOnly && (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Open now <button onClick={() => setIsOpenOnly(false)} className="opacity-60 hover:opacity-100">✕</button>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {isLoading ? (
            view === 'grid' || tab === 'stores' ? (
              <div className={`grid gap-4 ${tab === 'products' ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'}`}>
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 animate-pulse">
                    <div className="aspect-square bg-gray-200 rounded-t-2xl" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 bg-gray-200 rounded-full w-2/3" />
                      <div className="h-4 bg-gray-200 rounded-full" />
                      <div className="h-4 bg-gray-200 rounded-full w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex gap-4 bg-white rounded-2xl border border-gray-100 p-3.5 animate-pulse">
                    <div className="w-24 h-24 bg-gray-200 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-4 bg-gray-200 rounded-full w-3/4" />
                      <div className="h-3 bg-gray-200 rounded-full w-1/2" />
                      <div className="h-5 bg-gray-200 rounded-full w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : resultCount === 0 ? (
            <div className="flex flex-col items-center py-24 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="font-bold text-navy text-xl">No {tab} found</h3>
              <p className="text-gray-400 text-sm mt-2 max-w-xs">
                {query ? `No results for "${query}". ` : ''}
                Try increasing the radius or changing filters.
              </p>
              <div className="flex gap-2 mt-5">
                {radius < 10 && (
                  <Button onClick={() => setRadius(r => Math.min(r * 2, 10))}
                    className="px-5">Expand to {Math.min(radius * 2, 10)}km</Button>
                )}
                {activeFilterCount > 0 && (
                  <Button variant="outline" onClick={() => {
                    setCategory(null); setOnSale(false); setIsOpenOnly(false); setMinRating(0);
                  }} className="px-5">Clear filters</Button>
                )}
              </div>
            </div>
          ) : tab === 'products' ? (
            view === 'grid' ? (
              <motion.div
                className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4"
                variants={listContainer} initial="hidden" animate="show"
              >
                {products.map(p => (
                  <motion.div key={p.id} variants={listItem}>
                    <ProductCardGrid product={p}
                      wishlisted={wishlisted.has(p.id)} onWishlist={() => toggleWishlist(p.id)} />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div className="space-y-3" variants={listContainer} initial="hidden" animate="show">
                {products.map(p => (
                  <motion.div key={p.id} variants={listItem}>
                    <ProductCardList product={p}
                      wishlisted={wishlisted.has(p.id)} onWishlist={() => toggleWishlist(p.id)} />
                  </motion.div>
                ))}
              </motion.div>
            )
          ) : (
            <motion.div
              className={`grid gap-4 ${view === 'grid' ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}
              variants={listContainer} initial="hidden" animate="show"
            >
              {(tab === 'services' ? services : stores).map(s => (
                <motion.div key={s.id} variants={listItem}>
                  <StoreCard store={s} view={view} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchIsland({ initTab = 'products' }: { initTab?: 'products' | 'stores' | 'services' }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Inner initTab={initTab} />
    </QueryClientProvider>
  );
}
