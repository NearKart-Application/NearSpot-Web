import { useState, useEffect, useRef } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

interface Conversation {
  id: string;
  store_id: string;
  store_name: string;
  customer_name?: string;
  customer_profile_id?: string;
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

function ChatThread({ conv, onBack }: { conv: Conversation; onBack: () => void }) {
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const displayName = conv.customer_name || 'Customer';

  const { data: msgsData, isLoading } = useQuery({
    queryKey: ['vendor-messages', conv.id],
    queryFn: () => api.get(`/conversations/${conv.id}/messages/`).then(r => r.data),
    refetchInterval: 5_000,
  });

  const sendMut = useMutation({
    mutationFn: (content: string) =>
      api.post(`/conversations/${conv.id}/messages/`, { content }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['vendor-messages', conv.id] });
      qc.invalidateQueries({ queryKey: ['vendor-conversations'] });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [msgsData]);

  useEffect(() => {
    api.patch(`/conversations/${conv.id}/read/`).catch(() => {});
    qc.invalidateQueries({ queryKey: ['vendor-conversations'] });
  }, [conv.id]);

  const handleSend = () => {
    const t = text.trim();
    if (!t || sendMut.isPending) return;
    sendMut.mutate(t);
  };

  const msgs: Message[] = msgsData?.results ?? (Array.isArray(msgsData) ? msgsData : []);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-3 p-4 bg-white border-b border-gray-100 rounded-t-2xl shrink-0">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="w-10 h-10 rounded-full bg-navy flex items-center justify-center text-white font-bold text-sm shrink-0">
          {displayName.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-navy text-sm truncate">{displayName}</p>
          <p className={`text-xs font-semibold ${conv.is_active !== false ? 'text-green-500' : 'text-gray-400'}`}>
            {conv.is_active !== false ? 'Active' : 'Closed'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div className="h-10 w-48 bg-gray-200 rounded-2xl animate-pulse" />
              </div>
            ))}
          </div>
        )}
        {!isLoading && msgs.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-2">💬</div>
            <p className="text-gray-400 text-sm">No messages yet. Reply to start the conversation.</p>
          </div>
        )}
        {msgs.map(msg => {
          const isMe = msg.sender_role === 'vendor';
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && (
                <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 text-[10px] font-bold mr-1.5 mt-auto shrink-0">
                  {displayName.slice(0, 1).toUpperCase()}
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

      <div className="bg-white border-t border-gray-100 p-3 flex gap-2 shrink-0">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Type a reply…"
          className="input flex-1 py-2.5 rounded-2xl"
          autoFocus
        />
        <button
          onClick={handleSend}
          disabled={sendMut.isPending || !text.trim()}
          className="w-11 h-11 bg-navy rounded-2xl flex items-center justify-center hover:bg-navy/90 disabled:opacity-40 transition-all"
        >
          <svg className="w-5 h-5 text-white rotate-90" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function ConversationList({
  convs,
  isLoading,
  onSelect,
}: {
  convs: Conversation[];
  isLoading: boolean;
  onSelect: (c: Conversation) => void;
}) {
  return (
    <div className="space-y-1">
      {isLoading && convs.length === 0 && (
        <div className="space-y-2 p-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      )}
      {!isLoading && convs.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">💬</div>
          <p className="font-semibold text-gray-600">No messages yet</p>
          <p className="text-sm text-gray-400 mt-1">Customer conversations will appear here</p>
        </div>
      )}
      {convs.map(c => (
        <button
          key={c.id}
          onClick={() => onSelect(c)}
          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
        >
          <div className="w-11 h-11 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold text-sm shrink-0">
            {(c.customer_name || 'C').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-navy text-sm truncate">{c.customer_name || 'Customer'}</p>
              <span className="text-[11px] text-gray-400 shrink-0">{timeAgo(c.last_message_at)}</span>
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">{c.last_message || 'No messages yet'}</p>
          </div>
          {c.my_unread_count > 0 && (
            <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              {c.my_unread_count > 9 ? '9+' : c.my_unread_count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function Inner() {
  const [selected, setSelected] = useState<Conversation | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-conversations'],
    queryFn: () => api.get('/conversations/').then(r => r.data),
    refetchInterval: 15_000,
  });

  const convs: Conversation[] = data?.results ?? (Array.isArray(data) ? data : []);

  if (isError) return <IslandError error={error} refetch={refetch} />;

  if (selected) {
    return <ChatThread conv={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-navy">Messages</h1>
        <p className="text-sm text-gray-400">{convs.length} conversation{convs.length !== 1 ? 's' : ''}</p>
      </div>
      <ConversationList convs={convs} isLoading={isLoading} onSelect={setSelected} />
    </div>
  );
}

export default function VendorChatIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <VendorAuthGuard>
        <Inner />
      </VendorAuthGuard>
    </QueryClientProvider>
  );
}
