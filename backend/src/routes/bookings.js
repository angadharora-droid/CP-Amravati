import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import Booking, { BOOKING_STATUS, PAYMENT_STATUS } from '../models/Booking.js';
import RoomType from '../models/RoomType.js';
import { requireAdmin } from '../middleware/auth.js';
import { availabilityOne } from '../lib/availability.js';
import { toNight, today, nightsBetween } from '../lib/dates.js';
import { paymentsEnabled, publicKeyId, createOrder, verifySignature } from '../lib/razorpay.js';

const router = Router();

// Public writes get a lid, same as the enquiry form.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many attempts. Please call the desk on +91 92669 23456.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const MAX_NIGHTS = 30;
const MAX_ROOMS = 10;

/* Validate the search half of a booking and resolve the room type.
   Returns { error } or { room, checkIn, checkOut, nights, rooms, guests, quote }. */
async function resolveStay(body) {
  const checkIn = toNight(body.checkIn);
  const checkOut = toNight(body.checkOut);
  if (!checkIn || !checkOut) return { error: 'Please choose valid dates.' };
  if (checkIn < today()) return { error: 'Check-in cannot be in the past.' };
  if (checkOut <= checkIn) return { error: 'Check-out must be after check-in.' };

  const nights = nightsBetween(checkIn, checkOut);
  if (nights > MAX_NIGHTS) return { error: `Stays are limited to ${MAX_NIGHTS} nights online.` };

  const rooms = Math.max(1, Math.min(MAX_ROOMS, Number(body.rooms) || 1));
  const guests = Math.max(1, Number(body.guests) || 1);

  const query = body.roomTypeId && mongoose.isValidObjectId(body.roomTypeId)
    ? { _id: body.roomTypeId }
    : { slug: String(body.roomSlug || '').toLowerCase() };
  const room = await RoomType.findOne({ ...query, active: true }).lean();
  if (!room) return { error: 'That room is not available.' };

  const quote = await availabilityOne(room, checkIn, checkOut);
  if (quote.available < rooms) {
    return { error: quote.available > 0
      ? `Only ${quote.available} of these rooms are free for those dates.`
      : 'Those dates are fully booked for this room.' };
  }
  if (guests > room.maxOccupancy * rooms) {
    return { error: `That is too many guests for ${rooms} room(s) of this type.` };
  }

  return { room, checkIn, checkOut, nights, rooms, guests, quote };
}

/* ---------- PUBLIC: price a stay before committing ---------- */
router.post('/quote', limiter, async (req, res, next) => {
  try {
    const r = await resolveStay(req.body || {});
    if (r.error) return res.status(400).json({ message: r.error });
    res.json({
      room: { id: r.room._id, name: r.room.name, slug: r.room.slug },
      checkIn: req.body.checkIn,
      checkOut: req.body.checkOut,
      nights: r.nights,
      rooms: r.rooms,
      guests: r.guests,
      available: r.quote.available,
      ratePerNight: r.quote.avgPerNight,
      roomTotal: r.quote.roomTotal,
      total: r.quote.roomTotal * r.rooms,
      currency: 'INR',
    });
  } catch (err) {
    next(err);
  }
});

/* ---------- PUBLIC: create a booking ----------
   Payments live  → booking is `pending/unpaid` + a Razorpay order to pay against.
   Payments off   → booking is `confirmed/unpaid` (pay at the hotel desk). */
