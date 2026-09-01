import { useState, useEffect, useRef, useCallback } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  barcode: string;
  status: string;
  is_visible: boolean;
  colors: string;
  hsn_code: string;
  gst_rate: string;
}

interface ProductImage { id: string; image_url: string; is_primary: boolean; order: number; }

function ImageUploadSection({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const { data: images = [], refetch } = useQuery<ProductImage[]>({
    queryKey: ['product-images', productId],
    queryFn: () => api.get(`/products/${productId}/`).then(r => r.data.images ?? []),
  });

  const deleteMut = useMutation({
    mutationFn: (imageId: string) => api.delete(`/products/${productId}/images/${imageId}/`),
    onSuccess: () => refetch(),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    if (images.length + files.length > 5) {
      setUploadError(`Max 5 images. You have ${images.length}, tried to add ${files.length}.`);
      return;
    }
    setUploading(true);
    setUploadError('');
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('images', f));
    try {
      await api.post(`/products/${productId}/images/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refetch();
    } catch (err: any) {
      setUploadError(err?.response?.data?.message ?? 'Upload failed. Try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Product Images ({images.length}/5)</label>
      <div className="flex flex-wrap gap-2 mb-3">
        {images.map(img => (
          <div key={img.id} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 group">
            <img src={img.image_url} alt="" className="w-full h-full object-cover" />
            {img.is_primary && (
              <span className="absolute bottom-0 left-0 right-0 bg-navy/80 text-white text-[9px] text-center py-0.5">Primary</span>
            )}
            <button onClick={() => deleteMut.mutate(img.id)}
              className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              ×
            </button>
          </div>
        ))}
        {images.length < 5 && (
          <button onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-navy hover:text-navy transition-colors disabled:opacity-60">
            <span className="text-2xl leading-none">{uploading ? '⏳' : '+'}</span>
            <span className="text-[9px] mt-0.5">{uploading ? 'Uploading' : 'Add photo'}</span>
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
      <p className="text-[10px] text-gray-400">Min 300×300 px · Max 10 MB per image</p>
    </div>
  );
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
    base_price: '', sale_price: '', cost_price: '', stock: '', product_code: '', barcode: '',
    status: 'draft', is_visible: true, colors: '',
    hsn_code: '', gst_rate: '',
  });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  // Images staged during creation
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const pendingImgRef = useRef<HTMLInputElement>(null);

  const addPendingImages = useCallback((files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    setPendingImages(prev => {
      const merged = [...prev, ...newFiles].slice(0, 5);
      setPendingPreviews(merged.map(f => URL.createObjectURL(f)));
      return merged;
    });
  }, []);

  const removePendingImage = useCallback((i: number) => {
    setPendingImages(prev => {
      const next = prev.filter((_, j) => j !== i);
      setPendingPreviews(next.map(f => URL.createObjectURL(f)));
      return next;
    });
  }, []);

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
      barcode: existing.barcode ?? '',
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
        ...(form.barcode.trim() ? { barcode: form.barcode.trim() } : {}),
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
    onSuccess: async (resp: any) => {
      const newId = resp?.data?.id;
      if (!isEdit && newId && pendingImages.length > 0) {
        try {
          const fd = new FormData();
          pendingImages.forEach(f => fd.append('images', f));
          await api.post(`/products/${newId}/images/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        } catch {}
      }
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

        {/* Colors + Barcode */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Colors</label>
            <input value={form.colors} onChange={set('colors')} placeholder="Red, Blue, Black"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Barcode / EAN</label>
            <input value={form.barcode} onChange={set('barcode')} placeholder="8901234567890"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
          </div>
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

        {/* Image upload */}
        {isEdit && productId ? (
          <ImageUploadSection productId={productId} />
        ) : (
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">
              Product Images ({pendingImages.length}/5) <span className="font-normal normal-case text-gray-400">— optional</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {pendingPreviews.map((src, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 group">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removePendingImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    ×
                  </button>
                </div>
              ))}
              {pendingImages.length < 5 && (
                <button type="button" onClick={() => pendingImgRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-navy hover:text-navy transition-colors">
                  <span className="text-2xl leading-none">+</span>
                  <span className="text-[9px] mt-0.5">Add photo</span>
                </button>
              )}
            </div>
            <input ref={pendingImgRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => { addPendingImages(e.target.files); e.target.value = ''; }} />
            <p className="text-[10px] text-gray-400">Images will be uploaded after the product is created.</p>
          </div>
        )}

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
