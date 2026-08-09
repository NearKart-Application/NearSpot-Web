import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';
import { Button } from '@/components/ui/button';
import { Search, Monitor, Smartphone, Tablet, CheckCircle, XCircle } from 'lucide-react';

interface LoginLog {
  id: string;
  phone: string;
  role: string;
  success: boolean;
  failure_reason: string;
  ip_address: string | null;
  city: string;
  device_type: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  device_name: string;
  os: string;
  os_version: string;
  browser: string;
  app_version: string;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  customer:     'Customer',
  vendor:       'Vendor',
  admin:        'Admin',
  master_admin: 'Master Admin',
};

const ROLE_COLORS: Record<string, string> = {
  customer:     'bg-blue-50 text-blue-700',
  vendor:       'bg-purple-50 text-purple-700',
  admin:        'bg-amber-50 text-amber-700',
  master_admin: 'bg-red-50 text-red-700',
};

const FAIL_LABELS: Record<string, string> = {
  otp_invalid: 'Wrong OTP',
  suspended:   'Suspended',
  '':          '',
};

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
        active
          ? 'text-white border-transparent'
          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
      }`}
      style={active ? { backgroundColor: '#0F172A' } : {}}
    >
      {children}
    </button>
  );
}

function DeviceIcon({ type }: { type: string }) {
  if (type === 'mobile')  return <Smartphone className="w-3.5 h-3.5 text-gray-400" />;
  if (type === 'tablet')  return <Tablet className="w-3.5 h-3.5 text-gray-400" />;
  if (type === 'desktop') return <Monitor className="w-3.5 h-3.5 text-gray-400" />;
  return <Monitor className="w-3.5 h-3.5 text-gray-300" />;
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

function Inner() {
  const [search,      setSearch]      = useState('');
  const [roleFilter,  setRoleFilter]  = useState('');
  const [deviceFilter,setDeviceFilter]= useState('');
  const [successFilter, setSuccessFilter] = useState<'' | 'true' | 'false'>('');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [page,        setPage]        = useState(1);

  const PAGE_SIZE = 50;
  const dSearch   = useDebounce(search, 400);

  useEffect(() => { setPage(1); }, [dSearch, roleFilter, deviceFilter, successFilter, dateFrom, dateTo]);

  const { data, isLoading, error, refetch } = useQuery<{ count: number; results: LoginLog[] }>({
    queryKey: ['admin-login-logs', dSearch, roleFilter, deviceFilter, successFilter, dateFrom, dateTo, page],
    queryFn: () =>
      api.get('/admin-panel/login-logs/', {
        params: {
          page,
          page_size: PAGE_SIZE,
          ...(dSearch       && { search:      dSearch }),
          ...(roleFilter    && { role:         roleFilter }),
          ...(deviceFilter  && { device_type: deviceFilter }),
          ...(successFilter && { success:     successFilter }),
          ...(dateFrom      && { date_from:   dateFrom }),
          ...(dateTo        && { date_to:     dateTo }),
        },
      }).then((r) => r.data),
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const logs       = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-4xl mb-2">⚠️</p>
        <p className="font-semibold text-gray-800">Failed to load login logs</p>
        <p className="text-sm text-gray-400 mt-1">
          {(error as any)?.response?.data?.detail ?? 'Check your connection'}
        </p>
        <Button onClick={() => refetch()} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search phone, IP, city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 w-60"
            />
          </div>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input text-xs w-36"
            title="From date"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="input text-xs w-36"
            title="To date"
          />

          <span className="text-sm text-gray-400 ml-auto whitespace-nowrap">
            {isLoading ? 'Loading…' : `${totalCount.toLocaleString()} entries`}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Success filter */}
          <div className="flex gap-1">
            {([
              { v: '' as const,       label: 'All' },
              { v: 'true' as const,   label: '✓ Success' },
              { v: 'false' as const,  label: '✗ Failed' },
            ]).map(({ v, label }) => (
              <FilterChip key={v} active={successFilter === v} onClick={() => setSuccessFilter(v)}>
                {label}
              </FilterChip>
            ))}
          </div>

          <div className="w-px h-4 bg-gray-200" />

          {/* Role filter */}
          <div className="flex gap-1 flex-wrap">
            {['', 'customer', 'vendor', 'admin', 'master_admin'].map((r) => (
              <FilterChip key={r} active={roleFilter === r} onClick={() => setRoleFilter(r)}>
                {r === '' ? 'All Roles' : ROLE_LABELS[r] ?? r}
              </FilterChip>
            ))}
          </div>

          <div className="w-px h-4 bg-gray-200" />

          {/* Device filter */}
          <div className="flex gap-1">
            {['', 'mobile', 'tablet', 'desktop'].map((d) => (
              <FilterChip key={d} active={deviceFilter === d} onClick={() => setDeviceFilter(d)}>
                {d === '' ? 'All Devices' : d.charAt(0).toUpperCase() + d.slice(1)}
              </FilterChip>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className={`card overflow-hidden transition-opacity ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-left">
                <th className="px-4 py-2.5 font-semibold w-8"></th>
                <th className="px-4 py-2.5 font-semibold">Phone</th>
                <th className="px-4 py-2.5 font-semibold">Role</th>
                <th className="px-4 py-2.5 font-semibold">Device</th>
                <th className="px-4 py-2.5 font-semibold">OS</th>
                <th className="px-4 py-2.5 font-semibold">Browser / App</th>
                <th className="px-4 py-2.5 font-semibold">IP</th>
                <th className="px-4 py-2.5 font-semibold">City</th>
                <th className="px-4 py-2.5 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && logs.length === 0
                ? [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {[...Array(9)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: `${40 + j * 10}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : logs.map((log) => (
                    <tr
                      key={log.id}
                      className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                        !log.success ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        {log.success
                          ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                          : <XCircle className="w-4 h-4 text-red-400" />
                        }
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-800">{log.phone}</td>
                      <td className="px-4 py-3">
                        {log.role ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[log.role] ?? 'bg-gray-100 text-gray-600'}`}>
                            {ROLE_LABELS[log.role] ?? log.role}
                          </span>
                        ) : (
                          !log.success && log.failure_reason ? (
                            <span className="text-red-500 text-xs">{FAIL_LABELS[log.failure_reason] ?? log.failure_reason}</span>
                          ) : <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <DeviceIcon type={log.device_type} />
                          <span className="text-gray-700 truncate max-w-[120px]" title={log.device_name}>
                            {log.device_name || log.device_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {log.os}{log.os_version ? ` ${log.os_version}` : ''}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <div>
                          {log.browser || '—'}
                          {log.app_version && (
                            <span className="ml-1 text-gray-400">v{log.app_version}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-500">
                        {log.ip_address ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {log.city || '—'}
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
          <p className="text-center text-gray-400 py-10 text-sm">No login events match your filters</p>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages} · {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(page * PAGE_SIZE, totalCount).toLocaleString()} of {totalCount.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setPage(1)} disabled={page === 1} className="px-2">«</Button>
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-2">‹</Button>
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
                      page === p
                        ? 'text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                    style={page === p ? { backgroundColor: '#0F172A' } : {}}
                  >
                    {p}
                  </button>
                )
              )}
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2">›</Button>
            <Button variant="ghost" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2">»</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminLoginLogsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <Inner />
      </AdminShell>
    </QueryClientProvider>
  );
}
