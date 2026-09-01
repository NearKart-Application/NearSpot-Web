import { useState, useEffect, useRef, useCallback } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CustomerAuthGuard } from './CustomerAuthGuard';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';

const listContainer = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const listItem = { hidden: { opacity: 0, x: -14 }, show: { opacity: 1, x: 0, transition: { duration: 0.28, ease: 'easeOut' as const } } };

interface Conversation {
  id: string;
  store_id: string;
  store_name: string;
  customer_name?: string;
  my_unread_count: number;
  last_message?: { content: string; message_type: string } | string | null;
  last_message_at?: string;
  is_active?: boolean;
}

interface Message {
  id: string;
  sender_role: 'customer' | 'vendor';
  content: string;
  message_type: 'text' | 'image' | 'product_ref' | 'video_ref';
  media_url?: string | null;
  ref_id?: string | null;
  created_at: string;
  is_read?: boolean;
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getWsBase(): string {
  const base = (api.defaults.baseURL ?? '/api/v1').replace(/\/api\/v\d+\/?$/, '');
  if (base.startsWith('http')) {
    return base.replace(/^https?/, m => m === 'https' ? 'wss' : 'ws');
  }
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}`;
}

/* ── Thread view ────────────────────────────────────────────────────── */
function ChatThread({ conv, onBack }: { conv: Conversation; onBack: () => void }) {
  const [text, setText] = useState('');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [wsReady, setWsReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  // Initial load via REST
  const { data: msgsData, isLoading } = useQuery({
    queryKey: ['messages', conv.id],
    queryFn:  () => api.get(`/conversations/${conv.id}/messages/`).then(r => r.data),
    staleTime: Infinity,
  });

  const msgs: Message[] = Array.isArray(msgsData) ? msgsData : (msgsData?.results ?? []);

  // Inject an incoming WS message into the query cache
  const injectMessage = useCallback((msg: Message) => {
    qc.setQueryData(['messages', conv.id], (old: any) => {
      const list: Message[] = Array.isArray(old) ? old : (old?.results ?? []);
      // Replace optimistic entry if content matches, else append if new
      const optIdx = list.findIndex(m => m.id.startsWith('tmp_') && m.content === msg.content);
      if (optIdx >= 0) {
        const updated = [...list];
        updated[optIdx] = msg;
        return updated;
      }
      if (list.some(m => m.id === msg.id)) return list;
      return [...list, msg];
    });
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    qc.invalidateQueries({ queryKey: ['conversations'] });
  }, [conv.id, qc]);

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
      const url = `${getWsBase()}/ws/conversations/${conv.id}/?token=${token}`;
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        retries = 0;
        if (!unmounted) setWsReady(true);
      };

      ws.onmessage = (e) => {
        if (unmounted) return;
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'typing') {
            setIsPartnerTyping(data.is_typing);
            return;
          }
          if (data.type === 'token_refreshed') return;
          if (data.id) injectMessage(data as Message);
        } catch { /* ignore malformed frames */ }
      };

      ws.onclose = async (e) => {
        if (!unmounted) setWsReady(false);
        if (unmounted) return;
        if (e.code === 4001) {
          const newToken = await refreshToken();
          if (newToken) { connect(newToken); return; }
        }
        const delay = Math.min(1000 * (2 ** retries), 30_000) + Math.random() * 1000;
        retries = Math.min(retries + 1, 6);
        retryTimer = setTimeout(() => {
          const t = localStorage.getItem('ns_access');
          if (t && !unmounted) connect(t);
        }, delay);
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
  }, [conv.id, injectMessage]);

  // Scroll to bottom on load
  useEffect(() => {
    if (!isLoading) bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [isLoading]);

  // Mark read on open
  useEffect(() => {
    api.patch(`/conversations/${conv.id}/read/`).catch(() => {});
    qc.invalidateQueries({ queryKey: ['conversations'] });
  }, [conv.id, qc]);

  const sendMut = useMutation({
    mutationFn: (payload: { content: string; message_type?: string; media_url?: string }) =>
      api.post(`/conversations/${conv.id}/messages/`, payload).then(r => r.data as Message),
    onSuccess: (msg) => {
      injectMessage(msg);
    },
  });

  const sendText = () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    clearTimeout(typingTimerRef.current);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', is_typing: false }));
    }
    const optimistic: Message = {
      id: `tmp_${Date.now()}`,
      sender_role: 'customer',
      content: t,
      message_type: 'text',
      created_at: new Date().toISOString(),
    };
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      qc.setQueryData(['messages', conv.id], (old: any) => {
        const list: Message[] = Array.isArray(old) ? old : (old?.results ?? []);
        return [...list, optimistic];
      });
      wsRef.current.send(JSON.stringify({ type: 'chat_message', content: t }));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    } else {
      sendMut.mutate({ content: t });
    }
  };

  const handleTyping = (val: string) => {
    setText(val);
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'typing', is_typing: true }));
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      wsRef.current?.send(JSON.stringify({ type: 'typing', is_typing: false }));
    }, 3000);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const { data } = await api.post(`/conversations/${conv.id}/upload/`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      sendMut.mutate({ content: '', message_type: 'image', media_url: data.url });
    } catch {
      alert('Image upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const lastMessageText = (m?: Conversation['last_message']): string => {
    if (!m) return 'No messages yet';
    if (typeof m === 'string') return m;
    if (m.message_type === 'image') return '📷 Image';
    return m.content ?? 'No messages yet';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-white border-b border-gray-100 rounded-t-2xl shrink-0">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="w-10 h-10 rounded-full bg-navy flex items-center justify-center text-white font-bold text-sm shrink-0">
          {conv.store_name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-navy text-sm truncate">{conv.store_name}</p>
          <p className="text-xs font-semibold text-green-500 flex items-center gap-1">
            {wsReady
              ? <><span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />Live</>
              : (conv.is_active !== false ? 'Active' : 'Closed')
            }
          </p>
        </div>
        <a href={`/stores/${conv.store_id}`}
          className="text-xs font-bold text-navy/60 hover:text-navy transition-colors shrink-0">
          View Store →
        </a>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {isLoading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div className="h-10 w-48 bg-gray-200 rounded-2xl animate-pulse" />
              </div>
            ))}
          </div>
        )}
        {!isLoading && msgs.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-2">👋</div>
            <p className="text-gray-400 text-sm">
              Start the conversation! Say hi to {conv.store_name}.
            </p>
          </div>
        )}
        {msgs.map(msg => {
          const isMe = msg.sender_role === 'customer';
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && (
                <div className="w-7 h-7 rounded-full bg-navy flex items-center justify-center text-white text-[10px] font-bold mr-1.5 mt-auto shrink-0">
                  {conv.store_name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl overflow-hidden ${
                isMe
                  ? 'bg-navy text-white rounded-br-md'
                  : 'bg-white text-navy border border-gray-100 rounded-bl-md shadow-sm'
              }`}>
                {msg.message_type === 'image' && msg.media_url ? (
                  <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={msg.media_url}
                      alt="Chat image"
                      className="max-w-[240px] max-h-[320px] object-cover block"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <div className="px-4 py-2.5">
                    <p className="text-sm">{msg.content}</p>
                  </div>
                )}
                <div className={`px-4 pb-2 pt-0 flex items-center gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <span className={`text-[10px] ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                    {msg.id.startsWith('tmp_')
                      ? 'Sending…'
                      : new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                    }
                  </span>
                  {isMe && !msg.id.startsWith('tmp_') && (
                    <span className={`text-[10px] ${msg.is_read ? 'text-sky-300' : 'text-white/40'}`}>
                      {msg.is_read ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {isPartnerTyping && (
          <div className="flex items-end gap-1.5">
            <div className="w-7 h-7 rounded-full bg-navy flex items-center justify-center text-white text-[10px] font-bold shrink-0">
              {conv.store_name.slice(0, 1).toUpperCase()}
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md shadow-sm px-4 py-3 flex gap-1">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full inline-block animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 p-3 flex gap-2 items-center shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleImageSelect}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Send image"
          className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 disabled:opacity-40 transition-colors shrink-0">
          {uploading ? (
            <div className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 text-navy/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          )}
        </button>
        <input
          value={text}
          onChange={e => handleTyping(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
          placeholder="Type a message…"
          className="input flex-1 py-2.5 rounded-2xl"
          autoFocus
        />
        <button onClick={sendText}
          disabled={sendMut.isPending || !text.trim()}
          className="w-11 h-11 bg-navy rounded-2xl flex items-center justify-center hover:bg-navy/90 disabled:opacity-40 transition-all shrink-0">
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ── Conversation list ─────────────────────────────────────────────── */
function ConversationList({ onOpen }: { onOpen: (conv: Conversation) => void }) {
  const [page, setPage] = useState(1);
  const [allConvs, setAllConvs] = useState<Conversation[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn:  () => api.get('/conversations/').then(r => r.data),
    refetchInterval: 20_000,
  });

  useEffect(() => {
    if (!data) return;
    const fresh: Conversation[] = data?.results ?? (Array.isArray(data) ? data : []);
    setAllConvs(fresh);
    setHasMore(!!data?.next);
    setPage(1);
  }, [data]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await api.get(`/conversations/?page=${nextPage}`);
      const more: Conversation[] = res.data?.results ?? (Array.isArray(res.data) ? res.data : []);
      const ids = new Set(allConvs.map(c => c.id));
      setAllConvs(prev => [...prev, ...more.filter(c => !ids.has(c.id))]);
      setHasMore(!!res.data?.next);
      setPage(nextPage);
    } catch { /* keep existing */ }
    finally { setLoadingMore(false); }
  };

  const lastMessageText = (m: Conversation['last_message']): string => {
    if (!m) return 'No messages yet';
    if (typeof m === 'string') return m;
    if (m.message_type === 'image') return '📷 Image';
    return m.content ?? 'No messages yet';
  };

  if (isLoading) return (
    <div className="divide-y divide-gray-100 bg-white rounded-2xl border border-gray-100">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex gap-3 p-4 animate-pulse">
          <div className="w-12 h-12 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 bg-gray-200 rounded-full w-2/3" />
            <div className="h-3 bg-gray-200 rounded-full w-full" />
          </div>
        </div>
      ))}
    </div>
  );

  if (!allConvs.length) return (
    <div className="flex flex-col items-center py-20 text-center px-6">
      <div className="text-6xl mb-4">💬</div>
      <h3 className="font-bold text-navy text-lg">No conversations yet</h3>
      <p className="text-gray-400 text-sm mt-2 max-w-xs">
        Visit a store page and tap "Chat" to start a conversation.
      </p>
      <a href="/" className="mt-5 btn-primary px-8">Browse Stores</a>
    </div>
  );

  return (
    <div>
      <motion.div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100"
        variants={listContainer} initial="hidden" animate="show">
        {allConvs.map(conv => (
          <motion.button key={conv.id} variants={listItem} onClick={() => onOpen(conv)}
            className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-navy to-navy/60 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {conv.store_name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-navy text-sm truncate">{conv.store_name}</p>
                <span className="text-[11px] text-gray-400 shrink-0">{timeAgo(conv.last_message_at)}</span>
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {lastMessageText(conv.last_message)}
              </p>
            </div>
            {conv.my_unread_count > 0 && (
              <div className="w-5 h-5 bg-navy rounded-full flex items-center justify-center shrink-0 ml-1">
                <span className="text-[10px] text-white font-bold">{conv.my_unread_count}</span>
              </div>
            )}
          </motion.button>
        ))}
      </motion.div>
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full mt-3 py-3 text-sm font-bold text-navy hover:bg-navy/5 rounded-2xl border border-gray-200 transition-colors disabled:opacity-50">
          {loadingMore ? 'Loading…' : 'Load more conversations'}
        </button>
      )}
    </div>
  );
}

/* ── Main island ────────────────────────────────────────────────────── */
function Inner() {
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [starting, setStarting] = useState(false);
  const qc = useQueryClient();
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ns_access');

  // Read ?store= and ?conversation= URL params to deep-link
  useEffect(() => {
    if (!isLoggedIn) return;
    const params = new URLSearchParams(window.location.search);
    const storeId = params.get('store');
    const convId  = params.get('conversation');

    if (storeId) {
      const productId   = params.get('product');
      const productName = params.get('productName');
      setStarting(true);
      api.post('/conversations/start/', { store_id: storeId })
        .then(async res => {
          const conv = res.data;
          if (productId && productName) {
            try {
              await api.post(`/conversations/${conv.id}/messages/`, {
                content: `Hi! I'm interested in "${productName}". Is it available?`,
              });
            } catch { /* non-critical */ }
          }
          setSelected(conv);
          history.replaceState({}, '', '/customer/chat');
        })
        .catch(() => {})
        .finally(() => setStarting(false));
    } else if (convId) {
      api.get('/conversations/')
        .then(res => {
          const convs: Conversation[] = res.data?.results ?? (Array.isArray(res.data) ? res.data : []);
          const found = convs.find(c => c.id === convId);
          if (found) {
            setSelected(found);
            history.replaceState({}, '', '/customer/chat');
          }
        })
        .catch(() => {});
    }
  }, [isLoggedIn]);

  if (!isLoggedIn) return (
    <div className="flex flex-col items-center py-24 text-center px-6">
      <div className="w-24 h-24 rounded-full bg-navy/10 flex items-center justify-center mb-5 text-5xl">💬</div>
      <h2 className="text-xl font-black text-navy">Sign in to view messages</h2>
      <p className="text-gray-400 text-sm mt-2">Chat directly with store owners about products and availability.</p>
      <a href="/auth/login" className="mt-6 btn-primary px-10 py-3">Sign In</a>
    </div>
  );

  if (starting) return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-navy border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Opening chat…</p>
      </div>
    </div>
  );

  if (selected) {
    return (
      <ChatThread
        conv={selected}
        onBack={() => {
          setSelected(null);
          qc.invalidateQueries({ queryKey: ['conversations'] });
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-navy">Messages</h1>
          <p className="text-sm text-gray-400">Conversations with stores</p>
        </div>
        <a href="/"
          className="text-xs font-bold text-navy border border-navy px-3 py-2 rounded-xl hover:bg-navy hover:text-white transition-colors">
          Browse Stores
        </a>
      </div>
      <ConversationList onOpen={setSelected} />
    </div>
  );
}

export default function ChatIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomerAuthGuard>
        <Inner />
      </CustomerAuthGuard>
    </QueryClientProvider>
  );
}
