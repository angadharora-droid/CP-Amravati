import mongoose from 'mongoose';

export const BOOKING_STATUS = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];
export const PAYMENT_STATUS = ['unpaid', 'paid', 'refunded', 'failed'];

/* One reservation. `checkIn`/`checkOut` are stored at midnight UTC of the
   calendar date (nights, not moments) so overlap maths stays clean.
   A booking holds inventory while it is pending, confirmed or checked_in. */
const bookingSchema = new mongoose.Schema(
  {
    reference: { type: String, unique: true, index: true },

    roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true, index: true },
    roomName: { type: String, required: true }, // snapshot — survives a rename/delete of the type

    guestName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    phone: { type: String, required: true, trim: true, maxlength: 40 },

    checkIn: { type: Date, required: true, index: true },
    checkOut: { type: Date, required: true, index: true },
    nights: { type: Number, required: true, min: 1 },
    rooms: { type: Number, required: true, min: 1, default: 1 },
    guests: { type: Number, required: true, min: 1, default: 1 },

    ratePerNight: { type: Number, required: true, min: 0 }, // effective avg per room/night
    totalAmount: { type: Number, required: true, min: 0 },  // rooms × nights × rate, in ₹
    currency: { type: String, default: 'INR' },

    status: { type: String, enum: BOOKING_STATUS, default: 'pending', index: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUS, default: 'unpaid', index: true },

    razorpay: {
      orderId: { type: String, default: '' },
      paymentId: { type: String, default: '' },
      signature: { type: String, default: '' },
    },

    requests: { type: String, trim: true, maxlength: 600, default: '' }, // guest special requests
    note: { type: String, trim: true, maxlength: 500, default: '' },      // internal, staff-only
    source: { type: String, default: 'website' },
  },
  { timestamps: true }
);

bookingSchema.pre('validate', function (next) {
  if (!this.reference) {
    // BK-XXXXXX — short enough to read out over the phone.
    const stamp = Date.now().toString(36).toUpperCase().slice(-4);
    const salt = Math.random().toString(36).toUpperCase().slice(2, 4);
    this.reference = `BK-${stamp}${salt}`;
  }
  next();
});

export default mongoose.model('Booking', bookingSchema);
