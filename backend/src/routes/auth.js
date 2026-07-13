import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import Admin from '../models/Admin.js';
import { sign, requireAdmin } from '../middleware/auth.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many attempts. Wait fifteen minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password, please.' });
    }

    const admin = await Admin.findOne({ email: String(email).toLowerCase().trim() });

    // Same message either way — don't tell an attacker which half was wrong.
    if (!admin || !(await admin.verify(password))) {
      return res.status(401).json({ message: 'Those details do not match.' });
    }

    res.json({
      token: sign(admin),
      admin: { name: admin.name, email: admin.email },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ name: req.admin.name, email: req.admin.email });
});

export default router;