router.post('/', limiter, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.guestName || !b.email || !b.phone) {
      return res.status(400).json({ message: 'Your name, email and phone are required.' });
    }

    const r = await resolveStay(b);
    if (r.error) return res.status(400).json({ message: r.error });

    const total = r.quote.roomTotal * r.rooms;
    const booking = await Booking.create({
      roomType: r.room._id,
      roomName: r.room.name,
      guestName: String(b.guestName).trim(),
      email: String(b.email).trim(),
      phone: String(b.phone).trim(),
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      nights: r.nights,
      rooms: r.rooms,
      guests: r.guests,
      ratePerNight: r.quote.avgPerNight,
      totalAmount: total,
      requests: String(b.requests || '').trim(),
      status: paymentsEnabled ? 'pending' : 'confirmed',
      paymentStatus: 'unpaid',
    });

    if (!paymentsEnabled) {
      return res.status(201).json({
        paymentsEnabled: false,
        booking: publicBooking(booking),
        message: 'Reserved. Please pay at the hotel desk on arrival.',
      });
    }

    try {
      const order = await createOrder(total, booking.reference);
      booking.razorpay.orderId = order.id;
      await booking.save();
      res.status(201).json({
        paymentsEnabled: true,
        booking: publicBooking(booking),
        order: { id: order.id, amount: order.amount, currency: order.currency },
        keyId: publicKeyId,
      });
    } catch (payErr) {
      // Payment setup failed — don't leave a ghost holding inventory.
      await Booking.findByIdAndDelete(booking._id);
      console.error('[razorpay]', payErr.message);
      res.status(502).json({ message: 'Could not start the payment. Please try again.' });
    }
  } catch (err) {
    next(err);
  }
});

/* ---------- PUBLIC: confirm payment ---------- */
router.post('/verify', limiter, async (req, res, next) => {
  try {
    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ message: 'Unknown booking.' });
    }
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Unknown booking.' });

    const ok = booking.razorpay.orderId === razorpay_order_id &&
      verifySignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });

    if (!ok) {
      booking.paymentStatus = 'failed';
      await booking.save();
      return res.status(400).json({ message: 'Payment could not be verified.' });
    }

    booking.razorpay.paymentId = razorpay_payment_id;
    booking.razorpay.signature = razorpay_signature;
    booking.paymentStatus = 'paid';
    booking.status = 'confirmed';
    await booking.save();

    res.json({ booking: publicBooking(booking), message: 'Payment confirmed. You are booked.' });
  } catch (err) {
    next(err);
  }
});

/* ---------- ADMIN: list bookings ---------- */
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = status && status !== 'all' ? { status } : {};

    const [bookings, counts, revenue] = await Promise.all([
      Booking.find(filter).sort({ createdAt: -1 }).limit(300).lean(),
      Booking.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Booking.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
    ]);

    const tally = Object.fromEntries(BOOKING_STATUS.map((s) => [s, 0]));
    counts.forEach((c) => { tally[c._id] = c.n; });

    res.json({
      bookings,
      tally,
      total: Object.values(tally).reduce((a, b) => a + b, 0),
      paidRevenue: revenue[0]?.total || 0,
    });
  } catch (err) {
    next(err);
  }
});

/* ---------- ADMIN: update a booking ---------- */
router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { status, paymentStatus, note } = req.body || {};
    const update = {};
    if (status) {
      if (!BOOKING_STATUS.includes(status)) return res.status(400).json({ message: 'Unknown status.' });
      update.status = status;
    }
    if (paymentStatus) {
      if (!PAYMENT_STATUS.includes(paymentStatus)) return res.status(400).json({ message: 'Unknown payment status.' });
      update.paymentStatus = paymentStatus;
    }
    if (note !== undefined) update.note = String(note).slice(0, 500);

    const booking = await Booking.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).lean();
    if (!booking) return res.status(404).json({ message: 'No such booking.' });
    res.json(booking);
  } catch (err) {
    next(err);
  }
});

/* ---------- ADMIN: delete a booking ---------- */
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const gone = await Booking.findByIdAndDelete(req.params.id);
    if (!gone) return res.status(404).json({ message: 'No such booking.' });
    res.json({ message: 'Deleted.' });
  } catch (err) {
    next(err);
  }
});

// What the public API is allowed to see back (no internal note).
function publicBooking(b) {
  return {
    id: b._id,
    reference: b.reference,
    roomName: b.roomName,
    guestName: b.guestName,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    nights: b.nights,
    rooms: b.rooms,
    guests: b.guests,
    totalAmount: b.totalAmount,
    currency: b.currency,
    status: b.status,
    paymentStatus: b.paymentStatus,
  };
}

export default router;
