import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard } from './VendorAuthGuard';
import { Button } from '@/components/ui/button';

interface ProductFormData {
  name: string;
  category: string;
  description: string;
  base_price: string;
  sale_price: string;
  cost_price: string;
  stock: string;
  product_code: string;
  status: string;
  is_visible: boolean;
  colors: string;
  hsn_code: string;
  gst_rate: string;
}

const CATEGORIES = [
  'fashion', 'footwear', 'jewellery', 'electronics', 'beauty',
  'food', 'gifts', 'decor', 'books', 'sports', 'grocery', 'pharmacy', 'others',
];

const STATUSES = ['active', 'draft', 'inactive'];

function Inner({ productId }: { productId?: string }) {
  const isEdit = !!productId;

  const [form, setForm] = useState<ProductFormData>({
    name: '', category: 'fashion', description: '',
    base_price: '', sale_price: '', cost_price: '', stock: '', product_code: '',
    status: 'draft', is_visible: true, colors: '',
    hsn_code: '', gst_rate: '',
  });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ['vendor-product-detail', productId],
    queryFn: () => api.get(`/products/${productId}/`).then(r => r.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!existing) return;
    setForm({
      name: existing.name ?? '',
      category: existing.category ?? 'fashion',
      description: existing.description ?? '',
      base_price: String(existing.base_price ?? existing.price ?? ''),
      sale_price: String(existing.sale_price ?? ''),
      cost_price: String(existing.cost_price ?? ''),
      stock: String(existing.stock_count ?? existing.stock_total ?? ''),
      product_code: existing.product_code ?? '',
      status: existing.status ?? 'draft',
      is_visible: existing.is_visible ?? true,
      colors: (existing.colors ?? []).join(', '),
      hsn_code: existing.hsn_code ?? '',
      gst_rate: existing.gst_rate ? String(existing.gst_rate) : '',
    });
  }, [existing?.id]);

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim(),
        base_price: parseFloat(form.base_price) || 0,
        ...(form.sale_price ? { sale_price: parseFloat(form.sale_price) } : {}),
        ...(form.cost_price ? { cost_price: parseFloat(form.cost_price) } : {}),
        stock: parseInt(form.stock) || 0,
        product_code: form.product_code.trim(),
        status: form.status,
        is_visible: form.is_visible,
        colors: form.colors.split(',').map(c => c.trim()).filter(Boolean),
        ...(form.hsn_code.trim() ? { hsn_code: form.hsn_code.trim() } : {}),
        ...(form.gst_rate ? { gst_rate: parseFloat(form.gst_rate) } : {}),
      };
      return isEdit
        ? api.patch(`/products/${productId}/`, payload)
        : api.post('/products/', payload);
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => { window.location.href = '/vendor/products'; }, 1200);
    },
    onError: (e: any) => {
      const data = e?.response?.data;
      setError(
        typeof data === 'string' ? data :
        data?.detail ?? data?.name?.[0] ?? data?.base_price?.[0] ?? 'Failed to save product. Please try again.'
      );
    },
  });

  const set = (key: keyof ProductFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  if (saved) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-5xl mb-4">✅</div>
      <h2 className="text-xl font-bold text-navy mb-2">Product {isEdit ? 'updated' : 'created'}!</h2>
      <p className="text-sm text-gray-400">Redirecting to your products…</p>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <a href="/vendor/products" className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:border-navy hover:text-navy transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 className="text-xl font-bold text-navy">{isEdit ? 'Edit Product' : 'Add New Product'}</h1>
          <p className="text-sm text-gray-400">{isEdit ? 'Update product details' : 'Add a product to your store'}</p>
        </div>
      </div>

      <div className="card p-6 space-y-5">
        {/* Name */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Product Name *</label>
          <input value={form.name} onChange={set('name')} placeholder="e.g. Blue Denim Jacket"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10" />
        </div>

        {/* Category */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Category *</label>
          <select value={form.category} onChange={set('category')}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-navy/40 capitalize">
            {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Description</label>
          <textarea value={form.description} onChange={set('description')} rows={3}
            placeholder="Describe the product, materials, sizing, etc."
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10" />
        </div>

        {/* Prices */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Base Price (₹) *</label>
            <input type="number" min="0" step="0.01" value={form.base_price} onChange={set('base_price')} placeholder="499"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Sale Price (₹)</label>
            <input type="number" min="0" step="0.01" value={form.sale_price} onChange={set('sale_price')} placeholder="Optional"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
          </div>
        </div>

        {/* Stock + Code */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Stock Quantity *</label>
            <input type="number" min="0" value={form.stock} onChange={set('stock')} placeholder="10"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Product Code</label>
            <input value={form.product_code} onChange={set('product_code')} placeholder="SKU-001"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
          </div>
        </div>

        {/* Colors */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Colors</label>
          <input value={form.colors} onChange={set('colors')} placeholder="Red, Blue, Black (comma-separated)"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
        </div>

        {/* GST / Tax fields — P0 legal compliance */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">HSN Code</label>
            <input value={form.hsn_code} onChange={set('hsn_code')} placeholder="e.g. 61091000"
              maxLength={8}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">GST Rate (%)</label>
            <input type="number" min="0" max="28" step="0.5" value={form.gst_rate} onChange={set('gst_rate')} placeholder="0 / 5 / 12 / 18 / 28"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
          </div>
        </div>

        {/* Cost Price — P2 margin analytics */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Cost Price ₹ <span className="font-normal normal-case text-gray-400">(not visible to customers)</span></label>
          <input type="number" min="0" step="0.01" value={form.cost_price} onChange={set('cost_price')} placeholder="Your purchase cost"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
        </div>

        {/* Status + Visible */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Status</label>
            <select value={form.status} onChange={set('status')}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-navy/40">
              {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Visibility</label>
            <button onClick={() => setForm(f => ({ ...f, is_visible: !f.is_visible }))}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all w-full ${
                form.is_visible ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}>
              <span>{form.is_visible ? '👁️' : '🚫'}</span>
              {form.is_visible ? 'Visible' : 'Hidden'}
            </button>
          </div>
        </div>

        {/* Image upload note */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold mb-0.5">📸 Product Images</p>
          <p className="text-xs">To add or change product images, please use the NearSpot mobile app.</p>
        </div>

        {error && <p className="text-sm text-red-500 font-semibold">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !form.name.trim() || !(parseFloat(form.base_price) > 0)}
            className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-60">
            {saveMut.isPending ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Product')}
          </Button>
          <a href="/vendor/products"
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:border-navy hover:text-navy transition-colors text-center">
            Cancel
          </a>
        </div>
      </div>
    </div>
  );
}

export default function VendorProductFormIsland({ productId }: { productId?: string }) {
  return (
    <QueryClientProvider client={queryClient}>
      <VendorAuthGuard>
        <Inner productId={productId} />
      </VendorAuthGuard>
    </QueryClientProvider>
  );
}
