// src/controllers/events.controller.js
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const Event = require("../models/event.model");
const EventRegistration = require("../models/eventRegistration.model");
const Club = require("../models/club.model");
const Media = require("../models/media.model");
const { successResponse, errorResponse } = require("../utils/responseHelper");
const { logAudit } = require("../services/audit.service");
const { saveBuffer } = require("../services/storage.service");
const { enqueueNotification } = require("../services/notification.service");

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

exports.createEvent = asyncHandler(async (req, res) => {
  const { title, description, date, time, venue, posterUrl, club } = req.body;

  if (!mongoose.Types.ObjectId.isValid(club)) return errorResponse(res, "Invalid club id", 400);
  const clubDoc = await Club.findById(club);
  if (!clubDoc) return errorResponse(res, "Club not found", 404);

  // disallow actions on archived clubs
  if (clubDoc.status === "archived") return errorResponse(res, "Cannot create events for archived club", 400);

  // Role checks: admin, club-coordinator can create for any club; club-core only if core
  if (req.user.roles.includes("club-core")) {
    const isCore = await isUserCoreOfClub(club, req.user.id);
    if (!isCore) return errorResponse(res, "Forbidden: not a core member of this club", 403);
  } else if (!req.user.roles.includes("admin") && !req.user.roles.includes("club-coordinator")) {
    return errorResponse(res, "Forbidden: insufficient role to create event", 403);
  }

  // require at least one proposal document for production workflow
  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) {
    return errorResponse(res, "Event proposals/documents are required for submission", 400);
  }

  const event = await Event.create({
    title,
    description,
    date,
    time,
    venue,
    posterUrl: posterUrl || "",
    club,
    createdBy: req.user.id,
    status: "scheduled",
  });

  // Save each uploaded file via storage service
  for (const file of files) {
    await saveBuffer({
      originalName: file.originalname,
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
      relatedEntity: "event",
      relatedId: event._id,
      uploadedBy: req.user.id,
    });
  }

  // audit
  await logAudit({
    actor: req.user.id,
    action: "event:create",
    resourceType: "Event",
    resourceId: event._id.toString(),
    after: { title, description, date, time, venue, club },
    reason: req.body.reason || "New event created",
  });

  // enqueue notifications to club core / registrants later (non-blocking)
  try {
    await enqueueNotification({
      recipients: { club: clubDoc._id.toString() },
      channel: "email",
      title: `New event: ${event.title}`,
      message: `A new event "${event.title}" has been scheduled by ${clubDoc.name}.`,
      data: { eventId: event._id.toString(), clubId: clubDoc._id.toString() },
      createdBy: req.user.id,
    });
  } catch (err) {
    console.error("Notification enqueue error (non-fatal):", err && err.message ? err.message : err);
  }

  return successResponse(res, "Event created successfully", { event }, 201);
});

/**
 * Approve Event - only Admin or Club Coordinator
 * Checks that all related media are scanned and safe before approving.
 */
exports.approveEvent = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(eventId)) return errorResponse(res, "Invalid event id", 400);

  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, "Event not found", 404);

  // Only admin or club-coordinator can approve
  if (!req.user.roles.includes("admin") && !req.user.roles.includes("club-coordinator")) {
    return errorResponse(res, "Forbidden: insufficient role to approve events", 403);
  }

  // Ensure all related media for this event are scanned and safe
  const docs = await Media.find({ relatedEntity: "event", relatedId: event._id });
  const unsafe = docs.find((d) => d.status !== "scanned");
  if (unsafe) {
    return errorResponse(res, "Event cannot be approved: one or more documents are not yet scanned/approved", 400);
  }

  const before = { status: event.status };
  event.status = "approved";
  await event.save();

  await logAudit({
    actor: req.user.id,
    action: "event:approve",
    resourceType: "Event",
    resourceId: event._id.toString(),
    before,
    after: { status: event.status },
    reason: req.body.reason || "Event approved",
  });

  // enqueue notifications to club core and registrants
  await enqueueNotification({
    recipients: { club: event.club.toString() },
    channel: "email",
    title: `Event approved: ${event.title}`,
    message: `The event "${event.title}" has been approved.`,
    data: { eventId: event._id.toString() },
    createdBy: req.user.id,
  });

  return successResponse(res, "Event approved successfully", { event });
});

exports.updateEvent = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(eventId)) return errorResponse(res, "Invalid event id", 400);

  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, "Event not found", 404);

  // prevent modifications on cancelled events
  if (event.status === "cancelled") return errorResponse(res, "Cannot modify a cancelled event", 400);

  if (req.user.roles.includes("club-core")) {
    const isCore = await isUserCoreOfClub(event.club, req.user.id);
    if (!isCore) return errorResponse(res, "Forbidden: you cannot update this event", 403);
  } else if (!req.user.roles.includes("admin") && !req.user.roles.includes("club-coordinator")) {
    return errorResponse(res, "Forbidden: insufficient role", 403);
  }

  const allowedFields = ["title", "description", "date", "time", "venue", "posterUrl"];
  const before = {};
  allowedFields.forEach((f) => {
    if (Object.prototype.hasOwnProperty.call(req.body, f)) {
      before[f] = event[f];
      event[f] = req.body[f];
    }
  });

  if (Object.keys(before).length === 0) {
    return errorResponse(res, "No valid fields provided to update", 400);
  }

  await event.save();

  const after = {};
  Object.keys(before).forEach((k) => (after[k] = event[k]));
  await logAudit({
    actor: req.user.id,
    action: "event:update",
    resourceType: "Event",
    resourceId: event._id.toString(),
    before,
    after,
    reason: req.body.reason || "Event updated",
  });

  // notify core/registrants (enqueue)
  try {
    await enqueueNotification({
      recipients: { club: event.club.toString() },
      channel: "email",
      title: `Event updated: ${event.title}`,
      message: `Event "${event.title}" has been updated.`,
      data: { eventId: event._id.toString() },
      createdBy: req.user.id,
    });
  } catch (err) {
    console.error("Notification enqueue error (non-fatal):", err && err.message ? err.message : err);
  }

  return successResponse(res, "Event updated successfully", { event });
});

