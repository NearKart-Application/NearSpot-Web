import { useState, useEffect, useRef, useCallback } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CustomerAuthGuard } from './CustomerAuthGuard';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';
import { auth } from '../../lib/auth';

interface GroupMember {
  id: string;
  user: { id: string; full_name?: string; phone_number: string; profile_id?: string };
  role: 'admin' | 'member';
}

interface SharedProduct {
  id: string;
  product: { id: string; name: string; price: string; image?: string; store?: { name: string } };
  shared_by: { id: string; full_name?: string };
  note?: string;
  is_finalized: boolean;
  finalized_by?: { id: string; full_name?: string };
  created_at: string;
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
  avatar_url?: string;
  invite_token?: string | null;
}

interface Message {
  id: string;
  sender: { id: string; full_name?: string; phone_number: string };
  sender_id?: string;
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

function getWsBase(): string {
  const base = (api.defaults.baseURL ?? '/api/v1').replace(/\/api\/v\d+\/?$/, '');
  if (base.startsWith('http')) return base.replace(/^https?/, m => m === 'https' ? 'wss' : 'ws');
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}`;
}

type GroupTab = 'messages' | 'products' | 'members';

/* ── Group Thread View ──────────────────────────────────────────────── */
function GroupThread({ group, userId, onBack }: {
  group: Group; userId: string; onBack: () => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<GroupTab>('messages');
  const [msg, setMsg] = useState('');
  const [wsReady, setWsReady] = useState(false);
  const [addProfileId, setAddProfileId] = useState('');
  const [addError, setAddError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Fetch full group detail (member list + count)
  const detailQ = useQuery<Group>({
    queryKey: ['group-detail', group.id],
    queryFn: () => api.get(`/groups/${group.id}/`).then(r => r.data),
  });
  const detail = detailQ.data ?? group;
  const members: GroupMember[] = detail.members ?? [];
  const myProfileId = auth.user()?.profile_id;
  const isAdmin =
    (!!myProfileId && detail.created_by.profile_id === myProfileId) ||
    members.some(m => m.user.id === userId && m.role === 'admin');

  // Messages cache
  const msgsQ = useQuery<Message[]>({
    queryKey: ['group-messages', group.id],
    queryFn: () => api.get(`/groups/${group.id}/messages/`).then(r =>
      Array.isArray(r.data) ? r.data : (r.data?.results ?? [])
    ),
    staleTime: Infinity,
  });

  const injectMessage = useCallback((m: Message) => {
    qc.setQueryData(['group-messages', group.id], (old: any) => {
      const list: Message[] = Array.isArray(old) ? old : (old?.results ?? []);
      const optIdx = list.findIndex(x => x.id.startsWith('tmp_') && x.content === m.content);
      if (optIdx >= 0) { const u = [...list]; u[optIdx] = m; return u; }
      if (list.some(x => x.id === m.id)) return list;
      return [...list, m];
    });
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  }, [group.id, qc]);

  // WebSocket lifecycle
  useEffect(() => {
    let ws: WebSocket;
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout>;
    let unmounted = false;

    async function refreshToken() {
      const refresh = localStorage.getItem('ns_refresh');
      if (!refresh) return null;
      try {
        const { data } = await api.post('/auth/token/refresh/', { refresh });
        localStorage.setItem('ns_access', data.access);
        return data.access as string;
      } catch { return null; }
    }

    function connect(token: string) {
      if (unmounted) return;
      ws = new WebSocket(`${getWsBase()}/ws/groups/${group.id}/?token=${token}`);
      wsRef.current = ws;
      ws.onopen = () => { retries = 0; if (!unmounted) setWsReady(true); };
      ws.onmessage = (e) => {
        if (unmounted) return;
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'token_refreshed') return;
          if (data.id) injectMessage(data as Message);
        } catch { /* ignore */ }
      };
      ws.onclose = async (e) => {
        if (!unmounted) setWsReady(false);
        if (unmounted) return;
        if (e.code === 4001) { const t = await refreshToken(); if (t) { connect(t); return; } }
        const delay = Math.min(1000 * (2 ** retries), 30_000) + Math.random() * 1000;
        retries = Math.min(retries + 1, 6);
        retryTimer = setTimeout(() => { const t = localStorage.getItem('ns_access'); if (t && !unmounted) connect(t); }, delay);
      };
      ws.onerror = () => ws.close();
    }

    const token = localStorage.getItem('ns_access');
    if (token) connect(token);
    return () => {
      unmounted = true;
      clearTimeout(retryTimer);
      ws?.close(1000, 'Component unmounted');
      wsRef.current = null;
    };
  }, [group.id, injectMessage]);

  // Scroll to bottom on load
  useEffect(() => {
    if (!msgsQ.isLoading) bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [msgsQ.isLoading]);

  const sendMut = useMutation({
    mutationFn: (content: string) => api.post(`/groups/${group.id}/messages/`, { content }).then(r => r.data as Message),
    onSuccess: (m) => injectMessage(m),
  });

  const leaveMut = useMutation({
    mutationFn: () => api.post(`/groups/${group.id}/leave/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups'] }); onBack(); },
  });

  const finalizeMut = useMutation({
    mutationFn: (spId: string) => api.post(`/groups/${group.id}/products/${spId}/finalize/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group-products', group.id] }),
  });

  const addMemberMut = useMutation({
    mutationFn: (profileId: string) => api.post(`/groups/${group.id}/members/add/`, { profile_id: profileId }),
    onSuccess: () => {
      setAddProfileId('');
      setAddError('');
      qc.invalidateQueries({ queryKey: ['group-detail', group.id] });
    },
    onError: (e: any) => setAddError(e?.response?.data?.message ?? 'User not found'),
  });

  const removeMemberMut = useMutation({
    mutationFn: (uid: string) => api.delete(`/groups/${group.id}/members/${uid}/remove/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group-detail', group.id] }),
  });

  const makeAdminMut = useMutation({
    mutationFn: (uid: string) => api.post(`/groups/${group.id}/members/${uid}/make-admin/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group-detail', group.id] }),
  });

  const removeAdminMut = useMutation({
    mutationFn: (uid: string) => api.post(`/groups/${group.id}/members/${uid}/remove-admin/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group-detail', group.id] }),
  });

  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  const getInviteMut = useMutation({
    mutationFn: () => api.get(`/groups/${group.id}/invite/`).then(r => r.data),
    onSuccess: (data) => {
      const link = `${window.location.origin}/groups/join/${data.invite_token}`;
      setInviteLink(link);
    },
  });

  const revokeInviteMut = useMutation({
    mutationFn: () => api.delete(`/groups/${group.id}/invite/`),
    onSuccess: () => { setInviteLink(null); qc.invalidateQueries({ queryKey: ['group-detail', group.id] }); },
  });

  const productsQ = useQuery<SharedProduct[]>({
    queryKey: ['group-products', group.id],
    queryFn: () => api.get(`/groups/${group.id}/products/`).then(r => Array.isArray(r.data) ? r.data : (r.data?.results ?? [])),
    enabled: tab === 'products',
  });

  const handleSend = () => {
    const text = msg.trim();
    if (!text) return;
    clearTimeout(typingTimerRef.current);
    const optimistic: Message = { id: `tmp_${Date.now()}`, sender: { id: userId, full_name: 'You', phone_number: '' }, content: text, created_at: new Date().toISOString() };
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      qc.setQueryData(['group-messages', group.id], (old: any) => {
        const list: Message[] = Array.isArray(old) ? old : (old?.results ?? []);
        return [...list, optimistic];
      });
      wsRef.current.send(JSON.stringify({ type: 'group_message', content: text }));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    } else {
      sendMut.mutate(text);
    }
    setMsg('');
  };

  const memberCount = detail.members_count ?? members.length ?? 0;

  const tabs: { key: GroupTab; label: string }[] = [
    { key: 'messages', label: 'Messages' },
    { key: 'products', label: 'Products' },
    ...(isAdmin ? [{ key: 'members' as GroupTab, label: 'Members' }] : []),
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shrink-0">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="w-10 h-10 rounded-2xl bg-navy flex items-center justify-center text-white font-black text-sm shrink-0 overflow-hidden">
          {detail.avatar_url
            ? <img src={detail.avatar_url} alt={group.name} className="w-full h-full object-cover" />
            : initials(group.name)
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-navy truncate">{group.name}</p>
          <p className="text-[11px] flex items-center gap-1">
            {wsReady
              ? <><span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" /><span className="text-green-500 font-semibold">Live</span></>
              : <span className="text-gray-400">{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
            }
          </p>
        </div>
        {!isAdmin && (
          <button onClick={() => leaveMut.mutate()} disabled={leaveMut.isPending}
            className="text-xs font-bold text-red-500 border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50">
            Leave
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 bg-white shrink-0">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 text-xs font-bold transition-colors ${tab === t.key ? 'text-navy border-b-2 border-navy' : 'text-gray-400 hover:text-gray-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Messages tab */}
      {tab === 'messages' && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
            {msgsQ.isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-2xl animate-pulse w-3/4" />)}</div>
            ) : (msgsQ.data ?? []).length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">💬</div>
                <p className="text-sm">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              (msgsQ.data ?? []).map(m => {
                const isMine = (m.sender_id ?? m.sender?.id) === userId;
                return (
                  <div key={m.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                    {!isMine && (
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 mt-auto">
                        {initials(m.sender?.full_name, m.sender?.phone_number)}
                      </div>
                    )}
                    <div className={`max-w-[72%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      {!isMine && (
                        <p className="text-[10px] text-gray-500 font-medium px-1">
                          {m.sender?.full_name ?? m.sender?.phone_number}
                        </p>
                      )}
                      <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                        isMine ? 'bg-navy text-white rounded-br-md' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm'
                      }`}>
                        {m.content}
                      </div>
                      <p className="text-[9px] text-gray-400 px-1">
                        {m.id.startsWith('tmp_') ? 'Sending…' : timeAgo(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
          <div className="px-4 py-3 bg-white border-t border-gray-100 flex gap-2 items-center shrink-0">
            <input value={msg} onChange={e => setMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Type a message…"
              className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-navy/20" />
            <button onClick={handleSend} disabled={!msg.trim() || sendMut.isPending}
              className="w-10 h-10 bg-navy text-white rounded-xl flex items-center justify-center hover:bg-navy/90 transition-colors disabled:opacity-40">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
            </button>
          </div>
        </>
      )}

      {/* Products tab */}
      {tab === 'products' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
          {productsQ.isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
          ) : (productsQ.data ?? []).length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-2">🛍️</div>
              <p className="text-sm">No products shared yet.</p>
              <p className="text-xs mt-1">Share products from their store page!</p>
            </div>
          ) : (
            (productsQ.data ?? []).map(sp => (
              <div key={sp.id} className={`bg-white rounded-2xl border p-4 shadow-sm ${sp.is_finalized ? 'border-green-300' : 'border-gray-100'}`}>
                <div className="flex gap-3">
                  {sp.product.image && (
                    <img src={sp.product.image} alt={sp.product.name}
                      className="w-16 h-16 rounded-xl object-cover shrink-0 border border-gray-100" />
                  )}
                  <div className="flex-1 min-w-0">
                    <a href={`/products/${sp.product.id}`} className="font-bold text-navy text-sm hover:underline line-clamp-2">
                      {sp.product.name}
                    </a>
                    <p className="text-xs font-semibold text-green-600 mt-0.5">₹{sp.product.price}</p>
                    {sp.product.store && <p className="text-xs text-gray-400">{sp.product.store.name}</p>}
                    {sp.note && <p className="text-xs text-gray-500 italic mt-1">"{sp.note}"</p>}
                    <p className="text-[10px] text-gray-400 mt-1">Shared by {sp.shared_by.full_name ?? 'member'} · {timeAgo(sp.created_at)}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {sp.is_finalized ? (
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                      ✓ Finalized {sp.finalized_by ? `by ${sp.finalized_by.full_name}` : ''}
                    </span>
                  ) : isAdmin ? (
                    <button onClick={() => finalizeMut.mutate(sp.id)} disabled={finalizeMut.isPending}
                      className="text-xs font-bold text-navy border border-navy px-3 py-1.5 rounded-xl hover:bg-navy hover:text-white transition-colors disabled:opacity-50">
                      ✓ Set as Final Choice
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">Pending finalization</span>
                  )}
                  <a href={`/products/${sp.product.id}`}
                    className="text-xs text-navy/60 hover:text-navy transition-colors">View →</a>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Members tab (admin only) */}
      {tab === 'members' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">
          {/* Invite link */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs font-bold text-navy mb-3">Invite Link</p>
            {inviteLink ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input readOnly value={inviteLink}
                    className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-xs outline-none font-mono truncate" />
                  <button onClick={() => { navigator.clipboard.writeText(inviteLink); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 1500); }}
                    className="px-3 py-2 bg-navy text-white text-xs font-bold rounded-xl hover:bg-navy/90 transition-colors shrink-0">
                    {inviteCopied ? '✓' : 'Copy'}
                  </button>
                </div>
                <button onClick={() => revokeInviteMut.mutate()} disabled={revokeInviteMut.isPending}
                  className="text-xs text-red-500 hover:underline disabled:opacity-50">Revoke link</button>
              </div>
            ) : (
              <button onClick={() => getInviteMut.mutate()} disabled={getInviteMut.isPending}
                className="w-full py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-navy hover:bg-gray-50 transition-colors disabled:opacity-50">
                {getInviteMut.isPending ? 'Generating…' : 'Generate Invite Link'}
              </button>
            )}
          </div>

          {/* Add member */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs font-bold text-navy mb-3">Add Member by Profile ID</p>
            <div className="flex gap-2">
              <input value={addProfileId} onChange={e => { setAddProfileId(e.target.value.toUpperCase()); setAddError(''); }}
                placeholder="e.g. NS-SF-KU-4X2B"
                className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-navy/20 font-mono uppercase" />
              <button onClick={() => addProfileId.trim() && addMemberMut.mutate(addProfileId.trim())}
                disabled={!addProfileId.trim() || addMemberMut.isPending}
                className="px-4 py-2 bg-navy text-white text-xs font-bold rounded-xl hover:bg-navy/90 transition-colors disabled:opacity-50">
                {addMemberMut.isPending ? '…' : 'Add'}
              </button>
            </div>
            {addError && <p className="text-xs text-red-500 mt-2">{addError}</p>}
            {addMemberMut.isSuccess && <p className="text-xs text-green-600 mt-2">Member added!</p>}
          </div>

          {/* Members list */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {members.map(m => {
              const isCreator = m.user.id === detail.created_by.id;
              const isSelf = m.user.id === userId;
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center text-xs font-bold text-navy shrink-0">
                    {initials(m.user.full_name, m.user.phone_number)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy truncate">
                      {m.user.full_name ?? m.user.phone_number}
                      {isSelf && <span className="text-gray-400 font-normal"> (you)</span>}
                    </p>
                    <p className="text-[10px] text-gray-400">{m.user.profile_id ?? m.user.phone_number}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {m.role === 'admin' && (
                      <span className="text-[9px] font-bold bg-navy/10 text-navy px-1.5 py-0.5 rounded-full">
                        {isCreator ? 'Creator' : 'Admin'}
                      </span>
                    )}
                    {!isSelf && !isCreator && (
                      <>
                        {m.role === 'member' ? (
                          <button onClick={() => makeAdminMut.mutate(m.user.id)}
                            className="text-[10px] font-bold text-navy/60 hover:text-navy border border-gray-200 px-2 py-1 rounded-lg transition-colors">
                            Make Admin
                          </button>
                        ) : (
                          <button onClick={() => removeAdminMut.mutate(m.user.id)}
                            className="text-[10px] font-bold text-orange-500 hover:bg-orange-50 border border-orange-200 px-2 py-1 rounded-lg transition-colors">
                            Demote
                          </button>
                        )}
                        <button onClick={() => removeMemberMut.mutate(m.user.id)}
                          className="text-[10px] font-bold text-red-400 hover:bg-red-50 border border-red-100 px-2 py-1 rounded-lg transition-colors">
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="Group name (e.g. Family Shopping)"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-navy/20 mb-4"
          autoFocus onKeyDown={e => e.key === 'Enter' && name.trim() && createMut.mutate()} />
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
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

  if (!isLoggedIn) return (
    <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
      <div className="text-6xl mb-4">👥</div>
      <h2 className="text-xl font-bold text-navy mb-2">Sign in to view groups</h2>
      <p className="text-gray-500 text-sm mb-6">Create shopping groups with friends and family</p>
      <a href="/auth/login" className="px-6 py-3 bg-navy text-white rounded-xl font-bold text-sm">Sign In</a>
    </div>
  );

  if (selected) return <GroupThread group={selected} userId={userId} onBack={() => { setSelected(null); qc.invalidateQueries({ queryKey: ['groups'] }); }} />;

  const groups = groupsQ.data ?? [];

  return (
    <div className="max-w-lg mx-auto px-4 pb-24 pt-2">
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

      {groupsQ.isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
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
            const mc = g.members_count ?? g.members?.length ?? 0;
            const myGProfileId = auth.user()?.profile_id;
            const isAdm = (!!myGProfileId && g.created_by.profile_id === myGProfileId) ||
              (!!userId && !!g.members?.some(m => m.user.id === userId && m.role === 'admin'));
            return (
              <button key={g.id} onClick={() => setSelected(g)}
                className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 flex items-center gap-4 hover:border-navy hover:shadow-md transition-all text-left">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-navy to-navy/60 flex items-center justify-center text-white font-black text-sm shrink-0 overflow-hidden">
                  {g.avatar_url
                    ? <img src={g.avatar_url} alt={g.name} className="w-full h-full object-cover" />
                    : initials(g.name)
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-navy truncate">{g.name}</p>
                    {isAdm && <span className="text-[9px] font-bold bg-gold/20 text-navy px-1.5 py-0.5 rounded-full shrink-0">Admin</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{mc} member{mc !== 1 ? 's' : ''}</p>
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
        <CreateModal onClose={() => setShowCreate(false)} onCreated={() => qc.invalidateQueries({ queryKey: ['groups'] })} />
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
