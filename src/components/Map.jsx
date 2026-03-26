import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import { getSunStatus, getSunTagline, getSunPosition } from '../utils/sunCalc';

const BRUSSELS_CENTER = [50.845, 4.358];
const CARTO_LIGHT_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

function createPinSVG(status) {
  const colors = {
    sunny: { fill: '#FFD54F', stroke: '#F57F17', glow: 'rgba(255,213,79,0.5)' },
    partial: { fill: '#FF9800', stroke: '#E65100', glow: 'rgba(255,152,0,0.4)' },
    shade: { fill: '#D1D5DB', stroke: '#9CA3AF', glow: 'transparent' },
  };
  const c = colors[status] || colors.shade;

  const pulse = status === 'sunny'
    ? `<circle cx="12" cy="10" r="10" fill="${c.glow}" opacity="0">
        <animate attributeName="r" values="10;18" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.7;0" dur="2s" repeatCount="indefinite"/>
       </circle>`
    : '';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      ${pulse}
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 22 14 22S28 23.5 28 14C28 6.27 21.73 0 14 0z"
            fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5"/>
      <circle cx="14" cy="14" r="5" fill="white" opacity="0.9"/>
    </svg>
  `;
}

function createDivIcon(status) {
  const svg = createPinSVG(status);
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -38],
  });
}

function createPopupContent(bar, status, date) {
  const statusLabels = {
    sunny: { text: 'Plein soleil', color: '#FFD54F' },
    partial: { text: 'Mi-soleil', color: '#FF9800' },
    shade: { text: 'À l\'ombre', color: '#6B7280' },
  };
  const s = statusLabels[status] || statusLabels.shade;
  const tagline = getSunTagline(bar.orientation, date);

  return `
    <div style="
      padding: 18px 20px 16px;
      min-width: 220px;
      font-family: 'DM Sans', sans-serif;
      color: #1C1917;
    ">
      <div style="
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #A8A29E;
        margin-bottom: 4px;
        font-weight: 500;
      ">${bar.neighborhood}</div>

      <div style="
        font-size: 18px;
        font-weight: 700;
        letter-spacing: -0.02em;
        margin-bottom: 10px;
        line-height: 1.2;
      ">${bar.name}</div>

      <div style="
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(0,0,0,0.04);
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: 20px;
        padding: 4px 10px;
        margin-bottom: 10px;
      ">
        <span style="
          width: 7px; height: 7px;
          border-radius: 50%;
          background: ${s.color};
          display: inline-block;
          flex-shrink: 0;
        "></span>
        <span style="
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: ${s.color};
        ">${s.text}</span>
      </div>

      <div style="
        font-size: 12px;
        color: #78716C;
        line-height: 1.4;
      ">${tagline}</div>

      <div style="
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid rgba(0,0,0,0.06);
        display: flex;
        gap: 12px;
        font-size: 10px;
        color: #C4B5A5;
        letter-spacing: 0.04em;
      ">
        <span>Terrasse ${bar.orientation}</span>
        <span>${bar.openHours[0]}h – ${bar.openHours[1]}h</span>
      </div>
    </div>
  `;
}

export default function Map({ bars, selectedDate, onBarClick }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const tileLayerRef = useRef(null);
  const osmbRef = useRef(null);

  // Initialize map
  useEffect(() => {
    if (mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: BRUSSELS_CENTER,
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    tileLayerRef.current = L.tileLayer(CARTO_LIGHT_URL, {
      attribution: CARTO_ATTRIBUTION,
      maxZoom: 18,
    }).addTo(map);

    // OSMBuildings — ombres 3D des bâtiments (actif à partir du zoom 15)
    if (window.OSMBuildings) {
      const osmb = new window.OSMBuildings(map);
      osmb.load('https://data.osmbuildings.org/0.2/anonymous/tile/{z}/{x}/{y}.json');
      osmbRef.current = osmb;
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      osmbRef.current = null;
    };
  }, []);

  // Mettre à jour les ombres quand la date/heure change
  useEffect(() => {
    if (osmbRef.current) {
      osmbRef.current.date(selectedDate);
    }
  }, [selectedDate]);

  // Update markers when bars or date changes
  const updateMarkers = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentIds = new Set(bars.map((b) => b.id));

    // Remove markers no longer in data
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentIds.has(parseInt(id))) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    bars.forEach((bar) => {
      const status = getSunStatus(bar.orientation, selectedDate);
      const icon = createDivIcon(status);
      const popupContent = createPopupContent(bar, status, selectedDate);

      if (markersRef.current[bar.id]) {
        const marker = markersRef.current[bar.id];
        marker.setIcon(icon);
        marker.getPopup()?.setContent(popupContent);
      } else {
        const marker = L.marker([bar.lat, bar.lng], { icon })
          .addTo(map)
          .bindPopup(popupContent, {
            className: '',
            maxWidth: 280,
            minWidth: 240,
          });

        marker.on('click', () => {
          onBarClick?.(bar);
        });

        markersRef.current[bar.id] = marker;
      }
    });
  }, [bars, selectedDate, onBarClick]);

  useEffect(() => {
    updateMarkers();
  }, [updateMarkers]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Draw sun direction as a soft directional glow on the map
    // We use a simple CSS overlay approach via a pane
  }, [selectedDate]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {/* Sun compass overlay */}
      <SunCompass selectedDate={selectedDate} />
    </div>
  );
}

function SunCompass({ selectedDate }) {
  const pos = getSunPosition(selectedDate);
  const altitudeDeg = (pos.altitude * 180) / Math.PI;
  const azimuthDeg = ((pos.azimuth * 180) / Math.PI + 180) % 360;
  const isAboveHorizon = altitudeDeg > 0;

  // Arrow direction: sun azimuth means we draw an arrow pointing toward sun
  const arrowRad = (azimuthDeg * Math.PI) / 180;
  const size = 52;
  const cx = size / 2;
  const cy = size / 2;
  const r = 18;
  const tipX = cx + r * Math.sin(arrowRad);
  const tipY = cy - r * Math.cos(arrowRad);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '56px',
        left: '16px',
        zIndex: 1000,
        background: 'rgba(247,244,238,0.92)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '14px',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        minWidth: '70px',
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Compass ring */}
        <circle cx={cx} cy={cy} r={r + 2} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
        {/* Cardinal labels */}
        {[['N', 0, -1], ['S', 0, 1], ['E', 1, 0], ['O', -1, 0]].map(([label, dx, dy]) => (
          <text
            key={label}
            x={cx + (r + 8) * dx}
            y={cy + (r + 8) * dy + (dy !== 0 ? 4 : 0)}
            textAnchor="middle"
            fill="rgba(0,0,0,0.25)"
            fontSize="7"
            fontFamily="DM Sans, sans-serif"
            fontWeight="500"
          >
            {label}
          </text>
        ))}
        {/* Sun direction arrow */}
        {isAboveHorizon ? (
          <>
            <line
              x1={cx}
              y1={cy}
              x2={tipX}
              y2={tipY}
              stroke="#FFD54F"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.9"
            />
            <circle cx={tipX} cy={tipY} r="3" fill="#FFD54F" opacity="0.9" />
            <circle cx={cx} cy={cy} r="3" fill="rgba(255,213,79,0.3)" />
          </>
        ) : (
          <text x={cx} y={cy + 5} textAnchor="middle" fill="rgba(0,0,0,0.2)" fontSize="10">—</text>
        )}
      </svg>
      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', letterSpacing: '0.04em', lineHeight: 1.3 }}>
        {isAboveHorizon ? (
          <>
            <div style={{ color: '#FFD54F', fontWeight: 600 }}>{Math.round(altitudeDeg)}°</div>
            <div>altitude</div>
          </>
        ) : (
          <div>couché</div>
        )}
      </div>
    </div>
  );
}
