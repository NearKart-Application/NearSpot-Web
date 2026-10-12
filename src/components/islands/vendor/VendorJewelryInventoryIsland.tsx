import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';

export default function VendorJewelryInventoryIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <VendorAuthGuard>
        <JewelryInventoryApp />
      </VendorAuthGuard>
    </QueryClientProvider>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface JewelryVariant {
  variant_id: string;
  variant_name: string;
  product_id: string;
  product_name: string;
  sku: string;
  price: string;
  weight_grams: string | null;
  price_per_gram: string | null;
  purity: string;
  making_charges: string | null;
  hallmark_number: string;
}

interface JewelryForm {
  weight_grams: string;
  price_per_gram: string;
  purity: string;
  making_charges: string;
  hallmark_number: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PURITY_OPTIONS = ['22K', '18K', '14K', '10K', '925', '950', '999', 'Custom'];

function totalValue(v: JewelryVariant): string | null {
  const w = parseFloat(v.weight_grams ?? '');
  const p = parseFloat(v.price_per_gram ?? '');
  const m = parseFloat(v.making_charges ?? '0');
  if (isNaN(w) || isNaN(p)) return null;
  return (w * p + m).toFixed(2);
}

// ── App ───────────────────────────────────────────────────────────────────────

function JewelryInventoryApp() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<JewelryVariant | null>(null);

  const { data: variants = [], isLoading, isError, error, refetch } = useQuery<JewelryVariant[]>({
    queryKey: ['jewelry-variants'],
    queryFn: () => api.get('/products/jewelry/').then(r => r.data),
  });

  const displayed = variants.filter(v =>
    v.product_name.toLowerCase().includes(search.toLowerCase()) ||
    v.variant_name.toLowerCase().includes(search.toLowerCase()) ||
    v.sku.toLowerCase().includes(search.toLowerCase())
  );

