const mongoose = require("mongoose");

const ClubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ["technical", "cultural", "literary", "arts", "social"],
      required: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Admin
    facultyCoordinator: { type: String, required: true },
    coreMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Club-core users
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Club", ClubSchema);
