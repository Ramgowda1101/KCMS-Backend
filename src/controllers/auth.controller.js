const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/user.model");
const Session = require("../models/session.model");
const { successResponse, errorResponse } = require("../utils/responseHelper");

// Generate Access Token (JWT)
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, roleNumber: user.roleNumber, roles: user.roles },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
  );
};

// Generate Refresh Token (Random + store SHA256 + bcrypt in DB)
const generateRefreshToken = async (user, req) => {
  const refreshToken = crypto.randomBytes(40).toString("hex");

  // SHA256 for lookup
  const sha256Hash = crypto.createHash("sha256").update(refreshToken).digest("hex");

  // bcrypt for verification
  const bcryptHash = await bcrypt.hash(refreshToken, 10);

  // Save session
  await Session.create({
    user: user._id,
    sha256Hash,
    bcryptHash,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  return refreshToken;
};

// @desc Register user
exports.register = asyncHandler(async (req, res) => {
  const { name, roleNumber, email, password } = req.body;

  // Check duplicates
  const existingUser = await User.findOne({ $or: [{ roleNumber }, { email }] });
  if (existingUser) {
    return errorResponse(res, "User with this role number or email already exists", 400);
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Create user
  const user = await User.create({
    name,
    roleNumber,
    email,
    passwordHash,
    roles: ["student"],
    verificationStatus: "pending",
  });

  successResponse(
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

// @desc Login user
exports.login = asyncHandler(async (req, res) => {
  const { roleNumber, email, password } = req.body;

  // Allow login with either roleNumber or email
  const user = await User.findOne({
    $or: [{ roleNumber }, { email }],
  });

  if (!user) {
    return errorResponse(res, "Invalid credentials", 401);
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return errorResponse(res, "Invalid credentials", 401);
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user, req);

  successResponse(res, "Login successful", {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      roleNumber: user.roleNumber,
      email: user.email,
      roles: user.roles,
    },
  });
});

// @desc Refresh Access Token
exports.refreshToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) return errorResponse(res, "No refresh token provided", 401);

  // SHA256 lookup
  const sha256Hash = crypto.createHash("sha256").update(token).digest("hex");
  const session = await Session.findOne({ sha256Hash });

  if (!session || session.revokedAt) {
    return errorResponse(res, "Invalid or expired refresh token", 401);
  }

  // Verify with bcrypt
  const match = await bcrypt.compare(token, session.bcryptHash);
  if (!match) {
    return errorResponse(res, "Invalid refresh token", 401);
  }

  const user = await User.findById(session.user);
  if (!user) return errorResponse(res, "User not found", 404);

  // Issue new tokens
  const accessToken = generateAccessToken(user);
  const newRefreshToken = await generateRefreshToken(user, req);

  // Revoke old session
  session.revokedAt = new Date();
  await session.save();

  successResponse(res, "Token refreshed successfully", {
    accessToken,
    refreshToken: newRefreshToken,
  });
});

// @desc Logout user
exports.logout = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) return errorResponse(res, "No refresh token provided", 401);

  const sha256Hash = crypto.createHash("sha256").update(token).digest("hex");
  const session = await Session.findOne({ sha256Hash });

  if (session && session.user.toString() === req.user.id) {
    session.revokedAt = new Date();
    await session.save();
  }

  successResponse(res, "Logged out successfully");
});
