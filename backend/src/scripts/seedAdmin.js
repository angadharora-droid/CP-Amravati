/**
 * Creates (or resets) the admin account.
 *   npm run seed:admin
 * Reads ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME from .env
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Admin from '../models/Admin.js';

const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD || '';
const name = process.env.ADMIN_NAME || 'Front Desk';

if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env, then run this again.');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Use a password of at least 8 characters.');
  process.exit(1);
}

await connectDB();

const passwordHash = await Admin.hash(password);
const admin = await Admin.findOneAndUpdate(
  { email },
  { email, name, passwordHash },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);

console.log(`[seed] admin ready → ${admin.email} (${admin.name})`);
await mongoose.disconnect();
