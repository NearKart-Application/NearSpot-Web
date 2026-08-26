import { useState } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';

interface LogEntry {
  id: string;
  admin_name: string;
  action: string;
  target_type: string;
  target_id: string | number;
  target_label: string;
  detail: string;
  created_at: string;
}

function Inner() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');

  const { data, isLoading, error, refetch } = useQuery<{ count: number; results: LogEntry[] }>({
    queryKey: ['admin-activity-log', page, action, targetType],
    queryFn: () =>
      api.get('/admin-panel/activity-log/', {
        params: {
          page,
          ...(action     && { action }),
          ...(targetType && { target_type: targetType }),
        },
      }).then((r) => r.data),
  });

  const totalPages = data ? Math.ceil(data.count / 20) : 1;

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[...Array(10)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-2xl" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="font-semibold" style={{ color: '#1C2E4A' }}>Failed to load activity log</p>
        <button onClick={() => refetch()} className="btn-primary mt-4">Retry</button>
      </div>
    );
  }

  const entries = data?.results ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Filter by action…"
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          className="input max-w-xs"
        />
        <input
          type="text"
          placeholder="Filter by target type…"
          value={targetType}
          onChange={(e) => { setTargetType(e.target.value); setPage(1); }}
          className="input max-w-xs"
        />
        <span className="text-sm text-gray-400 ml-auto">{data?.count ?? 0} entries</span>
      </div>

      <div className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.id} className="card p-4 flex items-start gap-4">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
              style={{ backgroundColor: 'rgba(28,46,74,0.1)', color: '#1C2E4A' }}
            >
              {entry.admin_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm" style={{ color: '#1C2E4A' }}>{entry.admin_name}</span>
                <span className="badge badge-navy">{entry.action}</span>
                {entry.target_type && <span className="badge badge-blue">{entry.target_type}</span>}
              </div>
              {entry.target_label && (
                <p className="text-xs text-gray-600 mt-0.5">
                  Target: <span className="font-medium">{entry.target_label}</span>
                  {entry.target_id ? ` (ID: ${entry.target_id})` : ''}
                </p>
              )}
              {entry.detail && <p className="text-xs text-gray-500 mt-0.5">{entry.detail}</p>}
              <p className="text-xs text-gray-400 mt-1">
                {new Date(entry.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
        {entries.length === 0 && <div className="card p-12 text-center text-gray-400">No log entries</div>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-outline btn-sm"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-outline btn-sm"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminActivityLogIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <Inner />
      </AdminShell>
    </QueryClientProvider>
  );
}
