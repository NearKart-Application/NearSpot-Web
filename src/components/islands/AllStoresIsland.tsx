import { useState, useEffect, useRef } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';
import Img from '../ui/Img';

const gridContainer = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const gridItem = { hidden: { opacity: 0, y: 20, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: 'easeOut' as const } } };

interface Store {
  id: string; name: string; category: string; locality?: string;
  avatar?: string; cover_image?: string; is_open: boolean;
  rating?: number; avg_rating?: number; review_count?: number;
  distance_km?: number; is_verified?: boolean; holiday_mode?: boolean;
  active_offer_labels?: string[]; top_offer_label?: string; open_status_label?: string;
}

const CATEGORIES = [
  { label: 'Fashion',     slug: 'fashion',     icon: '👔' },
  { label: 'Footwear',    slug: 'footwear',    icon: '👟' },
  { label: 'Jewellery',   slug: 'jewellery',   icon: '💍' },
  { label: 'Beauty',      slug: 'beauty',      icon: '💄' },
  { label: 'Electronics', slug: 'electronics', icon: '📱' },
  { label: 'Food',        slug: 'food',        icon: '🍽️' },
  { label: 'Gifts',       slug: 'gifts',       icon: '🎁' },
  { label: 'Decor',       slug: 'decor',       icon: '🛋️' },
  { label: 'Others',      slug: 'others',      icon: '🏷️' },
];

function loadCoords() {
  try { const r = localStorage.getItem('ns_coords'); if (r) return JSON.parse(r); } catch {}
  return { lat: 17.385, lng: 78.4867 };
}

function StoreCard({ store }: { store: Store }) {
  const rating  = store.rating ?? store.avg_rating ?? 0;
  const dist    = store.distance_km;
  const distTxt = dist == null ? '' : dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)} km`;
  const offers  = store.active_offer_labels ?? (store.top_offer_label ? [store.top_offer_label] : []);

  return (
    <a href={`/stores/${store.id}`}
      className="block bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
      <div className="relative h-36 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
        <Img src={store.cover_image} alt={store.name} fallback="store" loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        {!store.is_open && <div className="absolute inset-0 bg-black/25 z-[1]" />}
        <div className="absolute top-2.5 right-2.5 z-[2]">
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full shadow ${
            store.is_open ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
          }`}>{store.is_open ? 'OPEN' : 'CLOSED'}</span>
        </div>
        {offers.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-4">
            <p className="text-white text-[11px] font-semibold truncate">🎉 {offers[0]}</p>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
            <Img src={store.avatar} alt={store.name} fallback="avatar" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <h3 className="font-bold text-navy text-sm leading-tight truncate">{store.name}</h3>
              {store.is_verified && <span className="text-blue-500 text-xs shrink-0">✓</span>}
            </div>
            <p className="text-gray-400 text-xs mt-0.5 capitalize truncate">{store.category}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          {rating > 0 ? (
            <span className="flex items-center gap-0.5 font-semibold text-gray-700">
              <span className="text-amber-400">★</span>{parseFloat(String(rating ?? '0')).toFixed(1)}
              {store.review_count ? <span className="text-gray-400 font-normal">({store.review_count})</span> : null}
            </span>
          ) : (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">NEW</span>
          )}
          {distTxt && <><span className="text-gray-200">•</span><span>{distTxt}</span></>}
          {store.locality && <><span className="text-gray-200">•</span><span className="truncate">{store.locality}</span></>}
        </div>
        {store.holiday_mode && (
          <div className="mt-1.5 text-[11px] font-semibold text-orange-600 bg-orange-50 rounded-lg px-2 py-0.5 w-fit">🌴 On Holiday</div>
        )}
        {!store.is_open && !store.holiday_mode && store.open_status_label && (
          <p className="text-[11px] text-gray-400 mt-1">🕐 {store.open_status_label}</p>
        )}
      </div>
    </a>
  );
}

function Skeletons() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
          <div className="h-36 bg-gray-200" />
          <div className="p-3 space-y-2">
            <div className="h-3.5 bg-gray-200 rounded-full w-3/4" />
            <div className="h-3 bg-gray-200 rounded-full w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Inner() {
  const [coords]   = useState(loadCoords);
  const [radius]   = useState(10);
  const [query, setQuery]       = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Read ?category= from URL on mount
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const c = p.get('category');
    if (c) setCategory(c);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['all-stores', coords, radius, category],
    queryFn:  () => api.get('/stores/nearby/', {
      params: { lat: coords.lat, lng: coords.lng, radius, ...(category ? { category } : {}), page_size: 100 },
    }).then(r => r.data),
  });

  const allStores: Store[] = data?.results ?? (Array.isArray(data) ? data : []);
  const stores = query.trim()
    ? allStores.filter(s =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.locality?.toLowerCase().includes(query.toLowerCase()) ||
        s.category?.toLowerCase().includes(query.toLowerCase())
      )
    : allStores;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <a href="/" className="text-gray-400 hover:text-navy transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 className="text-xl font-extrabold text-navy">Stores near you</h1>
          <p className="text-xs text-gray-400">Within {radius}km{category ? ` · ${category}` : ''}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search stores by name or area…"
          className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10 shadow-sm" />
        {query && (
          <button onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
        )}
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide mb-5">
        <button onClick={() => setCategory(null)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all ${
            !category ? 'bg-navy text-white shadow-lg' : 'bg-white border border-gray-200 text-gray-600 hover:border-navy/30'
          }`}>All</button>
        {CATEGORIES.map(c => (
          <button key={c.slug} onClick={() => setCategory(category === c.slug ? null : c.slug)}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              category === c.slug ? 'bg-navy text-white shadow-lg' : 'bg-white border border-gray-200 text-gray-600 hover:border-navy/30'
            }`}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {isLoading ? <Skeletons /> : stores.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="text-5xl mb-4">🏪</div>
          <h3 className="font-bold text-navy text-lg">No stores found</h3>
          <p className="text-gray-400 text-sm mt-1">
            {query ? 'Try a different search term' : 'Try a different category or increase your radius'}
          </p>
          {(query || category) && (
            <button onClick={() => { setQuery(''); setCategory(null); }}
              className="mt-4 px-6 py-2 rounded-full bg-navy text-white text-sm font-bold hover:bg-navy/90 transition-colors">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3 font-medium">{stores.length} store{stores.length !== 1 ? 's' : ''} found</p>
          <motion.div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
            variants={gridContainer} initial="hidden" animate="show">
            {stores.map(s => (
              <motion.div key={s.id} variants={gridItem}>
                <StoreCard store={s} />
              </motion.div>
            ))}
          </motion.div>
        </>
      )}
    </div>
  );
}

export default function AllStoresIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <Inner />
    </QueryClientProvider>
  );
}
