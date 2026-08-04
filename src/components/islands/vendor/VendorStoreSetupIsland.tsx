import { useState, useEffect } from 'react';
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import api from '../../../lib/api';
import { VendorAuthGuard, IslandError } from './VendorAuthGuard';
import Img from '../../ui/Img';
import { Button } from '@/components/ui/button';

interface VendorStore {
  id: string; name: string; description: string; category: string; phone: string;
  address: string; locality: string; area: string; city: string;
  is_open: boolean; holiday_mode: boolean; privacy_mode: boolean;
  store_type?: string;
  logo_url?: string; banner_url?: string; lat?: number; lng?: number;
}

interface DayHours { open: string; close: string; isOpen: boolean; }
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const CATEGORIES = [
  'fashion', 'footwear', 'jewellery', 'beauty', 'electronics',
  'food', 'gifts', 'decor', 'furniture', 'books', 'sports',
  'grocery', 'pharmacy', 'others',
];

function Inner() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: store, isLoading, isError, error } = useQuery<VendorStore>({
    queryKey: ['vendor-store'],
    queryFn: () => api.get('/stores/mine/').then(r => r.data),
  });

  const defaultHours = (): DayHours[] =>
    DAYS.map((_, i) => ({ open: '10:00', close: '21:00', isOpen: i < 6 }));

  const [hours, setHours] = useState<DayHours[]>(defaultHours());
  const [editingDayIdx, setEditingDayIdx] = useState<number | null>(null);

  const { data: hoursData } = useQuery({
    queryKey: ['vendor-store-hours', store?.id],
    queryFn: () => api.get(`/stores/${store!.id}/hours/`).then(r => r.data),
    enabled: !!store?.id,
  });

  useEffect(() => {
    if (hoursData && Array.isArray(hoursData) && hoursData.length > 0) {
      const mapped = defaultHours();
      hoursData.forEach((entry: any) => {
        if (entry.day >= 0 && entry.day < 7) {
          mapped[entry.day] = {
            open: (entry.open_time ?? entry.openTime ?? '10:00').slice(0, 5),
            close: (entry.close_time ?? entry.closeTime ?? '21:00').slice(0, 5),
            isOpen: !(entry.is_closed ?? entry.isClosed ?? false),
          };
        }
      });
      setHours(mapped);
    }
  }, [hoursData]);

  const saveHoursMut = useMutation({
    mutationFn: () => api.put(`/stores/${store!.id}/hours/`, hours.map((h, i) => ({
      day: i, open_time: h.open + ':00', close_time: h.close + ':00', is_closed: !h.isOpen,
    }))),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor-store-hours', store?.id] }); setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  const savedBusinessType = typeof window !== 'undefined'
    ? (localStorage.getItem('ns_business_type') ?? '') : '';

  const [form, setForm] = useState({
    name: '', description: '', category: '', phone: '',
    address: '', locality: '', area: '', city: '',
    is_open: true, holiday_mode: false, privacy_mode: false,
    store_type: savedBusinessType,
  });

  useEffect(() => {
    if (store) {
      setForm({
        name: store.name ?? '',
        description: store.description ?? '',
        category: store.category ?? '',
        phone: store.phone ?? '',
        address: store.address ?? '',
        locality: store.locality ?? '',
        area: store.area ?? '',
        city: store.city ?? '',
        is_open: store.is_open,
        holiday_mode: store.holiday_mode,
        privacy_mode: store.privacy_mode,
        store_type: store.store_type ?? savedBusinessType,
      });
    }
  }, [store]);

  const updateMut = useMutation({
    mutationFn: () => api.patch(`/stores/${store!.id}/`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-store'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const field = (key: keyof typeof form) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const toggle = (key: 'is_open' | 'holiday_mode' | 'privacy_mode') => () =>
    setForm(f => ({ ...f, [key]: !f[key] }));

  if (isLoading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded-xl w-48" />
      <div className="card p-6 space-y-4">
        {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-200 rounded-xl" />)}
      </div>
    </div>
  );

  if (isError) return <IslandError error={error} />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Store Setup</h1>
          <p className="text-sm text-gray-400">Manage your store profile</p>
        </div>
        {saved && <span className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-full">✅ Saved!</span>}
      </div>

      {/* Cover + logo preview */}
      {store && (
        <div className="card overflow-hidden">
          <div className="relative h-32 bg-gradient-to-br from-navy to-navy/70">
            <Img src={store.banner_url} alt="Cover" fallback="banner" className="w-full h-full object-cover" />
            <div className="absolute bottom-3 left-4">
              <div className="w-14 h-14 rounded-xl border-2 border-white bg-white overflow-hidden shadow">
                <Img src={store.logo_url} alt={store.name} fallback="store" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
          <div className="px-5 pt-2 pb-4">
            <p className="text-xs text-gray-400">To update logo or cover photo, use the mobile app.</p>
          </div>
        </div>
      )}

      {/* Basic info */}
      <div className="card p-6 space-y-4">
        <h2 className="font-bold text-navy border-b border-gray-100 pb-3">Basic Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Store Name</label>
            <input {...field('name')} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Category</label>
            <select {...field('category')} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm capitalize focus:outline-none focus:border-navy/40">
              {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Business Type</label>
            {store ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200">
                <span>{form.store_type === 'service' ? '🛠️' : form.store_type === 'home' ? '🏠' : '🛍️'}</span>
                <span className="text-sm font-semibold text-navy">
                  {form.store_type === 'service' ? 'Services' : form.store_type === 'home' ? 'Home Business' : 'Products'}
                </span>
                <span className="ml-auto text-[11px] text-gray-400">Locked after registration</span>
              </div>
            ) : (
              <div className="flex gap-2">
                {[
                  { val: 'product', icon: '🛍️', label: 'Products' },
                  { val: 'service', icon: '🛠️', label: 'Services' },
                  { val: 'home',    icon: '🏠',  label: 'Home Biz' },
                ].map(({ val, icon, label }) => (
                  <button key={val} type="button"
                    onClick={() => setForm(f => ({ ...f, store_type: val }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-sm font-semibold transition-all ${
                      form.store_type === val
                        ? 'bg-navy text-white border-navy shadow-sm'
                        : 'border-gray-200 text-gray-500 hover:border-navy/40'
                    }`}>
                    <span>{icon}</span>{label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Phone</label>
            <input {...field('phone')} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Description</label>
            <textarea {...field('description')} rows={3}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-navy/40 focus:ring-2 focus:ring-navy/10" />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="card p-6 space-y-4">
        <h2 className="font-bold text-navy border-b border-gray-100 pb-3">Location</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Address</label>
            <input {...field('address')} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Locality</label>
            <input {...field('locality')} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Area</label>
            <input {...field('area')} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">City</label>
            <input {...field('city')} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-navy/40" />
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="card p-6 space-y-4">
        <h2 className="font-bold text-navy border-b border-gray-100 pb-3">Store Status</h2>
        {[
          { key: 'is_open' as const, label: 'Store is Open', sub: 'Show as open to customers' },
          { key: 'holiday_mode' as const, label: 'Holiday Mode', sub: 'Hide from search results temporarily' },
          { key: 'privacy_mode' as const, label: 'Privacy Mode', sub: 'Only visible to followers' },
        ].map(({ key, label, sub }) => (
          <div key={key} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-navy">{label}</p>
              <p className="text-xs text-gray-400">{sub}</p>
            </div>
            <button onClick={toggle(key)}
              className={`relative rounded-full transition-colors`}
              style={{ width: '44px', height: '24px', background: form[key] ? '#1C2E4A' : '#e5e7eb' }}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form[key] ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Store Hours */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h2 className="font-bold text-navy">Opening Hours</h2>
          <Button onClick={() => saveHoursMut.mutate()} disabled={saveHoursMut.isPending}
            variant="outline" size="sm" className="px-4 py-1.5 text-xs font-bold">
            {saveHoursMut.isPending ? 'Saving…' : 'Save Hours'}
          </Button>
        </div>
        {hours.map((h, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-24 shrink-0">
              <p className="text-sm font-semibold text-navy">{DAYS[i].slice(0, 3)}</p>
            </div>
            <button onClick={() => setHours(hs => hs.map((x, j) => j === i ? { ...x, isOpen: !x.isOpen } : x))}
              className="relative rounded-full shrink-0"
              style={{ width: '36px', height: '20px', background: h.isOpen ? '#1C2E4A' : '#e5e7eb' }}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${h.isOpen ? 'translate-x-4' : ''}`} />
            </button>
            {h.isOpen ? (
              <div className="flex items-center gap-2 flex-1">
                <input type="time" value={h.open}
                  onChange={e => setHours(hs => hs.map((x, j) => j === i ? { ...x, open: e.target.value } : x))}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-navy/40" />
                <span className="text-xs text-gray-400">to</span>
                <input type="time" value={h.close}
                  onChange={e => setHours(hs => hs.map((x, j) => j === i ? { ...x, close: e.target.value } : x))}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-navy/40" />
              </div>
            ) : (
              <span className="text-sm text-gray-400">Closed</span>
            )}
          </div>
        ))}
      </div>

      <Button onClick={() => updateMut.mutate()} disabled={updateMut.isPending}
        className="w-full py-3.5 rounded-xl font-bold text-sm">
        {updateMut.isPending ? 'Saving…' : 'Save Store Info'}
      </Button>
    </div>
  );
}

export default function VendorStoreSetupIsland() {
  return <QueryClientProvider client={queryClient}><VendorAuthGuard><Inner /></VendorAuthGuard></QueryClientProvider>;
}
