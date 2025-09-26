// src/controllers/recruitment.controller.js
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Recruitment = require("../models/recruitment.model");
const RecruitmentApplication = require("../models/recruitmentApplication.model");
const Club = require("../models/club.model");
const { successResponse, errorResponse } = require("../utils/responseHelper");
const { logAudit } = require("../services/audit.service");
const { enqueueNotification, enqueueExportJob } = require("../services/notification.service");
const { exportToCSV } = require("../services/export.service");

/**
 * Helper: check if a user is a core member of a club (by clubId and userId)
 */
const isUserCoreOfClub = async (clubId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(clubId)) return false;
  const club = await Club.findById(clubId).select("coreMembers status");
  if (!club) return false;
  if (club.status === "archived") return false;
  return Array.isArray(club.coreMembers) && club.coreMembers.some((m) => m && m.toString() === userId);
};

/**
 * Create a recruitment cycle
 */
exports.createRecruitment = asyncHandler(async (req, res) => {
  const { club, role, description, startDate, endDate } = req.body;

  if (!mongoose.Types.ObjectId.isValid(club)) return errorResponse(res, "Invalid club id", 400);

  const clubDoc = await Club.findById(club);
  if (!clubDoc) return errorResponse(res, "Club not found", 404);
  if (clubDoc.status === "archived") return errorResponse(res, "Cannot create recruitment for archived club", 400);

  // Role checks
  if (req.user.roles.includes("club-core")) {
    const isCore = await isUserCoreOfClub(club, req.user.id);
    if (!isCore) return errorResponse(res, "Forbidden: not a core member of this club", 403);
  } else if (!req.user.roles.includes("admin") && !req.user.roles.includes("club-coordinator")) {
    return errorResponse(res, "Forbidden: insufficient role to create recruitment", 403);
  }

  const recruitment = await Recruitment.create({
    club,
    role,
    description,
    startDate,
    endDate,
    createdBy: req.user.id,
    status: "scheduled",
  });

  await logAudit({
    actor: req.user.id,
    action: "recruitment:create",
    resourceType: "Recruitment",
    resourceId: recruitment._id.toString(),
    after: { club, role, startDate, endDate },
    reason: req.body.reason || "Recruitment created",
  });

  // enqueue notification (non-blocking)
  try {
    await enqueueNotification({
      recipients: { club: clubDoc._id.toString() },
      channel: "email",
      title: `Recruitment created for ${recruitment.role}`,
      message: `A recruitment cycle for "${recruitment.role}" was scheduled by ${clubDoc.name}.`,
      data: { recruitmentId: recruitment._id.toString(), clubId: clubDoc._id.toString() },
      createdBy: req.user.id,
    });
  } catch (err) {
    console.error("Notification enqueue error (non-fatal):", err && err.message ? err.message : err);
  }

  return successResponse(res, "Recruitment cycle created successfully", { recruitment }, 201);
});

/**
 * Get recruitments (with pagination + filtering)
 */
