import { Router } from 'express';
import RoomType from '../models/RoomType.js';
import { requireAdmin } from '../middleware/auth.js';
import { availabilityFor } from '../lib/availability.js';
import { toNight, today, nightsBetween } from '../lib/dates.js';

const router = Router();

const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Accept room numbers as an array or a comma/space/newline-separated string.
const parseRoomNumbers = (v) => {
  const arr = Array.isArray(v) ? v : String(v || '').split(/[\s,]+/);
  return [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))].slice(0, 500);
};

/* ---------- PUBLIC: room types for the booking engine ----------
   With ?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD each type also carries
   { available, roomTotal, avgPerNight, nights } for that stay. */
router.get('/public', async (req, res, next) => {
  try {
    // roomNumbers is staff-only — never expose it to the public site.
    const types = await RoomType.find({ active: true })
      .select('-roomNumbers')
      .sort({ sortOrder: 1, basePrice: 1 })
      .lean();

    const checkIn = toNight(req.query.checkIn);
    const checkOut = toNight(req.query.checkOut);
    let stay = null;

    if (checkIn && checkOut && checkOut > checkIn && checkIn >= today()) {
      const avail = await availabilityFor(types, checkIn, checkOut);
      types.forEach((t) => {
        t.availability = avail.get(String(t._id));
      });
      stay = { checkIn: req.query.checkIn, checkOut: req.query.checkOut, nights: nightsBetween(checkIn, checkOut) };
    }

    res.json({ rooms: types, stay });
  } catch (err) {
    next(err);
  }
});

/* ---------- ADMIN: full list (incl. inactive) ---------- */
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const rooms = await RoomType.find().sort({ sortOrder: 1, name: 1 }).lean();
    res.json({ rooms });
  } catch (err) {
    next(err);
  }
});

/* ---------- ADMIN: create a room type ---------- */
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.name || b.basePrice == null || b.totalRooms == null) {
      return res.status(400).json({ message: 'Name, price and room count are required.' });
    }
    const slug = slugify(b.slug || b.name);
    if (await RoomType.exists({ slug })) {
      return res.status(409).json({ message: 'A room type with that name already exists.' });
    }

    const roomNumbers = b.roomNumbers !== undefined ? parseRoomNumbers(b.roomNumbers) : [];
    // If room numbers are listed, they define the count; otherwise trust totalRooms.
    const totalRooms = roomNumbers.length
      ? roomNumbers.length
      : Math.max(0, Number(b.totalRooms) || 0);

    const room = await RoomType.create({
      name: String(b.name).trim(),
      slug,
      description: String(b.description || '').trim(),
      size: String(b.size || '').trim(),
      maxOccupancy: Number(b.maxOccupancy) || 2,
      basePrice: Math.max(0, Number(b.basePrice) || 0),
      totalRooms,
      roomNumbers,
      image: String(b.image || '').trim(),
      amenities: Array.isArray(b.amenities) ? b.amenities.slice(0, 20) : [],
      sortOrder: Number(b.sortOrder) || 0,
      active: b.active !== false,
    });
    res.status(201).json(room);
  } catch (err) {
    next(err);
  }
});

/* ---------- ADMIN: edit a room type ---------- */
router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const b = req.body || {};
    const update = {};
    const fields = ['name', 'description', 'size', 'image'];
    fields.forEach((f) => { if (b[f] !== undefined) update[f] = String(b[f]).trim(); });
    if (b.maxOccupancy !== undefined) update.maxOccupancy = Number(b.maxOccupancy) || 1;
    if (b.basePrice !== undefined) update.basePrice = Math.max(0, Number(b.basePrice) || 0);
    if (b.totalRooms !== undefined) update.totalRooms = Math.max(0, Number(b.totalRooms) || 0);
    if (b.roomNumbers !== undefined) {
      update.roomNumbers = parseRoomNumbers(b.roomNumbers);
      update.totalRooms = update.roomNumbers.length; // the list is the source of truth for the count
    }
    if (b.sortOrder !== undefined) update.sortOrder = Number(b.sortOrder) || 0;
    if (b.active !== undefined) update.active = Boolean(b.active);
    if (Array.isArray(b.amenities)) update.amenities = b.amenities.slice(0, 20);
    if (b.slug) {
      const slug = slugify(b.slug);
      if (await RoomType.exists({ slug, _id: { $ne: req.params.id } })) {
        return res.status(409).json({ message: 'That slug is already in use.' });
      }
      update.slug = slug;
    }

    const room = await RoomType.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).lean();
    if (!room) return res.status(404).json({ message: 'No such room type.' });
    res.json(room);
  } catch (err) {
    next(err);
  }
});

/* ---------- ADMIN: delete a room type ----------
   Existing bookings keep a name snapshot, so history is not lost. */
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const gone = await RoomType.findByIdAndDelete(req.params.id);
    if (!gone) return res.status(404).json({ message: 'No such room type.' });
    res.json({ message: 'Deleted.' });
  } catch (err) {
    next(err);
  }
});

export default router;
