// src/models/media.model.js
const mongoose = require("mongoose");

const mediaSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    mimetype: { type: String },
    size: { type: Number },

    storageType: {
      type: String,
      enum: ["local", "s3"],
      required: true,
    },
    storageKey: { type: String, required: true }, // local filesystem path or s3 key
    url: { type: String },

    hash: { type: String },

    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    status: {
      type: String,
      enum: ["pending", "scanned", "rejected"],
      default: "pending",
    },

    scanResult: { type: String, default: "" },
    scannedAt: { type: Date },

    relatedEntity: {
      type: String,
      enum: ["event", "club", "recruitment", null],
      default: null,
    },
    relatedId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

mediaSchema.index({ uploadedBy: 1, createdAt: -1 });
mediaSchema.index({ relatedEntity: 1, relatedId: 1 });

module.exports = mongoose.model("Media", mediaSchema);
