import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import api from '../../../lib/api';
import VendorAuthGuard from '../../auth/VendorAuthGuard';

const qc = new QueryClient();

export default function VendorGroceryInventoryIsland() {
  return (
    <QueryClientProvider client={qc}>
      <VendorAuthGuard>
        <GroceryInventoryApp />
      </VendorAuthGuard>
    </QueryClientProvider>
  );
}

// ── Types ───────────────────────────────────────────────────────────────────

interface WastageRecord {
  id: string;
  quantity: string;
  reason: string;
  notes: string;
  created_at: string;
}

interface GroceryBatch {
  id: string;
  variant: string;
  variant_name: string;
  batch_number: string;
  quantity: string;
  remaining_qty: string;
  unit: string;
  unit_price: string;
  manufacture_date: string | null;
  expiry_date: string | null;
  is_perishable: boolean;
  temperature_zone: string;
  notes: string;
  is_expired: boolean;
  days_to_expiry: number | null;
  wastage_records: WastageRecord[];
  total_wastage: string;
  created_at: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const ZONE_LABELS: Record<string, string> = {
  ambient: 'Ambient',
  refrigerated: 'Refrigerated',
  frozen: 'Frozen',
};
const ZONE_COLORS: Record<string, string> = {
  ambient: '#f59e0b',
  refrigerated: '#3b82f6',
  frozen: '#06b6d4',
};
const REASON_OPTS = ['expired', 'damaged', 'spillage', 'other'];
const UNIT_OPTS = ['kg', 'g', 'l', 'ml', 'piece'];
const ZONE_OPTS = ['ambient', 'refrigerated', 'frozen'];

function expiryBadge(batch: GroceryBatch) {
  if (!batch.expiry_date) return null;
  if (batch.is_expired) return <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>Expired</span>;
  if (batch.days_to_expiry !== null && batch.days_to_expiry <= 7)
    return <span style={{ background: '#fef3c7', color: '#d97706', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>Exp. in {batch.days_to_expiry}d</span>;
  return <span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>{batch.days_to_expiry}d left</span>;
}

// ── Main app ─────────────────────────────────────────────────────────────────

function GroceryInventoryApp() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'batches' | 'nearExpiry'>('batches');
  const [zoneFilter, setZoneFilter] = useState('');
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<GroceryBatch | null>(null);
  const [showWastage, setShowWastage] = useState(false);

  const batchesQ = useQuery<GroceryBatch[]>({
    queryKey: ['grocery-batches', zoneFilter],
    queryFn: () =>
      api.get('/inventory/grocery-batches/', { params: zoneFilter ? { zone: zoneFilter } : {} })
        .then(r => r.data),
  });

  const nearExpiryQ = useQuery<{ count: number; batches: GroceryBatch[] }>({
    queryKey: ['near-expiry'],
    queryFn: () => api.get('/inventory/grocery-batches/near-expiry/?days=7').then(r => r.data),
    enabled: tab === 'nearExpiry',
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/grocery-batches/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grocery-batches'] }),
  });

  const tabs = [
    { key: 'batches', label: 'All Batches' },
    { key: 'nearExpiry', label: 'Near Expiry' },
  ] as const;

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 1000, margin: '0 auto', padding: '0 16px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Grocery Inventory</h2>
        <button onClick={() => setShowAddBatch(true)} style={btnStyle('#0f172a', '#fff')}>+ Add Batch</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid #e5e7eb', marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: tab === t.key ? '2px solid #0f172a' : '2px solid transparent',
              fontWeight: tab === t.key ? 700 : 400, color: tab === t.key ? '#0f172a' : '#6b7280' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'batches' && (
        <>
          {/* Zone filter */}
          <div style={{ marginBottom: 12 }}>
            {(['', ...ZONE_OPTS] as string[]).map(z => (
              <button key={z} onClick={() => setZoneFilter(z)}
                style={{ marginRight: 8, padding: '4px 12px', borderRadius: 16, border: '1px solid #d1d5db',
                  background: zoneFilter === z ? '#0f172a' : '#fff',
                  color: zoneFilter === z ? '#fff' : '#374151', cursor: 'pointer', fontSize: 13 }}>
                {z ? ZONE_LABELS[z] : 'All Zones'}
              </button>
            ))}
          </div>

          {batchesQ.isLoading ? <p>Loading...</p> : (
            <BatchTable
              batches={batchesQ.data ?? []}
              onWastage={b => { setSelectedBatch(b); setShowWastage(true); }}
              onDelete={id => { if (confirm('Delete this batch?')) deleteMut.mutate(id); }}
            />
          )}
        </>
      )}

      {tab === 'nearExpiry' && (
        nearExpiryQ.isLoading ? <p>Loading...</p> : (
          <div>
            <p style={{ color: '#d97706', fontWeight: 600 }}>{nearExpiryQ.data?.count ?? 0} batches expiring within 7 days</p>
            <BatchTable
              batches={nearExpiryQ.data?.batches ?? []}
              onWastage={b => { setSelectedBatch(b); setShowWastage(true); }}
              onDelete={id => { if (confirm('Delete this batch?')) deleteMut.mutate(id); }}
            />
          </div>
        )
      )}

      {showAddBatch && <AddBatchModal onClose={() => setShowAddBatch(false)} />}
      {showWastage && selectedBatch && (
        <WastageModal batch={selectedBatch} onClose={() => { setShowWastage(false); setSelectedBatch(null); }} />
      )}
    </div>
  );
}

