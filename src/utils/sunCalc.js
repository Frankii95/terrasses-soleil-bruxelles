import SunCalc from 'suncalc';

const BRUSSELS_LAT = 50.85;
const BRUSSELS_LNG = 4.35;

// Orientation to azimuth range map
// orientation = direction the terrace FACES
// Sun shines on terrace when sun is in the facing direction
const ORIENTATION_AZIMUTHS = {
  N:  { center: 0,   range: 90 },
  NE: { center: 45,  range: 90 },
  E:  { center: 90,  range: 90 },
  SE: { center: 135, range: 90 },
  S:  { center: 180, range: 90 },
  SW: { center: 225, range: 90 },
  W:  { center: 270, range: 90 },
  NW: { center: 315, range: 90 },
};

function angleDiff(a, b) {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/**
 * Returns sun position for Brussels at a given Date
 */
export function getSunPosition(date) {
  return SunCalc.getPosition(date, BRUSSELS_LAT, BRUSSELS_LNG);
}

/**
 * Returns sun times for Brussels for a given Date
 */
export function getSunTimes(date) {
  return SunCalc.getTimes(date, BRUSSELS_LAT, BRUSSELS_LNG);
}

/**
 * Determines if a terrace with a given orientation is sunny at the given date/time.
 * Returns one of: 'sunny' | 'partial' | 'shade'
 */
export function getSunStatus(orientation, date) {
  const pos = SunCalc.getPosition(date, BRUSSELS_LAT, BRUSSELS_LNG);

  // Sun below horizon
  if (pos.altitude <= 0) return 'shade';

  const sunAzimuthDeg = ((pos.azimuth * 180) / Math.PI + 180) % 360;
  const sunAltitudeDeg = (pos.altitude * 180) / Math.PI;

  const { center } = ORIENTATION_AZIMUTHS[orientation] || ORIENTATION_AZIMUTHS['S'];
  const diff = angleDiff(sunAzimuthDeg, center);

  // Full sun: azimuth within 45° of facing direction and sun altitude > 10°
  if (diff <= 45 && sunAltitudeDeg > 10) return 'sunny';
  // Partial: within 75° or altitude is low (golden hour)
  if (diff <= 75 || (sunAltitudeDeg > 4 && diff <= 90)) return 'partial';

  return 'shade';
}

/**
 * Find the next window when a terrace will be sunny (within 2h lookahead)
 * Returns a Date or null
 */
export function getNextSunnyWindow(orientation, date) {
  const status = getSunStatus(orientation, date);
  if (status === 'sunny') return null; // already sunny

  const step = 15 * 60 * 1000; // 15 minutes
  const maxLook = 2 * 60 * 60 * 1000; // 2 hours

  for (let offset = step; offset <= maxLook; offset += step) {
    const checkDate = new Date(date.getTime() + offset);
    if (getSunStatus(orientation, checkDate) === 'sunny') {
      return checkDate;
    }
  }
  return null;
}

/**
 * Find when a currently sunny terrace will go into shade (within 4h lookahead)
 * Returns a Date or null
 */
export function getSunnyUntil(orientation, date) {
  const status = getSunStatus(orientation, date);
  if (status !== 'sunny') return null;

  const step = 10 * 60 * 1000; // 10 minutes
  const maxLook = 6 * 60 * 60 * 1000; // 6 hours

  for (let offset = step; offset <= maxLook; offset += step) {
    const checkDate = new Date(date.getTime() + offset);
    if (getSunStatus(orientation, checkDate) === 'shade') {
      return new Date(date.getTime() + offset - step);
    }
  }
  return null;
}

/**
 * Format a Date as "15h30"
 */
export function formatHour(date) {
  if (!date) return null;
  const h = date.getHours();
  const m = date.getMinutes();
  return `${h}h${m.toString().padStart(2, '0')}`;
}

/**
 * Get a human-readable tagline for the sun status
 */
export function getSunTagline(orientation, date) {
  const status = getSunStatus(orientation, date);

  if (status === 'sunny') {
    const until = getSunnyUntil(orientation, date);
    if (until) return `Plein soleil jusqu'à ${formatHour(until)}`;
    return 'Plein soleil';
  }

  if (status === 'partial') {
    const next = getNextSunnyWindow(orientation, date);
    if (next) return `Plein soleil vers ${formatHour(next)}`;
    return 'Mi-ombre';
  }

  const next = getNextSunnyWindow(orientation, date);
  if (next) return `Soleil dans ${Math.round((next - date) / 60000)} min`;

  const pos = SunCalc.getPosition(date, BRUSSELS_LAT, BRUSSELS_LNG);
  if (pos.altitude <= 0) return 'Après le coucher du soleil';
  return 'À l\'ombre';
}
