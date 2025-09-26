// src/models/recruitmentApplication.model.js

const mongoose = require("mongoose");

const recruitmentApplicationSchema = new mongoose.Schema(
  {
    recruitment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recruitment",
      required: true,
    },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["applied", "accepted", "rejected"],
      default: "applied",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Ensure one student can only apply once per recruitment
recruitmentApplicationSchema.index({ recruitment: 1, applicant: 1 }, { unique: true });

module.exports = mongoose.model("RecruitmentApplication", recruitmentApplicationSchema);
