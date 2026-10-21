import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zkm';
  try {
    await mongoose.connect(uri);
    console.log(`[ZKM Database] Connected to MongoDB at ${uri}`);
  } catch (error) {
    console.error('[ZKM Database] MongoDB connection failed:', error.message);
    process.exit(1);
  }
}
