// src/models/notification.model.js
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    recipientMeta: {
      type: mongoose.Schema.Types.Mixed,
      default: null, // e.g., { type: "club", id: "..." } or { type: "all" }
    },
    channel: {
      type: String,
      enum: ["in-app", "email", "push", "sms"],
      default: "in-app",
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    error: { type: String, default: "" },
    sentAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // optionally store a job id for correlating with BullMQ jobs
    jobId: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

// Indexes for performance
notificationSchema.index({ recipient: 1, status: 1, createdAt: -1 });
notificationSchema.index({ status: 1, createdAt: -1 });

// TTL: keep notifications for 90 days (adjustable)
const TTL_DAYS = process.env.NOTIFICATION_TTL_DAYS ? parseInt(process.env.NOTIFICATION_TTL_DAYS, 10) : 90;
if (TTL_DAYS > 0) {
  notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: TTL_DAYS * 24 * 60 * 60 });
}

module.exports = mongoose.model("Notification", notificationSchema);
