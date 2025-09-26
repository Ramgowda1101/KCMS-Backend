// src/models/session.model.js
const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,               // link session to user
      index: true,
    },
    sha256Hash: {
      type: String,
      required: true,
      index: true,                  // fast lookup by sha256(token)
    },
    bcryptHash: {
      type: String,
      required: true,               // secure verification (bcrypt)
    },
    ip: { type: String, default: "" },     // optional for audit
    userAgent: { type: String, default: "" }, // optional for audit
    createdAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null }, // set when session revoked
  },
  { timestamps: true }
);

module.exports = mongoose.model("Session", sessionSchema);
