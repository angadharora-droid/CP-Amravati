import { Router } from 'express';
import mongoose from 'mongoose';
import RateBlock from '../models/RateBlock.js';
import { requireAdmin } from '../middleware/auth.js';
import { toNight } from '../lib/dates.js';

const router = Router();

/* ---------- ADMIN: list close-outs and rate overrides ---------- */
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const blocks = await RateBlock.find()
      .populate('roomType', 'name')
      .sort({ from: 1 })
      .lean();
    res.json({ blocks });
  } catch (err) {
    next(err);
  }
});

/* ---------- ADMIN: add a close-out and/or rate override ---------- */
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const b = req.body || {};
    const from = toNight(b.from);
    const to = toNight(b.to);
    if (!from || !to || to <= from) {
      return res.status(400).json({ message: 'Give a valid date range (to must be after from).' });
    }

    const closed = Boolean(b.closed);
    const price = b.price === '' || b.price == null ? null : Math.max(0, Number(b.price));
    if (!closed && price == null) {
      return res.status(400).json({ message: 'Set a close-out, a price override, or both.' });
    }

    const roomType = b.roomType && mongoose.isValidObjectId(b.roomType) ? b.roomType : null;

    const block = await RateBlock.create({
      roomType,
      from,
      to,
      closed,
      price,
      label: String(b.label || '').trim(),
    });
    res.status(201).json(block);
  } catch (err) {
    next(err);
  }
});

/* ---------- ADMIN: remove ---------- */
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const gone = await RateBlock.findByIdAndDelete(req.params.id);
    if (!gone) return res.status(404).json({ message: 'No such block.' });
    res.json({ message: 'Deleted.' });
  } catch (err) {
    next(err);
  }
});

export default router;
