import { useEffect, useRef, useState } from 'react';
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

function Inner() {
  const [coords, setCoords]     = useState(loadCoords);
  const [radius, setRadius]     = useState(5);
  const [locating, setLocating] = useState(false);
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

  const stores: Store[] = data?.results ?? (Array.isArray(data) ? data : []);

  // Draw markers whenever stores / coords / radius change
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

      stores.forEach(s => {
        const sLat = s.latitude ?? s.lat;
        const sLng = s.longitude ?? s.lng;
        if (!sLat || !sLng) return;

        const color = s.is_open ? '#22c55e' : '#6b7280';
        const icon = L.divIcon({
          html: `<div style="background:white;border:2.5px solid ${color};border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.2);font-size:15px">🏪</div>`,
          className: '', iconSize: [34, 34], iconAnchor: [17, 17],
        });
        const popup = `
          <div style="font-family:system-ui;min-width:160px;padding:2px">
            <p style="font-weight:800;font-size:14px;color:#1C2E4A;margin:0 0 2px">${s.name}</p>
            <p style="font-size:11px;color:#9ca3af;margin:0 0 6px;text-transform:capitalize">${s.category}${s.locality ? ' · ' + s.locality : ''}</p>
            <span style="display:inline-block;background:${s.is_open ? '#dcfce7' : '#f3f4f6'};color:${s.is_open ? '#15803d' : '#6b7280'};padding:2px 10px;border-radius:999px;font-size:10px;font-weight:700">${s.is_open ? 'Open now' : 'Closed'}</span>
            <br><a href="/stores/${s.id}" style="display:inline-block;margin-top:8px;background:#1C2E4A;color:white;padding:5px 14px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none">View Store →</a>
          </div>`;
        markersRef.current.push(
          L.marker([sLat, sLng], { icon }).addTo(map).bindPopup(popup)
        );
      });
    });
  }, [stores, coords, radius]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative h-[calc(100vh-4rem)]">
      <div ref={containerRef} className="w-full h-full" />

      {/* Controls overlay */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
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
