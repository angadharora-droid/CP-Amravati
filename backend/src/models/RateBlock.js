import mongoose from 'mongoose';

/* A date range that changes what the booking engine does, for one room type or
   for the whole hotel (roomType = null). Two uses, not mutually exclusive:

   - `closed: true`  → close-out. Those rooms cannot be booked in the range.
   - `price` set      → rate override. That price per night replaces the base
                        rate for nights inside the range (seasonal / event pricing).

   The range is [from, to) by night: `from` is the first affected night,
   `to` is the morning the guest would leave (exclusive), matching how a
   booking's checkOut works. */
const rateBlockSchema = new mongoose.Schema(
  {
    roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', default: null, index: true },
    from: { type: Date, required: true, index: true },
    to: { type: Date, required: true, index: true },

    closed: { type: Boolean, default: false },
    price: { type: Number, default: null, min: 0 }, // null → no override

    label: { type: String, trim: true, maxlength: 120, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('RateBlock', rateBlockSchema);
