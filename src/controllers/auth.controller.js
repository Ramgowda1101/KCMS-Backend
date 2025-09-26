// src/controllers/auth.controller.js
const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const authService = require("../services/auth.service");
const { successResponse, errorResponse } = require("../utils/responseHelper");
const { logAudit } = require("../services/audit.service");
const { sendNotification } = require("../utils/notifications");

/**
 * Register user
 */
exports.register = asyncHandler(async (req, res) => {
  const { name, roleNumber, email, password } = req.body;

  // Validate duplicates
  const existingUser = await User.findOne({ $or: [{ roleNumber }, { email }] });
  if (existingUser) {
    return errorResponse(res, "User with this role number or email already exists", 400);
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Create user in pending verification state
  const user = await User.create({
    name,
    roleNumber,
    email,
    passwordHash,
    roles: ["student"],
    verificationStatus: "pending",
  });

  // Audit: user created (actor = system or creator)
  await logAudit({
    actor: user._id,
    action: "user:register",
    resourceType: "User",
    resourceId: user._id.toString(),
    after: { name: user.name, roleNumber: user.roleNumber, email: user.email },
    reason: "User registration",
  });

  // Send welcome / verification email (best-effort)
  try {
    await sendNotification("Welcome to KMIT Clubs! Please verify your account.", user._id.toString(), {
      channel: "email",
      title: "Welcome to KMIT Clubs",
      createdBy: user._id,
    });
  } catch (err) {
    // non-fatal
    console.error("Notification error (non-fatal):", err && err.message ? err.message : err);
  }

  return successResponse(
    res,
    "User registered successfully. Please verify your account.",
    {
      user: {
        id: user._id,
        name: user.name,
        roleNumber: user.roleNumber,
        email: user.email,
        roles: user.roles,
        verificationStatus: user.verificationStatus,
      },
    },
    201
  );
});

/**
 * Login user
 * Accepts roleNumber OR email and password.
 */
exports.login = asyncHandler(async (req, res) => {
  const { roleNumber, email, password } = req.body;

  // Find user by roleNumber or email
  const user = await User.findOne({ $or: [{ roleNumber }, { email }] });
  if (!user) return errorResponse(res, "Invalid credentials", 401);

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) return errorResponse(res, "Invalid credentials", 401);

  // Block deactivated or rejected accounts
  if (user.verificationStatus === "deactivated" || user.verificationStatus === "rejected") {
    return errorResponse(res, "Account is not active", 403);
  }

  // Optionally warn if pending verification (but allow login)
  const warnings = [];
  if (user.verificationStatus === "pending") {
    warnings.push("Account verification pending");
  }

  // Create tokens
  const accessToken = authService.createAccessToken(user);
  const refreshToken = await authService.createRefreshToken(user, req);

  // Audit login
  await logAudit({
    actor: user._id,
    action: "auth:login",
    resourceType: "User",
    resourceId: user._id.toString(),
    after: { roles: user.roles },
    reason: "User login",
  });

  return successResponse(res, "Login successful", {
    accessToken,
    refreshToken,
    warnings,
    user: {
      id: user._id,
      name: user.name,
      roleNumber: user.roleNumber,
      email: user.email,
      roles: user.roles,
    },
  });
});

/**
 * Refresh access token (rotate refresh token)
 */
exports.refreshToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) return errorResponse(res, "No refresh token provided", 401);

  try {
    const { accessToken, refreshToken } = await authService.rotateRefreshToken(token, req);
    return successResponse(res, "Token refreshed successfully", { accessToken, refreshToken });
  } catch (err) {
    return errorResponse(res, err.message || "Invalid refresh token", 401);
  }
});

/**
 * Logout (revoke a refresh token)
 * Expects protected route (req.user present)
 */
exports.logout = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) return errorResponse(res, "No refresh token provided", 400);

  const revoked = await authService.revokeRefreshToken(token, req.user.id);
  if (!revoked) return errorResponse(res, "Refresh token not found or not owned by user", 400);

  await logAudit({
    actor: req.user.id,
    action: "auth:logout",
    resourceType: "Session",
    resourceId: token.slice(0, 12), // avoid logging full token
    reason: "User logout",
  });

  return successResponse(res, "Logged out successfully");
});

/**
 * Forgot Password - generate reset token and notify user.
 * For security: always respond with success (avoid user enumeration).
 */
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email, roleNumber } = req.body;

  const user = await User.findOne({ $or: [{ email }, { roleNumber }] });
  if (user) {
    // Create reset token and notify
    const token = await authService.generatePasswordResetToken(user);

    // Send via notification/email (best-effort)
    try {
      await sendNotification("Password reset instructions", user._id.toString(), {
        channel: "email",
        title: "Password reset",
        data: { token },
        createdBy: null,
      });
      if (process.env.NODE_ENV === "development") {
        // dev fallback for convenience
        console.log("Password reset token (dev):", token);
      }
    } catch (err) {
      console.error("Notification error (non-fatal):", err && err.message ? err.message : err);
    }
  }

  // Always return success response to callers
  return successResponse(res, "If an account exists, password reset instructions have been sent.");
});

/**
 * Reset Password - verify token, update password, revoke sessions
 */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return errorResponse(res, "Token and newPassword are required", 400);

  try {
    const resetRecord = await authService.verifyPasswordResetToken(token);
    const user = await User.findById(resetRecord.user);
    if (!user) return errorResponse(res, "User not found", 404);

    // capture a minimal before snapshot (avoid storing raw hashes in audit)
    const before = { passwordSet: !!user.passwordHash };

    // update password
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    // mark reset used and revoke sessions
    await authService.markPasswordResetUsed(resetRecord);
    await authService.revokeAllSessionsForUser(user._id);

    await logAudit({
      actor: user._id,
      action: "auth:password-reset",
      resourceType: "User",
      resourceId: user._id.toString(),
      before,
      after: { passwordSet: true },
      reason: "Password reset via token",
    });

    // notify user
    try {
      await sendNotification("Your password has been changed", user._id.toString(), {
        channel: "email",
        title: "Password changed",
        createdBy: null,
      });
    } catch (err) {
      console.error("Notification error (non-fatal):", err && err.message ? err.message : err);
    }

    return successResponse(res, "Password reset successful. Please login again.");
  } catch (err) {
    return errorResponse(res, err.message || "Invalid or expired token", 400);
  }
});
