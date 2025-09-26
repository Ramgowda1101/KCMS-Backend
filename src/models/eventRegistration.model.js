const mongoose = require("mongoose");

const eventRegistrationSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    registeredAt: { type: Date, default: Date.now },

    // optional application flow fields
    status: { type: String, enum: ["registered", "shortlisted", "accepted", "rejected", "waitlisted"], default: "registered" },
    answers: { type: mongoose.Schema.Types.Mixed, default: {} }, // dynamic answers for custom forms
    source: { type: String, default: "web" }, // e.g., 'web', 'mobile'
  },
  { timestamps: true }
);

// Ensure student can only register once per event
eventRegistrationSchema.index({ event: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("EventRegistration", eventRegistrationSchema);
