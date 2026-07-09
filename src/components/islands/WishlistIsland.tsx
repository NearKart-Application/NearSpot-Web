import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';
import Img from '../ui/Img';

interface WishlistProduct {
  id: string; name: string; category?: string; store_name?: string;
  base_price: string; min_price?: string; sale_price?: number; price?: string;
  primary_image?: string; image?: string;
  is_on_sale?: boolean; status?: string; distance_km?: number;
  store?: { id: string; name: string };
}

function ProductCard({ product, onRemove, onNotify }: { product: WishlistProduct; onRemove: () => void; onNotify: () => void }) {
  const img     = product.primary_image ?? product.image;
  const orig    = parseFloat(product.base_price ?? '0');
  const sale    = product.sale_price ?? null;
  const price   = sale ?? parseFloat(product.min_price ?? product.price ?? product.base_price ?? '0');
  const hasOff  = product.is_on_sale && sale != null && sale < orig;
  const disc    = hasOff ? Math.round((1 - sale! / orig) * 100) : 0;
  const outOfStock = product.status === 'out_of_stock' || product.status === 'inactive';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <a href={`/products/${product.id}`} className="block">
        <div className="relative h-44 bg-gray-100 overflow-hidden">
          <Img src={img} alt={product.name} fallback="product" loading="lazy"
            className={`w-full h-full object-cover hover:scale-105 transition-transform duration-300 ${outOfStock ? 'opacity-60' : ''}`} />
          {hasOff && (
            <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow">
              {disc}% OFF
            </span>
          )}
          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-gray-800/70 text-white text-xs font-bold px-3 py-1.5 rounded-xl">Out of Stock</span>
            </div>
          )}
        </div>
      </a>
      <div className="p-3 flex flex-col flex-1">
        <p className="text-[11px] text-gray-400 truncate">{product.store_name ?? product.store?.name}</p>
        <a href={`/products/${product.id}`}>
          <h3 className="text-sm font-bold text-navy mt-0.5 line-clamp-2 leading-tight hover:text-navy/80 transition-colors">{product.name}</h3>
        </a>
        {product.category && (
          <p className="text-[11px] text-gray-400 capitalize mt-0.5">{product.category}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-base font-black text-navy">₹{price.toLocaleString('en-IN')}</span>
          {hasOff && <span className="text-xs text-gray-400 line-through">₹{orig.toLocaleString('en-IN')}</span>}
        </div>
        {product.distance_km != null && (
          <p className="text-[11px] text-gray-400 mt-0.5">
            {product.distance_km < 1 ? `${Math.round(product.distance_km * 1000)}m away` : `${product.distance_km.toFixed(1)} km away`}
          </p>
        )}
        <div className="flex gap-2 mt-3 mt-auto pt-2">
          {outOfStock ? (
            <button onClick={onNotify}
              className="flex-1 text-center py-2 rounded-xl bg-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-300 transition-colors">
              🔔 Notify Me
            </button>
          ) : (
            <a href={`/products/${product.id}`}
              className="flex-1 text-center py-2 rounded-xl bg-navy text-white text-xs font-bold hover:bg-navy/90 transition-colors">
              Reserve
            </a>
          )}
          <button onClick={onRemove}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-red-100 bg-red-50 hover:bg-red-100 transition-colors">
            <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function Inner() {
  const qc = useQueryClient();
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ns_access');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['wishlist'],
    queryFn:  () => api.get('/products/wishlist/').then(r => r.data),
    enabled:  isLoggedIn,
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api.post(`/products/${id}/wishlist/`),
    onMutate: (id) => setRemoving(p => new Set(p).add(id)),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['wishlist'] });
      setRemoving(p => { const s = new Set(p); s.delete(id); return s; });
    },
    onError: (_, id) => setRemoving(p => { const s = new Set(p); s.delete(id); return s; }),
  });

  const watchMut = useMutation({
    mutationFn: (id: string) => api.post(`/products/${id}/watch/`),
  });

  if (!isLoggedIn) return (
    <div className="flex flex-col items-center py-24 text-center px-6">
      <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center mb-5">
        <svg className="w-10 h-10 text-red-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
        </svg>
      </div>
      <h2 className="text-xl font-black text-navy">Sign in to see your wishlist</h2>
      <p className="text-gray-400 text-sm mt-2 max-w-xs">Save your favourite items and get notified about price drops and availability.</p>
      <a href="/auth/login" className="mt-6 btn-primary px-10 py-3">Sign In</a>
    </div>
  );

  const products: WishlistProduct[] = data?.results ?? (Array.isArray(data) ? data : []);

  if (isError) return (
    <div className="flex flex-col items-center py-24 text-center px-6">
      <div className="text-5xl mb-4">⚠️</div>
      <h2 className="text-xl font-black text-navy">Failed to load wishlist</h2>
      <p className="text-sm text-gray-400 mt-2">Please check your connection and try again.</p>
      <a href="/customer/wishlist" className="mt-6 btn-primary px-10 py-3">Retry</a>
    </div>
  );

  if (isLoading) return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 animate-pulse">
          <div className="h-44 bg-gray-200 rounded-t-2xl" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-gray-200 rounded-full w-2/3" />
            <div className="h-4 bg-gray-200 rounded-full" />
            <div className="h-4 bg-gray-200 rounded-full w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  if (!products.length) return (
    <div className="flex flex-col items-center py-24 text-center px-6">
      <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center mb-5">
        <svg className="w-10 h-10 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
        </svg>
      </div>
      <h2 className="text-xl font-black text-navy">Your wishlist is empty</h2>
      <p className="text-gray-400 text-sm mt-2 max-w-xs">Start saving products you love. Tap the heart icon on any product to add it here.</p>
      <a href="/" className="mt-6 btn-primary px-10 py-3">Browse Stores</a>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-navy">My Wishlist</h1>
          <p className="text-sm text-gray-400">{products.length} saved item{products.length !== 1 ? 's' : ''}</p>
        </div>
        {products.length > 0 && (
          <a href="/" className="text-xs font-bold text-navy/60 hover:text-navy transition-colors uppercase tracking-wider">
            + Add more →
          </a>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {products.filter(p => !removing.has(p.id)).map(p => (
          <ProductCard key={p.id} product={p} onRemove={() => removeMut.mutate(p.id)} onNotify={() => watchMut.mutate(p.id)} />
        ))}
      </div>
    </div>
  );
}

export default function WishlistIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <Inner />
    </QueryClientProvider>
  );
}
