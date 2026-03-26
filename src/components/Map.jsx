import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getSunStatus, getSunTagline, getSunPosition } from '../utils/sunCalc';

const BRUSSELS_CENTER = [4.358, 50.845];

const STATUS_COLORS = {
  sunny:   { fill: '#FFD54F', stroke: '#F57F17' },
  partial: { fill: '#FF9800', stroke: '#E65100' },
  shade:   { fill: '#D1D5DB', stroke: '#9CA3AF' },
};

function createMarkerEl(status) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.shade;
  const pulse = status === 'sunny'
    ? `<circle cx="12" cy="10" r="10" fill="${c.fill}" opacity="0">
        <animate attributeName="r" values="10;18" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.7;0" dur="2s" repeatCount="indefinite"/>
       </circle>`
    : '';
  const el = document.createElement('div');
  el.style.cursor = 'pointer';
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    ${pulse}
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 22 14 22S28 23.5 28 14C28 6.27 21.73 0 14 0z"
          fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="5" fill="white" opacity="0.9"/>
  </svg>`;
  return el;
}

function createPopupHTML(bar, status, date) {
  const statusLabels = {
    sunny:   { text: 'Plein soleil', color: '#D97706' },
    partial: { text: 'Mi-soleil',    color: '#EA580C' },
    shade:   { text: "À l'ombre",   color: '#9CA3AF' },
  };
  const s = statusLabels[status] || statusLabels.shade;
  const tagline = getSunTagline(bar.orientation, date);
  return `
    <div style="padding:16px 18px 14px;min-width:200px;font-family:'DM Sans',sans-serif;color:#1C1917;">
      <div style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#A8A29E;margin-bottom:3px;font-weight:500;">${bar.neighborhood}</div>
      <div style="font-size:17px;font-weight:700;margin-bottom:8px;line-height:1.2;">${bar.name}</div>
      <div style="display:inline-flex;align-items:center;gap:5px;background:rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.08);border-radius:20px;padding:3px 9px;margin-bottom:8px;">
        <span style="width:6px;height:6px;border-radius:50%;background:${s.color};display:inline-block;flex-shrink:0;"></span>
        <span style="font-size:10px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${s.color};">${s.text}</span>
      </div>
      <div style="font-size:11px;color:#78716C;line-height:1.4;">${tagline}</div>
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(0,0,0,0.06);display:flex;gap:10px;font-size:9px;color:#C4B5A5;letter-spacing:0.04em;">
        <span>Terrasse ${bar.orientation}</span>
        <span>${bar.openHours[0]}h – ${bar.openHours[1]}h</span>
      </div>
    </div>`;
}

export default function Map({ bars, selectedDate, onBarClick }) {
  const mapRef         = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef     = useRef({});
  const styleLoadedRef = useRef(false);
  const buildingsRef   = useRef(null); // données bâtiments OSM, disponibles pour usage futur

  useEffect(() => {
    if (mapInstanceRef.current) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: BRUSSELS_CENTER,
      zoom: 13,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      styleLoadedRef.current = true;

      map.addLayer({
        id: '3d-buildings',
        source: 'openmaptiles',
        'source-layer': 'building',
        type: 'fill-extrusion',
        minzoom: 15,
        paint: {
          'fill-extrusion-color': '#ede8df',
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            15, 0, 15.5,
            ['coalesce', ['get', 'render_height'], ['get', 'height'], 8],
          ],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
          'fill-extrusion-opacity': 0.85,
        },
      });

      // Fetch bâtiments Brussels — données en cache pour usage futur (aucun calcul au slider)
      const query = `[out:json][timeout:30];way["building"](50.82,4.31,50.88,4.43);out geom;`;
      fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(data => {
          buildingsRef.current = data.elements
            .filter(el => el.type === 'way' && el.geometry?.length >= 3)
            .map(el => ({
              coords: el.geometry.map(n => [n.lon, n.lat]),
              height: el.tags?.height
                ? parseFloat(el.tags.height)
                : el.tags?.['building:levels']
                  ? parseFloat(el.tags['building:levels']) * 3
                  : 8,
            }));
        })
        .catch(() => {});
    });

    mapInstanceRef.current = map;

    return () => {
      Object.values(markersRef.current).forEach(({ marker }) => marker.remove());
      markersRef.current = {};
      map.remove();
      mapInstanceRef.current = null;
      styleLoadedRef.current = false;
    };
  }, []);

  const updateMarkers = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const currentIds = new Set(bars.map(b => String(b.id)));
    Object.keys(markersRef.current).forEach(id => {
      if (!currentIds.has(id)) { markersRef.current[id].marker.remove(); delete markersRef.current[id]; }
    });
    bars.forEach(bar => {
      const status = getSunStatus(bar.orientation, selectedDate);
      const popupHTML = createPopupHTML(bar, status, selectedDate);
      if (markersRef.current[bar.id]) {
        const { marker, popup } = markersRef.current[bar.id];
        marker.getElement().innerHTML = createMarkerEl(status).innerHTML;
        popup.setHTML(popupHTML);
      } else {
        const el = createMarkerEl(status);
        const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '280px', offset: [0, -38] })
          .setHTML(popupHTML);
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([bar.lng, bar.lat])
          .setPopup(popup)
          .addTo(map);
        el.addEventListener('click', () => onBarClick?.(bar));
        markersRef.current[bar.id] = { marker, popup };
      }
    });
  }, [bars, selectedDate, onBarClick]);

  useEffect(() => { updateMarkers(); }, [updateMarkers]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      <SunCompass selectedDate={selectedDate} />
    </div>
  );
}

function SunCompass({ selectedDate }) {
  const pos = getSunPosition(selectedDate);
  const altitudeDeg = (pos.altitude * 180) / Math.PI;
  const azimuthDeg  = ((pos.azimuth * 180) / Math.PI + 180) % 360;
  const isAboveHorizon = altitudeDeg > 0;
  const arrowRad = (azimuthDeg * Math.PI) / 180;
  const size = 52, cx = size/2, cy = size/2, r = 18;
  const tipX = cx + r * Math.sin(arrowRad);
  const tipY = cy - r * Math.cos(arrowRad);

  return (
    <div style={{
      position: 'absolute', bottom: '56px', left: '16px', zIndex: 1000,
      background: 'rgba(247,244,238,0.92)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(0,0,0,0.08)', borderRadius: '14px',
      padding: '10px 12px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: '4px', minWidth: '70px',
    }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r+2} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1"/>
        {[['N',0,-1],['S',0,1],['E',1,0],['O',-1,0]].map(([label,dx,dy]) => (
          <text key={label} x={cx+(r+8)*dx} y={cy+(r+8)*dy+(dy!==0?4:0)}
            textAnchor="middle" fill="rgba(0,0,0,0.25)" fontSize="7"
            fontFamily="DM Sans, sans-serif" fontWeight="500">{label}</text>
        ))}
        {isAboveHorizon ? (
          <>
            <line x1={cx} y1={cy} x2={tipX} y2={tipY} stroke="#D97706" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
            <circle cx={tipX} cy={tipY} r="3" fill="#D97706" opacity="0.9"/>
            <circle cx={cx} cy={cy} r="3" fill="rgba(217,119,6,0.3)"/>
          </>
        ) : (
          <text x={cx} y={cy+5} textAnchor="middle" fill="rgba(0,0,0,0.2)" fontSize="10">—</text>
        )}
      </svg>
      <div style={{ fontSize:'9px', color:'rgba(0,0,0,0.4)', textAlign:'center', letterSpacing:'0.04em', lineHeight:1.3 }}>
        {isAboveHorizon
          ? <><div style={{ color:'#D97706', fontWeight:600 }}>{Math.round(altitudeDeg)}°</div><div>altitude</div></>
          : <div>couché</div>}
      </div>
    </div>
  );
}
