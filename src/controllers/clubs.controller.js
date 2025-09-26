// src/controllers/clubs.controller.js
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Club = require("../models/club.model");
const Media = require("../models/media.model");
const { successResponse, errorResponse } = require("../utils/responseHelper");
const { saveUploadedFile } = require("../services/storage.service");
const { enqueueNotification } = require("../queues/notification.producer");
const { logAudit } = require("../services/audit.service");

// Create a new club (Admin or coordinator)
exports.createClub = asyncHandler(async (req, res) => {
  const { name, description, category, facultyCoordinator } = req.body;

  const existingClub = await Club.findOne({ name });
  if (existingClub) {
    return errorResponse(res, "Club with this name already exists", 400);
  }

  // Validate facultyCoordinator if provided
  if (facultyCoordinator) {
    if (!mongoose.Types.ObjectId.isValid(facultyCoordinator)) return errorResponse(res, "Invalid facultyCoordinator id", 400);
    const fc = await User.findById(facultyCoordinator);
    if (!fc) return errorResponse(res, "Faculty coordinator user not found", 400);
  }

  // create new club; include creator as initial core member
  const club = await Club.create({
    name,
    description,
    category,
    facultyCoordinator: facultyCoordinator || null,
    createdBy: req.user.id,
    coreMembers: [req.user.id],
    status: "active",
  });

  // Save uploaded docs (if any)
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      await saveUploadedFile({
        filename: file.originalname,
        pathOnDisk: file.path,
        uploadedBy: req.user.id,
      }).then(async (media) => {
        media.relatedEntity = "club";
        media.relatedId = club._id;
        await media.save();
      });
    }
  }

  // audit
  await logAudit({
    actor: req.user.id,
    action: "club:create",
    resourceType: "Club",
    resourceId: club._id.toString(),
    after: { name, description, category, facultyCoordinator },
    reason: req.body.reason || "Club created",
  });

  // enqueue notification (non-blocking)
  try {
    await enqueueNotification({
      recipients: req.user.id.toString(),
      channel: "email",
      title: `Club created: ${club.name}`,
      message: `Your club "${club.name}" was created successfully.`,
      data: { clubId: club._id.toString() },
      createdBy: req.user.id,
    });
  } catch (err) {
    // non-fatal
    console.error("Notification enqueue error (non-fatal):", err && err.message ? err.message : err);
  }

  return successResponse(res, "Club created successfully", { club }, 201);
});

// Get all clubs (Public)
exports.getAllClubs = asyncHandler(async (req, res) => {
  const clubs = await Club.find().populate("coreMembers", "name roleNumber");
  return successResponse(res, "Clubs fetched successfully", { clubs });
});

// Get single club (Public)
exports.getClubById = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return errorResponse(res, "Invalid club id", 400);
  }
  const club = await Club.findById(req.params.id).populate("coreMembers", "name roleNumber");
  if (!club) return errorResponse(res, "Club not found", 404);
  return successResponse(res, "Club fetched successfully", { club });
});

// Update club (Admin or Core Members)
exports.updateClub = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return errorResponse(res, "Invalid club id", 400);
  }

  const club = await Club.findById(req.params.id);
  if (!club) return errorResponse(res, "Club not found", 404);

  // robust core-membership check
  const isCoreMember = Array.isArray(club.coreMembers) && club.coreMembers.some((m) => m && m.toString() === req.user.id);

  if (!req.user.roles.includes("admin") && !isCoreMember) {
    return errorResponse(res, "Forbidden: not allowed to update this club", 403);
  }

  // define allowed fields depending on role
  const adminAllowed = ["name", "description", "category", "facultyCoordinator", "visibility", "status", "recruitmentPolicy", "defaultRoles", "logoUrl", "tags", "metadata"];
  const coreAllowed = ["description", "logoUrl", "tags", "metadata"];

  const allowedFields = req.user.roles.includes("admin") ? adminAllowed : coreAllowed;

  const updates = {};
  allowedFields.forEach((f) => {
    if (Object.prototype.hasOwnProperty.call(req.body, f)) updates[f] = req.body[f];
  });

  if (Object.keys(updates).length === 0) {
    return errorResponse(res, "No valid fields provided to update", 400);
  }

  // If admin updates facultyCoordinator validate
  if (updates.facultyCoordinator) {
    if (!mongoose.Types.ObjectId.isValid(updates.facultyCoordinator)) return errorResponse(res, "Invalid facultyCoordinator id", 400);
    const fc = await User.findById(updates.facultyCoordinator);
    if (!fc) return errorResponse(res, "Faculty coordinator user not found", 400);
  }

  const before = {};
  Object.keys(updates).forEach((k) => {
    before[k] = club[k];
  });

  const updatedClub = await Club.findByIdAndUpdate(req.params.id, updates, { new: true });

  // audit
  await logAudit({
    actor: req.user.id,
    action: "club:update",
    resourceType: "Club",
    resourceId: updatedClub._id.toString(),
    before,
    after: updates,
    reason: req.body.reason || "Club updated",
  });

  // notify core members or creator (enqueue non-blocking)
  try {
    await enqueueNotification({
      recipients: { club: updatedClub._id.toString() },
      channel: "email",
      title: `Club updated: ${updatedClub.name}`,
      message: `Club "${updatedClub.name}" has been updated.`,
      data: { clubId: updatedClub._id.toString(), changes: updates },
      createdBy: req.user.id,
    });
  } catch (err) {
    console.error("Notification enqueue error (non-fatal):", err && err.message ? err.message : err);
  }

  return successResponse(res, "Club updated successfully", { club: updatedClub });
});

// Delete club (Admin or Coordinator) => soft-archive
exports.deleteClub = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return errorResponse(res, "Invalid club id", 400);
  }

  const club = await Club.findById(req.params.id);
  if (!club) return errorResponse(res, "Club not found", 404);

  // Allow Admin or Coordinator
  if (!req.user.roles.includes("admin") && !req.user.roles.includes("club-coordinator")) {
    return errorResponse(res, "Forbidden: only Admin or Coordinator can delete", 403);
  }

  const before = { status: club.status };
  // soft-archive
  club.status = "archived";
  club.archivedAt = new Date();
  await club.save();

  await logAudit({
    actor: req.user.id,
    action: "club:archive",
    resourceType: "Club",
    resourceId: club._id.toString(),
    before,
    after: { status: "archived", archivedAt: club.archivedAt },
    reason: req.body.reason || "Club archived by admin/coordinator",
  });

  // enqueue notifications to club core
  try {
    await enqueueNotification({
      recipients: { club: club._id.toString() },
      channel: "email",
      title: `Club archived: ${club.name}`,
      message: `The club '${club.name}' has been archived.`,
      data: { clubId: club._id.toString() },
      createdBy: req.user.id,
    });
  } catch (err) {
    console.error("Notification enqueue error (non-fatal):", err && err.message ? err.message : err);
  }

  return successResponse(res, "Club archived successfully", { club });
});
