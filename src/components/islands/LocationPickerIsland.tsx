import { useState, useEffect, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';

interface Coords { lat: number; lng: number }
interface NominatimResult {
  lat: string; lon: string; display_name: string;
  address: {
    suburb?: string; neighbourhood?: string; town?: string;
    city_district?: string; city?: string; county?: string; state?: string;
  };
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const d = await r.json();
    const a = d.address ?? {};
    return a.suburb ?? a.neighbourhood ?? a.town ?? a.city_district ?? a.city ?? a.county ?? 'Your Area';
  } catch { return 'Your Area'; }
}

function pickName(a: NominatimResult['address'], fallback: string) {
  return a.suburb ?? a.neighbourhood ?? a.town ?? a.city_district ?? a.city ?? a.county ?? fallback;
}

function LocationPickerSheet({ onClose }: { onClose: () => void }) {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<NominatimResult[]>([]);
  const [searching, setSearching]   = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError]     = useState('');
  const [popularLocs, setPopularLocs] = useState<{ city: string }[]>([]);
  const [currentName, setCurrentName]   = useState('');
  const [currentCoords, setCurrentCoords] = useState<Coords | null>(null);
  const [visible, setVisible]       = useState(false);
  const inputRef    = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ns_coords');
      if (raw) {
        const c = JSON.parse(raw);
        setCurrentCoords(c);
        reverseGeocode(c.lat, c.lng).then(setCurrentName);
      }
    } catch { /* */ }

    setTimeout(() => inputRef.current?.focus(), 150);
  }, []);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!query.trim() || query.length < 3) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', India')}&format=json&limit=6&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        setResults(await r.json());
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 500);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  function applyLocation(coords: Coords, name: string, city?: string) {
    try { localStorage.setItem('ns_coords', JSON.stringify(coords)); } catch { /* */ }
    const token = localStorage.getItem('ns_access');
    if (token) {
      api.patch('/auth/me/location/', { latitude: coords.lat, longitude: coords.lng, city: city ?? name }).catch(() => {});
    }
    document.dispatchEvent(new CustomEvent('ns:location-changed', { detail: { coords, name } }));
    handleClose();
  }

  function pickNominatim(r: NominatimResult) {
    const name = pickName(r.address, r.display_name.split(',')[0]);
    const city = r.address.city ?? r.address.county ?? name;
    applyLocation({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) }, name, city);
  }

  async function pickPopular(city: string) {
    setSearching(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ', India')}&format=json&limit=1&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data: NominatimResult[] = await r.json();
      if (data.length) {
        const result = data[0];
        const name = pickName(result.address, city);
        applyLocation({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) }, name, city);
      } else setSearching(false);
    } catch { setSearching(false); }
  }

  function useGPS() {
    setGpsError('');
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const c: Coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const name = await reverseGeocode(c.lat, c.lng);
        applyLocation(c, name, name);
        setGpsLoading(false);
      },
      () => {
        setGpsError('Location access denied. Please allow it in browser settings.');
        setGpsLoading(false);
      },
      { timeout: 12000 }
    );
  }

  const showResults   = results.length > 0;
  const showPopular   = !query && popularLocs.length > 0;
  const showCurrent   = !query && !!currentName && !!currentCoords;
  const showEmpty     = query.length >= 3 && !searching && results.length === 0;

  return (
    /* Overlay */
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${visible ? 'opacity-50' : 'opacity-0'}`}
      />

      {/* Panel — bottom-sheet on mobile, centered modal on desktop */}
      <div className={`
        relative w-full md:max-w-lg bg-white shadow-2xl flex flex-col
        rounded-t-2xl md:rounded-2xl
        max-h-[88vh] md:max-h-[80vh]
        transition-transform duration-300 ease-out
        ${visible
          ? 'translate-y-0 md:scale-100 md:opacity-100'
          : 'translate-y-full md:translate-y-0 md:scale-95 md:opacity-0'
        }
      `}>
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
          <div className="w-9 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
          <div>
            <h2 className="text-base font-black text-navy">Set your location</h2>
            <p className="text-xs text-gray-400 mt-0.5">Find stores and products near you</p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors shrink-0">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Search bar */}
        <div className="px-5 pb-3 shrink-0">
          <div className={`flex items-center gap-2.5 bg-gray-50 border rounded-xl px-4 py-3 transition-colors ${query ? 'border-navy/30 bg-white' : 'border-gray-200'}`}>
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search area, colony, city…"
              autoComplete="off"
              className="flex-1 bg-transparent text-sm text-navy outline-none placeholder-gray-400"
            />
            {searching
              ? <div className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin shrink-0" />
              : query
                ? <button onClick={() => { setQuery(''); setResults([]); }}
                    className="w-4 h-4 rounded-full bg-gray-300 hover:bg-gray-400 flex items-center justify-center transition-colors shrink-0">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                : null
            }
          </div>
        </div>

        {/* GPS button */}
        <div className="px-5 pb-4 shrink-0">
          <button
            onClick={useGPS}
            disabled={gpsLoading}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-60 text-left">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              {gpsLoading
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                  </svg>
              }
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-700">
                {gpsLoading ? 'Detecting your location…' : 'Use current location'}
              </p>
              <p className="text-xs text-blue-400">Via GPS — most accurate</p>
            </div>
          </button>
          {gpsError && (
            <p className="text-xs text-red-500 mt-2 px-1">{gpsError}</p>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 px-5 mb-3 shrink-0">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">or browse</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">

          {/* Current location */}
          {showCurrent && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Current location</p>
              <button
                onClick={() => applyLocation(currentCoords!, currentName)}
                className="w-full flex items-center gap-3 p-3 bg-navy/5 border border-navy/15 rounded-xl hover:bg-navy/10 transition-colors text-left group">
                <div className="w-9 h-9 rounded-xl bg-navy flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-gold" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-navy">{currentName}</p>
                  <p className="text-xs text-gray-400">{currentCoords!.lat.toFixed(4)}, {currentCoords!.lng.toFixed(4)}</p>
                </div>
                <svg className="w-4 h-4 text-navy/30 group-hover:text-navy/60 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          )}

          {/* Search results */}
          {showResults && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Results</p>
              <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                {results.map((r, i) => {
                  const name = pickName(r.address, r.display_name.split(',')[0]);
                  const sub  = r.display_name.split(',').slice(1, 3).join(', ').trim();
                  return (
                    <button key={i} onClick={() => pickNominatim(r)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left">
                      <svg className="w-4 h-4 text-gray-300 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-navy truncate">{name}</p>
                        {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty search */}
          {showEmpty && (
            <div className="py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-500">No results for "{query}"</p>
              <p className="text-xs text-gray-400 mt-1">Try a different area or city name</p>
            </div>
          )}

          {/* Popular cities */}
          {showPopular && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Popular cities</p>
              <div className="flex flex-wrap gap-2">
                {popularLocs.map((loc, i) => (
                  <button key={i} onClick={() => pickPopular(loc.city)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gray-100 hover:bg-navy hover:text-white text-navy text-sm font-medium transition-all">
                    <svg className="w-3 h-3 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    {loc.city}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Inner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handle = () => setOpen(true);
    document.addEventListener('ns:open-location-picker', handle);
    return () => document.removeEventListener('ns:open-location-picker', handle);
  }, []);

  if (!open) return null;
  return <LocationPickerSheet onClose={() => setOpen(false)} />;
}

export default function LocationPickerIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <Inner />
    </QueryClientProvider>
  );
}
