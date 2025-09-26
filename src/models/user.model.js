// src/models/user.model.js
const mongoose = require("mongoose");

/*
  User schema - kept rich real-world fields to match WorkPlan:
  - name, email, roleNumber, passwordHash (kept your original naming)
  - roles: array of strings (student, club-core, club-coordinator, admin)
  - verificationStatus: pending/verified/rejected/deactivated
  - tokenVersion: for optional token invalidation (kept for compatibility)
  - isAdmin2FAEnabled, totpSecret: for admin 2FA support
*/
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,               // required for onboarding
      trim: true,                   // whitespace trimmed
    },
    email: {
      type: String,
      required: true,
      unique: true,                 // unique index for lookup
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"], // allow any valid email (no college-only restriction)
    },
    roleNumber: {
      type: String,
      required: true,
      unique: true,                 // unique student identifier
      // keep the roll number validation you used; adjust if pattern differs
      match: [/^[0-9]{2}[Bb][Dd][A-Za-z0-9]{6}$/, "Invalid role number"],
    },
    passwordHash: {
      type: String,
      required: true,               // stored hashed (bcrypt)
    },
    roles: {
      type: [String],
      default: ["student"],         // default role
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected", "deactivated"],
      default: "pending",           // important: do NOT default to verified
    },
    tokenVersion: {
      type: Number,
      default: 0,                   // optional - useful for global invalidation
    },
    isAdmin2FAEnabled: {
      type: Boolean,
      default: false,
    },
    totpSecret: {
      type: String,
      default: null,                // store encrypted in production
    },
    // add optional profile fields if you had them (keep compatibility)
    profilePhotoUrl: { type: String, default: "" },
    phone: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }             // createdAt, updatedAt
);

module.exports = mongoose.model("User", userSchema);
