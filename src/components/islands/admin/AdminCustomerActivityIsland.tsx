import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';
import { Button } from '@/components/ui/button';
import {
  Search, ArrowLeft, ChevronLeft, ChevronRight,
  Eye, Store, SearchIcon, Heart, HeartOff, ShoppingBag,
} from 'lucide-react';

interface ActivityLog {
  id: string;
  phone: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  meta: Record<string, unknown>;
  ip_address: string | null;
  city: string;
  device_type: string;
  created_at: string;
}

interface CustomerResult {
  id: string;
  phone_number: string;
  full_name: string;
  location_city: string;
  is_active: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  product_view:       'Viewed Product',
  store_view:         'Visited Store',
  search:             'Searched',
  wishlist_add:       'Wishlisted',
  wishlist_remove:    'Unwishlisted',
  reservation_create: 'Reserved',
};

const ACTION_COLORS: Record<string, string> = {
  product_view:       'bg-blue-50 text-blue-700',
  store_view:         'bg-indigo-50 text-indigo-700',
  search:             'bg-gray-100 text-gray-700',
  wishlist_add:       'bg-pink-50 text-pink-700',
  wishlist_remove:    'bg-gray-100 text-gray-500',
  reservation_create: 'bg-emerald-50 text-emerald-700',
};

function ActionIcon({ action }: { action: string }) {
  const cls = 'w-4 h-4';
  switch (action) {
    case 'product_view':       return <Eye className={`${cls} text-blue-400`} />;
    case 'store_view':         return <Store className={`${cls} text-indigo-400`} />;
    case 'search':             return <SearchIcon className={`${cls} text-gray-400`} />;
    case 'wishlist_add':       return <Heart className={`${cls} text-pink-400`} />;
    case 'wishlist_remove':    return <HeartOff className={`${cls} text-gray-400`} />;
    case 'reservation_create': return <ShoppingBag className={`${cls} text-emerald-500`} />;
    default:                   return <Eye className={`${cls} text-gray-300`} />;
  }
}

const ALL_ACTIONS = Object.keys(ACTION_LABELS);

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'Just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ── Customer Selector ─────────────────────────────────────────────────────────

