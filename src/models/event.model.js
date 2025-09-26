const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "Event title is required"], trim: true },
    description: { type: String, required: [true, "Event description is required"] },

    // date/time: date for day, startAt/endAt if needed later
    date: { type: Date, required: [true, "Event date is required"] },
    time: { type: String, required: [true, "Event time is required"] },
    startAt: Date,
    endAt: Date,

    venue: { type: String, required: [true, "Event venue is required"] },
    posterUrl: { type: String, default: "" },

    // link to the owning club
    club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: [true, "Event must belong to a club"] },

    // who created the event
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // workflow & approvals
    status: { type: String, enum: ["draft", "pending_approval", "approved", "cancelled", "completed"], default: "draft" },
    approvalPipeline: [
      {
        role: String,
        actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
        note: String,
        at: Date,
      },
    ],

    budgetEstimate: { type: Number, default: 0 },
    externalGuests: [{ name: String, affiliation: String }],
    attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Media" }], // require media model if used

    // post-event artifacts & attendance
    artifactsRequired: { type: Boolean, default: false },
    artifacts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Media" }],
    attendanceCount: { type: Number, default: 0 },

    cancellationReason: { type: String, default: "" },
    tags: { type: [String], default: [] },

    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// indexes for common queries
eventSchema.index({ club: 1, date: 1 });
eventSchema.index({ status: 1 });

module.exports = mongoose.model("Event", eventSchema);
