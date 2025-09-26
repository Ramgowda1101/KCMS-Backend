// src/services/auth.service.js
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const User = require("../models/user.model");
const Session = require("../models/session.model");
const PasswordReset = require("../models/passwordReset.model");

/* Access Token */
const createAccessToken = (user) => {
  const payload = { id: user._id.toString(), roleNumber: user.roleNumber || null, roles: user.roles || [] };
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  });
  return token;
};

/* Refresh Token */
const createRefreshToken = async (user, req = {}) => {
  const refreshToken = crypto.randomBytes(40).toString("hex");
  const sha256Hash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const bcryptHash = await bcrypt.hash(refreshToken, 10);

  await Session.create({
    user: user._id,
    sha256Hash,
    bcryptHash,
    ip: req.ip || "",
    userAgent: req.headers ? req.headers["user-agent"] || "" : "",
  });

  return refreshToken;
};

const verifyRefreshToken = async (token) => {
  const sha256Hash = crypto.createHash("sha256").update(token).digest("hex");
  const session = await Session.findOne({ sha256Hash });
  if (!session || session.revokedAt) throw new Error("Invalid or expired refresh token");
  const match = await bcrypt.compare(token, session.bcryptHash);
  if (!match) throw new Error("Invalid refresh token");

  const user = await User.findById(session.user);
  if (!user) throw new Error("User not found");
  return { session, user };
};

const rotateRefreshToken = async (token, req = {}) => {
  const { session, user } = await verifyRefreshToken(token);
  const accessToken = createAccessToken(user);
  const newRefreshToken = await createRefreshToken(user, req);
  session.revokedAt = new Date();
  await session.save();
  return { accessToken, refreshToken: newRefreshToken, user };
};

const revokeRefreshToken = async (token, userId = null) => {
  const sha256Hash = crypto.createHash("sha256").update(token).digest("hex");
  const session = await Session.findOne({ sha256Hash });
  if (!session || session.revokedAt) return false;
  if (userId && session.user.toString() !== userId.toString()) return false;
  session.revokedAt = new Date();
  await session.save();
  return true;
};

const revokeAllSessionsForUser = async (userId) => {
  await Session.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  return true;
};

const findSessionsByUser = async (userId) => {
  return Session.find({ user: userId }).sort({ createdAt: -1 });
};

/* Password Reset Token */
const generatePasswordResetToken = async (user, ttlMinutes = 15) => {
  const token = crypto.randomBytes(32).toString("hex");
  const sha256Hash = crypto.createHash("sha256").update(token).digest("hex");
  const bcryptHash = await bcrypt.hash(token, 10);

  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await PasswordReset.create({
    user: user._id,
    sha256Hash,
    bcryptHash,
    expiresAt,
  });

  return token;
};

const verifyPasswordResetToken = async (token) => {
  const sha256Hash = crypto.createHash("sha256").update(token).digest("hex");
  const resetRecord = await PasswordReset.findOne({ sha256Hash });
  if (!resetRecord) throw new Error("Invalid reset token");
  if (resetRecord.usedAt) throw new Error("Reset token already used");
  if (resetRecord.expiresAt < new Date()) throw new Error("Reset token expired");

  const match = await bcrypt.compare(token, resetRecord.bcryptHash);
  if (!match) throw new Error("Invalid reset token");

  return resetRecord;
};

const markPasswordResetUsed = async (resetRecord) => {
  resetRecord.usedAt = new Date();
  await resetRecord.save();
};

module.exports = {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllSessionsForUser,
  findSessionsByUser,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  markPasswordResetUsed,
};
