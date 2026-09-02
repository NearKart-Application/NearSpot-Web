import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { QueryClientProvider } from '../../../lib/queryClient';
import VendorAuthGuard from '../VendorAuthGuard';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Consumable {
  id: string; name: string; unit: string;
  current_stock: string; reorder_level: string;
  cost_per_unit: string | null; notes: string;
  is_low_stock: boolean; created_at: string;
}
interface ServiceItem { id: string; name: string; price: string; duration_minutes: number; }
interface ServiceConsumable {
  id: string; consumable: string; consumable_name: string;
  unit: string; quantity_per_session: string; notes: string;
}
interface Equipment {
  id: string; name: string; serial_number: string;
  purchase_date: string | null; last_maintenance_date: string | null;
  next_maintenance_date: string | null; maintenance_interval_days: number | null;
  condition: string; notes: string; is_maintenance_due: boolean;
}
interface MaintenanceRecord {
  id: string; equipment: string; equipment_name: string;
  date: string; performed_by: string; cost: string | null; description: string; next_due: string | null;
}
interface Resource {
  id: string; name: string; resource_type: string;
  capacity: number; is_active: boolean; notes: string;
}
interface ResourceAllocation {
  id: string; resource: string; resource_name: string;
  reservation: string | null; staff_name: string;
  date: string; start_time: string; end_time: string; notes: string;
}

const UNITS = ['ml', 'litre', 'gram', 'kg', 'piece', 'bottle', 'sachet', 'pair'];
const CONDITIONS = ['good', 'fair', 'needs_repair', 'out_of_service'];
const RESOURCE_TYPES = ['chair', 'bay', 'room', 'table', 'other'];

function condBadge(c: string) {
  const map: Record<string, string> = {
    good: 'bg-green-100 text-green-700', fair: 'bg-yellow-100 text-yellow-700',
    needs_repair: 'bg-orange-100 text-orange-700', out_of_service: 'bg-red-100 text-red-700',
  };
  return map[c] ?? 'bg-slate-100 text-slate-600';
}

// ── Main Island ───────────────────────────────────────────────────────────────

type Tab = 'consumables' | 'bom' | 'equipment' | 'resources';

