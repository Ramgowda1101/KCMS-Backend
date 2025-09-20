const asyncHandler = require("express-async-handler");
const User = require("../models/user.model");

// @desc Get own profile
exports.getMyProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("-passwordHash");
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  res.json({ success: true, user });
});

// @desc Update own profile
exports.updateMyProfile = asyncHandler(async (req, res) => {
  const updates = req.body;
  delete updates.roles; // Prevent role manipulation
  delete updates.verificationStatus;

  const user = await User.findByIdAndUpdate(req.user.id, updates, {
    new: true,
  }).select("-passwordHash");

  res.json({ success: true, user });
});

// @desc Get all users (Admin only)
exports.getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select("-passwordHash");
  res.json({ success: true, users });
});

// @desc Update user roles (Admin only)
exports.updateUserRoles = asyncHandler(async (req, res) => {
  const { roles } = req.body;
  if (!roles || !Array.isArray(roles)) {
    res.status(400);
    throw new Error("Roles must be an array");
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { roles },
    { new: true }
  ).select("-passwordHash");

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.json({ success: true, user });
});

// @desc Deactivate a user (Admin only)
exports.deactivateUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { verificationStatus: "deactivated" },
    { new: true }
  ).select("-passwordHash");

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.json({ success: true, user });
});
