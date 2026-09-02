import { useState } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

// ── Types ────────────────────────────────────────────────────────────────────
interface DayBook { date: string; invoice_count: number; total_sales: string; total_gst: string; top_items: { name: string; qty: number; revenue: string }[]; }
interface PnL { month: string; revenue: string; cogs: string; gross_profit: string; gross_margin: string; total_expenses: string; net_profit: string; net_margin: string; }
interface CashRow { date: string; inflow: string; outflow: string; net: string; balance: string; }
interface CashFlow { month: string; rows: CashRow[]; }
interface TopProduct { name: string; qty: number; revenue: string; share: string; }
interface ABCProduct { name: string; revenue: string; qty: number; cumulative: string; tier: 'A' | 'B' | 'C'; }
interface GrossMarginProduct { name: string; qty: number; revenue: string; cogs: string | null; gross_profit: string | null; margin: string; }
interface GSTRow { invoice_id: string; date: string; customer: string; gstin: string; gst_rate: string; taxable: string; cgst: string; sgst: string; total_gst: string; invoice_total: string; }
interface GSTReport { month: string; invoices: GSTRow[]; totals: Record<string, string>; }

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: string | number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);
const monthOpts = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(); d.setMonth(d.getMonth() - i);
  return d.toISOString().slice(0, 7);
});
const monthLabel = (s: string) => { const [y, m] = s.split('-'); return `${['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m]} ${y}`; };

type Tab = 'daybook' | 'pnl' | 'cashflow' | 'products' | 'abc' | 'margin' | 'gst';

const TABS: { id: Tab; label: string }[] = [
  { id: 'daybook',  label: 'Day Book'    },
  { id: 'pnl',      label: 'P&L'         },
  { id: 'cashflow', label: 'Cash Flow'   },
  { id: 'products', label: 'Top Products'},
  { id: 'abc',      label: 'ABC Analysis'},
  { id: 'margin',   label: 'Gross Margin'},
  { id: 'gst',      label: 'GST Report' },
];

const TIER_COLOR: Record<string, string> = { A: 'bg-green-100 text-green-700', B: 'bg-amber-100 text-amber-700', C: 'bg-red-100 text-red-700' };

