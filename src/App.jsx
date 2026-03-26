import { useState, useMemo, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Map from './components/Map';
import BarCard from './components/BarCard';
import TimeSlider from './components/TimeSlider';
import { bars } from './data/bars';
import { getSunStatus, getSunTimes, getSunnyUntil, getNextSunnyWindow, formatHour } from './utils/sunCalc';
import './App.css';

const STATUS_ORDER = { sunny: 0, partial: 1, shade: 2 };

// Time-of-day context
function getMomentIdeal(hour) {
  if (hour < 9)  return { label: 'un café au soleil',        emoji: '☕' };
  if (hour < 11) return { label: 'un café en terrasse',       emoji: '☕' };
  if (hour < 14) return { label: 'un lunch en terrasse',      emoji: '🍽' };
  if (hour < 16) return { label: 'une pause café au soleil',  emoji: '☕' };
  if (hour < 19) return { label: 'une bière en terrasse',     emoji: '🍺' };
  if (hour < 21) return { label: 'un apéro au soleil',        emoji: '🥂' };
  return           { label: 'un dernier verre',               emoji: '🌙' };
}


function formatRemainingTime(totalMinutes) {
  if (totalMinutes <= 0) return null;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export default function App() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const h = now.getHours();
    if (h < 9)  { now.setHours(9, 0, 0, 0); }
    if (h >= 22) { now.setHours(21, 30, 0, 0); }
    return now;
  });

  const [activeTab, setActiveTab] = useState('list');
  const [highlightedBarId, setHighlightedBarId] = useState(null);
  const [filterType, setFilterType] = useState('tous');
  const [drinkSlide, setDrinkSlide] = useState(0); // 0=café 1=bière 2=vin 3=cocktail

  const barsWithStatus = useMemo(() => {
    return bars.map((bar) => ({
      ...bar,
      status: getSunStatus(bar.orientation, selectedDate),
    })).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }, [selectedDate]);

  const sunnyBars  = useMemo(() => barsWithStatus.filter(b => b.status === 'sunny'),   [barsWithStatus]);
  const partialBars = useMemo(() => barsWithStatus.filter(b => b.status === 'partial'), [barsWithStatus]);
  const shadeBars   = useMemo(() => barsWithStatus.filter(b => b.status === 'shade'),   [barsWithStatus]);
  const visibleCards = useMemo(() => {
    const all = [...sunnyBars, ...partialBars];
    if (filterType === 'tous') return all;
    return all.filter(b => b.type === filterType);
  }, [sunnyBars, partialBars, filterType]);

  // Best bar: sunny bar with the most remaining sun time, fallback to first partial
  const bestBarId = useMemo(() => {
    if (sunnyBars.length > 0) {
      let best = sunnyBars[0];
      let bestMs = 0;
      for (const bar of sunnyBars) {
        const until = getSunnyUntil(bar.orientation, selectedDate);
        const ms = until ? until.getTime() - selectedDate.getTime() : 0;
        if (ms > bestMs) { bestMs = ms; best = bar; }
      }
      return best.id;
    }
    if (partialBars.length > 0) {
      // Among partial, pick the one whose sunny window arrives soonest
      let best = partialBars[0];
      let bestMs = Infinity;
      for (const bar of partialBars) {
        const next = getNextSunnyWindow(bar.orientation, selectedDate);
        const ms = next ? next.getTime() - selectedDate.getTime() : Infinity;
        if (ms < bestMs) { bestMs = ms; best = bar; }
      }
      return best.id;
    }
    return null;
  }, [sunnyBars, partialBars, selectedDate]);

  // Sun info
  const sunInfo = useMemo(() => {
    const sunTimes = getSunTimes(selectedDate);
    const sunset = sunTimes.sunset;
    const sunriseMs = sunTimes.sunrise.getTime();
    const sunsetMs  = sunset.getTime();
    const nowMs     = selectedDate.getTime();

    const isSunUp = nowMs >= sunriseMs && nowMs < sunsetMs;
    const remainingMs = sunsetMs - nowMs;
    const remainingMinutes = isSunUp ? Math.max(0, Math.floor(remainingMs / 60000)) : 0;

    const hour = selectedDate.getHours();
    const moment = getMomentIdeal(hour);

    // Cafés: minutes until noon / 20 min each
    const noon = new Date(selectedDate);
    noon.setHours(12, 0, 0, 0);
    const minutesUntilNoon = Math.max(0, Math.floor((noon.getTime() - nowMs) / 60000));
    const cafeCount = minutesUntilNoon > 0 ? Math.floor(minutesUntilNoon / 20) : 0;

    // Boissons: minutes until sunset
    const biereCount    = remainingMinutes > 0 ? Math.floor(remainingMinutes / 30) : 0;
    const vinCount      = remainingMinutes > 0 ? Math.floor(remainingMinutes / 25) : 0;
    const cocktailCount = remainingMinutes > 0 ? Math.floor(remainingMinutes / 35) : 0;

    return {
      isSunUp,
      remainingMinutes,
      remainingFormatted: formatRemainingTime(remainingMinutes),
      sunsetLabel: formatHour(sunset),
      moment,
      cafeCount,
      biereCount,
      vinCount,
      cocktailCount,
    };
  }, [selectedDate]);

  const hour = selectedDate.getHours();
  const min  = selectedDate.getMinutes();
  const timeLabel = `${hour}h${min.toString().padStart(2, '0')}`;

  // Cycle between café and bière info every 3s
  useEffect(() => {
    const id = setInterval(() => setDrinkSlide(s => (s + 1) % 4), 5000);
    return () => clearInterval(id);
  }, []);

  const handleBarClick = useCallback((bar) => {
    setHighlightedBarId(bar.id);
    setActiveTab('list');
    setTimeout(() => setHighlightedBarId(null), 2000);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F7F4EE' }}>

      {/* ─── HEADER ─── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 20px',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        flexShrink: 0,
        background: '#F7F4EE',
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 30, height: 30, borderRadius: '9px',
            background: 'linear-gradient(135deg, #F59E0B, #EA580C)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: '0 3px 10px rgba(245,158,11,0.3)',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3.5" fill="white" />
              {[0, 60, 120, 180, 240, 300].map((deg) => {
                const rad = (deg * Math.PI) / 180;
                return <line key={deg} x1={8 + 5 * Math.cos(rad)} y1={8 + 5 * Math.sin(rad)} x2={8 + 7 * Math.cos(rad)} y2={8 + 7 * Math.sin(rad)} stroke="white" strokeWidth="1.5" strokeLinecap="round" />;
              })}
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '15px', fontWeight: 700, color: '#1C1917', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
              Pti verre en Terrasse ?
            </div>
            <div style={{ fontSize: '9.5px', color: '#A8A29E', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>
              Bruxelles
            </div>
          </div>
        </div>

        {/* Status pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          background: sunnyBars.length > 0 ? '#FEF3C7' : '#F3F4F6',
          border: `1px solid ${sunnyBars.length > 0 ? '#FDE68A' : '#E5E7EB'}`,
          borderRadius: '20px', padding: '5px 12px',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: sunnyBars.length > 0 ? '#D97706' : '#9CA3AF',
          }} />
          <span style={{ fontSize: '11.5px', fontWeight: 600, color: sunnyBars.length > 0 ? '#92400E' : '#6B7280' }}>
            {sunnyBars.length} terrasse{sunnyBars.length !== 1 ? 's' : ''} ensoleillée{sunnyBars.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: '10px', color: '#C4B5A5' }}>/ {bars.length}</span>
        </div>

        {/* Mobile toggle */}
        <div className="mobile-tabs" style={{ display: 'none', background: '#EDE9E3', borderRadius: '9px', padding: '3px' }}>
          {['map', 'list'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '4px 11px', borderRadius: '7px', border: 'none', cursor: 'pointer',
              fontSize: '11px', fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
              background: activeTab === tab ? '#FFFFFF' : 'transparent',
              color: activeTab === tab ? '#92400E' : '#A8A29E',
              boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
            }}>
              {tab === 'map' ? 'Carte' : 'Liste'}
            </button>
          ))}
        </div>
      </header>

      {/* ─── TIME SLIDER ─── */}
      <TimeSlider selectedDate={selectedDate} onChange={setSelectedDate} />

      {/* ─── MAIN CONTENT ─── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* MAP PANEL — 60% */}
        <div
          style={{ flex: '0 0 60%', background: '#F7F4EE', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px 14px 16px 18px' }}
          className="map-panel"
        >
          {/* Section title */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px', flexShrink: 0 }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', fontWeight: 700, color: '#1C1917', letterSpacing: '-0.02em' }}>
              Bruxelles
            </div>
            <div style={{ fontSize: '10px', color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500 }}>
              · Carte des terrasses
            </div>
          </div>

          {/* Map card — flex column so the band is a normal sibling, no z-index conflict with Leaflet */}
          <div style={{
            flex: 1,
            borderRadius: '20px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            border: '1.5px solid rgba(0,0,0,0.07)',
          }}>
            {/* Yellow–orange top band — normal flow, never overlaps Leaflet layers */}
            <div style={{
              height: '5px', flexShrink: 0,
              background: 'linear-gradient(90deg, #FCD34D 0%, #F59E0B 40%, #EA580C 100%)',
            }} />
            {/* Map fills remaining height */}
            <div style={{ flex: 1, position: 'relative' }}>
              <Map bars={bars} selectedDate={selectedDate} onBarClick={handleBarClick} />
            </div>
          </div>
        </div>

        {/* DIVIDER */}
        <div style={{ width: '1px', background: 'rgba(0,0,0,0.07)', flexShrink: 0 }} />

        {/* RIGHT PANEL — 40% */}
        <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F7F4EE' }} className="cards-panel">

          {/* ── PRESENTATION BLOCK ── */}
          <div style={{ padding: '22px 22px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)', flexShrink: 0 }}>

            {/* Greeting + time */}
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '26px', fontWeight: 600, color: '#1C1917', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
              Bonjour, il est{' '}
              <span style={{ color: '#D97706' }}>{timeLabel}</span>
            </div>

            {/* Dynamic subtitle */}
            <div style={{ marginTop: '6px', fontSize: '14px', color: '#78716C', fontWeight: 400, lineHeight: 1.4 }}>
              Le moment idéal pour{' '}
              <span style={{ color: '#1C1917', fontWeight: 600 }}>
                {sunInfo.moment.label}
              </span>
              {' '}{sunInfo.moment.emoji}
            </div>

            {/* Stats row */}
            <div style={{ marginTop: '18px', display: 'flex', gap: '10px' }}>

              {/* Remaining sun */}
              <div style={{
                flex: 1, background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)',
                borderRadius: '14px', padding: '13px 14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle cx="6.5" cy="6.5" r="3" fill="#D97706" />
                    {[0, 60, 120, 180, 240, 300].map((deg) => {
                      const rad = (deg * Math.PI) / 180;
                      return <line key={deg} x1={6.5 + 3.8*Math.cos(rad)} y1={6.5 + 3.8*Math.sin(rad)} x2={6.5 + 5.5*Math.cos(rad)} y2={6.5 + 5.5*Math.sin(rad)} stroke="#D97706" strokeWidth="1.3" strokeLinecap="round" />;
                    })}
                  </svg>
                  <span style={{ fontSize: '9.5px', color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
                    Soleil restant
                  </span>
                </div>

                {sunInfo.isSunUp && sunInfo.remainingMinutes > 0 ? (
                  <>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#D97706', letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {sunInfo.remainingFormatted}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#A8A29E', marginTop: '3px' }}>
                      Coucher à {sunInfo.sunsetLabel}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#C4B5A5', marginTop: '4px' }}>
                    Soleil couché
                  </div>
                )}
              </div>

              {/* Drink count — cycling café / bière with fade */}
              <div style={{
                flex: 1, background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)',
                borderRadius: '14px', padding: '13px 14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                overflow: 'hidden', position: 'relative', minHeight: '80px',
              }}>
                <div style={{ fontSize: '9.5px', color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: '5px' }}>
                  Tu as le temps pour
                </div>
                <AnimatePresence mode="wait">
                  {drinkSlide === 0 && (
                    <DrinkSlide key="cafe" count={sunInfo.cafeCount} singular="café" plural="cafés" emoji="☕"
                      sub={sunInfo.cafeCount > 0 ? 'avant midi · ~20 min chacun' : 'Midi est passé'} />
                  )}
                  {drinkSlide === 1 && (
                    <DrinkSlide key="biere" count={sunInfo.biereCount} singular="bière" plural="bières" emoji="🍺"
                      sub={sunInfo.biereCount > 0 ? 'avant le coucher · ~30 min chacune' : 'Soleil couché 🌙'} />
                  )}
                  {drinkSlide === 2 && (
                    <DrinkSlide key="vin" count={sunInfo.vinCount} singular="verre de vin" plural="verres de vin" emoji="🍷"
                      sub={sunInfo.vinCount > 0 ? 'avant le coucher · ~25 min chacun' : 'Soleil couché 🌙'} />
                  )}
                  {drinkSlide === 3 && (
                    <DrinkSlide key="cocktail" count={sunInfo.cocktailCount} singular="cocktail" plural="cocktails" emoji="🍹"
                      sub={sunInfo.cocktailCount > 0 ? 'avant le coucher · ~35 min chacun' : 'Soleil couché 🌙'} />
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* ── CARDS LIST ── */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
            {/* List header */}
            <div style={{
              padding: '12px 16px 8px 22px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
              flexShrink: 0,
            }}>
              <div style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#A8A29E', flexShrink: 0 }}>
                En ce moment
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {/* Status chips */}
                <StatusChip color="#92400E" bg="#FEF3C7" border="#FDE68A" label={`${sunnyBars.length} ☀`} />
                <StatusChip color="#9A3412" bg="#FFF7ED" border="#FED7AA" label={`${partialBars.length} ◑`} />
                {/* Type filter dropdown */}
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  style={{
                    fontSize: '10.5px', fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
                    color: filterType === 'tous' ? '#78716C' : '#92400E',
                    background: filterType === 'tous' ? '#F5F5F4' : '#FEF3C7',
                    border: `1px solid ${filterType === 'tous' ? '#E7E5E4' : '#FDE68A'}`,
                    borderRadius: '20px',
                    padding: '3px 22px 3px 9px',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23A8A29E' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 7px center',
                    outline: 'none',
                  }}
                >
                  <option value="tous">Tous</option>
                  <option value="café">Cafés</option>
                  <option value="bar">Bars</option>
                  <option value="restaurant">Restos</option>
                </select>
              </div>
            </div>

            {/* Scrollable 2-column grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 14px 14px' }}>
              <AnimatePresence mode="popLayout">
                {visibleCards.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ textAlign: 'center', padding: '48px 20px', color: '#C4B5A5' }}
                  >
                    <div style={{ fontSize: '36px', marginBottom: '10px' }}>🌑</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#78716C' }}>Aucune terrasse ensoleillée</div>
                    <div style={{ fontSize: '11.5px', marginTop: '5px' }}>Essayez un autre horaire</div>
                  </motion.div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                  }}>
                    {visibleCards.map((bar, i) => (
                      <BarCard
                        key={bar.id}
                        bar={bar}
                        status={bar.status}
                        selectedDate={selectedDate}
                        index={i}
                        isBest={bar.id === bestBarId}
                      />
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Shaded bars footer */}
            {shadeBars.length > 0 && (
              <div style={{ padding: '8px 22px', borderTop: '1px solid rgba(0,0,0,0.05)', fontSize: '10.5px', color: '#C4B5A5', flexShrink: 0 }}>
                + {shadeBars.length} terrasse{shadeBars.length !== 1 ? 's' : ''} à l'ombre
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile responsive */}
      <style>{`
        @media (max-width: 768px) {
          .mobile-tabs { display: flex !important; }
          .map-panel {
            display: ${activeTab === 'map' ? 'block' : 'none'} !important;
            flex: 1 1 auto !important;
          }
          .cards-panel {
            display: ${activeTab === 'list' ? 'flex' : 'none'} !important;
            flex: 1 1 auto !important;
          }
        }
      `}</style>
    </div>
  );
}

function DrinkSlide({ count, singular, plural, emoji, sub }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      {count > 0 ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
            <span style={{ fontSize: '22px', fontWeight: 700, color: '#1C1917', letterSpacing: '-0.03em', lineHeight: 1 }}>{count}</span>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#78716C' }}>{count === 1 ? singular : plural}</span>
            <span style={{ fontSize: '16px' }}>{emoji}</span>
          </div>
          <div style={{ fontSize: '10.5px', color: '#A8A29E', marginTop: '3px' }}>{sub}</div>
        </>
      ) : (
        <div style={{ fontSize: '12px', color: '#C4B5A5', marginTop: '2px' }}>{sub}</div>
      )}
    </motion.div>
  );
}

function StatusChip({ color, bg, border, label }) {
  return (
    <div style={{
      fontSize: '10px', fontWeight: 600, color, background: bg,
      border: `1px solid ${border}`, borderRadius: '20px', padding: '2px 7px',
      letterSpacing: '0.02em',
    }}>
      {label}
    </div>
  );
}