function Island() {
  const [tab, setTab] = useState<Tab>('consumables');
  const tabs: { key: Tab; label: string }[] = [
    { key: 'consumables', label: 'Consumables' },
    { key: 'bom',         label: 'Service BOM' },
    { key: 'equipment',   label: 'Equipment' },
    { key: 'resources',   label: 'Resources' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Services Inventory</h1>
        <p className="text-slate-500 text-sm mt-1">Consumables, equipment maintenance &amp; resource allocation</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition ${
              tab === t.key ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'consumables' && <ConsumablesTab />}
      {tab === 'bom'         && <BomTab />}
      {tab === 'equipment'   && <EquipmentTab />}
      {tab === 'resources'   && <ResourcesTab />}
    </div>
  );
}

// ── Consumables Tab ───────────────────────────────────────────────────────────

function ConsumablesTab() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Consumable | null>(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const { data: consumables = [], isLoading } = useQuery<Consumable[]>({
    queryKey: ['svc-consumables', lowStockOnly],
    queryFn: () => api.get('/services/consumables/', { params: lowStockOnly ? { low_stock: 'true' } : {} }).then(r => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/services/consumables/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['svc-consumables'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)} className="rounded" />
          Low stock only
        </label>
        <button onClick={() => setShowAdd(true)} className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700 transition">
          + Add Consumable
        </button>
      </div>

      {isLoading ? <Spinner /> : consumables.length === 0 ? (
        <Empty>No consumables yet. Add supplies like shampoo, chemicals, or repair parts.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>{['Name', 'Unit', 'Stock', 'Reorder Level', 'Cost/Unit', ''].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-slate-600">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {consumables.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {c.name}
                    {c.is_low_stock && <span className="ml-2 bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full">Low</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.unit}</td>
                  <td className="px-4 py-3 text-slate-700 font-medium">{c.current_stock}</td>
                  <td className="px-4 py-3 text-slate-500">{c.reorder_level}</td>
                  <td className="px-4 py-3 text-slate-600">{c.cost_per_unit ? `₹${c.cost_per_unit}` : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(c)} className="text-amber-600 text-xs border border-amber-200 rounded px-2 py-1 hover:bg-amber-50">Edit</button>
                      <button onClick={() => { if (confirm('Delete consumable?')) deleteMut.mutate(c.id); }} className="text-red-500 text-xs border border-red-200 rounded px-2 py-1 hover:bg-red-50">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(showAdd || editing) && (
        <ConsumableModal
          initial={editing}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={() => { setShowAdd(false); setEditing(null); qc.invalidateQueries({ queryKey: ['svc-consumables'] }); }}
        />
      )}
    </div>
  );
}

function ConsumableModal({ initial, onClose, onSaved }: { initial: Consumable | null; onClose: () => void; onSaved: () => void; }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? 'piece');
  const [stock, setStock] = useState(initial?.current_stock ?? '0');
  const [reorder, setReorder] = useState(initial?.reorder_level ?? '0');
  const [cost, setCost] = useState(initial?.cost_per_unit ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setSaving(true); setErr('');
    try {
      const payload = { name, unit, current_stock: stock, reorder_level: reorder, cost_per_unit: cost || null, notes };
      if (initial) await api.patch(`/services/consumables/${initial.id}/`, payload);
      else await api.post('/services/consumables/', payload);
      onSaved();
    } catch { setErr('Failed to save. Check all fields.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={initial ? 'Edit Consumable' : 'Add Consumable'} onClose={onClose}>
      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{err}</div>}
      <Field label="Name"><input value={name} onChange={e => setName(e.target.value)} className={inp} /></Field>
      <Field label="Unit">
        <select value={unit} onChange={e => setUnit(e.target.value)} className={inp}>
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Current Stock"><input type="number" value={stock} onChange={e => setStock(e.target.value)} className={inp} /></Field>
        <Field label="Reorder Level"><input type="number" value={reorder} onChange={e => setReorder(e.target.value)} className={inp} /></Field>
      </div>
      <Field label="Cost per Unit (₹)"><input type="number" value={cost} onChange={e => setCost(e.target.value)} className={inp} placeholder="Optional" /></Field>
      <Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inp} /></Field>
      <ModalFooter onClose={onClose} onSave={save} saving={saving} />
    </Modal>
  );
}

// ── Service BOM Tab ───────────────────────────────────────────────────────────

function BomTab() {
  const qc = useQueryClient();
  const [selectedService, setSelectedService] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);

  const { data: services = [] } = useQuery<ServiceItem[]>({
    queryKey: ['vendor-services'],
    queryFn: () => api.get('/stores/services/').then(r => r.data),
  });

  const { data: links = [], isLoading: linksLoading } = useQuery<ServiceConsumable[]>({
    queryKey: ['svc-bom', selectedService],
    queryFn: () => selectedService
      ? api.get(`/services/services/${selectedService}/consumables/`).then(r => r.data)
      : Promise.resolve([]),
    enabled: !!selectedService,
  });

  const deleteLinkMut = useMutation({
    mutationFn: (sc_id: string) => api.delete(`/services/services/${selectedService}/consumables/${sc_id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['svc-bom', selectedService] }),
  });

  const deductMut = useMutation({
    mutationFn: (sessions: number) => api.post(`/services/services/${selectedService}/deduct/?sessions=${sessions}`).then(r => r.data),
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Select Service</label>
        <select value={selectedService} onChange={e => setSelectedService(e.target.value)} className={`${inp} max-w-sm`}>
          <option value="">— choose a service —</option>
          {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {selectedService && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Consumables used per session of this service</p>
            <div className="flex gap-2">
              <button
                onClick={() => { const n = prompt('Number of sessions to deduct for?', '1'); if (n) deductMut.mutate(parseInt(n)); }}
                className="bg-amber-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-amber-600 transition"
              >
                Deduct Stock
              </button>
              <button onClick={() => setShowAdd(true)} className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700 transition">+ Link Consumable</button>
            </div>
          </div>

          {deductMut.isSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
              Deducted: {(deductMut.data as any).deducted?.map((d: any) => `${d.consumable}: −${d.deducted} (left: ${d.remaining})`).join(', ')}
            </div>
          )}

          {linksLoading ? <Spinner /> : links.length === 0 ? (
            <Empty>No consumables linked to this service yet.</Empty>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>{['Consumable', 'Unit', 'Qty / Session', 'Notes', ''].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-slate-600">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {links.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{l.consumable_name}</td>
                      <td className="px-4 py-3 text-slate-600">{l.unit}</td>
                      <td className="px-4 py-3 text-slate-700">{l.quantity_per_session}</td>
                      <td className="px-4 py-3 text-slate-500">{l.notes || '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => { if (confirm('Remove this link?')) deleteLinkMut.mutate(l.id); }} className="text-red-500 text-xs border border-red-200 rounded px-2 py-1 hover:bg-red-50">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showAdd && (
            <LinkConsumableModal
              serviceId={selectedService}
              onClose={() => setShowAdd(false)}
              onSaved={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ['svc-bom', selectedService] }); }}
            />
          )}
        </>
      )}
    </div>
  );
}

function LinkConsumableModal({ serviceId, onClose, onSaved }: { serviceId: string; onClose: () => void; onSaved: () => void; }) {
  const { data: consumables = [] } = useQuery<Consumable[]>({ queryKey: ['svc-consumables'], queryFn: () => api.get('/services/consumables/').then(r => r.data) });
  const [consumable, setConsumable] = useState('');
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setSaving(true); setErr('');
    try {
      await api.post(`/services/services/${serviceId}/consumables/`, { consumable, quantity_per_session: qty, notes });
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? 'Failed to link consumable.');
    }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Link Consumable to Service" onClose={onClose}>
      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{err}</div>}
      <Field label="Consumable">
        <select value={consumable} onChange={e => setConsumable(e.target.value)} className={inp}>
          <option value="">— select —</option>
          {consumables.map(c => <option key={c.id} value={c.id}>{c.name} ({c.unit})</option>)}
        </select>
      </Field>
      <Field label="Quantity per Session"><input type="number" value={qty} onChange={e => setQty(e.target.value)} className={inp} placeholder="e.g. 5" /></Field>
      <Field label="Notes (optional)"><input value={notes} onChange={e => setNotes(e.target.value)} className={inp} /></Field>
      <ModalFooter onClose={onClose} onSave={save} saving={saving} />
    </Modal>
  );
}

// ── Equipment Tab ─────────────────────────────────────────────────────────────

function EquipmentTab() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [dueOnly, setDueOnly] = useState(false);
  const [maint, setMaint] = useState<Equipment | null>(null);

  const { data: equipment = [], isLoading } = useQuery<Equipment[]>({
    queryKey: ['svc-equipment', dueOnly],
    queryFn: () => api.get('/services/equipment/', { params: dueOnly ? { maintenance_due: 'true' } : {} }).then(r => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/services/equipment/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['svc-equipment'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={dueOnly} onChange={e => setDueOnly(e.target.checked)} className="rounded" />
          Maintenance due only
        </label>
        <button onClick={() => setShowAdd(true)} className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700 transition">+ Add Equipment</button>
      </div>

      {isLoading ? <Spinner /> : equipment.length === 0 ? (
        <Empty>No equipment added. Track chairs, scissors, machines, tools, etc.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>{['Name', 'Serial #', 'Condition', 'Last Maintenance', 'Next Due', ''].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-slate-600">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {equipment.map(e => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {e.name}
                    {e.is_maintenance_due && <span className="ml-2 bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full">Due</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{e.serial_number || '—'}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${condBadge(e.condition)}`}>{e.condition.replace('_', ' ')}</span></td>
                  <td className="px-4 py-3 text-slate-600">{e.last_maintenance_date || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{e.next_maintenance_date || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setMaint(e)} className="text-green-600 text-xs border border-green-200 rounded px-2 py-1 hover:bg-green-50">Log Maint.</button>
                      <button onClick={() => setEditing(e)} className="text-amber-600 text-xs border border-amber-200 rounded px-2 py-1 hover:bg-amber-50">Edit</button>
                      <button onClick={() => { if (confirm('Delete equipment?')) deleteMut.mutate(e.id); }} className="text-red-500 text-xs border border-red-200 rounded px-2 py-1 hover:bg-red-50">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(showAdd || editing) && (
        <EquipmentModal
          initial={editing}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={() => { setShowAdd(false); setEditing(null); qc.invalidateQueries({ queryKey: ['svc-equipment'] }); }}
        />
      )}
      {maint && (
        <MaintenanceModal
          equipment={maint}
          onClose={() => setMaint(null)}
          onSaved={() => { setMaint(null); qc.invalidateQueries({ queryKey: ['svc-equipment'] }); }}
        />
      )}
    </div>
  );
}

function EquipmentModal({ initial, onClose, onSaved }: { initial: Equipment | null; onClose: () => void; onSaved: () => void; }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [serial, setSerial] = useState(initial?.serial_number ?? '');
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchase_date ?? '');
  const [interval, setInterval] = useState(initial?.maintenance_interval_days?.toString() ?? '');
  const [condition, setCondition] = useState(initial?.condition ?? 'good');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setSaving(true); setErr('');
    try {
      const payload = { name, serial_number: serial, purchase_date: purchaseDate || null, maintenance_interval_days: interval ? parseInt(interval) : null, condition, notes };
      if (initial) await api.patch(`/services/equipment/${initial.id}/`, payload);
      else await api.post('/services/equipment/', payload);
      onSaved();
    } catch { setErr('Failed to save.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={initial ? 'Edit Equipment' : 'Add Equipment'} onClose={onClose}>
      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{err}</div>}
      <Field label="Name"><input value={name} onChange={e => setName(e.target.value)} className={inp} /></Field>
      <Field label="Serial Number"><input value={serial} onChange={e => setSerial(e.target.value)} className={inp} placeholder="Optional" /></Field>
      <Field label="Purchase Date"><input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className={inp} /></Field>
      <Field label="Maintenance Interval (days)"><input type="number" value={interval} onChange={e => setInterval(e.target.value)} className={inp} placeholder="e.g. 90" /></Field>
      <Field label="Condition">
        <select value={condition} onChange={e => setCondition(e.target.value)} className={inp}>
          {CONDITIONS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
      </Field>
      <Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inp} /></Field>
      <ModalFooter onClose={onClose} onSave={save} saving={saving} />
    </Modal>
  );
}

function MaintenanceModal({ equipment, onClose, onSaved }: { equipment: Equipment; onClose: () => void; onSaved: () => void; }) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [by, setBy] = useState('');
  const [cost, setCost] = useState('');
  const [desc, setDesc] = useState('');
  const [nextDue, setNextDue] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setSaving(true); setErr('');
    try {
      await api.post(`/services/equipment/${equipment.id}/maintenance/`, { date, performed_by: by, cost: cost || null, description: desc, next_due: nextDue || null });
      onSaved();
    } catch { setErr('Failed to log maintenance.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={`Log Maintenance — ${equipment.name}`} onClose={onClose}>
      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{err}</div>}
      <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inp} /></Field>
      <Field label="Performed By"><input value={by} onChange={e => setBy(e.target.value)} className={inp} placeholder="Name or workshop" /></Field>
      <Field label="Cost (₹)"><input type="number" value={cost} onChange={e => setCost(e.target.value)} className={inp} placeholder="Optional" /></Field>
      <Field label="Description"><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} className={inp} /></Field>
      <Field label="Next Due Date"><input type="date" value={nextDue} onChange={e => setNextDue(e.target.value)} className={inp} /></Field>
      <ModalFooter onClose={onClose} onSave={save} saving={saving} label="Log" />
    </Modal>
  );
}

