import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  trip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['text', 'image', 'location'],
    default: 'text'
  },
  mediaUrl: {
    type: String,
    trim: true
  },
  location: {
    latitude: Number,
    longitude: Number
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);

export default Message; 