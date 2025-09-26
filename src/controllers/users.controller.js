// src/controllers/users.controller.js
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const User = require("../models/user.model");
const Club = require("../models/club.model");
const rolesDef = require("../models/role.model");
const authService = require("../services/auth.service");
const { successResponse, errorResponse } = require("../utils/responseHelper");
const { logAudit } = require("../services/audit.service");
const { enqueueNotification } = require("../services/notification.service");

/**
 * Get own profile
 */
exports.getMyProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("-passwordHash");
  if (!user) return errorResponse(res, "User not found", 404);
  return successResponse(res, "Profile fetched successfully", { user });
});

/**
 * Update own profile
 */
exports.updateMyProfile = asyncHandler(async (req, res) => {
  const updates = { ...req.body };
  // Prevent elevation or dangerous edits
  delete updates.roles;
  delete updates.verificationStatus;
  delete updates.passwordHash;

  const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select("-passwordHash");
  if (!user) return errorResponse(res, "User not found", 404);

  // Audit profile update (lightweight)
  await logAudit({
    actor: req.user.id,
    action: "user:update-profile",
    resourceType: "User",
    resourceId: req.user.id,
    after: updates,
    reason: req.body.reason || "User updated own profile",
  });

  return successResponse(res, "Profile updated successfully", { user });
});

/**
 * Get all users (Admin only)
 */
exports.getAllUsers = asyncHandler(async (req, res) => {
  // add pagination later
  const users = await User.find().select("-passwordHash");
  return successResponse(res, "Users fetched successfully", { users });
});

/**
 * Update user roles (Admin only)
 */
exports.updateUserRoles = asyncHandler(async (req, res) => {
  const { roles } = req.body;
  if (!Array.isArray(roles)) return errorResponse(res, "Roles must be an array", 400);

  // Validate each role exists in role definitions
  for (const r of roles) {
    if (!rolesDef[r]) return errorResponse(res, `Invalid role: ${r}`, 400);
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return errorResponse(res, "Invalid user id", 400);

  // fetch current user to examine before state
  const targetUser = await User.findById(req.params.id);
  if (!targetUser) return errorResponse(res, "User not found", 404);

  // safeguard: prevent removing the last admin
  const removingAdmin = targetUser.roles.includes("admin") && !roles.includes("admin");
  if (removingAdmin) {
    const otherAdminCount = await User.countDocuments({
      roles: "admin",
      _id: { $ne: targetUser._id },
    });
    if (otherAdminCount === 0) {
      return errorResponse(res, "Operation would remove the last admin. Assign another admin first.", 400);
    }
  }

  const before = { roles: targetUser.roles };
  targetUser.roles = roles;
  await targetUser.save();

  // revoke all sessions for security (role change)
  try {
    await authService.revokeAllSessionsForUser(targetUser._id);
  } catch (err) {
    console.error("Failed to revoke sessions after role change:", err && err.message ? err.message : err);
  }

  // audit
  await logAudit({
    actor: req.user.id,
    action: "user:assign-role",
    resourceType: "User",
    resourceId: targetUser._id.toString(),
    before,
    after: { roles },
    reason: req.body.reason || "Role update from admin panel",
  });

  // notify affected user (enqueue)
  try {
    await enqueueNotification({
      recipients: targetUser._id.toString(),
      channel: "email",
      title: "Your account roles were updated",
      message: `Your roles were updated to: ${roles.join(", ")}`,
      data: { roles },
      createdBy: req.user.id,
    });
  } catch (err) {
    console.error("Notification enqueue error (non-fatal):", err && err.message ? err.message : err);
  }

  const user = await User.findById(req.params.id).select("-passwordHash");
  return successResponse(res, "User roles updated successfully", { user });
});

/**
 * Deactivate a user (Admin only)
 */
exports.deactivateUser = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return errorResponse(res, "Invalid user id", 400);

  const userBefore = await User.findById(req.params.id).select("verificationStatus");
  if (!userBefore) return errorResponse(res, "User not found", 404);

  const user = await User.findByIdAndUpdate(req.params.id, { verificationStatus: "deactivated" }, { new: true }).select("-passwordHash");

  // revoke sessions
  try {
    await authService.revokeAllSessionsForUser(user._id);
  } catch (err) {
    console.error("Failed to revoke sessions on deactivation:", err && err.message ? err.message : err);
  }

  // Remove user from any club coreMembers (cleanup)
  try {
    await Club.updateMany({ coreMembers: user._id }, { $pull: { coreMembers: user._id } });
  } catch (err) {
    console.error("Failed to remove user from club coreMembers during deactivation:", err && err.message ? err.message : err);
  }

  // audit
  await logAudit({
    actor: req.user.id,
    action: "user:deactivate",
    resourceType: "User",
    resourceId: user._id.toString(),
    before: { verificationStatus: userBefore.verificationStatus },
    after: { verificationStatus: "deactivated" },
    reason: req.body.reason || "Admin deactivated the account",
  });

  // notify user (enqueue)
  try {
    await enqueueNotification({
      recipients: user._id.toString(),
      channel: "email",
      title: "Your account has been deactivated",
      message: "An administrator has deactivated your account. Contact support for more information.",
      data: {},
      createdBy: req.user.id,
    });
  } catch (err) {
    console.error("Notification enqueue error (non-fatal):", err && err.message ? err.message : err);
  }

  const out = await User.findById(req.params.id).select("-passwordHash");
  return successResponse(res, "User deactivated successfully", { user: out });
});
