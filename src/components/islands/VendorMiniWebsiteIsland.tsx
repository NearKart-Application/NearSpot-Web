import { useState } from 'react';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface StoreHour { day: number; open_time: string; close_time: string; is_closed: boolean }
interface Offer { id: string; title: string; description: string; discount_type: string; discount_value: number; code?: string }
interface Review { id: string; user_name: string; rating: number; comment: string; created_at: string }
interface Product {
  id: string; name: string; description: string; base_price: string;
  images: { image_url: string }[]; category: string;
}
interface Store {
  id: string; slug: string; name: string; description: string;
  category: string; logo_url: string; banner_url: string; phone: string;
  address: string; locality: string; city: string; state: string;
  is_open: boolean; is_verified: boolean; is_women_owned: boolean; is_home_based: boolean;
  rating: number; review_count: number;
  hours: StoreHour[]; offers: Offer[]; products: Product[]; reviews: Review[];
}

function StarRow({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(n => (
        <span key={n} className={n <= Math.round(value) ? 'text-amber-400' : 'text-gray-200'}>★</span>
      ))}
    </span>
  );
}

function formatDiscount(offer: Offer) {
  if (offer.discount_type === 'percentage') return `${offer.discount_value}% off`;
  if (offer.discount_type === 'flat')       return `₹${offer.discount_value} off`;
  return offer.title;
}

