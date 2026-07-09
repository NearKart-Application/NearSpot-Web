import { useState } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { AdminShell } from './AdminShell';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

type CatForm = Omit<Category, 'id' | 'created_at'>;

const EMPTY_FORM: CatForm = { name: '', slug: '', icon: '', display_order: 0, is_active: true };

function toSlug(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function InlineEditor({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial: CatForm;
  onSave: (data: CatForm) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<CatForm>(initial);
  const set = (k: keyof CatForm, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <tr className="bg-blue-50">
      <td className="px-4 py-2">
        <input
          value={form.name}
          onChange={(e) => { set('name', e.target.value); set('slug', toSlug(e.target.value)); }}
          className="input py-1.5 text-xs"
          placeholder="Name"
        />
      </td>
      <td className="px-4 py-2">
        <input value={form.slug} onChange={(e) => set('slug', e.target.value)} className="input py-1.5 text-xs" placeholder="slug" />
      </td>
      <td className="px-4 py-2">
        <input value={form.icon} onChange={(e) => set('icon', e.target.value)} className="input py-1.5 text-xs w-20" placeholder="🛍" />
      </td>
      <td className="px-4 py-2">
        <input type="number" value={form.display_order} onChange={(e) => set('display_order', +e.target.value)} className="input py-1.5 text-xs w-20" />
      </td>
      <td className="px-4 py-2">
        <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-2">
          <button onClick={() => onSave(form)} disabled={loading || !form.name} className="btn-primary btn-sm">Save</button>
          <button onClick={onCancel} className="btn-ghost btn-sm">Cancel</button>
        </div>
      </td>
    </tr>
  );
}

function Inner() {
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | 'new' | null>(null);

  const { data, isLoading, error, refetch } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: () => api.get('/admin-panel/categories/').then((r) => Array.isArray(r.data) ? r.data : r.data.results ?? []),
  });

  const create = useMutation({
    mutationFn: (payload: CatForm) => api.post('/admin-panel/categories/', payload).then((r) => r.data),
    onSuccess: () => { setEditId(null); qc.invalidateQueries({ queryKey: ['admin-categories'] }); },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CatForm }) =>
      api.patch(`/admin-panel/categories/${id}/`, payload).then((r) => r.data),
    onSuccess: () => { setEditId(null); qc.invalidateQueries({ queryKey: ['admin-categories'] }); },
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/admin-panel/categories/${id}/`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-categories'] }),
  });

  if (isLoading) {
    return <div className="h-64 bg-gray-200 rounded-2xl animate-pulse" />;
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="font-semibold" style={{ color: '#1C2E4A' }}>Failed to load categories</p>
        <button onClick={() => refetch()} className="btn-primary mt-4">Retry</button>
      </div>
    );
  }

  const categories = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title mb-0">Categories ({categories.length})</h2>
        <button onClick={() => setEditId('new')} className="btn-primary btn-sm">+ Add Category</button>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {['Name', 'Slug', 'Icon', 'Order', 'Active', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {editId === 'new' && (
              <InlineEditor
                initial={EMPTY_FORM}
                onSave={(form) => create.mutate(form)}
                onCancel={() => setEditId(null)}
                loading={create.isPending}
              />
            )}
            {categories.map((cat) =>
              editId === cat.id ? (
                <InlineEditor
                  key={cat.id}
                  initial={{ name: cat.name, slug: cat.slug, icon: cat.icon, display_order: cat.display_order, is_active: cat.is_active }}
                  onSave={(form) => update.mutate({ id: cat.id, payload: form })}
                  onCancel={() => setEditId(null)}
                  loading={update.isPending}
                />
              ) : (
                <tr key={cat.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium" style={{ color: '#1C2E4A' }}>{cat.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cat.slug}</td>
                  <td className="px-4 py-3 text-xl">{cat.icon}</td>
                  <td className="px-4 py-3 text-gray-500">{cat.display_order}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${cat.is_active ? 'badge-green' : 'badge-red'}`}>
                      {cat.is_active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setEditId(cat.id)} className="btn-ghost btn-sm">Edit</button>
                      <button
                        onClick={() => { if (confirm('Delete this category?')) del.mutate(cat.id); }}
                        disabled={del.isPending}
                        className="btn-danger btn-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
            {categories.length === 0 && !editId && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">No categories</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminCategoriesIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        <Inner />
      </AdminShell>
    </QueryClientProvider>
  );
}