  const saveMut = useMutation({
    mutationFn: ({ productId, variantId, data }: { productId: string; variantId: string; data: JewelryForm }) =>
      api.patch(`/products/${productId}/variants/${variantId}/jewelry/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jewelry-variants'] });
      setEditing(null);
    },
  });

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 1000, margin: '0 auto', padding: '0 16px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Jewelry Inventory</h2>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>
            Manage purity, weight, making charges, and BIS hallmark per variant
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          style={inputStyle}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by product, variant, or SKU…"
        />
      </div>

      {isError ? <IslandError error={error} refetch={refetch} /> : isLoading ? (
        <p>Loading…</p>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>No jewelry variants found.</p>
          <p style={{ fontSize: 13 }}>
            Set jewelry attributes on any product variant to see it here.
            Go to <strong>Products</strong> → edit a product → update a variant.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Product / Variant', 'SKU', 'Purity', 'Weight (g)', '₹/g', 'Making ₹', 'Total Value', 'HUID / Hallmark', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(v => {
                const tv = totalValue(v);
                return (
                  <tr key={v.variant_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{v.product_name}</div>
                      <div style={{ color: '#6b7280', fontSize: 12 }}>{v.variant_name}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12 }}>{v.sku}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {v.purity ? (
                        <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{v.purity}</span>
                      ) : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{v.weight_grams ?? <span style={{ color: '#d1d5db' }}>—</span>}</td>
                    <td style={{ padding: '10px 12px' }}>{v.price_per_gram ? `₹${v.price_per_gram}` : <span style={{ color: '#d1d5db' }}>—</span>}</td>
                    <td style={{ padding: '10px 12px' }}>{v.making_charges ? `₹${v.making_charges}` : <span style={{ color: '#d1d5db' }}>—</span>}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: tv ? '#16a34a' : '#d1d5db' }}>
                      {tv ? `₹${tv}` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: v.hallmark_number ? '#374151' : '#d1d5db' }}>
                      {v.hallmark_number || '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button onClick={() => setEditing(v)} style={btnStyle('#0f172a', '#fff', 12)}>Edit</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <JewelryEditModal
          variant={editing}
          onClose={() => setEditing(null)}
          onSave={form => saveMut.mutate({ productId: editing.product_id, variantId: editing.variant_id, data: form })}
          saving={saveMut.isPending}
          error={saveMut.isError}
        />
      )}

      {/* Info card for setting attributes on new products */}
      <div style={{ marginTop: 24, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '12px 16px' }}>
        <strong style={{ fontSize: 13 }}>How to add a new jewelry product</strong>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#374151' }}>
          Go to <strong>Products → Add Product</strong>, create the product, then use the Edit button above (or edit variants on the product page) and set purity, weight, making charges, and hallmark. The product will appear in this list automatically.
        </p>
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function JewelryEditModal({
  variant, onClose, onSave, saving, error,
}: {
  variant: JewelryVariant;
  onClose: () => void;
  onSave: (form: JewelryForm) => void;
  saving: boolean;
  error: boolean;
}) {
  const [form, setForm] = useState<JewelryForm>({
    weight_grams:    variant.weight_grams    ?? '',
    price_per_gram:  variant.price_per_gram  ?? '',
    purity:          variant.purity          ?? '',
    making_charges:  variant.making_charges  ?? '',
    hallmark_number: variant.hallmark_number ?? '',
  });
  const [customPurity, setCustomPurity] = useState(!PURITY_OPTIONS.includes(variant.purity) && variant.purity !== '');

  const f = (k: keyof JewelryForm, v: string) => setForm(p => ({ ...p, [k]: v }));

  const metalValue = (() => {
    const w = parseFloat(form.weight_grams);
    const p = parseFloat(form.price_per_gram);
    const m = parseFloat(form.making_charges || '0');
    if (isNaN(w) || isNaN(p)) return null;
    return (w * p + m).toFixed(2);
  })();

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 4px' }}>Edit Jewelry Attributes</h3>
        <p style={{ color: '#6b7280', marginTop: 0, marginBottom: 16, fontSize: 13 }}>
          {variant.product_name} — {variant.variant_name}
        </p>

        {/* Purity */}
        <label style={labelStyle}>Purity / Karat (#140)</label>
        {!customPurity ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {PURITY_OPTIONS.map(opt => (
              <button key={opt} onClick={() => opt === 'Custom' ? setCustomPurity(true) : f('purity', opt)}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: '1px solid',
                  borderColor: form.purity === opt ? '#0f172a' : '#d1d5db',
                  background: form.purity === opt ? '#0f172a' : '#fff',
                  color: form.purity === opt ? '#fff' : '#374151',
                  cursor: 'pointer', fontSize: 13, fontWeight: form.purity === opt ? 700 : 400,
                }}>
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input style={{ ...inputStyle, marginBottom: 0 }} value={form.purity} onChange={e => f('purity', e.target.value)} placeholder="e.g. 750 (18K), 916 (22K)" />
            <button onClick={() => setCustomPurity(false)} style={{ ...btnStyle('#e5e7eb', '#374151'), whiteSpace: 'nowrap' }}>Standard</button>
          </div>
        )}

        {/* Weight + Price/gram */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Weight (grams) (#139)</label>
            <input style={inputStyle} type="number" step="0.001" value={form.weight_grams} onChange={e => f('weight_grams', e.target.value)} placeholder="e.g. 8.500" />
          </div>
          <div>
            <label style={labelStyle}>Rate (₹/gram) (#139)</label>
            <input style={inputStyle} type="number" step="0.01" value={form.price_per_gram} onChange={e => f('price_per_gram', e.target.value)} placeholder="e.g. 6200.00" />
          </div>
        </div>

        {/* Making charges */}
        <label style={labelStyle}>Making Charges (₹) (#141)</label>
        <input style={inputStyle} type="number" step="0.01" value={form.making_charges} onChange={e => f('making_charges', e.target.value)} placeholder="Labour / craftsmanship fee" />

        {/* Computed total */}
        {metalValue && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
            <strong style={{ fontSize: 13 }}>Computed Total Value: ₹{metalValue}</strong>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {form.weight_grams}g × ₹{form.price_per_gram}/g + ₹{form.making_charges || '0'} making charges
            </div>
          </div>
        )}

        {/* Hallmark */}
        <label style={labelStyle}>BIS Hallmark / HUID (#142)</label>
        <input style={inputStyle} value={form.hallmark_number} onChange={e => f('hallmark_number', e.target.value)} placeholder="6-character HUID, e.g. AB1234" maxLength={50} />
        <p style={{ color: '#9ca3af', fontSize: 11, marginTop: -8, marginBottom: 12 }}>
          BIS Hallmark Unique ID (HUID) — mandatory for gold jewelry sold in India from April 2023.
        </p>

        {error && <p style={{ color: '#dc2626' }}>Failed to save. Please try again.</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={btnStyle('#e5e7eb', '#374151')}>Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving} style={btnStyle('#0f172a', '#fff')}>
            {saving ? 'Saving…' : 'Save Attributes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function btnStyle(bg: string, color: string, fontSize = 14): React.CSSProperties {
  return { background: bg, color, border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize };
}
const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', boxSizing: 'border-box',
  border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px',
  marginBottom: 12, fontSize: 14,
};
const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' };
