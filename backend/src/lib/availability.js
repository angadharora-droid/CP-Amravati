import Booking from '../models/Booking.js';
import RateBlock from '../models/RateBlock.js';
import { eachNight, nightsBetween, overlaps } from './dates.js';

// A pending (unpaid) booking holds its rooms for this long, then the inventory
// is treated as released so an abandoned checkout doesn't block the calendar.
const HOLD_MINUTES = 30;

// Statuses that occupy a room. `pending` only counts while the hold is fresh.
const OCCUPYING = ['confirmed', 'checked_in'];

/** Bookings that could occupy `roomIds` between `from` and `to`. */
async function loadBookings(roomIds, from, to) {
  const holdCutoff = new Date(Date.now() - HOLD_MINUTES * 60 * 1000);
  return Booking.find({
    roomType: { $in: roomIds },
    checkIn: { $lt: to },
    checkOut: { $gt: from },
    $or: [
      { status: { $in: OCCUPYING } },
      { status: 'pending', createdAt: { $gt: holdCutoff } },
    ],
  })
    .select('roomType checkIn checkOut rooms')
    .lean();
}

/** Blocks (close-outs / rate overrides) touching `roomIds` (or hotel-wide) in range. */
async function loadBlocks(roomIds, from, to) {
  return RateBlock.find({
    $or: [{ roomType: { $in: roomIds } }, { roomType: null }],
    from: { $lt: to },
    to: { $gt: from },
  }).lean();
}

/** How many rooms of `roomId` are held on a single `night`, from booking + block data. */
function heldOn(roomId, night, nextNight, bookings, blocks) {
  let held = 0;
  for (const b of bookings) {
    if (String(b.roomType) !== String(roomId)) continue;
    if (overlaps(b.checkIn, b.checkOut, night, nextNight)) held += b.rooms || 1;
  }
  for (const bl of blocks) {
    if (!bl.closed) continue;
    if (bl.roomType && String(bl.roomType) !== String(roomId)) continue;
    if (overlaps(bl.from, bl.to, night, nextNight)) held = Infinity; // whole type closed
  }
  return held;
}

/** The effective per-night price for `roomId` on `night` (override beats base). */
function priceOn(roomId, basePrice, night, nextNight, blocks) {
  let price = basePrice;
  let hotelWide = null;
  for (const bl of blocks) {
    if (bl.price == null) continue;
    if (!overlaps(bl.from, bl.to, night, nextNight)) continue;
    if (bl.roomType && String(bl.roomType) === String(roomId)) return bl.price; // most specific wins
    if (!bl.roomType) hotelWide = bl.price;
  }
  return hotelWide != null ? hotelWide : price;
}

/**
 * For each room type, how many rooms are bookable across the whole [checkIn, checkOut)
 * range and what the stay costs (one room). A room must be free every night to count.
 *
 * @returns Map<roomTypeId, { available, total, nights, roomTotal, avgPerNight }>
 */
export async function availabilityFor(types, checkIn, checkOut) {
  const roomIds = types.map((t) => t._id);
  const nights = nightsBetween(checkIn, checkOut);
  const [bookings, blocks] = await Promise.all([
    loadBookings(roomIds, checkIn, checkOut),
    loadBlocks(roomIds, checkIn, checkOut),
  ]);

  const nightsList = eachNight(checkIn, checkOut);
  const result = new Map();

  for (const t of types) {
    let minFree = t.totalRooms;
    let roomTotal = 0;

    for (const night of nightsList) {
      const next = new Date(night.getTime() + 86400000);
      const held = heldOn(t._id, night, next, bookings, blocks);
      const free = held === Infinity ? 0 : Math.max(0, t.totalRooms - held);
      if (free < minFree) minFree = free;
      roomTotal += priceOn(t._id, t.basePrice, night, next, blocks);
    }

    result.set(String(t._id), {
      available: minFree,
      total: t.totalRooms,
      nights,
      roomTotal,
      avgPerNight: Math.round(roomTotal / nights),
    });
  }

  return result;
}

/** Availability + pricing for a single already-loaded room type. */
export async function availabilityOne(type, checkIn, checkOut) {
  const map = await availabilityFor([type], checkIn, checkOut);
  return map.get(String(type._id));
}
