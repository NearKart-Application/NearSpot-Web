import { useState, useCallback } from 'react';
import { QueryClientProvider, useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StockLogEntry {
  id: string;
  product_name: string;
  variant_name?: string;
  old_qty: number;
  new_qty: number;
  delta: number;
  reason: string;
  note?: string;
  changed_by?: string;
  created_at: string;
}

interface InvoiceItem { name: string; qty: number; price: number | string; returned_qty?: number; }
interface Invoice {
  id: string;
  customer_name: string;
  customer_ns_code?: string;
  items: InvoiceItem[];
  total: number | string;
  is_sent: boolean;
  created_at: string;
}

interface POItem { sku: string; qty: number; unit_cost: number; }
interface PurchaseOrder {
  id: string;
  po_number?: string;
  supplier_name?: string;
  status: string;
  items: POItem[];
  total_cost: number;
  created_at: string;
}

interface AuditItem { sku: string; discrepancy: number; }
interface Audit {
  id: string;
  status: string;
  items: AuditItem[];
  total_discrepancy: number;
  notes?: string;
  completed_at: string | null;
  created_at: string;
}

interface PagedResponse<T> { results: T[]; next: string | null; count: number; }

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = ['Activity', 'Returns', 'Invoices', 'Purchases', 'Audits', 'Earnings'] as const;
type Tab = typeof TABS[number];

const ACTIVITY_REASONS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'manual', label: 'Manual' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'restock', label: 'Restock' },
  { value: 'reservation', label: 'Reserved' },
  { value: 'restoration', label: 'Restored' },
  { value: 'return_from_customer', label: 'Return' },
  { value: 'damage', label: 'Damage' },
  { value: 'audit_adjustment', label: 'Audit' },
];

const REASON_COLORS: Record<string, string> = {
  manual: 'text-gray-600 bg-gray-100',
  invoice: 'text-blue-700 bg-blue-100',
  restock: 'text-green-700 bg-green-100',
  reservation: 'text-purple-700 bg-purple-100',
  restoration: 'text-teal-700 bg-teal-100',
  return_from_customer: 'text-amber-700 bg-amber-100',
  damage: 'text-red-700 bg-red-100',
  audit_adjustment: 'text-indigo-700 bg-indigo-100',
};

const REASON_LABELS: Record<string, string> = {
  manual: 'Manual',
  invoice: 'Invoice',
  restock: 'Restock',
  reservation: 'Reserved',
  restoration: 'Restored',
  return_from_customer: 'Customer Return',
  damage: 'Damage',
  audit_adjustment: 'Audit Adj.',
};

const REASON_ICONS: Record<string, string> = {
  manual: '✏️',
  invoice: '🧾',
  restock: '📦',
  reservation: '📅',
  restoration: '↩️',
  return_from_customer: '🔄',
  damage: '⚠️',
  audit_adjustment: '🔍',
};

const PO_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
};

const PO_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', received: 'Received', cancelled: 'Cancelled',
};

const AUDIT_STATUS_COLORS: Record<string, string> = {
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
};

const AUDIT_STATUS_LABELS: Record<string, string> = {
  in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled',
};

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function EmptyState({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="card p-12 text-center text-gray-400">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="font-semibold text-gray-500">{label}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="card h-14 animate-pulse bg-gray-50" />
      ))}
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Stock Log Row ─────────────────────────────────────────────────────────────

