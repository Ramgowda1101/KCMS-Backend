const mongoose = require("mongoose");

const ClubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["technical", "cultural", "literary", "arts", "social"],
      required: true,
    },

    // who created the club (admin or coordinator)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // faculty coordinator stored as a user reference (workplan expects id ref)
    facultyCoordinator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // members who are core of this club
    coreMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // visibility and lifecycle fields
    visibility: { type: String, enum: ["public", "private"], default: "public" },
    status: { type: String, enum: ["active", "pending", "archived", "deleted"], default: "active" },
    isActive: { type: Boolean, default: true },
    archivedAt: { type: Date, default: null },

    // recruitment policy & scheduling
    recruitmentPolicy: {
      enabled: { type: Boolean, default: false },
      startAt: Date,
      endAt: Date,
      formSchema: { type: Object, default: {} }, // JSON Schema for custom application forms
    },

    // default roles & metadata
    defaultRoles: { type: [String], default: ["member"] },
    logoUrl: { type: String, default: "" },
    tags: { type: [String], default: [] },

    // free metadata field for NAAC / attributes
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// indexes for common queries
ClubSchema.index({ name: 1 });
ClubSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model("Club", ClubSchema);
