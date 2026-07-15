/* Nights, not moments. Every date in the booking engine is snapped to midnight
   UTC of its calendar day, so a "night" is one whole day and overlap maths is
   just number comparison. */

/** Parse a YYYY-MM-DD (or ISO) string to midnight-UTC of that calendar date. */
export function toNight(value) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const m = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Today at midnight UTC. */
export function today() {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

/** Whole nights between two night-dates (checkOut − checkIn). */
export function nightsBetween(checkIn, checkOut) {
  return Math.round((checkOut - checkIn) / 86400000);
}

/** Every night in [from, to) as an array of midnight-UTC dates. */
export function eachNight(from, to) {
  const out = [];
  for (let t = from.getTime(); t < to.getTime(); t += 86400000) out.push(new Date(t));
  return out;
}

/** Do ranges [aIn, aOut) and [bIn, bOut) share at least one night? */
export function overlaps(aIn, aOut, bIn, bOut) {
  return aIn < bOut && aOut > bIn;
}
