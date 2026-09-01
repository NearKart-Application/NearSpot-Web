import { useEffect, useRef, useState, useMemo } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import api from '../../lib/api';
import 'leaflet/dist/leaflet.css';

interface Store {
  id: string; name: string; category: string; locality?: string;
  avatar?: string; latitude?: number; longitude?: number; lat?: number; lng?: number;
  is_open: boolean; rating?: number; avg_rating?: number; distance_km?: number;
}

function loadCoords() {
  try {
    const r = localStorage.getItem('ns_coords');
    if (r) return JSON.parse(r);
  } catch { /* */ }
  return { lat: 17.385, lng: 78.4867 };
}

const CATS = ['All', 'Fashion', 'Food', 'Electronics', 'Beauty', 'Jewellery', 'Footwear', 'Decor', 'Gifts'];

// Proximity-based clustering: group stores within ~0.003 degrees (~300m)
function clusterStores(stores: Store[], clusterRadius = 0.003) {
  const assigned = new Set<number>();
  const clusters: { stores: Store[]; lat: number; lng: number }[] = [];
  for (let i = 0; i < stores.length; i++) {
    if (assigned.has(i)) continue;
    const sLat = stores[i].latitude ?? stores[i].lat;
    const sLng = stores[i].longitude ?? stores[i].lng;
    if (sLat == null || sLng == null) continue;
    const group: Store[] = [stores[i]];
    assigned.add(i);
    for (let j = i + 1; j < stores.length; j++) {
      if (assigned.has(j)) continue;
      const tLat = stores[j].latitude ?? stores[j].lat;
      const tLng = stores[j].longitude ?? stores[j].lng;
      if (tLat == null || tLng == null) continue;
      const d = Math.sqrt((sLat - tLat) ** 2 + (sLng - tLng) ** 2);
      if (d < clusterRadius) { group.push(stores[j]); assigned.add(j); }
    }
    clusters.push({ stores: group, lat: sLat, lng: sLng });
  }
  return clusters;
}

