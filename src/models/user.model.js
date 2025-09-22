const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      // Removed strict college email validation
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"],
    },
    roleNumber: {
      type: String,
      required: true,
      unique: true,
      match: [/^[0-9]{2}[Bb][Dd][A-Za-z0-9]{6}$/, "Invalid roll number"],
    },
    passwordHash: {
      type: String,
      required: true,
    },
    roles: {
      type: [String],
      default: ["student"], // basic role until upgraded
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected", "deactivated"],
      default: "pending",
    },
    tokenVersion: {
      type: Number,
      default: 0, // helps revoke refresh tokens
    },
    isAdmin2FAEnabled: {
      type: Boolean,
      default: false,
    },
    totpSecret: {
      type: String,
      default: null, // encrypted if enabled
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
