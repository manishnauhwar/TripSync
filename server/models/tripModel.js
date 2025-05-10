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

const coordinatesSchema = new mongoose.Schema({
  lat: {
    type: Number,
    required: true
  },
  lon: {
    type: Number,
    required: true
  },
  displayName: {
    type: String
  }
}, { _id: false });

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
  coordinates: {
    type: coordinatesSchema,
    default: null
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

// No need to modify the Trip schema as documents will be stored in a separate collection
// with a reference to the trip ID. This allows for better scaling and performance.

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
  itinerary: [itineraryItemSchema],
  // We're not storing documents directly in the trip schema
  // Instead, documents will be queried from the Document collection using tripId
}, { timestamps: true });

const Trip = mongoose.model('Trip', tripSchema);

export default Trip;