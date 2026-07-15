import dotenvx from '@dotenvx/dotenvx';
dotenvx.config();

import express from 'express';
import cors from 'cors';

import { connectDB } from './src/config/db.js';
import Admin from './src/models/Admin.js';
import enquiryRoutes from './src/routes/enquiries.js';
import authRoutes from './src/routes/auth.js';
import roomRoutes from './src/routes/rooms.js';
import bookingRoutes from './src/routes/bookings.js';
import blockRoutes from './src/routes/blocks.js';
import { seedRooms } from './src/scripts/seedRooms.js';
import { paymentsEnabled } from './src/lib/razorpay.js';

const app = express();
const PORT = process.env.PORT || 3001;
// Production sets CORS_ORIGINS (per render.yaml); dev may set FRONTEND_ORIGIN.
// Either can be a comma-separated list of allowed site origins.
const FRONTEND = process.env.CORS_ORIGINS || process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

if (!process.env.JWT_SECRET) {
  console.error('✗ JWT_SECRET is not set. Copy .env.example to .env first.');
  process.exit(1);
}

// Render sits behind a proxy; without this the rate limiter sees one IP for everyone.
app.set('trust proxy', 1);

const allowed = FRONTEND.split(',').map((s) => s.trim()).filter(Boolean);
// Any localhost / 127.0.0.1 port is the developer's own machine — allow it in dev
// so a Vite server that lands on 5174 (because 5173 was taken) still reaches the API.
const isLocalhost = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowed.includes(origin) || isLocalhost(origin)) return cb(null, true);
      cb(new Error(`Origin ${origin} is not allowed.`));
    },
  })
);

app.use(express.json({ limit: '10kb' }));

app.get('/health', (req, res) =>
  res.json({ ok: true, service: 'amravti-fp-backend', time: new Date().toISOString() })
);

app.use('/api/enquiries', enquiryRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/blocks', blockRoutes);

app.use((req, res) => res.status(404).json({ message: 'No such endpoint.' }));
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(err.status || 500).json({ message: err.message || 'Something broke on our side.' });
});

/* Seed (or refresh) the admin account on boot, from .env. */
async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const name = process.env.ADMIN_NAME || 'Front Desk';
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) return;

  const passwordHash = await Admin.hash(password);
  await Admin.findOneAndUpdate(
    { email },
    { email, name, passwordHash },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`Seeded admin "${name}" (password: ${password})`);
}

connectDB()
  .then(async () => {
    await seedAdmin();
    await seedRooms();
    app.listen(PORT, () => {
      console.log(`✓ Server running → port ${PORT} (http://localhost:${PORT})`);
      console.log(`  Allowing frontend origin: ${FRONTEND}`);
      console.log(`  Payments: ${paymentsEnabled ? 'Razorpay (live keys set)' : 'off — booking = pay at desk'}`);
    });
  })
  .catch((err) => {
    console.error('✗ Could not reach MongoDB:', err.message);
    process.exit(1);
  });
