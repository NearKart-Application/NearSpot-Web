import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard } from './VendorAuthGuard';

interface HomeDecorVariant {
  variant_id: string;
  variant_name: string;
  product_id: string;
  product_name: string;
  sku: string;
  price: string;
  stock_quantity: number;
  length_cm: string | null;
  width_cm: string | null;
  height_cm: string | null;
  weight_kg: string | null;
  is_assembly_required: boolean;
  is_display_unit: boolean;
}

interface EditBody {
  length_cm?: string | null;
  width_cm?: string | null;
  height_cm?: string | null;
  weight_kg?: string | null;
  is_assembly_required?: boolean;
  is_display_unit?: boolean;
}

function dims(v: HomeDecorVariant) {
  const parts = [v.length_cm, v.width_cm, v.height_cm].filter(Boolean);
  return parts.length === 3 ? `${parts.join(' × ')} cm` : parts.length > 0 ? `${parts.join(' × ')} cm` : '—';
}

function Island() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<HomeDecorVariant | null>(null);

  const { data: variants = [], isLoading } = useQuery<HomeDecorVariant[]>({
    queryKey: ['home-decor-variants'],
    queryFn: () => api.get('/products/home-decor/').then(r => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ productId, variantId, body }: { productId: string; variantId: string; body: EditBody }) =>
      api.patch(`/products/${productId}/variants/${variantId}/home-decor/`, body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['home-decor-variants'] });
      setEditing(null);
    },
  });

  const filtered = variants.filter(v =>
    !query ||
    v.product_name.toLowerCase().includes(query.toLowerCase()) ||
    v.variant_name.toLowerCase().includes(query.toLowerCase()) ||
    v.sku.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Home Decor Inventory</h1>
          <p className="text-slate-500 text-sm mt-1">Manage dimensions, weight, assembly &amp; display flags per variant</p>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Tip:</strong> Dimensions and weight help customers compare products and allow carriers to calculate
        shipping costs. Mark display/floor samples so they aren't counted in fresh sellable stock.
        To add a new home-decor product, go to <a href="/vendor/products" className="underline font-medium">Products</a> and
        create a product first, then return here to fill in physical attributes.
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by product, variant, or SKU…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
      />

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-slate-800 border-t-transparent rounded-full" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No home decor variants found. Edit a product variant and set its physical attributes to have it appear here.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Product / Variant', 'SKU', 'Dimensions (L×W×H)', 'Weight (kg)', 'Assembly', 'Display Unit', 'Stock', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map(v => (
                <tr key={v.variant_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{v.product_name}</div>
                    <div className="text-slate-500 text-xs">{v.variant_name}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{v.sku}</td>
                  <td className="px-4 py-3 text-slate-700">{dims(v)}</td>
                  <td className="px-4 py-3 text-slate-700">{v.weight_kg ? `${v.weight_kg} kg` : '—'}</td>
                  <td className="px-4 py-3">
                    {v.is_assembly_required
                      ? <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs font-medium px-2 py-0.5 rounded-full">🔧 Required</span>
                      : <span className="text-slate-400 text-xs">No</span>}
                  </td>
                  <td className="px-4 py-3">
                    {v.is_display_unit
                      ? <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-xs font-medium px-2 py-0.5 rounded-full">🪟 Display</span>
                      : <span className="text-slate-400 text-xs">No</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{v.stock_quantity}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEditing(v)}
                      className="text-amber-600 hover:text-amber-700 font-medium text-xs border border-amber-200 rounded-lg px-3 py-1 hover:bg-amber-50 transition"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <HomeDecorEditModal
          variant={editing}
          saving={updateMutation.isPending}
          error={updateMutation.error ? 'Failed to save. Please try again.' : null}
          onSave={body => updateMutation.mutate({ productId: editing.product_id, variantId: editing.variant_id, body })}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function HomeDecorEditModal({
  variant,
  saving,
  error,
  onSave,
  onClose,
}: {
  variant: HomeDecorVariant;
  saving: boolean;
  error: string | null;
  onSave: (body: EditBody) => void;
  onClose: () => void;
}) {
  const [lengthCm, setLengthCm] = useState(variant.length_cm ?? '');
  const [widthCm, setWidthCm] = useState(variant.width_cm ?? '');
  const [heightCm, setHeightCm] = useState(variant.height_cm ?? '');
  const [weightKg, setWeightKg] = useState(variant.weight_kg ?? '');
  const [assembly, setAssembly] = useState(variant.is_assembly_required);
  const [display, setDisplay] = useState(variant.is_display_unit);

  const volumeLitres =
    lengthCm && widthCm && heightCm
      ? ((parseFloat(lengthCm) * parseFloat(widthCm) * parseFloat(heightCm)) / 1000).toFixed(2)
      : null;

  function handleSave() {
    onSave({
      length_cm: lengthCm || null,
      width_cm: widthCm || null,
      height_cm: heightCm || null,
      weight_kg: weightKg || null,
      is_assembly_required: assembly,
      is_display_unit: display,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold text-slate-900">Edit Physical Attributes</h2>
          <p className="text-slate-500 text-sm">{variant.product_name} / {variant.variant_name}</p>
        </div>
        <div className="p-6 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

          {/* Dimensions */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Dimensions (cm)</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Length', value: lengthCm, set: setLengthCm },
                { label: 'Width',  value: widthCm,  set: setWidthCm  },
                { label: 'Height', value: heightCm, set: setHeightCm },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="text-xs text-slate-500 mb-1 block">{label}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={value}
                    onChange={e => set(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              ))}
            </div>
            {volumeLitres && (
              <p className="text-xs text-slate-500 mt-1">Volume: {volumeLitres} L ({(parseFloat(volumeLitres) / 1000).toFixed(4)} m³)</p>
            )}
          </div>

          {/* Weight */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Weight (kg)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              placeholder="0.000"
              value={weightKg}
              onChange={e => setWeightKg(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            {[
              { label: 'Assembly Required', desc: 'Ships unassembled — customer must self-assemble', value: assembly, set: setAssembly },
              { label: 'Display / Floor Sample', desc: 'Not fresh stock — marks as non-saleable display unit', value: display, set: setDisplay },
            ].map(({ label, desc, value, set }) => (
              <label key={label} className="flex items-start gap-3 cursor-pointer group">
                <div className="mt-0.5">
                  <div
                    onClick={() => set(!value)}
                    className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${value ? 'bg-slate-800' : 'bg-slate-200'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">{label}</p>
                  <p className="text-xs text-slate-400">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="p-6 pt-0 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VendorHomeDecorInventoryIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <VendorAuthGuard>
        <Island />
      </VendorAuthGuard>
    </QueryClientProvider>
  );
}