exports.deleteEvent = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(eventId)) return errorResponse(res, "Invalid event id", 400);

  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, "Event not found", 404);

  if (!req.user.roles.includes("admin") && !req.user.roles.includes("club-coordinator")) {
    return errorResponse(res, "Forbidden: only Admin or Coordinator can delete events", 403);
  }

  const before = { status: event.status };
  event.status = "cancelled";
  event.cancellationReason = req.body.cancellationReason || "";
  await event.save();

  await logAudit({
    actor: req.user.id,
    action: "event:cancel",
    resourceType: "Event",
    resourceId: event._id.toString(),
    before,
    after: { status: event.status, cancellationReason: event.cancellationReason },
    reason: req.body.reason || "Event cancelled",
  });

  // notify registrants/core (enqueue)
  try {
    await enqueueNotification({
      recipients: { club: event.club.toString() },
      channel: "email",
      title: `Event cancelled: ${event.title}`,
      message: `Event "${event.title}" has been cancelled.`,
      data: { eventId: event._id.toString() },
      createdBy: req.user.id,
    });
  } catch (err) {
    console.error("Notification enqueue error (non-fatal):", err && err.message ? err.message : err);
  }

  return successResponse(res, "Event cancelled successfully");
});

exports.getAllEvents = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.clubId && mongoose.Types.ObjectId.isValid(req.query.clubId)) filter.club = req.query.clubId;
  if (req.query.upcoming === "true") filter.date = { $gte: new Date() };

  const events = await Event.find(filter).populate("club", "name category").sort({ date: 1, time: 1 });
  return successResponse(res, "Events fetched successfully", { events });
});

exports.getEventsByClub = asyncHandler(async (req, res) => {
  const clubId = req.params.clubId;
  if (!mongoose.Types.ObjectId.isValid(clubId)) return errorResponse(res, "Invalid club id", 400);

  const events = await Event.find({ club: clubId }).populate("club", "name category").sort({ date: 1, time: 1 });
  return successResponse(res, "Club events fetched successfully", { events });
});

exports.getEventById = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(eventId)) return errorResponse(res, "Invalid event id", 400);

  const event = await Event.findById(eventId).populate("club", "name category");
  if (!event) return errorResponse(res, "Event not found", 404);

  return successResponse(res, "Event fetched successfully", { event });
});

exports.registerForEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) return errorResponse(res, "Invalid event id", 400);

  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, "Event not found", 404);

  // disallow registrations for cancelled events
  if (event.status === "cancelled") return errorResponse(res, "Event is cancelled", 400);

  // Enforce student-only registration
  if (!req.user.roles.includes("student")) {
    return errorResponse(res, "Only students can register for events", 403);
  }

  // Optional pre-check to avoid duplicate attempt error
  const existing = await EventRegistration.findOne({ event: eventId, student: req.user.id });
  if (existing) return errorResponse(res, "You have already registered for this event", 400);

  try {
    const registration = await EventRegistration.create({
      event: eventId,
      student: req.user.id,
    });

    await logAudit({
      actor: req.user.id,
      action: "event:register",
      resourceType: "EventRegistration",
      resourceId: registration._id.toString(),
      after: { event: eventId, student: req.user.id },
      reason: req.body.reason || "Student registered for event",
    });

    // enqueue confirmation to student
    try {
      await enqueueNotification({
        recipients: req.user.id.toString(),
        channel: "email",
        title: `Registered for event: ${event.title}`,
        message: `You are registered for "${event.title}"`,
        data: { eventId: event._id.toString() },
        createdBy: req.user.id,
      });
    } catch (err) {
      console.error("Notification enqueue error (non-fatal):", err && err.message ? err.message : err);
    }

    return successResponse(res, "Registered for event successfully", { registration }, 201);
  } catch (err) {
    // fallback duplicate error handling
    if (err.code === 11000) {
      return errorResponse(res, "You have already registered for this event", 400);
    }
    throw err;
  }
});

exports.getRegistrations = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(eventId)) return errorResponse(res, "Invalid event id", 400);

  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, "Event not found", 404);

  if (req.user.roles.includes("club-core")) {
    const isCore = await isUserCoreOfClub(event.club, req.user.id);
    if (!isCore) return errorResponse(res, "Forbidden: cannot view registrations", 403);
  } else if (!req.user.roles.includes("admin") && !req.user.roles.includes("club-coordinator")) {
    return errorResponse(res, "Forbidden: cannot view registrations", 403);
  }

  const registrations = await EventRegistration.find({ event: eventId })
    .populate("student", "name roleNumber email")
    .populate("event", "title date");

  return successResponse(res, "Registrations fetched successfully", { registrations });
});
