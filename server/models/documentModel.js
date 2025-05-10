import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Optional fields for additional metadata
  size: {
    type: Number
  },
  description: {
    type: String,
    trim: true
  }
}, { timestamps: true });

const Document = mongoose.model('Document', documentSchema);

export default Document;