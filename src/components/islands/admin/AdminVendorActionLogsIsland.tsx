import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';
import { Button } from '@/components/ui/button';
import { Search, ArrowLeft, ChevronRight, ChevronLeft } from 'lucide-react';

interface ActionLog {
  id: string;
  store_id: string;
  store_name: string;
  user_phone: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  meta: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

interface StoreResult {
  id: string;
  name: string;
  owner_phone: string;
  locality: string;
  is_active: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  product_create:     'Product Created',
  product_update:     'Product Updated',
  product_delete:     'Product Deleted',
  image_upload:       'Image Uploaded',
  image_delete:       'Image Deleted',
  stock_update:       'Stock Updated',
  stock_bulk_update:  'Bulk Stock Update',
  offer_create:       'Offer Created',
  offer_delete:       'Offer Deleted',
  store_update:       'Store Updated',
  store_hours_update: 'Hours Updated',
};

const ACTION_COLORS: Record<string, string> = {
  product_create:     'bg-emerald-50 text-emerald-700',
  product_update:     'bg-blue-50 text-blue-700',
  product_delete:     'bg-red-50 text-red-700',
  image_upload:       'bg-purple-50 text-purple-700',
  image_delete:       'bg-red-50 text-red-600',
  stock_update:       'bg-amber-50 text-amber-700',
  stock_bulk_update:  'bg-amber-50 text-amber-800',
  offer_create:       'bg-teal-50 text-teal-700',
  offer_delete:       'bg-gray-100 text-gray-600',
  store_update:       'bg-indigo-50 text-indigo-700',
  store_hours_update: 'bg-cyan-50 text-cyan-700',
};

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
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

function MetaCell({ meta }: { meta: Record<string, unknown> }) {
  if (!meta || Object.keys(meta).length === 0) return <span className="text-gray-300">—</span>;
  const parts = Object.entries(meta)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${v}`);
  return (
    <span className="text-gray-500 text-xs leading-tight" title={JSON.stringify(meta, null, 2)}>
      {parts.slice(0, 3).join(', ')}
      {parts.length > 3 && <span className="text-gray-400"> +{parts.length - 3}</span>}
    </span>
  );
}

// ── Store Selector ────────────────────────────────────────────────────────────

function StoreSelector({ onSelect }: { onSelect: (id: string, name: string) => void }) {
  const [search, setSearch] = useState('');
  const dSearch = useDebounce(search, 350);

  const { data, isLoading } = useQuery<{ count: number; results: StoreResult[] }>({
    queryKey: ['action-log-store-search', dSearch],
    queryFn: () =>
      api.get('/admin-panel/stores/', { params: { search: dSearch, page_size: 8 } }).then((r) => r.data),
    staleTime: 30 * 1000,
  });

  const stores = data?.results ?? [];

  return (
    <div className="max-w-xl mx-auto">
      <div className="card p-6 space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-700">Select a store to view vendor action logs</p>
          <p className="text-xs text-gray-400 mt-0.5">Search by name or phone number</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search stores…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 w-full"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          {isLoading && (
            [...Array(4)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
            ))
          )}
          {!isLoading && stores.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id, s.name)}
              className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-navy/30 hover:bg-gray-50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.owner_phone} · {s.locality}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            </button>
          ))}
          {!isLoading && stores.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-4">No stores found</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Store Action Log ──────────────────────────────────────────────────────────

function StoreActionLog({ storeId, storeName, onBack }: { storeId: string; storeName: string; onBack: () => void }) {
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);

  const PAGE_SIZE = 50;
  const dSearch   = useDebounce(search, 350);

  useEffect(() => { setPage(1); }, [actionFilter, dSearch, dateFrom, dateTo]);

  const { data, isLoading, error, refetch } = useQuery<{ count: number; results: ActionLog[] }>({
    queryKey: ['admin-vendor-action-logs', storeId, actionFilter, dSearch, dateFrom, dateTo, page],
    queryFn: () =>
      api.get('/admin-panel/vendor-action-logs/', {
        params: {
          store_id: storeId,
          page,
          page_size: PAGE_SIZE,
          ...(actionFilter && { action:    actionFilter }),
          ...(dSearch      && { search:    dSearch }),
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
          <p className="font-semibold text-gray-800">{storeName}</p>
          <p className="text-xs text-gray-400">Vendor action log · {totalCount.toLocaleString()} entries</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search product name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 w-52"
            />
          </div>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input text-xs w-36" title="From" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input text-xs w-36" title="To" />
        </div>

        {/* Action chips */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setActionFilter('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              actionFilter === ''
                ? 'text-white border-transparent'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            style={actionFilter === '' ? { backgroundColor: '#0F172A' } : {}}
          >
            All
          </button>
          {ALL_ACTIONS.map((a) => (
            <button
              key={a}
              onClick={() => setActionFilter(a === actionFilter ? '' : a)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                actionFilter === a
                  ? 'text-white border-transparent'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
              style={actionFilter === a ? { backgroundColor: '#0F172A' } : {}}
            >
              {ACTION_LABELS[a]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {error ? (
        <div className="card p-8 text-center">
          <p className="font-semibold text-gray-700">Failed to load logs</p>
          <Button onClick={() => refetch()} className="mt-3" size="sm">Retry</Button>
        </div>
      ) : (
        <div className={`card overflow-hidden transition-opacity ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-left">
                  <th className="px-4 py-2.5 font-semibold">Action</th>
                  <th className="px-4 py-2.5 font-semibold">Entity</th>
                  <th className="px-4 py-2.5 font-semibold">Details</th>
                  <th className="px-4 py-2.5 font-semibold">Done by</th>
                  <th className="px-4 py-2.5 font-semibold">IP</th>
                  <th className="px-4 py-2.5 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && logs.length === 0
                  ? [...Array(6)].map((_, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        {[...Array(6)].map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-3 bg-gray-200 rounded animate-pulse w-24" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : logs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                            {ACTION_LABELS[log.action] ?? log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-700 font-medium truncate max-w-[160px]" title={log.entity_name}>
                            {log.entity_name || '—'}
                          </div>
                          <div className="text-gray-400 text-xs">{log.entity_type}</div>
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <MetaCell meta={log.meta} />
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-600">
                          {log.user_phone || '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-500">
                          {log.ip_address ?? '—'}
                        </td>
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
            <p className="text-center text-gray-400 py-10 text-sm">No action logs match your filters</p>
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
  const [selectedStoreId,   setSelectedStoreId]   = useState('');
  const [selectedStoreName, setSelectedStoreName] = useState('');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const sid  = p.get('store_id')   ?? '';
    const sn   = p.get('store_name') ?? '';
    if (sid) { setSelectedStoreId(sid); setSelectedStoreName(decodeURIComponent(sn)); }
  }, []);

  function handleSelect(id: string, name: string) {
    setSelectedStoreId(id);
    setSelectedStoreName(name);
    window.history.replaceState({}, '', `/admin/vendor-action-logs?store_id=${id}&store_name=${encodeURIComponent(name)}`);
  }

  function handleBack() {
    setSelectedStoreId('');
    setSelectedStoreName('');
    window.history.replaceState({}, '', '/admin/vendor-action-logs');
  }

  return selectedStoreId
    ? <StoreActionLog storeId={selectedStoreId} storeName={selectedStoreName} onBack={handleBack} />
    : <StoreSelector onSelect={handleSelect} />;
}

export default function AdminVendorActionLogsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <Inner />
      </AdminShell>
    </QueryClientProvider>
  );
}
