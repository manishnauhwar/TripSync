import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    const res = await mongoose.connect(process.env.MONGODB_URI);

    if (res.connection.readyState === 1) {
      console.log('✅ MongoDB Connected Successfully');
    }
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

export default connectDB;
