const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    // Primary Identity
    roleNumber: {
      type: String,
      required: true,
      unique: true,
      match: [/^[0-9]{2}[Bb][Dd][A-Za-z0-9]{6}$/, 'Invalid KMIT Roll Number format'],
    },

    // Mandatory
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },

    // Optional
    phone: { type: String, minlength: 10, maxlength: 10 },
    department: { type: String, trim: true },
    batch: { type: String, trim: true },
    profilePhotoUrl: { type: String },

    // System
    roles: { type: [String], default: ['student'] }, // student, club-core, coordinator, admin
    verificationStatus: { type: String, enum: ['verified'], default: 'verified' },

    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