function StockLogRow({ entry }: { entry: StockLogEntry }) {
  const color = REASON_COLORS[entry.reason] ?? 'text-gray-600 bg-gray-100';
  const icon  = REASON_ICONS[entry.reason]  ?? '📝';
  const label = REASON_LABELS[entry.reason] ?? entry.reason;
  const isPositive = entry.delta >= 0;

  return (
    <div className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/60 transition-colors border-b border-gray-50 last:border-0">
      <div className="text-xl mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-navy text-sm truncate">{entry.product_name}</span>
          {entry.variant_name && (
            <span className="text-xs text-gray-400">· {entry.variant_name}</span>
          )}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>{label}</span>
        </div>
        {entry.note && <p className="text-xs text-gray-500 mt-0.5 truncate">{entry.note}</p>}
        <p className="text-[11px] text-gray-400 mt-0.5">{fmtDateTime(entry.created_at)}</p>
      </div>
      <div className="text-right shrink-0">
        <span className={`text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
          {isPositive ? '+' : ''}{entry.delta}
        </span>
        <p className="text-[10px] text-gray-400">{entry.old_qty} → {entry.new_qty}</p>
      </div>
    </div>
  );
}

// ── Activity Tab ──────────────────────────────────────────────────────────────

function ActivityTab() {
  const [reason, setReason] = useState('');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['reports-activity', reason],
    queryFn: ({ pageParam = 1 }) => {
      const params: Record<string, string | number> = { page: pageParam as number, page_size: 25 };
      if (reason) params.reason = reason;
      return api.get('/products/vendor/stock-logs/', { params }).then(r => r.data as PagedResponse<StockLogEntry>);
    },
    getNextPageParam: (last: PagedResponse<StockLogEntry>, pages: PagedResponse<StockLogEntry>[]) =>
      last.next ? pages.length + 1 : undefined,
    initialPageParam: 1,
  });

  const allEntries = data?.pages.flatMap(p => p.results) ?? [];
  const total = data?.pages[0]?.count ?? 0;

  return (
    <div className="space-y-4">
      {/* Reason filter chips */}
      <div className="flex gap-2 flex-wrap">
        {ACTIVITY_REASONS.map(r => (
          <button
            key={r.value}
            onClick={() => setReason(r.value)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              reason === r.value
                ? 'bg-navy text-white border-navy'
                : 'bg-white text-gray-600 border-gray-200 hover:border-navy/40'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {isLoading ? <Skeleton /> : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : allEntries.length === 0 ? (
        <EmptyState icon="📊" label="No activity logs found" />
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">{total.toLocaleString('en-IN')} total entries</span>
            </div>
            {allEntries.map(entry => <StockLogRow key={entry.id} entry={entry} />)}
          </div>
          {hasNextPage && (
            <div className="text-center">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:border-navy/40 hover:text-navy transition-colors disabled:opacity-50"
              >
                {isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Returns Tab ───────────────────────────────────────────────────────────────

function ReturnsTab() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reports-returns'],
    queryFn: () =>
      api.get('/products/vendor/stock-logs/', {
        params: { page_size: 50, reason: 'return_from_customer' },
      }).then(r => r.data as PagedResponse<StockLogEntry>),
  });

  const entries = data?.results ?? [];

  if (isLoading) return <Skeleton />;
  if (isError) return <IslandError error={error} refetch={refetch} />;
  if (entries.length === 0) return <EmptyState icon="🔄" label="No customer returns recorded yet" />;

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <span className="text-xs text-gray-400">{entries.length} return{entries.length !== 1 ? 's' : ''}</span>
      </div>
      {entries.map(entry => <StockLogRow key={entry.id} entry={entry} />)}
    </div>
  );
}

// ── Invoices Tab ──────────────────────────────────────────────────────────────

function InvoicesTab() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reports-invoices'],
    queryFn: () => api.get('/stores/mine/invoices/').then(r => r.data),
  });

  const invoices: Invoice[] = data?.results ?? (Array.isArray(data) ? data : []);

  if (isLoading) return <Skeleton />;
  if (isError) return <IslandError error={error} refetch={refetch} />;
  if (invoices.length === 0) return <EmptyState icon="🧾" label="No invoices found" />;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">NS Code</th>
              <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Customer</th>
              <th className="text-right px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Items</th>
              <th className="text-right px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Total</th>
              <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-5 py-3.5 font-mono text-xs font-bold text-navy">
                  {inv.customer_ns_code ?? inv.id.slice(0, 8).toUpperCase()}
                </td>
                <td className="px-4 py-3.5 text-gray-700">{inv.customer_name || '—'}</td>
                <td className="px-4 py-3.5 text-right text-gray-500">
                  {inv.items?.length ?? 0} item{(inv.items?.length ?? 0) !== 1 ? 's' : ''}
                </td>
                <td className="px-4 py-3.5 text-right font-semibold text-rose-600">
                  ₹{Number(inv.total).toLocaleString('en-IN')}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap gap-1">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      inv.is_sent ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {inv.is_sent ? 'Sent' : 'Draft'}
                    </span>
                    {inv.items?.some(i => (i.returned_qty ?? 0) >= i.qty) && inv.items.every(i => (i.returned_qty ?? 0) >= i.qty) && (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600">Returned</span>
                    )}
                    {inv.items?.some(i => (i.returned_qty ?? 0) > 0) && !inv.items.every(i => (i.returned_qty ?? 0) >= i.qty) && (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Part. Return</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-gray-400 text-xs">{fmtDate(inv.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Purchases Tab ─────────────────────────────────────────────────────────────

function PurchasesTab() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reports-purchase-orders'],
    queryFn: () => api.get('/inventory/purchase-orders/').then(r => r.data),
  });

  const orders: PurchaseOrder[] = data?.results ?? (Array.isArray(data) ? data : []);

  if (isLoading) return <Skeleton />;
  if (isError) return <IslandError error={error} refetch={refetch} />;
  if (orders.length === 0) return <EmptyState icon="📋" label="No purchase orders found" />;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">PO #</th>
              <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Supplier</th>
              <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Items</th>
              <th className="text-right px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Total</th>
              <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.map(po => (
              <tr key={po.id} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-5 py-3.5 font-mono text-xs font-bold text-navy">
                  {po.po_number ?? po.id.slice(0, 8).toUpperCase()}
                </td>
                <td className="px-4 py-3.5 text-gray-700">{po.supplier_name ?? '—'}</td>
                <td className="px-4 py-3.5">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${PO_STATUS_COLORS[po.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {PO_STATUS_LABELS[po.status] ?? po.status}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right text-gray-500">{po.items?.length ?? 0}</td>
                <td className="px-4 py-3.5 text-right font-semibold text-gray-800">
                  ₹{Number(po.total_cost).toLocaleString('en-IN')}
                </td>
                <td className="px-4 py-3.5 text-gray-400 text-xs">{fmtDate(po.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-gray-50 text-right">
        <a href="/vendor/purchase-orders" className="text-xs font-bold text-navy hover:underline">
          Manage Purchase Orders →
        </a>
      </div>
    </div>
  );
}

// ── Audits Tab ────────────────────────────────────────────────────────────────

function AuditsTab() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reports-audits'],
    queryFn: () => api.get('/inventory/audits/').then(r => r.data),
  });

  const audits: Audit[] = data?.results ?? (Array.isArray(data) ? data : []);

  if (isLoading) return <Skeleton />;
  if (isError) return <IslandError error={error} refetch={refetch} />;
  if (audits.length === 0) return <EmptyState icon="🔍" label="No stock audits found" />;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">ID</th>
              <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Items</th>
              <th className="text-right px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Discrepancy</th>
              <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Completed</th>
              <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {audits.map(audit => {
              const disc = Number(audit.total_discrepancy ?? 0);
              return (
                <tr key={audit.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-xs font-bold text-navy">
                    {audit.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${AUDIT_STATUS_COLORS[audit.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {AUDIT_STATUS_LABELS[audit.status] ?? audit.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-gray-500">{audit.items?.length ?? 0}</td>
                  <td className="px-4 py-3.5 text-right font-bold">
                    <span className={disc === 0 ? 'text-gray-400' : disc > 0 ? 'text-green-600' : 'text-red-500'}>
                      {disc > 0 ? '+' : ''}{disc}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-gray-500 text-xs">
                    {audit.completed_at ? fmtDate(audit.completed_at) : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-gray-400 text-xs">{fmtDate(audit.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-gray-50 text-right">
        <a href="/vendor/stock-audit" className="text-xs font-bold text-navy hover:underline">
          Manage Stock Audits →
        </a>
      </div>
    </div>
  );
}

// ── Earnings Tab ──────────────────────────────────────────────────────────────

function EarningsTab() {
  const today = new Date();
  const [month, setMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const handleDownload = async () => {
    setDownloading(true);
    setError('');
    try {
      const token = localStorage.getItem('access_token') ?? '';
      const baseUrl = (api.defaults.baseURL ?? '').replace(/\/$/, '');
      const resp = await fetch(`${baseUrl}/stores/mine/earnings/pdf/?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const text = await resp.text();
        setError(text || `HTTP ${resp.status}`);
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `earnings-${month}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message ?? 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h2 className="font-bold text-navy text-lg">Monthly Earnings Report</h2>
        <p className="text-sm text-gray-400 mt-0.5">Download a PDF summary of all invoices for any month</p>
      </div>

      <div className="flex items-end gap-3">
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Select Month</label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            max={`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10"
          />
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading || !month}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-navy text-white text-sm font-bold hover:bg-navy/90 transition-colors disabled:opacity-50"
        >
          {downloading ? '⏳ Generating…' : '↓ Download PDF'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <p>📄 The PDF includes all invoices issued that month, itemised totals, and net revenue.</p>
        <p>📦 Reports are generated in real-time from your invoice data.</p>
      </div>
    </div>
  );
}

// ── Main inner component ──────────────────────────────────────────────────────

function Inner() {
  const [activeTab, setActiveTab] = useState<Tab>('Activity');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-navy">Reports & Logs</h1>
        <p className="text-sm text-gray-400">All vendor activity, returns, invoices, purchases and audits in one place</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto pb-px">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-navy text-navy'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Activity'  && <ActivityTab />}
      {activeTab === 'Returns'   && <ReturnsTab />}
      {activeTab === 'Invoices'  && <InvoicesTab />}
      {activeTab === 'Purchases' && <PurchasesTab />}
      {activeTab === 'Audits'    && <AuditsTab />}
      {activeTab === 'Earnings'  && <EarningsTab />}
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function VendorReportsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <VendorAuthGuard>
        <Inner />
      </VendorAuthGuard>
    </QueryClientProvider>
  );
}
