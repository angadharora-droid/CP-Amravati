import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/centrepoint_amravati';

  mongoose.connection.on('connected', () => console.log('✓ MongoDB connected'));
  mongoose.connection.on('error', (err) => console.error('✗ MongoDB error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('✗ MongoDB disconnected'));

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
}
