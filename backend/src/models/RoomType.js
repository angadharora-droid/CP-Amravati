import mongoose from 'mongoose';

/* A room category the hotel sells — the unit of inventory the booking engine
   counts against. `totalRooms` is how many physical rooms of this type exist;
   availability for a date range is that number minus overlapping bookings and
   minus any close-outs (see RateBlock). */
const roomTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 600, default: '' },

    size: { type: String, trim: true, maxlength: 40, default: '' }, // e.g. "250 sq ft"
    maxOccupancy: { type: Number, default: 2, min: 1, max: 12 },

    basePrice: { type: Number, required: true, min: 0 }, // per room, per night, in ₹
    totalRooms: { type: Number, required: true, min: 0 }, // stays in step with roomNumbers when those are set
    // The physical rooms, e.g. ['201','202']. Staff-only — never sent to the public site.
    roomNumbers: { type: [String], default: [] },

    image: { type: String, trim: true, default: '' }, // path under /images or /src/assets
    amenities: { type: [String], default: [] },

    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export default mongoose.model('RoomType', roomTypeSchema);
