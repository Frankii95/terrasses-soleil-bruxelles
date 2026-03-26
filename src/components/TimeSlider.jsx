import { useMemo } from 'react';
import { getSunTimes } from '../utils/sunCalc';

const HOUR_START = 9;
const HOUR_END = 22;
const TOTAL_MINUTES = (HOUR_END - HOUR_START) * 60;

export default function TimeSlider({ selectedDate, onChange }) {
  const minutes = useMemo(() => {
    const h = selectedDate.getHours();
    const m = selectedDate.getMinutes();
    return Math.max(0, Math.min(TOTAL_MINUTES, (h - HOUR_START) * 60 + m));
  }, [selectedDate]);

  const sunTimes = useMemo(() => getSunTimes(selectedDate), [selectedDate]);

  const sunriseMinutes = useMemo(() => {
    const sr = sunTimes.sunrise;
    return (sr.getHours() - HOUR_START) * 60 + sr.getMinutes();
  }, [sunTimes]);

  const sunsetMinutes = useMemo(() => {
    const ss = sunTimes.sunset;
    return (ss.getHours() - HOUR_START) * 60 + ss.getMinutes();
  }, [sunTimes]);

  const sunrisePercent = Math.max(0, Math.min(100, (sunriseMinutes / TOTAL_MINUTES) * 100));
  const sunsetPercent = Math.max(0, Math.min(100, (sunsetMinutes / TOTAL_MINUTES) * 100));
  const sliderPercent = (minutes / TOTAL_MINUTES) * 100;

  function handleChange(e) {
    const val = parseInt(e.target.value, 10);
    const newDate = new Date(selectedDate);
    newDate.setHours(HOUR_START + Math.floor(val / 60));
    newDate.setMinutes(val % 60);
    newDate.setSeconds(0);
    onChange(newDate);
  }

  return (
    <div
      style={{
        background: '#F0EDE5',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        padding: '10px 20px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexShrink: 0,
      }}
    >
      {/* Sun icon */}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="5" fill="#D97706" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x1 = 12 + 7 * Math.cos(rad);
          const y1 = 12 + 7 * Math.sin(rad);
          const x2 = 12 + 9.5 * Math.cos(rad);
          const y2 = 12 + 9.5 * Math.sin(rad);
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />;
        })}
      </svg>

      {/* Slider track */}
      <div style={{ flex: 1, position: 'relative', paddingBottom: '14px' }}>
        {/* Hour ticks */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between' }}>
          {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => (
            <span key={i} style={{ color: 'rgba(0,0,0,0.2)', fontSize: '8.5px', width: 0, textAlign: 'center' }}>
              {i + HOUR_START}h
            </span>
          ))}
        </div>

        {/* Track */}
        <div style={{ position: 'relative', height: '3px', borderRadius: '2px' }}>
          <div
            style={{
              position: 'absolute', inset: 0, borderRadius: '2px',
              background: `linear-gradient(to right,
                rgba(0,0,0,0.08) 0%,
                rgba(0,0,0,0.08) ${sunrisePercent}%,
                rgba(217,119,6,0.25) ${sunrisePercent}%,
                rgba(217,119,6,0.5) 50%,
                rgba(234,88,12,0.4) ${sunsetPercent}%,
                rgba(0,0,0,0.08) ${sunsetPercent}%,
                rgba(0,0,0,0.08) 100%
              )`,
            }}
          />
          <div
            style={{
              position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: '2px',
              width: `${sliderPercent}%`,
              background: 'rgba(217,119,6,0.6)',
              transition: 'width 0.05s',
            }}
          />
        </div>

        <input
          type="range"
          min={0}
          max={TOTAL_MINUTES}
          value={minutes}
          onChange={handleChange}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', background: 'transparent', margin: 0, padding: 0 }}
        />
      </div>

      {/* Sunrise/sunset */}
      <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '72px' }}>
        <div style={{ fontSize: '9px', color: 'rgba(0,0,0,0.3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Lever · Coucher
        </div>
        <div style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(0,0,0,0.5)', marginTop: '1px' }}>
          {sunTimes.sunrise.getHours()}h{sunTimes.sunrise.getMinutes().toString().padStart(2,'0')}
          {' · '}
          {sunTimes.sunset.getHours()}h{sunTimes.sunset.getMinutes().toString().padStart(2,'0')}
        </div>
      </div>
    </div>
  );
}
