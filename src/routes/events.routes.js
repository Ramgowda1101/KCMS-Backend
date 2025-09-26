// src/routes/events.routes.js
const express = require("express");
const router = express.Router();

const {
  createEvent,
  updateEvent,
  deleteEvent,
  getAllEvents,
  getEventsByClub,
  getEventById,
  registerForEvent,
  getRegistrations,
} = require("../controllers/events.controller");

const protect = require("../middlewares/auth.middleware");
const { roleAuth } = require("../middlewares/permission.middleware");
const validate = require("../middlewares/validate.middleware");
const { createEventSchema, updateEventSchema, registerEventSchema } = require("../validators/event.validators");

// Public
router.get("/", getAllEvents);
router.get("/club/:clubId", getEventsByClub);
router.get("/:id", getEventById);

// Protected
router.post("/", protect, roleAuth("admin", "club-coordinator", "club-core"), validate(createEventSchema), createEvent);
router.put("/:id", protect, roleAuth("admin", "club-coordinator", "club-core"), validate(updateEventSchema), updateEvent);
router.delete("/:id", protect, roleAuth("admin", "club-coordinator"), deleteEvent);
router.post("/register", protect, roleAuth("student"), validate(registerEventSchema), registerForEvent);
router.get("/:id/registrations", protect, roleAuth("admin", "club-coordinator", "club-core"), getRegistrations);

module.exports = router;
