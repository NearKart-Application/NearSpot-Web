import { useState, useEffect, useRef } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';

interface Conversation {
  id: string;
  store_id: string;
  store_name: string;
  customer_name?: string;
  my_unread_count: number;
  last_message?: string;
  last_message_at?: string;
  is_active?: boolean;
}

interface Message {
  id: string;
  sender_role: 'customer' | 'vendor';
  content: string;
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

/* ── Thread view ────────────────────────────────────────────────────── */
function ChatThread({ conv, onBack }: { conv: Conversation; onBack: () => void }) {
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: msgsData, isLoading } = useQuery({
    queryKey: ['messages', conv.id],
    queryFn:  () => api.get(`/conversations/${conv.id}/messages/`).then(r => r.data),
    refetchInterval: 5_000,
  });

  const sendMut = useMutation({
    mutationFn: (content: string) =>
      api.post(`/conversations/${conv.id}/messages/`, { content }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['messages', conv.id] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    },
  });

  const msgs: Message[] = msgsData?.results ?? (Array.isArray(msgsData) ? msgsData : []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [msgs.length]);

  useEffect(() => {
    // Mark conversation as read when opening
    api.patch(`/conversations/${conv.id}/read/`).catch(() => {});
    qc.invalidateQueries({ queryKey: ['conversations'] });
  }, [conv.id]);

  const handleSend = () => {
    const t = text.trim();
    if (!t || sendMut.isPending) return;
    sendMut.mutate(t);
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
          <p className={`text-xs font-semibold ${conv.is_active !== false ? 'text-green-500' : 'text-gray-400'}`}>
            {conv.is_active !== false ? 'Active' : 'Closed'}
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
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                isMe
                  ? 'bg-navy text-white rounded-br-md'
                  : 'bg-white text-navy border border-gray-100 rounded-bl-md shadow-sm'
              }`}>
                <p className="text-sm">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${isMe ? 'text-white/60 text-right' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  {isMe && msg.is_read && <span className="ml-1">✓✓</span>}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 p-3 flex gap-2 shrink-0">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Type a message…"
          className="input flex-1 py-2.5 rounded-2xl"
          autoFocus
        />
        <button onClick={handleSend}
          disabled={sendMut.isPending || !text.trim()}
          className="w-11 h-11 bg-navy rounded-2xl flex items-center justify-center hover:bg-navy/90 disabled:opacity-40 transition-all">
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
  const { data, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn:  () => api.get('/conversations/').then(r => r.data),
    refetchInterval: 15_000,
  });

  const convs: Conversation[] = data?.results ?? (Array.isArray(data) ? data : []);

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

  if (!convs.length) return (
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
      {convs.map(conv => (
        <button key={conv.id} onClick={() => onOpen(conv)}
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
              {conv.last_message ?? 'No messages yet'}
            </p>
          </div>
          {conv.my_unread_count > 0 && (
            <div className="w-5 h-5 bg-navy rounded-full flex items-center justify-center shrink-0 ml-1">
              <span className="text-[10px] text-white font-bold">{conv.my_unread_count}</span>
            </div>
          )}
        </button>
      ))}
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
      // Start or get conversation with this store
      setStarting(true);
      api.post('/conversations/start/', { store_id: storeId })
        .then(async res => {
          const conv = res.data;
          // If arriving from a product page, send an automatic opening message so
          // the vendor immediately knows which product the customer is asking about.
          if (productId && productName) {
            try {
              await api.post(`/conversations/${conv.id}/messages/`, {
                content: `Hi! I'm interested in "${productName}". Is it available?`,
              });
            } catch { /* non-critical — open chat even if auto-message fails */ }
          }
          setSelected(conv);
          // Clean URL
          history.replaceState({}, '', '/customer/chat');
        })
        .catch(() => {})
        .finally(() => setStarting(false));
    } else if (convId) {
      // Open a known conversation by ID
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
      <Inner />
    </QueryClientProvider>
  );
}
