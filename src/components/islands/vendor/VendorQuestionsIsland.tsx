import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';
import { Button } from '@/components/ui/button';
import NoStoreBanner from './NoStoreBanner';

interface Question {
  id: string; question: string; answer: string;
  answered_at?: string; user_name: string; created_at: string;
}

function QuestionRow({ question: q, storeId }: { question: Question; storeId: string }) {
  const qc = useQueryClient();
  const [answer, setAnswer] = useState(q.answer ?? '');
  const [editing, setEditing] = useState(false);

  const answerMut = useMutation({
    mutationFn: (text: string) => api.patch(`/stores/${storeId}/qa/${q.id}/`, { answer: text }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor-questions'] }); setEditing(false); },
  });

  return (
    <div className="bg-white border-b border-gray-100 last:border-0 p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-navy text-sm">{q.user_name || 'Customer'}</span>
          {!q.answer && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Awaiting reply</span>}
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {new Date(q.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
        </span>
      </div>
      <p className="text-sm text-gray-700">{q.question}</p>

      {/* Answer */}
      {q.answer && !editing ? (
        <div className="mt-3 pl-3 border-l-2 border-navy bg-navy/5 rounded-r-xl py-2 pr-3">
          <p className="text-[10px] font-bold text-navy mb-1">Your answer</p>
          <p className="text-xs text-gray-600">{q.answer}</p>
          <button onClick={() => { setEditing(true); setAnswer(q.answer ?? ''); }}
            className="text-[10px] text-navy font-bold mt-1 hover:underline">Edit</button>
        </div>
      ) : editing || !q.answer ? (
        <div className="mt-3">
          {!editing && !q.answer && (
            <button onClick={() => setEditing(true)} className="text-xs text-navy font-bold hover:underline">+ Answer this question</button>
          )}
          {editing && (
            <div className="space-y-2">
              <textarea value={answer} onChange={e => setAnswer(e.target.value)}
                placeholder="Write a helpful answer…" rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10" />
              <div className="flex gap-2">
                <Button onClick={() => answerMut.mutate(answer)} disabled={answerMut.isPending || !answer.trim() || !storeId}
                  size="sm" className="px-4 py-1.5">{answerMut.isPending ? 'Saving…' : 'Post Answer'}</Button>
                <Button onClick={() => { setEditing(false); setAnswer(q.answer ?? ''); }}
                  variant="ghost" size="sm" className="px-4 py-1.5">Cancel</Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Inner() {
  const [filter, setFilter] = useState<'all' | 'unanswered'>('all');

  const { data: storeData, isError: storeError } = useQuery({
    queryKey: ['vendor-store-id'],
    queryFn: () => api.get('/stores/mine/').then(r => r.data),
  });
  const storeId: string = Array.isArray(storeData) ? ((storeData[0] as any)?.id ?? '') : ((storeData as any)?.id ?? '');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-questions'],
    queryFn: () => api.get(`/stores/${storeId}/qa/`).then(r => (Array.isArray(r.data) ? r.data : (r.data?.results ?? []))),
    enabled: !!storeId,
  });

  const questions: Question[] = data ?? [];
  const unanswered = questions.filter(q => !q.answer);
  const shown = filter === 'unanswered' ? unanswered : questions;

  if (storeError || !storeId) return <NoStoreBanner feature="questions" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Questions</h1>
        <p className="text-sm text-gray-400">{questions.length} questions · {unanswered.length} awaiting your answer</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Total Questions', value: questions.length, icon: '❓' },
          { label: 'Awaiting Answer', value: unanswered.length, icon: '✍️' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <p className="text-xl font-bold text-navy">{s.value}</p>
            <p className="text-xs text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-2">
        {[['all', 'All Questions'], ['unanswered', 'Unanswered']].map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f as any)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === f ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {label} {f === 'unanswered' && unanswered.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unanswered.length}</span>}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="card overflow-hidden">
          {[...Array(3)].map((_, i) => <div key={i} className="p-5 border-b border-gray-100 animate-pulse h-20" />)}
        </div>
      ) : isError ? (
        <IslandError error={error} refetch={refetch} />
      ) : shown.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">❓</div>
          <p className="font-semibold text-gray-600">{filter === 'unanswered' ? 'All questions answered!' : 'No questions yet'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {shown.map(q => <QuestionRow key={q.id} question={q} storeId={storeId} />)}
        </div>
      )}
    </div>
  );
}

export default function VendorQuestionsIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
