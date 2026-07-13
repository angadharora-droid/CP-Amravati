import mongoose from 'mongoose';

export const TOPICS = ['A stay', 'An event', 'Dining', 'Something else'];

const enquirySchema = new mongoose.Schema(
  {
    reference: { type: String, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    topic: { type: String, required: true, enum: TOPICS },
    contact: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, trim: true, maxlength: 600, default: '' },

    status: {
      type: String,
      enum: ['new', 'replied', 'archived'],
      default: 'new',
      index: true,
    },
    note: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true }
);

enquirySchema.pre('validate', function (next) {
  if (!this.reference) {
    // CP-XXXXXX — short enough to read out over the phone.
    const stamp = Date.now().toString(36).toUpperCase().slice(-4);
    const salt = Math.random().toString(36).toUpperCase().slice(2, 4);
    this.reference = `CP-${stamp}${salt}`;
  }
  next();
});

export default mongoose.model('Enquiry', enquirySchema);