// ── Main ─────────────────────────────────────────────────────────────────────
function Inner() {
  const [tab, setTab]       = useState<Tab>('pnl');
  const [month, setMonth]   = useState(currentMonth);
  const [date, setDate]     = useState(today);

  const MonthPicker = () => (
    <select value={month} onChange={e => setMonth(e.target.value)}
      className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300">
      {monthOpts.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
    </select>
  );

  const exportCSV = async (type: string) => {
    const token = localStorage.getItem('ns_access');
    const url = api.defaults.baseURL + `/reports/export/?type=${type}&month=${month}`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${type}-${month}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy">Financial Reports</h1>
        <p className="text-sm text-gray-500">P&L, GST, product performance, and more</p>
      </div>

      {/* Tab strip — scrollable on mobile */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto pb-0 scrollbar-hide">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t.id ? 'border-rose-500 text-rose-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Day Book */}
      {tab === 'daybook' && <DayBookTab date={date} onDateChange={setDate} />}
      {tab === 'pnl'     && <PnLTab month={month} picker={<MonthPicker />} onExport={() => exportCSV('pnl')} />}
      {tab === 'cashflow'&& <CashFlowTab month={month} picker={<MonthPicker />} />}
      {tab === 'products'&& <TopProductsTab month={month} picker={<MonthPicker />} onExport={() => exportCSV('top-products')} />}
      {tab === 'abc'     && <ABCTab month={month} picker={<MonthPicker />} onExport={() => exportCSV('abc')} />}
      {tab === 'margin'  && <GrossMarginTab month={month} picker={<MonthPicker />} onExport={() => exportCSV('gross-margin')} />}
      {tab === 'gst'     && <GSTTab month={month} picker={<MonthPicker />} onExport={() => exportCSV('gst')} />}
    </div>
  );
}

// ── Sub-tabs ─────────────────────────────────────────────────────────────────

function DayBookTab({ date, onDateChange }: { date: string; onDateChange: (d: string) => void }) {
  const { data, isLoading, error } = useQuery<DayBook>({
    queryKey: ['report-daybook', date],
    queryFn: () => api.get(`/reports/day-book/?date=${date}`).then(r => r.data),
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input type="date" value={date} onChange={e => onDateChange(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300" />
      </div>
      {isLoading && <Spinner />}
      {error && <IslandError error={error} />}
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Invoices" value={String(data.invoice_count)} />
            <StatCard label="Total Sales" value={fmt(data.total_sales)} accent />
            <StatCard label="Total GST" value={fmt(data.total_gst)} />
          </div>
          {data.top_items.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 font-semibold text-sm">Items Sold</div>
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50"><th className="text-left px-4 py-2">Item</th><th className="text-right px-4 py-2">Qty</th><th className="text-right px-4 py-2">Revenue</th></tr></thead>
                <tbody>
                  {data.top_items.map(it => (
                    <tr key={it.name} className="border-t border-gray-50">
                      <td className="px-4 py-2">{it.name}</td>
                      <td className="px-4 py-2 text-right">{it.qty}</td>
                      <td className="px-4 py-2 text-right font-semibold">{fmt(it.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PnLTab({ month, picker, onExport }: { month: string; picker: React.ReactNode; onExport: () => void }) {
  const { data, isLoading, error } = useQuery<PnL>({
    queryKey: ['report-pnl', month],
    queryFn: () => api.get(`/reports/pnl/?month=${month}`).then(r => r.data),
  });
  const profit = data ? Number(data.net_profit) : 0;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">{picker}<button onClick={onExport} className="btn-outline text-sm">↓ CSV</button></div>
      {isLoading && <Spinner />}
      {error && <IslandError error={error} />}
      {data && (
        <div className="space-y-3">
          {[
            { label: 'Revenue (Sales)', value: data.revenue, color: 'text-green-600' },
            { label: 'Cost of Goods Sold (COGS)', value: data.cogs, color: 'text-rose-500' },
            { label: 'Gross Profit', value: data.gross_profit, sub: data.gross_margin, color: 'text-navy' },
            { label: 'Total Expenses', value: data.total_expenses, color: 'text-rose-600' },
          ].map(r => (
            <div key={r.label} className="card px-5 py-4 flex justify-between items-center">
              <div><p className="text-sm text-gray-500">{r.label}</p>{r.sub && <p className="text-xs text-gray-400">{r.sub} margin</p>}</div>
              <p className={`font-bold text-lg ${r.color}`}>{fmt(r.value)}</p>
            </div>
          ))}
          <div className={`card px-5 py-5 flex justify-between items-center ${profit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <div>
              <p className="font-bold text-base">Net Profit</p>
              <p className="text-sm text-gray-500">{data.net_margin} margin</p>
            </div>
            <p className={`font-black text-2xl ${profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(data.net_profit)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CashFlowTab({ month, picker }: { month: string; picker: React.ReactNode }) {
  const { data, isLoading, error } = useQuery<CashFlow>({
    queryKey: ['report-cashflow', month],
    queryFn: () => api.get(`/reports/cash-flow/?month=${month}`).then(r => r.data),
  });
  return (
    <div className="space-y-4">
      <div className="flex">{picker}</div>
      {isLoading && <Spinner />}
      {error && <IslandError error={error} />}
      {data && data.rows.length === 0 && <p className="text-gray-400 text-center py-8">No transactions this month.</p>}
      {data && data.rows.length > 0 && (
        <div className="card overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="text-left px-4 py-2">Date</th>
              <th className="text-right px-4 py-2">Inflow</th>
              <th className="text-right px-4 py-2">Outflow</th>
              <th className="text-right px-4 py-2">Net</th>
              <th className="text-right px-4 py-2">Balance</th>
            </tr></thead>
            <tbody>
              {data.rows.map(r => (
                <tr key={r.date} className="border-t border-gray-50">
                  <td className="px-4 py-2">{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  <td className="px-4 py-2 text-right text-green-600">{fmt(r.inflow)}</td>
                  <td className="px-4 py-2 text-right text-rose-500">{fmt(r.outflow)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${Number(r.net) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(r.net)}</td>
                  <td className="px-4 py-2 text-right font-bold">{fmt(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TopProductsTab({ month, picker, onExport }: { month: string; picker: React.ReactNode; onExport: () => void }) {
  const { data, isLoading } = useQuery<{ products: TopProduct[] }>({
    queryKey: ['report-products', month],
    queryFn: () => api.get(`/reports/top-products/?month=${month}`).then(r => r.data),
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">{picker}<button onClick={onExport} className="btn-outline text-sm">↓ CSV</button></div>
      {isLoading && <Spinner />}
      {data && data.products.length === 0 && <p className="text-gray-400 text-center py-8">No sales this month.</p>}
      {data && data.products.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50"><th className="text-left px-4 py-2">Product</th><th className="text-right px-4 py-2">Qty</th><th className="text-right px-4 py-2">Revenue</th><th className="text-right px-4 py-2">Share</th></tr></thead>
            <tbody>
              {data.products.map((p, i) => (
                <tr key={p.name} className="border-t border-gray-50">
                  <td className="px-4 py-2 flex items-center gap-2"><span className="text-xs text-gray-400 w-5">{i + 1}</span>{p.name}</td>
                  <td className="px-4 py-2 text-right">{p.qty}</td>
                  <td className="px-4 py-2 text-right font-semibold text-rose-600">{fmt(p.revenue)}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{p.share}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ABCTab({ month, picker, onExport }: { month: string; picker: React.ReactNode; onExport: () => void }) {
  const { data, isLoading } = useQuery<{ products: ABCProduct[] }>({
    queryKey: ['report-abc', month],
    queryFn: () => api.get(`/reports/abc/?month=${month}`).then(r => r.data),
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">{picker}<button onClick={onExport} className="btn-outline text-sm">↓ CSV</button></div>
      <p className="text-xs text-gray-400">A = top 70% revenue · B = next 20% · C = bottom 10%</p>
      {isLoading && <Spinner />}
      {data && (
        <div className="card overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50"><th className="text-left px-4 py-2">Product</th><th className="text-right px-4 py-2">Revenue</th><th className="text-right px-4 py-2">Cumulative</th><th className="text-right px-4 py-2">Tier</th></tr></thead>
            <tbody>
              {data.products.map(p => (
                <tr key={p.name} className="border-t border-gray-50">
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2 text-right font-semibold">{fmt(p.revenue)}</td>
                  <td className="px-4 py-2 text-right text-gray-400">{p.cumulative}</td>
                  <td className="px-4 py-2 text-right"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${TIER_COLOR[p.tier]}`}>{p.tier}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GrossMarginTab({ month, picker, onExport }: { month: string; picker: React.ReactNode; onExport: () => void }) {
  const { data, isLoading } = useQuery<{ products: GrossMarginProduct[] }>({
    queryKey: ['report-margin', month],
    queryFn: () => api.get(`/reports/gross-margin/?month=${month}`).then(r => r.data),
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">{picker}<button onClick={onExport} className="btn-outline text-sm">↓ CSV</button></div>
      <p className="text-xs text-gray-400">Requires cost price to be set on product variants.</p>
      {isLoading && <Spinner />}
      {data && (
        <div className="card overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50">
              <th className="text-left px-4 py-2">Product</th>
              <th className="text-right px-4 py-2">Revenue</th>
              <th className="text-right px-4 py-2">COGS</th>
              <th className="text-right px-4 py-2">Gross Profit</th>
              <th className="text-right px-4 py-2">Margin</th>
            </tr></thead>
            <tbody>
              {data.products.map(p => (
                <tr key={p.name} className="border-t border-gray-50">
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2 text-right">{fmt(p.revenue)}</td>
                  <td className="px-4 py-2 text-right text-gray-400">{p.cogs ? fmt(p.cogs) : '—'}</td>
                  <td className="px-4 py-2 text-right font-semibold">{p.gross_profit ? fmt(p.gross_profit) : '—'}</td>
                  <td className={`px-4 py-2 text-right font-bold ${p.margin === 'N/A' ? 'text-gray-400' : 'text-green-600'}`}>{p.margin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GSTTab({ month, picker, onExport }: { month: string; picker: React.ReactNode; onExport: () => void }) {
  const { data, isLoading } = useQuery<GSTReport>({
    queryKey: ['report-gst', month],
    queryFn: () => api.get(`/reports/gst/?month=${month}`).then(r => r.data),
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">{picker}<button onClick={onExport} className="btn-outline text-sm">↓ CSV</button></div>
      {isLoading && <Spinner />}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Taxable Amount', key: 'taxable' },
              { label: 'CGST', key: 'cgst' },
              { label: 'SGST', key: 'sgst' },
              { label: 'Total GST', key: 'gst' },
            ].map(s => (
              <div key={s.key} className="card p-4">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="font-bold text-base mt-1">{fmt(data.totals[s.key] || '0')}</p>
              </div>
            ))}
          </div>
          <div className="card overflow-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50">
                {['Invoice', 'Date', 'Customer', 'Rate', 'Taxable', 'CGST', 'SGST', 'Total'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {data.invoices.map(r => (
                  <tr key={r.invoice_id} className="border-t border-gray-50">
                    <td className="px-3 py-2 font-mono">{r.invoice_id}</td>
                    <td className="px-3 py-2">{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                    <td className="px-3 py-2">{r.customer}</td>
                    <td className="px-3 py-2">{r.gst_rate}</td>
                    <td className="px-3 py-2">{fmt(r.taxable)}</td>
                    <td className="px-3 py-2">{fmt(r.cgst)}</td>
                    <td className="px-3 py-2">{fmt(r.sgst)}</td>
                    <td className="px-3 py-2 font-semibold">{fmt(r.total_gst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────
function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`font-bold text-lg mt-1 ${accent ? 'text-rose-600' : 'text-navy'}`}>{value}</p>
    </div>
  );
}
function Spinner() { return <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>; }

// ── Export ────────────────────────────────────────────────────────────────────
export default function VendorFinancialReportsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <VendorAuthGuard>
        <Inner />
      </VendorAuthGuard>
    </QueryClientProvider>
  );
}
