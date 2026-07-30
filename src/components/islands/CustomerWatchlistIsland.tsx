import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';

interface WatchlistItem {
  id: string;
  product: string;
  product_name: string;
  notified_at: string | null;
  created_at: string;
}

function Inner() {
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ns_access');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['customer-watchlist'],
    queryFn: () => api.get('/inventory/watchlist/').then(r => r.data),
    enabled: isLoggedIn,
  });

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center py-24 text-center px-6">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-black text-navy">Sign in to view your watchlist</h2>
        <p className="text-gray-400 text-sm mt-2 max-w-xs">
          Your watchlist tracks out-of-stock products you want to be notified about when they come back.
        </p>
        <a href="/auth/login" className="mt-6 btn-primary px-10 py-3">Sign In</a>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center py-24 text-center px-6">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-black text-navy">Failed to load watchlist</h2>
        <p className="text-sm text-gray-400 mt-2">Please check your connection and try again.</p>
        <a href="/customer/watchlist" className="mt-6 btn-primary px-10 py-3">Retry</a>
      </div>
    );
  }

  const items: WatchlistItem[] = data?.results ?? (Array.isArray(data) ? data : []);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center py-24 text-center px-6">
        <div className="text-5xl mb-4">👀</div>
        <h2 className="text-xl font-black text-navy">Your watchlist is empty</h2>
        <p className="text-gray-400 text-sm mt-2 max-w-xs">
          When a product you want is out of stock, tap "Notify me" on the product page. We'll alert you when it's back.
        </p>
        <a href="/" className="mt-6 btn-primary px-10 py-3">Browse Products</a>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-navy">My Watchlist</h1>
          <p className="text-sm text-gray-400">{items.length} product{items.length !== 1 ? 's' : ''} being watched</p>
        </div>
      </div>

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center shrink-0">
              <span className="text-lg">👀</span>
            </div>
            <div className="flex-1 min-w-0">
              <a href={`/products/${item.product}`} className="font-bold text-navy hover:underline truncate block">
                {item.product_name}
              </a>
              <p className="text-xs text-gray-400 mt-0.5">
                Added {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div className="shrink-0">
              {item.notified_at ? (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                  ✅ Notified
                </span>
              ) : (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                  ⏳ Watching
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CustomerWatchlistIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <Inner />
    </QueryClientProvider>
  );
}