function CustomerSelector({ onSelect }: { onSelect: (phone: string, name: string) => void }) {
  const [search, setSearch] = useState('');
  const dSearch = useDebounce(search, 350);

  const { data, isLoading } = useQuery<{ count: number; results: CustomerResult[] }>({
    queryKey: ['cust-search-activity', dSearch],
    queryFn: () =>
      api.get('/admin-panel/users/', {
        params: { search: dSearch, role: 'customer', page_size: 8 },
      }).then((r) => r.data),
    staleTime: 30 * 1000,
    enabled: dSearch.length > 0,
  });

  const customers = data?.results ?? [];

  return (
    <div className="max-w-xl mx-auto">
      <div className="card p-6 space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-700">Select a customer to view their activity</p>
          <p className="text-xs text-gray-400 mt-0.5">Search by phone number or name</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 w-full"
            autoFocus
          />
        </div>

        {dSearch.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-4">Type to search customers</p>
        )}

        <div className="space-y-2">
          {isLoading && dSearch.length > 0 && (
            [...Array(4)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
            ))
          )}
          {!isLoading && customers.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.phone_number, c.full_name || c.phone_number)}
              className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-navy/30 hover:bg-gray-50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{c.full_name || '—'}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{c.phone_number} · {c.location_city || 'no city'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${c.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            </button>
          ))}
          {!isLoading && dSearch.length > 0 && customers.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-4">No customers found</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Customer Activity Timeline ────────────────────────────────────────────────

function CustomerActivityTimeline({
  phone,
  customerName,
  onBack,
}: {
  phone: string;
  customerName: string;
  onBack: () => void;
}) {
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [page,         setPage]         = useState(1);

  const PAGE_SIZE = 50;
  useEffect(() => { setPage(1); }, [actionFilter, dateFrom, dateTo]);

  const { data, isLoading, error, refetch } = useQuery<{ count: number; results: ActivityLog[] }>({
    queryKey: ['admin-customer-activity', phone, actionFilter, dateFrom, dateTo, page],
    queryFn: () =>
      api.get('/admin-panel/customer-activity/', {
        params: {
          phone,
          page,
          page_size: PAGE_SIZE,
          ...(actionFilter && { action:    actionFilter }),
          ...(dateFrom     && { date_from: dateFrom }),
          ...(dateTo       && { date_to:   dateTo }),
        },
      }).then((r) => r.data),
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const logs       = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </button>
        <div>
          <p className="font-semibold text-gray-800">{customerName}</p>
          <p className="text-xs text-gray-400 font-mono">{phone} · {totalCount.toLocaleString()} events</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input text-xs w-36" title="From" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input text-xs w-36" title="To" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['', ...ALL_ACTIONS].map((a) => (
            <button
              key={a}
              onClick={() => setActionFilter(a)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                actionFilter === a
                  ? 'text-white border-transparent'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
              style={actionFilter === a ? { backgroundColor: '#0F172A' } : {}}
            >
              {a === '' ? 'All' : ACTION_LABELS[a]}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline / Table */}
      {error ? (
        <div className="card p-8 text-center">
          <p className="font-semibold text-gray-700">Failed to load activity</p>
          <Button onClick={() => refetch()} className="mt-3" size="sm">Retry</Button>
        </div>
      ) : (
        <div className={`card overflow-hidden transition-opacity ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-left">
                  <th className="px-4 py-2.5 font-semibold w-8"></th>
                  <th className="px-4 py-2.5 font-semibold">Action</th>
                  <th className="px-4 py-2.5 font-semibold">What</th>
                  <th className="px-4 py-2.5 font-semibold">Details</th>
                  <th className="px-4 py-2.5 font-semibold">City</th>
                  <th className="px-4 py-2.5 font-semibold">Device</th>
                  <th className="px-4 py-2.5 font-semibold">IP</th>
                  <th className="px-4 py-2.5 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && logs.length === 0
                  ? [...Array(8)].map((_, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        {[...Array(8)].map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-3 bg-gray-200 rounded animate-pulse w-20" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : logs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <ActionIcon action={log.action} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                            {ACTION_LABELS[log.action] ?? log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-800 font-medium truncate max-w-[180px]" title={log.entity_name}>
                            {log.entity_name || '—'}
                          </div>
                          {log.entity_type && (
                            <div className="text-gray-400">{log.entity_type}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-[160px]">
                          {log.action === 'search' && log.meta?.results !== undefined ? (
                            <span className="text-gray-500">{log.meta.results as number} results</span>
                          ) : log.action === 'reservation_create' && log.meta?.quantity ? (
                            <span className="text-gray-500">qty {log.meta.quantity as number}</span>
                          ) : log.meta && Object.keys(log.meta).length > 0 ? (
                            <span className="text-gray-400 truncate">
                              {Object.entries(log.meta).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(', ')}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{log.city || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 capitalize">{log.device_type || '—'}</td>
                        <td className="px-4 py-3 font-mono text-gray-400">{log.ip_address ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap" title={log.created_at}>
                          {formatRelative(log.created_at)}
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
          {!isLoading && logs.length === 0 && (
            <p className="text-center text-gray-400 py-10 text-sm">No activity found for this customer</p>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages} · {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(page * PAGE_SIZE, totalCount).toLocaleString()} of {totalCount.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setPage(1)} disabled={page === 1} className="px-2">«</Button>
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | '…')[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '…' ? (
                  <span key={`e-${i}`} className="px-1 text-gray-400 text-sm">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                      page === p ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                    style={page === p ? { backgroundColor: '#0F172A' } : {}}
                  >
                    {p}
                  </button>
                )
              )}
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2">»</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

function Inner() {
  const [selectedPhone, setSelectedPhone] = useState('');
  const [selectedName,  setSelectedName]  = useState('');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const ph = p.get('phone') ?? '';
    const nm = p.get('name')  ?? '';
    if (ph) { setSelectedPhone(ph); setSelectedName(decodeURIComponent(nm)); }
  }, []);

  function handleSelect(phone: string, name: string) {
    setSelectedPhone(phone);
    setSelectedName(name);
    window.history.replaceState({}, '', `/admin/customer-activity?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(name)}`);
  }

  function handleBack() {
    setSelectedPhone('');
    setSelectedName('');
    window.history.replaceState({}, '', '/admin/customer-activity');
  }

  return selectedPhone
    ? <CustomerActivityTimeline phone={selectedPhone} customerName={selectedName} onBack={handleBack} />
    : <CustomerSelector onSelect={handleSelect} />;
}

export default function AdminCustomerActivityIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <Inner />
      </AdminShell>
    </QueryClientProvider>
  );
}
