const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sha256Hash: {
      type: String,
      required: true,
      index: true, // fast lookup
    },
    bcryptHash: {
      type: String,
      required: true,
    },
    ip: String,
    userAgent: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
    revokedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Session", sessionSchema);
