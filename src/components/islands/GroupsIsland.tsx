import { useState, useRef } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CustomerAuthGuard } from './CustomerAuthGuard';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';
import { auth } from '../../lib/auth';

interface GroupMember {
  id: string;
  user: { id: string; full_name?: string; phone_number: string };
  role: 'admin' | 'member';
}

interface Group {
  id: string;
  name: string;
  group_type: 'customer' | 'vendor';
  created_by: { id: string; full_name?: string; profile_id?: string };
  members?: GroupMember[];
  members_count?: number;
  created_at: string;
  is_active: boolean;
}

interface Message {
  id: string;
  sender: { id: string; full_name?: string; phone_number: string };
  content: string;
  created_at: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function initials(name?: string, phone?: string) {
  if (name) return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
  return (phone ?? '?').slice(-2);
}

/* ── Group Thread View ──────────────────────────────────────────────── */
function GroupThread({ group, userId, onBack }: {
  group: Group; userId: string; onBack: () => void;
}) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const msgsQ = useQuery<Message[]>({
    queryKey: ['group-messages', group.id],
    queryFn: () => api.get(`/groups/${group.id}/messages/`).then(r =>
      Array.isArray(r.data) ? r.data : (r.data?.results ?? [])
    ),
    refetchInterval: 5_000,
  });

  const sendMut = useMutation({
    mutationFn: (content: string) => api.post(`/groups/${group.id}/messages/`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-messages', group.id] });
      setMsg('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    },
  });

  const leaveMut = useMutation({
    mutationFn: () => api.post(`/groups/${group.id}/leave/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      onBack();
    },
  });

  const messages = msgsQ.data ?? [];
  const memberCount = group.members_count ?? group.members?.length ?? 0;
  const myProfileId = auth.user()?.profile_id;
  const isAdmin =
    (!!myProfileId && group.created_by.profile_id === myProfileId) ||
    (!!userId && !!group.members?.some(m => m.user.id === userId && m.role === 'admin'));

  const handleSend = () => {
    const text = msg.trim();
    if (!text) return;
    sendMut.mutate(text);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shrink-0">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="w-10 h-10 rounded-2xl bg-navy flex items-center justify-center text-white font-black text-sm shrink-0">
          {initials(group.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-navy truncate">{group.name}</p>
          <p className="text-[11px] text-gray-400">{memberCount} member{memberCount !== 1 ? 's' : ''}</p>
        </div>
        {!isAdmin && (
          <button onClick={() => leaveMut.mutate()} disabled={leaveMut.isPending}
            className="text-xs font-bold text-red-500 border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50">
            Leave
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
        {msgsQ.isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-2xl animate-pulse w-3/4" />)}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">💬</div>
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map(m => {
            const isMine = m.sender.id === userId;
            return (
              <div key={m.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                {!isMine && (
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 mt-auto">
                    {initials(m.sender.full_name, m.sender.phone_number)}
                  </div>
                )}
                <div className={`max-w-[72%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {!isMine && (
                    <p className="text-[10px] text-gray-500 font-medium px-1">
                      {m.sender.full_name ?? m.sender.phone_number}
                    </p>
                  )}
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                    isMine
                      ? 'bg-navy text-white rounded-br-md'
                      : 'bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm'
                  }`}>
                    {m.content}
                  </div>
                  <p className="text-[9px] text-gray-400 px-1">{timeAgo(m.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 bg-white border-t border-gray-100 flex gap-2 items-center shrink-0">
        <input
          value={msg}
          onChange={e => setMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Type a message…"
          className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-navy/20 resize-none"
        />
        <button onClick={handleSend} disabled={!msg.trim() || sendMut.isPending}
          className="w-10 h-10 bg-navy text-white rounded-xl flex items-center justify-center hover:bg-navy/90 transition-colors disabled:opacity-40">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ── Create Group Modal ─────────────────────────────────────────────── */
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');

  const createMut = useMutation({
    mutationFn: () => api.post('/groups/', { name, group_type: 'customer' }),
    onSuccess: () => { onCreated(); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-navy mb-4">New Group</h3>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Group name (e.g. Family Shopping)"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-navy/20 mb-4"
          autoFocus
        />
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={() => createMut.mutate()} disabled={!name.trim() || createMut.isPending}
            className="flex-1 py-3 rounded-xl bg-navy text-white text-sm font-bold hover:bg-navy/90 transition-colors disabled:opacity-50">
            {createMut.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Inner ─────────────────────────────────────────────────────── */
function Inner() {
  const qc = useQueryClient();
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ns_access');
  const userId: string = (() => {
    try { return String(JSON.parse(localStorage.getItem('ns_user') ?? '{}').id ?? ''); } catch { return ''; }
  })();

  const [selected, setSelected] = useState<Group | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const groupsQ = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups/').then(r => Array.isArray(r.data) ? r.data : r.data.results ?? []),
    enabled: isLoggedIn,
  });

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
        <div className="text-6xl mb-4">👥</div>
        <h2 className="text-xl font-bold text-navy mb-2">Sign in to view groups</h2>
        <p className="text-gray-500 text-sm mb-6">Create shopping groups with friends and family</p>
        <a href="/auth/login" className="px-6 py-3 bg-navy text-white rounded-xl font-bold text-sm">Sign In</a>
      </div>
    );
  }

  if (selected) {
    return <GroupThread group={selected} userId={userId} onBack={() => setSelected(null)} />;
  }

  const groups = groupsQ.data ?? [];

  return (
    <div className="max-w-lg mx-auto px-4 pb-24 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black text-navy">Groups</h1>
          <p className="text-gray-400 text-xs mt-0.5">Shop together with friends & family</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-navy text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-navy/90 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          New Group
        </button>
      </div>

      {/* List */}
      {groupsQ.isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-navy/5 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">👥</div>
          <h3 className="font-bold text-gray-700 mb-1">No groups yet</h3>
          <p className="text-gray-400 text-sm mb-6">Create a group to share products and shop together</p>
          <button onClick={() => setShowCreate(true)}
            className="px-6 py-3 bg-navy text-white rounded-xl font-bold text-sm hover:bg-navy/90 transition-colors">
            Create your first group
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => {
            const memberCount = g.members_count ?? g.members?.length ?? 0;
            const myGProfileId = auth.user()?.profile_id;
            const isAdmin =
              (!!myGProfileId && g.created_by.profile_id === myGProfileId) ||
              (!!userId && !!g.members?.some(m => m.user.id === userId && m.role === 'admin'));
            return (
              <button key={g.id} onClick={() => setSelected(g)}
                className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 flex items-center gap-4 hover:border-navy hover:shadow-md transition-all text-left">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-navy to-navy/60 flex items-center justify-center text-white font-black text-sm shrink-0">
                  {initials(g.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-navy truncate">{g.name}</p>
                    {isAdmin && (
                      <span className="text-[9px] font-bold bg-gold/20 text-navy px-1.5 py-0.5 rounded-full shrink-0">Admin</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{memberCount} member{memberCount !== 1 ? 's' : ''}</p>
                </div>
                <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['groups'] })}
        />
      )}
    </div>
  );
}

export default function GroupsIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomerAuthGuard>
        <Inner />
      </CustomerAuthGuard>
    </QueryClientProvider>
  );
}
