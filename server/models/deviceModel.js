import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    deviceId: {
      type: String,
      required: true,
    },
    fcmToken: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      enum: ['ios', 'android', 'web'],
      required: true,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Create a compound unique index on user and deviceId
deviceSchema.index({ user: 1, deviceId: 1 }, { unique: true });

const Device = mongoose.model('Device', deviceSchema);

export default Device; 