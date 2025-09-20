const asyncHandler = require("express-async-handler");
const Club = require("../models/club.model");
const { successResponse, errorResponse } = require("../utils/responseHelper");

// @desc Create a new club (Admin or coordinator)
exports.createClub = asyncHandler(async (req, res) => {
  const { name, description, category, facultyCoordinator } = req.body;

  const existingClub = await Club.findOne({ name });
  if (existingClub) {
    return errorResponse(res, "Club with this name already exists", 400);
  }

  const club = await Club.create({
    name,
    description,
    category,
    facultyCoordinator,
    createdBy: req.user._id,
  });

  return successResponse(res, "Club created successfully", { club }, 201);
});

// @desc Get all clubs (Public)
exports.getAllClubs = asyncHandler(async (req, res) => {
  const clubs = await Club.find().populate("coreMembers", "name roleNumber");
  return successResponse(res, "Clubs fetched successfully", { clubs });
});

// @desc Get single club (Public)
exports.getClubById = asyncHandler(async (req, res) => {
  const club = await Club.findById(req.params.id).populate("coreMembers", "name roleNumber");
  if (!club) {
    return errorResponse(res, "Club not found", 404);
  }
  return successResponse(res, "Club fetched successfully", { club });
});

// @desc Update club (Admin or Core Members)
exports.updateClub = asyncHandler(async (req, res) => {
  const club = await Club.findById(req.params.id);
  if (!club) {
    return errorResponse(res, "Club not found", 404);
  }

  // Only admin or core members of this club
  if (!req.user.roles.includes("admin") && !club.coreMembers.includes(req.user._id)) {
    return errorResponse(res, "Forbidden: not allowed to update this club", 403);
  }

  const updates = req.body;
  const updatedClub = await Club.findByIdAndUpdate(req.params.id, updates, { new: true });

  return successResponse(res, "Club updated successfully", { club: updatedClub });
});

// @desc Delete club (Admin or Coordinator)
exports.deleteClub = asyncHandler(async (req, res) => {
  const club = await Club.findById(req.params.id);
  if (!club) {
    return errorResponse(res, "Club not found", 404);
  }

  // Allow Admin or Coordinator
  if (!req.user.roles.includes("admin") && !req.user.roles.includes("club-coordinator")) {
    return errorResponse(res, "Forbidden: only Admin or Coordinator can delete", 403);
  }

  await club.deleteOne();
  return successResponse(res, "Club deleted successfully");
});