exports.getAllRecruitments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, clubId } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const filter = {};
  const user = req.user || null;

  // Status filter param allowed for admins/coordinators only
  if (status && ["scheduled", "open", "closed"].includes(status)) {
    if (user && (user.roles.includes("admin") || user.roles.includes("club-coordinator"))) {
      filter.status = status;
    }
  }

  // Club filter
  if (clubId && mongoose.Types.ObjectId.isValid(clubId)) {
    filter.club = clubId;
  }

  // Role-based view restrictions
  if (!user) {
    filter.status = "open";
  } else if (user.roles.includes("admin") || user.roles.includes("club-coordinator")) {
    // admin/coordinator can see all or as filtered above
  } else if (user.roles.includes("club-core")) {
    const clubs = await Club.find({ coreMembers: user.id }).select("_id");
    const clubIds = clubs.map((c) => c._id);
    filter.$or = [{ status: "open" }, { club: { $in: clubIds } }];
  } else {
    filter.status = "open";
  }

  const [recruitments, total] = await Promise.all([
    Recruitment.find(filter)
      .populate("club", "name category")
      .sort({ startDate: 1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Recruitment.countDocuments(filter),
  ]);

  return successResponse(res, "Recruitments fetched successfully", {
    recruitments,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * Apply to a recruitment (Students only)
 */
exports.applyToRecruitment = asyncHandler(async (req, res) => {
  const { recruitmentId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(recruitmentId)) return errorResponse(res, "Invalid recruitment id", 400);

  const recruitment = await Recruitment.findById(recruitmentId);
  if (!recruitment) return errorResponse(res, "Recruitment not found", 404);

  if (recruitment.status !== "open") return errorResponse(res, "Recruitment is not open", 400);

  if (!req.user.roles.includes("student")) return errorResponse(res, "Only students can apply to recruitments", 403);

  // pre-check to avoid duplicate DB error
  const existing = await RecruitmentApplication.findOne({ recruitment: recruitmentId, applicant: req.user.id });
  if (existing) return errorResponse(res, "You have already applied for this recruitment", 400);

  try {
    const application = await RecruitmentApplication.create({
      recruitment: recruitmentId,
      applicant: req.user.id,
    });

    await logAudit({
      actor: req.user.id,
      action: "recruitment:apply",
      resourceType: "RecruitmentApplication",
      resourceId: application._id.toString(),
      after: { recruitment: recruitmentId, applicant: req.user.id },
      reason: req.body.reason || "Applied to recruitment",
    });

    // notify club core/coordinator
    try {
      await enqueueNotification({
        recipients: { club: recruitment.club.toString() },
        channel: "email",
        title: `New application for ${recruitment.role}`,
        message: `A new application was submitted for ${recruitment.role}.`,
        data: { recruitmentId: recruitment._id.toString(), applicationId: application._id.toString() },
        createdBy: req.user.id,
      });
    } catch (err) {
      console.error("Notification enqueue error (non-fatal):", err && err.message ? err.message : err);
    }

    return successResponse(res, "Applied successfully", { application }, 201);
  } catch (err) {
    if (err.code === 11000) {
      return errorResponse(res, "You have already applied for this recruitment", 400);
    }
    throw err;
  }
});

/**
 * Review application (Admin, Coordinator, Club-Core for own club)
 */
exports.reviewApplication = asyncHandler(async (req, res) => {
  const { applicationId, status, notes } = req.body;

  if (!mongoose.Types.ObjectId.isValid(applicationId)) return errorResponse(res, "Invalid application id", 400);
  if (!["accepted", "rejected"].includes(status)) return errorResponse(res, "Invalid status", 400);

  const application = await RecruitmentApplication.findById(applicationId).populate("recruitment");
  if (!application) return errorResponse(res, "Application not found", 404);

  const recruitment = application.recruitment;
  if (!recruitment) return errorResponse(res, "Recruitment not found for this application", 404);

  // Role checks
  if (req.user.roles.includes("club-core")) {
    const isCore = await isUserCoreOfClub(recruitment.club, req.user.id);
    if (!isCore) return errorResponse(res, "Forbidden: not authorized to review this application", 403);
  } else if (!req.user.roles.includes("admin") && !req.user.roles.includes("club-coordinator")) {
    return errorResponse(res, "Forbidden: insufficient role to review", 403);
  }

  const before = { status: application.status, notes: application.notes };
  application.status = status;
  application.notes = notes || "";
  await application.save();

  await logAudit({
    actor: req.user.id,
    action: "recruitment:review",
    resourceType: "RecruitmentApplication",
    resourceId: application._id.toString(),
    before,
    after: { status: application.status, notes: application.notes },
    reason: req.body.reason || "Application reviewed",
  });

  // notify applicant
  try {
    await enqueueNotification({
      recipients: application.applicant.toString(),
      channel: "email",
      title: `Your application status: ${status}`,
      message: `Your application has been ${status}.`,
      data: { applicationId: application._id.toString(), status },
      createdBy: req.user.id,
    });
  } catch (err) {
    console.error("Notification enqueue error (non-fatal):", err && err.message ? err.message : err);
  }

  return successResponse(res, "Application reviewed successfully", { application });
});

/**
 * Export applicants of a recruitment (Admin, Coordinator, Club-core of own club)
 * For large exports we enqueue an export job; small datasets still return CSV directly.
 */
exports.exportApplicants = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, "Invalid recruitment id", 400);

  const recruitment = await Recruitment.findById(id).populate("club", "name");
  if (!recruitment) return errorResponse(res, "Recruitment not found", 404);

  // Role checks
  if (req.user.roles.includes("club-core")) {
    const isCore = await isUserCoreOfClub(recruitment.club._id, req.user.id);
    if (!isCore) return errorResponse(res, "Forbidden: not authorized to export applicants", 403);
  } else if (!req.user.roles.includes("admin") && !req.user.roles.includes("club-coordinator")) {
    return errorResponse(res, "Forbidden: insufficient role to export applicants", 403);
  }

  const total = await RecruitmentApplication.countDocuments({ recruitment: id });
  const EXPORT_THRESHOLD = parseInt(process.env.EXPORT_STREAM_THRESHOLD || "1000", 10);

  // If large, enqueue an export job and return 202 Accepted with job id
  if (total >= EXPORT_THRESHOLD) {
    const job = await enqueueExportJob({
      type: "recruitmentApplicants",
      recruitmentId: id,
      requestedBy: req.user.id,
    });

    await logAudit({
      actor: req.user.id,
      action: "recruitment:export",
      resourceType: "Recruitment",
      resourceId: recruitment._id.toString(),
      after: { queuedJobId: job.id },
      reason: req.body.reason || "Export queued",
    });

    return successResponse(res, "Export queued", { jobId: job.id }, 202);
  }

  // Otherwise small export: generate CSV and return directly
  const applications = await RecruitmentApplication.find({ recruitment: id })
    .populate("applicant", "name email roleNumber")
    .sort({ createdAt: 1 });

  const data = applications.map((app) => ({
    Name: app.applicant.name,
    Email: app.applicant.email || "",
    RoleNumber: app.applicant.roleNumber || "",
    Status: app.status,
    Notes: app.notes || "",
    AppliedAt: app.createdAt ? app.createdAt.toISOString() : "",
  }));

  const csv = await exportToCSV(data, `recruitment_${id}_applicants.csv`);

  // audit: small export read
  await logAudit({
    actor: req.user.id,
    action: "recruitment:export",
    resourceType: "Recruitment",
    resourceId: recruitment._id.toString(),
    after: { count: data.length },
    reason: req.body.reason || "Export generated",
  });

  res.header("Content-Type", "text/csv");
  res.attachment(`recruitment_${id}_applicants.csv`);
  return res.send(csv);
});