function Inner() {
  const [coords, setCoords]         = useState(loadCoords);
  const [radius, setRadius]         = useState(5);
  const [locating, setLocating]     = useState(false);
  const [searchQuery, setSearch]    = useState('');
  const [category, setCategory]     = useState('All');
  const mapRef       = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef   = useRef<any[]>([]);

  // Listen for location picker changes and re-centre map
  useEffect(() => {
    const handle = (e: Event) => {
      const { coords: c } = (e as CustomEvent).detail;
      setCoords(c);
    };
    document.addEventListener('ns:location-changed', handle);
    return () => document.removeEventListener('ns:location-changed', handle);
  }, []);

  // Explicit GPS — only when user taps the button
  function goToMyLocation() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        try { localStorage.setItem('ns_coords', JSON.stringify(c)); } catch { /* */ }
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 10000 },
    );
  }

  // Init Leaflet once on mount
  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    import('leaflet').then(({ default: L }) => {
      if (destroyed || !containerRef.current) return;

      const map = L.map(containerRef.current, { zoomControl: false }).setView(
        [coords.lat, coords.lng], 14
      );
      mapRef.current = map;

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      map.invalidateSize();
    });

    return () => {
      destroyed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-centre map when coords change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([coords.lat, coords.lng], map.getZoom());
  }, [coords]);

  const { data } = useQuery({
    queryKey: ['map-stores', coords.lat, coords.lng, radius],
    queryFn:  () => api.get('/stores/nearby/', {
      params: { lat: coords.lat, lng: coords.lng, radius }
    }).then(r => r.data),
    staleTime: 60_000,
  });

  const allStores: Store[] = data?.results ?? (Array.isArray(data) ? data : []);

  const stores = useMemo(() => {
    let s = allStores;
    if (category !== 'All') s = s.filter(x => x.category?.toLowerCase().includes(category.toLowerCase()));
    if (searchQuery.trim()) s = s.filter(x => x.name.toLowerCase().includes(searchQuery.trim().toLowerCase()));
    return s;
  }, [allStores, category, searchQuery]);

  // Draw markers whenever filtered stores / coords / radius change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    import('leaflet').then(({ default: L }) => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      const circle = L.circle([coords.lat, coords.lng], {
        radius: radius * 1000,
        color: '#1C2E4A', weight: 1.5, opacity: 0.4,
        fillColor: '#1C2E4A', fillOpacity: 0.06,
      }).addTo(map);
      markersRef.current.push(circle);

      const userIcon = L.divIcon({
        html: `<div style="width:14px;height:14px;background:#1C2E4A;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`,
        className: '', iconSize: [14, 14], iconAnchor: [7, 7],
      });
      markersRef.current.push(
        L.marker([coords.lat, coords.lng], { icon: userIcon })
          .addTo(map).bindPopup('<strong>You are here</strong>')
      );

      // Cluster nearby stores and draw cluster or individual markers
      const clusters = clusterStores(stores);
      clusters.forEach(cluster => {
        if (cluster.stores.length > 1) {
          // Cluster marker with count badge
          const clusterIcon = L.divIcon({
            html: `<div style="background:#1C2E4A;color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;box-shadow:0 2px 10px rgba(0,0,0,.3);border:2px solid white">${cluster.stores.length}</div>`,
            className: '', iconSize: [36, 36], iconAnchor: [18, 18],
          });
          const clusterPopup = `
            <div style="font-family:system-ui;min-width:140px;padding:2px">
              <p style="font-weight:800;font-size:13px;color:#1C2E4A;margin:0 0 6px">${cluster.stores.length} stores here</p>
              ${cluster.stores.slice(0, 4).map(s => `<p style="font-size:11px;color:#374151;margin:2px 0">🏪 ${s.name}</p>`).join('')}
              ${cluster.stores.length > 4 ? `<p style="font-size:10px;color:#9ca3af;margin:4px 0 0">+${cluster.stores.length - 4} more — zoom in</p>` : ''}
            </div>`;
          markersRef.current.push(
            L.marker([cluster.lat, cluster.lng], { icon: clusterIcon }).addTo(map).bindPopup(clusterPopup)
          );
        } else {
          const s = cluster.stores[0];
          const sLat = s.latitude ?? s.lat;
          const sLng = s.longitude ?? s.lng;
          if (!sLat || !sLng) return;
          const color = s.is_open ? '#22c55e' : '#6b7280';
          const icon = L.divIcon({
            html: `<div style="background:white;border:2.5px solid ${color};border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.2);font-size:15px">🏪</div>`,
            className: '', iconSize: [34, 34], iconAnchor: [17, 17],
          });
          const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${sLat},${sLng}`;
          const popup = `
            <div style="font-family:system-ui;min-width:160px;padding:2px">
              <p style="font-weight:800;font-size:14px;color:#1C2E4A;margin:0 0 2px">${s.name}</p>
              <p style="font-size:11px;color:#9ca3af;margin:0 0 6px;text-transform:capitalize">${s.category}${s.locality ? ' · ' + s.locality : ''}</p>
              <span style="display:inline-block;background:${s.is_open ? '#dcfce7' : '#f3f4f6'};color:${s.is_open ? '#15803d' : '#6b7280'};padding:2px 10px;border-radius:999px;font-size:10px;font-weight:700">${s.is_open ? 'Open now' : 'Closed'}</span>
              <div style="display:flex;gap:6px;margin-top:8px">
                <a href="${directionsUrl}" target="_blank" rel="noopener" style="flex:1;text-align:center;background:#f3f4f6;color:#1C2E4A;padding:5px 10px;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none">📍 Directions</a>
                <a href="/stores/${s.id}" style="flex:1;text-align:center;background:#1C2E4A;color:white;padding:5px 10px;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none">View Store →</a>
              </div>
            </div>`;
          markersRef.current.push(
            L.marker([sLat, sLng], { icon }).addTo(map).bindPopup(popup)
          );
        }
      });
    });
  }, [stores, coords, radius]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative h-[calc(100vh-4rem)]">
      <div ref={containerRef} className="w-full h-full" />

      {/* Controls overlay */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 pointer-events-auto max-w-[260px]">
        {/* Search bar */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 px-3 py-2">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              value={searchQuery}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search stores on map…"
              className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder-gray-400"
            />
            {searchQuery && (
              <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
            )}
          </div>
        </div>

        {/* Radius control */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 px-3 py-2.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Search radius</p>
          <div className="flex gap-1.5">
            {[1, 2, 5, 10].map(r => (
              <button key={r} onClick={() => setRadius(r)}
                className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${
                  radius === r ? 'bg-navy text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>{r}km</button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 font-medium">
            {stores.length} {stores.length === 1 ? 'store' : 'stores'} found
          </p>
        </div>

        {/* Category filter */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 px-3 py-2.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Category</p>
          <div className="flex flex-wrap gap-1">
            {CATS.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  category === cat ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>{cat}</button>
            ))}
          </div>
        </div>

        <button onClick={goToMyLocation} disabled={locating}
          className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-lg text-xs font-semibold text-navy hover:bg-navy hover:text-white transition-all disabled:opacity-50">
          {locating ? (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          )}
          My Location
        </button>
      </div>
    </div>
  );
}

export default function MapIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <Inner />
    </QueryClientProvider>
  );
}
