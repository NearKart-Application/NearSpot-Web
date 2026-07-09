import { useState } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

interface Follower {
  // Confirmed API fields from mobile: full_name, profile_id
  // Others may exist depending on backend version
  id?: string; full_name?: string; name?: string; profile_id?: string;
  avatar?: string; phone?: string;
  followed_at?: string; joined_at?: string; created_at?: string;
  total_reservations?: number;
}

function getFollowerName(f: Follower) { return f.full_name ?? f.name ?? 'Customer'; }
function getFollowerKey(f: Follower, idx: number) { return f.profile_id ?? f.id ?? String(idx); }
function getFollowerSince(f: Follower) {
  const d = f.followed_at ?? f.joined_at ?? f.created_at;
  return d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : null;
}

function Inner() {
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-followers'],
    queryFn: () => api.get('/stores/mine/followers/').then(r => r.data),
  });

  const followers: Follower[] = data?.results ?? (Array.isArray(data) ? data : []);
  const shown = search
    ? followers.filter(f =>
        getFollowerName(f).toLowerCase().includes(search.toLowerCase()) ||
        (f.phone ?? '').includes(search) ||
        (f.profile_id ?? '').toLowerCase().includes(search.toLowerCase()))
    : followers;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Followers</h1>
        <p className="text-sm text-gray-400">{followers.length} people follow your store</p>
      </div>

      <div className="relative max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search followers…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10" />
      </div>

      {isLoading ? (
        <div className="card overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100 animate-pulse">
              <div className="w-11 h-11 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-200 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : shown.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">👥</div>
          <p className="font-semibold text-gray-600">{search ? 'No matching followers' : 'No followers yet'}</p>
          <p className="text-sm mt-1">{search ? '' : 'Share your store to attract followers'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {shown.map((f, idx) => {
            const key = getFollowerKey(f, idx);
            const name = getFollowerName(f);
            const since = getFollowerSince(f);
            return (
              <div key={key} className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                <div className="w-11 h-11 rounded-full bg-navy/10 flex items-center justify-center text-navy font-bold text-sm shrink-0">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-navy text-sm">{name}</p>
                  {f.phone && <p className="text-xs text-gray-400">{f.phone}</p>}
                  {f.profile_id && (
                    <button onClick={() => {
                      navigator.clipboard.writeText(f.profile_id!).then(() => {
                        setCopiedId(key);
                        setTimeout(() => setCopiedId(null), 2000);
                      });
                    }} className="text-xs text-gray-400 font-mono hover:text-navy transition-colors">
                      {copiedId === key ? '✅ Copied' : `ID: ${f.profile_id}`}
                    </button>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {since && <p className="text-xs text-gray-400">Since {since}</p>}
                  {f.total_reservations != null && (
                    <p className="text-xs text-navy font-semibold mt-0.5">{f.total_reservations} reservations</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function VendorFollowersIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