// ── Resources Tab ─────────────────────────────────────────────────────────────

function ResourcesTab() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: resources = [], isLoading } = useQuery<Resource[]>({
    queryKey: ['svc-resources'],
    queryFn: () => api.get('/services/resources/').then(r => r.data),
  });

  const { data: allocations = [] } = useQuery<ResourceAllocation[]>({
    queryKey: ['svc-allocations', filterDate],
    queryFn: () => api.get('/services/allocations/', { params: { date: filterDate } }).then(r => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/services/resources/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['svc-resources'] }),
  });

  const deleteAllocMut = useMutation({
    mutationFn: (id: string) => api.delete(`/services/allocations/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['svc-allocations', filterDate] }),
  });

  const [showAlloc, setShowAlloc] = useState(false);

  return (
    <div className="space-y-6">
      {/* Resources list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Chairs / Bays / Rooms</h2>
          <button onClick={() => setShowAdd(true)} className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700 transition">+ Add Resource</button>
        </div>
        {isLoading ? <Spinner /> : resources.length === 0 ? (
          <Empty>No resources added. Add chairs, bays, or treatment rooms.</Empty>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {resources.map(r => (
              <div key={r.id} className={`border rounded-xl p-4 ${r.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{r.resource_type} · cap. {r.capacity}</p>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {r.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setEditing(r)} className="text-amber-600 text-xs border border-amber-200 rounded px-2 py-1 hover:bg-amber-50 flex-1">Edit</button>
                  <button onClick={() => { if (confirm('Delete resource?')) deleteMut.mutate(r.id); }} className="text-red-500 text-xs border border-red-200 rounded px-2 py-1 hover:bg-red-50 flex-1">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Allocations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Schedule / Allocations</h2>
          <div className="flex items-center gap-3">
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className={`${inp} w-auto`} />
            <button onClick={() => setShowAlloc(true)} className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700 transition">+ Block Slot</button>
          </div>
        </div>
        {allocations.length === 0 ? (
          <Empty>No allocations for this date.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>{['Resource', 'Time', 'Staff', 'Notes', ''].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-slate-600">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {allocations.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{a.resource_name}</td>
                    <td className="px-4 py-3 text-slate-700">{a.start_time} – {a.end_time}</td>
                    <td className="px-4 py-3 text-slate-600">{a.staff_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{a.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => { if (confirm('Remove allocation?')) deleteAllocMut.mutate(a.id); }} className="text-red-500 text-xs border border-red-200 rounded px-2 py-1 hover:bg-red-50">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(showAdd || editing) && (
        <ResourceModal
          initial={editing}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={() => { setShowAdd(false); setEditing(null); qc.invalidateQueries({ queryKey: ['svc-resources'] }); }}
        />
      )}
      {showAlloc && (
        <AllocationModal
          resources={resources}
          defaultDate={filterDate}
          onClose={() => setShowAlloc(false)}
          onSaved={() => { setShowAlloc(false); qc.invalidateQueries({ queryKey: ['svc-allocations', filterDate] }); }}
        />
      )}
    </div>
  );
}

function ResourceModal({ initial, onClose, onSaved }: { initial: Resource | null; onClose: () => void; onSaved: () => void; }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState(initial?.resource_type ?? 'chair');
  const [capacity, setCapacity] = useState(initial?.capacity?.toString() ?? '1');
  const [active, setActive] = useState(initial?.is_active ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setSaving(true); setErr('');
    try {
      const payload = { name, resource_type: type, capacity: parseInt(capacity), is_active: active, notes };
      if (initial) await api.patch(`/services/resources/${initial.id}/`, payload);
      else await api.post('/services/resources/', payload);
      onSaved();
    } catch { setErr('Failed to save.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={initial ? 'Edit Resource' : 'Add Resource'} onClose={onClose}>
      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{err}</div>}
      <Field label="Name"><input value={name} onChange={e => setName(e.target.value)} className={inp} placeholder="e.g. Chair 1, Bay A" /></Field>
      <Field label="Type">
        <select value={type} onChange={e => setType(e.target.value)} className={inp}>
          {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Capacity"><input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} className={inp} min={1} /></Field>
      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="rounded" />
        Active (available for booking)
      </label>
      <Field label="Notes"><input value={notes} onChange={e => setNotes(e.target.value)} className={inp} /></Field>
      <ModalFooter onClose={onClose} onSave={save} saving={saving} />
    </Modal>
  );
}

function AllocationModal({ resources, defaultDate, onClose, onSaved }: { resources: Resource[]; defaultDate: string; onClose: () => void; onSaved: () => void; }) {
  const [resource, setResource] = useState('');
  const [staff, setStaff] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setSaving(true); setErr('');
    try {
      await api.post('/services/allocations/', { resource, staff_name: staff, date, start_time: start, end_time: end, notes });
      onSaved();
    } catch { setErr('Failed to create allocation.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Block a Slot" onClose={onClose}>
      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{err}</div>}
      <Field label="Resource">
        <select value={resource} onChange={e => setResource(e.target.value)} className={inp}>
          <option value="">— select —</option>
          {resources.filter(r => r.is_active).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </Field>
      <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inp} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start Time"><input type="time" value={start} onChange={e => setStart(e.target.value)} className={inp} /></Field>
        <Field label="End Time"><input type="time" value={end} onChange={e => setEnd(e.target.value)} className={inp} /></Field>
      </div>
      <Field label="Staff Name"><input value={staff} onChange={e => setStaff(e.target.value)} className={inp} placeholder="Optional" /></Field>
      <Field label="Notes"><input value={notes} onChange={e => setNotes(e.target.value)} className={inp} /></Field>
      <ModalFooter onClose={onClose} onSave={save} saving={saving} label="Block Slot" />
    </Modal>
  );
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        </div>
        <div className="p-6 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({ onClose, onSave, saving, label = 'Save' }: { onClose: () => void; onSave: () => void; saving: boolean; label?: string }) {
  return (
    <div className="flex gap-3 justify-end pt-2">
      <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">Cancel</button>
      <button onClick={onSave} disabled={saving} className="px-5 py-2 text-sm font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition">
        {saving ? 'Saving…' : label}
      </button>
    </div>
  );
}

function Spinner() {
  return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-slate-800 border-t-transparent rounded-full" /></div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-center py-12 text-slate-400 text-sm">{children}</div>;
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function VendorServicesInventoryIsland() {
  return (
    <QueryClientProvider>
      <VendorAuthGuard>
        <Island />
      </VendorAuthGuard>
    </QueryClientProvider>
  );
}