// ── Batch Table ───────────────────────────────────────────────────────────────

function BatchTable({ batches, onWastage, onDelete }: {
  batches: GroceryBatch[];
  onWastage: (b: GroceryBatch) => void;
  onDelete: (id: string) => void;
}) {
  if (!batches.length) return <p style={{ color: '#9ca3af' }}>No batches found.</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            {['Product', 'Batch #', 'Qty', 'Remaining', 'Unit', 'Expiry', 'Zone', 'Price', 'Actions'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {batches.map(b => (
            <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '8px 12px' }}>{b.variant_name}</td>
              <td style={{ padding: '8px 12px', color: '#6b7280' }}>{b.batch_number || '—'}</td>
              <td style={{ padding: '8px 12px' }}>{b.quantity}</td>
              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{b.remaining_qty}</td>
              <td style={{ padding: '8px 12px' }}>{b.unit}</td>
              <td style={{ padding: '8px 12px' }}>{expiryBadge(b) ?? (b.expiry_date ?? '—')}</td>
              <td style={{ padding: '8px 12px' }}>
                <span style={{ background: ZONE_COLORS[b.temperature_zone] + '22', color: ZONE_COLORS[b.temperature_zone],
                  borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
                  {ZONE_LABELS[b.temperature_zone] ?? b.temperature_zone}
                </span>
              </td>
              <td style={{ padding: '8px 12px' }}>₹{b.unit_price}</td>
              <td style={{ padding: '8px 12px', display: 'flex', gap: 6 }}>
                <button onClick={() => onWastage(b)} style={btnStyle('#f59e0b', '#fff', 12)}>Record Wastage</button>
                <button onClick={() => onDelete(b.id)} style={btnStyle('#ef4444', '#fff', 12)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Add Batch Modal ───────────────────────────────────────────────────────────

function AddBatchModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    variant: '', batch_number: '', quantity: '', unit: 'piece',
    unit_price: '', expiry_date: '', manufacture_date: '',
    is_perishable: false, temperature_zone: 'ambient', notes: '',
  });

  const mut = useMutation({
    mutationFn: (data: typeof form) => api.post('/inventory/grocery-batches/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-batches'] });
      onClose();
    },
  });

  const f = (k: keyof typeof form, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div style={overlayStyle}>
      <div style={modalStyle(500)}>
        <h3 style={{ margin: '0 0 16px' }}>Add Grocery Batch</h3>
        <label style={labelStyle}>Variant ID *</label>
        <input style={inputStyle} value={form.variant} onChange={e => f('variant', e.target.value)} placeholder="UUID of product variant" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Quantity *</label>
            <input style={inputStyle} type="number" step="0.001" value={form.quantity} onChange={e => f('quantity', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Unit</label>
            <select style={inputStyle} value={form.unit} onChange={e => f('unit', e.target.value)}>
              {UNIT_OPTS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Unit Price (₹) *</label>
            <input style={inputStyle} type="number" step="0.01" value={form.unit_price} onChange={e => f('unit_price', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Batch #</label>
            <input style={inputStyle} value={form.batch_number} onChange={e => f('batch_number', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Manufacture Date</label>
            <input style={inputStyle} type="date" value={form.manufacture_date} onChange={e => f('manufacture_date', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Expiry Date</label>
            <input style={inputStyle} type="date" value={form.expiry_date} onChange={e => f('expiry_date', e.target.value)} />
          </div>
        </div>

        <label style={labelStyle}>Temperature Zone</label>
        <select style={inputStyle} value={form.temperature_zone} onChange={e => f('temperature_zone', e.target.value)}>
          {ZONE_OPTS.map(z => <option key={z} value={z}>{ZONE_LABELS[z]}</option>)}
        </select>

        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.is_perishable} onChange={e => f('is_perishable', e.target.checked)} />
          Perishable item
        </label>

        <label style={labelStyle}>Notes</label>
        <textarea style={{ ...inputStyle, height: 60 }} value={form.notes} onChange={e => f('notes', e.target.value)} />

        {mut.isError && <p style={{ color: '#dc2626' }}>Failed to create batch.</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={btnStyle('#e5e7eb', '#374151')}>Cancel</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending} style={btnStyle('#0f172a', '#fff')}>
            {mut.isPending ? 'Saving…' : 'Add Batch'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Wastage Modal ─────────────────────────────────────────────────────────────

function WastageModal({ batch, onClose }: { batch: GroceryBatch; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ quantity: '', reason: 'expired', notes: '' });

  const mut = useMutation({
    mutationFn: (data: typeof form) =>
      api.post(`/inventory/grocery-batches/${batch.id}/wastage/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-batches'] });
      queryClient.invalidateQueries({ queryKey: ['near-expiry'] });
      onClose();
    },
  });

  return (
    <div style={overlayStyle}>
      <div style={modalStyle(400)}>
        <h3 style={{ margin: '0 0 4px' }}>Record Wastage</h3>
        <p style={{ color: '#6b7280', marginTop: 0, marginBottom: 16 }}>
          {batch.variant_name} — Remaining: {batch.remaining_qty} {batch.unit}
        </p>

        <label style={labelStyle}>Quantity Wasted *</label>
        <input style={inputStyle} type="number" step="0.001" max={batch.remaining_qty}
          value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} />

        <label style={labelStyle}>Reason</label>
        <select style={inputStyle} value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}>
          {REASON_OPTS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>

        <label style={labelStyle}>Notes</label>
        <textarea style={{ ...inputStyle, height: 60 }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />

        {mut.isError && <p style={{ color: '#dc2626' }}>Failed to record wastage.</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={btnStyle('#e5e7eb', '#374151')}>Cancel</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending} style={btnStyle('#f59e0b', '#fff')}>
            {mut.isPending ? 'Saving…' : 'Record Wastage'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function btnStyle(bg: string, color: string, fontSize = 14): React.CSSProperties {
  return { background: bg, color, border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize };
}
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 50,
};
function modalStyle(w: number): React.CSSProperties {
  return { background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: w, maxHeight: '90vh', overflowY: 'auto' };
}
const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', boxSizing: 'border-box',
  border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px',
  marginBottom: 12, fontSize: 14,
};
const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' };
