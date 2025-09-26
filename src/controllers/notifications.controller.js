// src/controllers/notifications.controller.js
const asyncHandler = require("express-async-handler");
const Notification = require("../models/notification.model");
const mongoose = require("mongoose");
const { successResponse, errorResponse } = require("../utils/responseHelper");

/**
 * GET /api/v1/notifications
 * Query: page, limit, unreadOnly=true
 * Requires authentication (req.user)
 */
exports.getMyNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10)));
  const skip = (page - 1) * limit;
  const unreadOnly = req.query.unreadOnly === "true";

  const filter = { recipient: req.user.id };
  if (unreadOnly) filter.read = false;

  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
  ]);

  return successResponse(res, "Notifications fetched", {
    notifications: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * POST /api/v1/notifications/:id/read
 * Mark a notification as read (only owner)
 */
exports.markAsRead = asyncHandler(async (req, res) => {
  const id = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, "Invalid id", 400);

  const n = await Notification.findById(id);
  if (!n) return errorResponse(res, "Notification not found", 404);
  if (!n.recipient || n.recipient.toString() !== req.user.id) return errorResponse(res, "Forbidden", 403);

  n.read = true;
  await n.save();

  return successResponse(res, "Notification marked as read");
});
