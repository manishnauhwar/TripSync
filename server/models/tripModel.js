import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  email: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'editor', 'viewer'],
    default: 'viewer'
  },
  status: {
    type: String,
    enum: ['invited', 'accepted', 'declined'],
    default: 'invited'
  }
}, { timestamps: true });

const itineraryItemSchema = new mongoose.Schema({
  day: {
    type: Number,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  order: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

const tripSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Trip name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [participantSchema],
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  itinerary: [itineraryItemSchema]
}, { timestamps: true });

const Trip = mongoose.model('Trip', tripSchema);

export default Trip; 