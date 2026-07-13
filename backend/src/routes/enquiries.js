import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import Enquiry, { TOPICS } from '../models/Enquiry.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// The public form is the only unauthenticated write on the API, so it gets a lid.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { message: 'Too many messages. Please call the desk on +91 721 222 2222.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/* ---------- PUBLIC: send an enquiry ---------- */
router.post('/', limiter, async (req, res, next) => {
  try {
    const { name, topic, contact, message } = req.body;

    if (!name || !topic || !contact) {
      return res.status(400).json({ message: 'Please finish the sentence.' });
    }
    if (!TOPICS.includes(topic)) {
      return res.status(400).json({ message: 'Unknown topic.' });
    }

    const enquiry = await Enquiry.create({
      name: String(name).trim(),
      topic,
      contact: String(contact).trim(),
      message: String(message || '').trim(),
    });

    res.status(201).json({
      reference: enquiry.reference,
      message: 'Enquiry received.',
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'That does not look right. Please check and resend.' });
    }
    next(err);
  }
});

/* ---------- ADMIN: the inbox ---------- */
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = status && status !== 'all' ? { status } : {};

    const [enquiries, counts] = await Promise.all([
      Enquiry.find(filter).sort({ createdAt: -1 }).limit(200).lean(),
      Enquiry.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);

    const tally = { new: 0, replied: 0, archived: 0 };
    counts.forEach((c) => (tally[c._id] = c.n));

    res.json({
      enquiries,
      tally,
      total: tally.new + tally.replied + tally.archived,
    });
  } catch (err) {
    next(err);
  }
});

/* ---------- ADMIN: mark replied / archived, add a note ---------- */
router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const update = {};

    if (status) {
      if (!['new', 'replied', 'archived'].includes(status)) {
        return res.status(400).json({ message: 'Unknown status.' });
      }
      update.status = status;
    }
    if (note !== undefined) update.note = String(note).slice(0, 500);

    const enquiry = await Enquiry.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).lean();

    if (!enquiry) return res.status(404).json({ message: 'No such enquiry.' });
    res.json(enquiry);
  } catch (err) {
    next(err);
  }
});

/* ---------- ADMIN: delete ---------- */
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const gone = await Enquiry.findByIdAndDelete(req.params.id);
    if (!gone) return res.status(404).json({ message: 'No such enquiry.' });
    res.json({ message: 'Deleted.' });
  } catch (err) {
    next(err);
  }
});

export default router;
