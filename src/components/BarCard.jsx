import { motion } from 'framer-motion';
import { getSunTagline } from '../utils/sunCalc';

const STATUS_CONFIG = {
  sunny: {
    badge: 'Plein soleil',
    badgeStyle: { background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' },
    dot: '#D97706',
    topBar: 'linear-gradient(135deg, #FCD34D, #F59E0B)',
  },
  partial: {
    badge: 'Mi-soleil',
    badgeStyle: { background: '#FFF7ED', color: '#9A3412', border: '1px solid #FED7AA' },
    dot: '#EA580C',
    topBar: 'linear-gradient(135deg, #FDBA74, #FB923C)',
  },
  shade: {
    badge: 'À l\'ombre',
    badgeStyle: { background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' },
    dot: '#9CA3AF',
    topBar: 'linear-gradient(135deg, #D1D5DB, #9CA3AF)',
  },
};

export default function BarCard({ bar, status, selectedDate, index, isBest }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.shade;
  const tagline = getSunTagline(bar.orientation, selectedDate);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.28, delay: index * 0.04, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -2, boxShadow: isBest ? '0 8px 24px rgba(217,119,6,0.2)' : '0 4px 16px rgba(0,0,0,0.1)' }}
      style={{
        background: '#FFFFFF',
        border: isBest ? '1.5px solid #F59E0B' : '1px solid rgba(0,0,0,0.07)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: isBest
          ? '0 4px 20px rgba(217,119,6,0.15)'
          : '0 1px 4px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        cursor: 'default',
      }}
    >
      {/* Top color strip */}
      <div style={{ height: '4px', background: config.topBar, flexShrink: 0 }} />

      {/* Best pick crown badge */}
      {isBest && (
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '10px',
          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
          color: 'white',
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          padding: '3px 7px',
          borderRadius: '20px',
          boxShadow: '0 2px 8px rgba(217,119,6,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
        }}>
          ★ Notre choix
        </div>
      )}

      {/* Card body */}
      <div style={{ padding: '11px 13px 12px', display: 'flex', flexDirection: 'column', flex: 1 }}>

        {/* Status badge */}
        <div style={{
          ...config.badgeStyle,
          fontSize: '9.5px', fontWeight: 600,
          letterSpacing: '0.05em', textTransform: 'uppercase',
          padding: '2px 7px', borderRadius: '20px',
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          alignSelf: 'flex-start',
          marginBottom: '8px',
        }}>
          <span style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: config.dot, display: 'inline-block', flexShrink: 0,
          }} />
          {config.badge}
        </div>

        {/* Name */}
        <div style={{
          fontSize: '13.5px', fontWeight: 700, color: '#1C1917',
          letterSpacing: '-0.01em', lineHeight: 1.25,
          marginBottom: '2px',
        }}>
          {bar.name}
        </div>

        {/* Neighborhood */}
        <div style={{
          fontSize: '10px', color: '#A8A29E',
          textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500,
          marginBottom: '8px',
        }}>
          {bar.neighborhood}
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: '11.5px', color: '#78716C', lineHeight: 1.4, flex: 1,
        }}>
          {tagline}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '10px', display: 'flex', gap: '5px', alignItems: 'center' }}>
          <span style={{
            fontSize: '9.5px', color: '#A8A29E',
            background: '#F5F5F4', border: '1px solid #E7E5E4',
            borderRadius: '5px', padding: '1.5px 5px', letterSpacing: '0.04em',
          }}>
            {bar.orientation}
          </span>
          <span style={{ fontSize: '9.5px', color: '#C4B5A5' }}>
            {bar.openHours[0]}h–{bar.openHours[1]}h
          </span>
        </div>
      </div>
    </motion.div>
  );
}
