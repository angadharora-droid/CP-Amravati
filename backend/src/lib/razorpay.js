import crypto from 'crypto';
import Razorpay from 'razorpay';

const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

// Payments are "live" only when both keys are present. Without them the engine
// stays fully usable in development: bookings are created and the guest is asked
// to pay at the hotel desk (see routes/bookings.js), so nobody is blocked while
// the Razorpay account is still being set up.
export const paymentsEnabled = Boolean(KEY_ID && KEY_SECRET);

export const publicKeyId = KEY_ID;

const client = paymentsEnabled ? new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET }) : null;

/** Create a Razorpay order for a rupee amount. `amount` is in ₹ (whole rupees). */
export async function createOrder(amount, reference) {
  if (!client) throw new Error('Payments are not configured.');
  return client.orders.create({
    amount: Math.round(amount * 100), // paise
    currency: 'INR',
    receipt: reference,
    notes: { reference },
  });
}

/** Verify the signature Razorpay returns to the browser after a successful pay. */
export function verifySignature({ orderId, paymentId, signature }) {
  if (!KEY_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  // timing-safe compare, guarding against length mismatch
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