export default function VendorMiniWebsiteIsland({
  initialStore,
  storeSlug,
}: {
  initialStore: Store;
  storeSlug: string;
}) {
  const [store] = useState<Store>(initialStore);
  const [tab, setTab] = useState<'products' | 'hours' | 'reviews'>('products');

  const storePageUrl = `/stores/${store.id}`;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Banner */}
      <div className="relative h-48 sm:h-64 bg-gradient-to-br from-navy to-slate-700 overflow-hidden">
        {store.banner_url && (
          <img src={store.banner_url} alt="" className="w-full h-full object-cover opacity-70" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Store header card */}
      <div className="max-w-4xl mx-auto px-4 -mt-16 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl p-5 flex flex-col sm:flex-row gap-4 items-start">
          {/* Logo */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-white shadow-lg bg-amber-50 flex items-center justify-center shrink-0 overflow-hidden -mt-10 sm:-mt-14">
            {store.logo_url
              ? <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover" />
              : <span className="text-3xl font-black text-amber-500">{store.name[0]}</span>
            }
          </div>

          <div className="flex-1 min-w-0">
            {/* Name + badges */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-navy leading-tight">{store.name}</h1>
              {store.is_verified && (
                <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-2 py-0.5 font-medium">✓ Verified</span>
              )}
              {store.is_women_owned && (
                <span className="text-xs bg-pink-50 text-pink-600 border border-pink-200 rounded-full px-2 py-0.5">🌸 Women-owned</span>
              )}
            </div>

            {/* Rating */}
            {store.rating > 0 && (
              <div className="flex items-center gap-2 mb-1">
                <StarRow value={store.rating} />
                <span className="text-sm text-gray-500">{store.rating.toFixed(1)} · {store.review_count} reviews</span>
              </div>
            )}

            {/* Category + location */}
            <p className="text-sm text-gray-500">
              {store.category}
              {(store.locality || store.city) && ` · ${store.locality ? `${store.locality}, ` : ''}${store.city}${store.state ? `, ${store.state}` : ''}`}
            </p>

            {/* Open status */}
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full ${store.is_open ? 'bg-green-500' : 'bg-red-400'}`} />
              <span className={`text-xs font-medium ${store.is_open ? 'text-green-600' : 'text-red-500'}`}>
                {store.is_open ? 'Open now' : 'Closed'}
              </span>
            </div>

            {/* Description */}
            {store.description && (
              <p className="text-sm text-gray-600 mt-2 line-clamp-3">{store.description}</p>
            )}
          </div>
        </div>

        {/* CTA buttons */}
        <div className="flex gap-3 mt-4">
          {store.phone && (
            <a
              href={`tel:${store.phone}`}
              className="flex-1 flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50"
            >
              📞 Call
            </a>
          )}
          {store.phone && (
            <a
              href={`https://wa.me/91${store.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener"
              className="flex-1 flex items-center justify-center gap-2 border border-green-200 rounded-xl py-2.5 text-sm font-semibold text-green-700 bg-green-50 hover:bg-green-100"
            >
              💬 WhatsApp
            </a>
          )}
          <a
            href={storePageUrl}
            className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl py-2.5 text-sm font-semibold"
          >
            Reserve →
          </a>
        </div>

        {/* Offers strip */}
        {store.offers.length > 0 && (
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {store.offers.map(o => (
              <div key={o.id} className="shrink-0 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm">
                <span className="font-bold text-amber-700">{formatDiscount(o)}</span>
                {o.code && <span className="ml-2 text-xs text-amber-600 bg-amber-100 rounded px-1.5 py-0.5">{o.code}</span>}
                <p className="text-xs text-amber-600 mt-0.5">{o.title}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex mt-6 border-b border-gray-200 gap-6">
          {(['products', 'hours', 'reviews'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2 text-sm font-semibold capitalize border-b-2 transition-colors ${
                tab === t
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'products' ? `Products (${store.products.length})` : t === 'hours' ? 'Hours' : `Reviews (${store.review_count})`}
            </button>
          ))}
        </div>

        {/* Products tab */}
        {tab === 'products' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pb-10">
            {store.products.length === 0 && (
              <p className="col-span-3 text-center text-gray-400 py-12">No products listed yet.</p>
            )}
            {store.products.map(p => (
              <a key={p.id} href={`/products/${p.id}`} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="h-36 bg-gray-100 overflow-hidden">
                  {p.images?.[0]?.image_url
                    ? <img src={p.images[0].image_url} alt={p.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-3xl text-gray-300">🛍</div>
                  }
                </div>
                <div className="p-3">
                  <p className="font-semibold text-navy text-sm line-clamp-2 leading-snug">{p.name}</p>
                  <p className="text-amber-600 font-bold text-sm mt-1">₹{Number(p.base_price).toLocaleString('en-IN')}</p>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Hours tab */}
        {tab === 'hours' && (
          <div className="bg-white rounded-2xl shadow-sm mt-6 divide-y divide-gray-50 mb-10">
            {store.hours.length === 0 && (
              <p className="text-center text-gray-400 py-10">Hours not set.</p>
            )}
            {store.hours.map(h => (
              <div key={h.day} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="font-medium text-navy w-10">{DAY_NAMES[h.day]}</span>
                {h.is_closed
                  ? <span className="text-red-400">Closed</span>
                  : <span className="text-gray-600">{h.open_time} – {h.close_time}</span>
                }
              </div>
            ))}
          </div>
        )}

        {/* Reviews tab */}
        {tab === 'reviews' && (
          <div className="space-y-4 mt-6 pb-10">
            {store.reviews.length === 0 && (
              <p className="text-center text-gray-400 py-12">No reviews yet.</p>
            )}
            {store.reviews.map(r => (
              <div key={r.id} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-navy text-sm">{r.user_name}</span>
                  <StarRow value={r.rating} />
                </div>
                {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
                <p className="text-xs text-gray-400 mt-2">{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            ))}
            {store.review_count > 5 && (
              <a href={storePageUrl} className="block text-center text-sm text-amber-600 font-medium hover:underline">
                See all {store.review_count} reviews →
              </a>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="py-6 text-center text-xs text-gray-400 border-t border-gray-100">
          Powered by{' '}
          <a href="/" className="text-amber-500 font-semibold hover:underline">NearSpot</a>
          {' '}· Discover local stores near you
        </div>
      </div>
    </div>
  );
}
