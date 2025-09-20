const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const Event = require("../models/event.model");
const EventRegistration = require("../models/eventRegistration.model");
const Club = require("../models/club.model");
const { successResponse, errorResponse } = require("../utils/responseHelper");
const { sendNotification } = require("../utils/notifications");

/**
 * Helper: check if a user is a core member of a club (by clubId and userId)
 * Returns boolean
 */
const isUserCoreOfClub = async (clubId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(clubId)) return false;
  const club = await Club.findById(clubId).select("coreMembers");
  if (!club) return false;
  // ensure ObjectId equality
  return club.coreMembers.some((m) => m.equals(userId));
};

/**
 * CREATE Event
 * Allowed roles: admin, club-coordinator, club-core
 * Note: core members are allowed only if they are core of the given club (validated below)
 */
exports.createEvent = asyncHandler(async (req, res) => {
  const { title, description, date, time, venue, posterUrl, club } = req.body;

  // Basic club existence check
  const clubDoc = await Club.findById(club);
  if (!clubDoc) return errorResponse(res, "Club not found", 404);

  // Role checks:
  if (req.user.roles.includes("admin") || req.user.roles.includes("club-coordinator")) {
    // allowed
  } else if (req.user.roles.includes("club-core")) {
    const isCore = await isUserCoreOfClub(club, req.user._id);
    if (!isCore) return errorResponse(res, "Forbidden: not a core member of this club", 403);
  } else {
    return errorResponse(res, "Forbidden: insufficient role to create event", 403);
  }

  // Create event
  const event = await Event.create({
    title,
    description,
    date,
    time,
    venue,
    posterUrl: posterUrl || "",
    club,
    createdBy: req.user._id,
  });

  // Trigger notification placeholder (async, not blocking)
  // recipients can be improved to send to club members or specific filters
  try {
    sendNotification(`New event: ${event.title} by ${clubDoc.name}`, { club: clubDoc._id });
  } catch (err) {
    // log and continue
    console.error("Notification error (non-fatal):", err.message);
  }

  return successResponse(res, "Event created successfully", { event }, 201);
});

/**
 * UPDATE Event
 * Allowed roles: admin, club-coordinator, club-core (core only for same club)
 */
exports.updateEvent = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(eventId)) return errorResponse(res, "Invalid event id", 400);

  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, "Event not found", 404);

  // Authorization: admin or club-coordinator can update any event;
  // club-core can update only if core of that club
  if (req.user.roles.includes("admin") || req.user.roles.includes("club-coordinator")) {
    // allowed
  } else if (req.user.roles.includes("club-core")) {
    const isCore = await isUserCoreOfClub(event.club, req.user._id);
    if (!isCore) return errorResponse(res, "Forbidden: you cannot update this event", 403);
  } else {
    return errorResponse(res, "Forbidden: insufficient role", 403);
  }

  // Apply allowed updates only (prevent changing createdBy, club)
  const allowedFields = ["title", "description", "date", "time", "venue", "posterUrl"];
  allowedFields.forEach((f) => {
    if (Object.prototype.hasOwnProperty.call(req.body, f)) {
      event[f] = req.body[f];
    }
  });

  await event.save();

  return successResponse(res, "Event updated successfully", { event });
});

/**
 * DELETE Event
 * Allowed roles: admin, club-coordinator
 * (Core members cannot delete)
 */
exports.deleteEvent = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(eventId)) return errorResponse(res, "Invalid event id", 400);

  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, "Event not found", 404);

  // Only admin or club-coordinator can delete
  if (!req.user.roles.includes("admin") && !req.user.roles.includes("club-coordinator")) {
    return errorResponse(res, "Forbidden: only Admin or Coordinator can delete events", 403);
  }

  await event.deleteOne();

  return successResponse(res, "Event deleted successfully");
});

/**
 * GET all events (public)
 */
exports.getAllEvents = asyncHandler(async (req, res) => {
  // optional query params: upcoming=true, clubId=...
  const filter = {};
  if (req.query.clubId && mongoose.Types.ObjectId.isValid(req.query.clubId)) {
    filter.club = req.query.clubId;
  }
  if (req.query.upcoming === "true") {
    filter.date = { $gte: new Date() };
  }

  const events = await Event.find(filter).populate("club", "name category").sort({ date: 1, time: 1 });
  return successResponse(res, "Events fetched successfully", { events });
});

/**
 * GET events by club (public)
 */
exports.getEventsByClub = asyncHandler(async (req, res) => {
  const clubId = req.params.clubId;
  if (!mongoose.Types.ObjectId.isValid(clubId)) return errorResponse(res, "Invalid club id", 400);

  const events = await Event.find({ club: clubId }).populate("club", "name category").sort({ date: 1, time: 1 });
  return successResponse(res, "Club events fetched successfully", { events });
});

/**
 * GET event by id (public)
 */
exports.getEventById = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(eventId)) return errorResponse(res, "Invalid event id", 400);

  const event = await Event.findById(eventId).populate("club", "name category");
  if (!event) return errorResponse(res, "Event not found", 404);

  return successResponse(res, "Event fetched successfully", { event });
});

/**
 * REGISTER for event (student)
 * Request body: { eventId }
 */
exports.registerForEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) return errorResponse(res, "Invalid event id", 400);

  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, "Event not found", 404);

  // Prevent non-students from registering (admins/coordinators/core can also register if desired,
  // but requirement was students register; enforce strictly if needed)
  if (!req.user.roles.includes("student")) {
    return errorResponse(res, "Only students can register for events", 403);
  }

  // Create registration; unique compound index in model prevents duplicates
  try {
    const registration = await EventRegistration.create({
      event: eventId,
      student: req.user._id,
    });

    return successResponse(res, "Registered for event successfully", { registration }, 201);
  } catch (err) {
    // handle duplicate key (already registered)
    if (err.code === 11000) {
      return errorResponse(res, "You have already registered for this event", 400);
    }
    throw err; // let global error handler handle other errors
  }
});

/**
 * GET registrations for event
 * Allowed: admin, club-coordinator, club-core (but core only for same club)
 */
exports.getRegistrations = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(eventId)) return errorResponse(res, "Invalid event id", 400);

  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, "Event not found", 404);

  // Authorization
  if (req.user.roles.includes("admin") || req.user.roles.includes("club-coordinator")) {
    // allowed
  } else if (req.user.roles.includes("club-core")) {
    const isCore = await isUserCoreOfClub(event.club, req.user._id);
    if (!isCore) return errorResponse(res, "Forbidden: cannot view registrations", 403);
  } else {
    return errorResponse(res, "Forbidden: cannot view registrations", 403);
  }

  const registrations = await EventRegistration.find({ event: eventId })
    .populate("student", "name roleNumber email")
    .populate("event", "title date");

  return successResponse(res, "Registrations fetched successfully", { registrations });
});
