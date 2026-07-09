import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';
import Img from '../ui/Img';

interface Product {
  id: string; name: string; category?: string;
  base_price?: string; sale_price?: number; min_price?: string;
  primary_image?: string; image?: string;
  is_on_sale?: boolean; status?: string;
  store_name?: string; store?: { id: string; name: string };
  store_id?: string; distance_km?: number; festival_tag?: string;
  is_wishlisted?: boolean;
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

function ProductCard({ product }: { product: Product }) {
  const qc      = useQueryClient();
  const img     = product.primary_image ?? product.image;
  const orig    = parseFloat(product.base_price ?? '0');
  const sale    = product.sale_price ?? null;
  const price   = sale ?? parseFloat(product.min_price ?? product.base_price ?? '0');
  const disc    = (product.is_on_sale && sale != null && sale < orig) ? Math.round((1 - sale / orig) * 100) : 0;
  const outOfStock = product.status === 'out_of_stock' || product.status === 'inactive';
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ns_access');
  const [wishlisted, setWishlisted] = useState(product.is_wishlisted ?? false);

  const wishMut = useMutation({
    mutationFn: () => api.post(`/products/${product.id}/wishlist/`),
    onMutate:   () => setWishlisted(w => !w),
    onError:    () => setWishlisted(w => !w),
  });

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isLoggedIn) { window.location.href = '/auth/login'; return; }
    wishMut.mutate();
  };

  return (
    <div className="relative group">
      <a href={`/products/${product.id}`}
        className="block bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
        <div className="relative h-48 bg-gray-50 overflow-hidden">
          <Img src={img} alt={product.name} fallback="product" loading="lazy"
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${outOfStock ? 'opacity-60' : ''}`} />
          {disc >= 5 && (
            <div className="absolute top-0 left-0 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-br-xl">{disc}% OFF</div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-black/70 text-white text-xs font-bold px-3 py-1 rounded-full">Out of Stock</span>
            </div>
          )}
          {product.festival_tag && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center">
              <span className="bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">🏷️ {product.festival_tag}</span>
            </div>
          )}
        </div>
        <div className="p-3">
          <p className="text-[10px] text-gray-400 truncate mb-0.5">{product.store_name ?? product.store?.name}</p>
          <h4 className="text-sm font-bold text-gray-800 line-clamp-2 leading-snug">{product.name}</h4>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-sm font-black text-navy">₹{price.toLocaleString('en-IN')}</span>
            {disc >= 5 && <span className="text-xs text-gray-400 line-through">₹{orig.toLocaleString('en-IN')}</span>}
          </div>
          {product.distance_km != null && (
            <p className="text-[10px] text-gray-400 mt-1">
              {product.distance_km < 1 ? `${Math.round(product.distance_km * 1000)}m away` : `${product.distance_km.toFixed(1)} km away`}
            </p>
          )}
        </div>
      </a>
      <button onClick={handleWishlist}
        className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-all ${
          wishlisted ? 'bg-red-500' : 'bg-white/90 hover:bg-white'
        } opacity-0 group-hover:opacity-100 md:opacity-100`}>
        <svg className={`w-3.5 h-3.5 ${wishlisted ? 'text-white' : 'text-gray-500'}`}
          fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
        </svg>
      </button>
    </div>
  );
}

function Skeletons() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
          <div className="h-48 bg-gray-200" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-gray-200 rounded-full w-1/2" />
            <div className="h-4 bg-gray-200 rounded-full w-3/4" />
            <div className="h-4 bg-gray-200 rounded-full w-1/3" />
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
  const [onSaleOnly, setOnSaleOnly] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const c = p.get('category');
    const sale = p.get('sale');
    if (c) setCategory(c);
    if (sale === '1') setOnSaleOnly(true);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['all-products', coords, radius, category, onSaleOnly],
    queryFn:  () => api.get('/products/nearby/', {
      params: {
        lat: coords.lat, lng: coords.lng, radius,
        ...(category ? { category } : {}),
        ...(onSaleOnly ? { is_on_sale: true } : {}),
        page_size: 100,
      },
    }).then(r => r.data),
  });

  const allProducts: Product[] = data?.results ?? (Array.isArray(data) ? data : []);
  const products = query.trim()
    ? allProducts.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.store_name ?? p.store?.name ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : allProducts;

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
          <h1 className="text-xl font-extrabold text-navy">Products near you</h1>
          <p className="text-xs text-gray-400">Within {radius}km{category ? ` · ${category}` : ''}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search products…"
          className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10 shadow-sm" />
        {query && (
          <button onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
        )}
      </div>

      {/* Category + sale filter */}
      <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide mb-5">
        <button onClick={() => setCategory(null)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all ${
            !category ? 'bg-navy text-white shadow-lg' : 'bg-white border border-gray-200 text-gray-600 hover:border-navy/30'
          }`}>All</button>
        <button onClick={() => setOnSaleOnly(v => !v)}
          className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
            onSaleOnly ? 'bg-red-500 text-white shadow-lg' : 'bg-white border border-gray-200 text-gray-600 hover:border-navy/30'
          }`}>🔥 Sale</button>
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
      {isLoading ? <Skeletons /> : products.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="text-5xl mb-4">🛍️</div>
          <h3 className="font-bold text-navy text-lg">No products found</h3>
          <p className="text-gray-400 text-sm mt-1">
            {query ? 'Try a different search term' : 'Try a different category or increase your radius'}
          </p>
          {(query || category || onSaleOnly) && (
            <button onClick={() => { setQuery(''); setCategory(null); setOnSaleOnly(false); }}
              className="mt-4 px-6 py-2 rounded-full bg-navy text-white text-sm font-bold hover:bg-navy/90 transition-colors">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3 font-medium">{products.length} product{products.length !== 1 ? 's' : ''} found</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </>
      )}
    </div>
  );
}

export default function AllProductsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <Inner />
    </QueryClientProvider>
  );
}
