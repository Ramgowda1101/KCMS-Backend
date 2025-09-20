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

const { protect } = require("../middlewares/auth.middleware");
const { roleAuth } = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");
const { createEventSchema, updateEventSchema, registerEventSchema } = require("../validations/event.validation");

// ================== Public ==================
// Get all events
router.get("/", getAllEvents);

// Get events by club
router.get("/club/:clubId", getEventsByClub);

// Get event by ID
router.get("/:id", getEventById);

// ================== Protected ==================
// Create Event (Admin, Coordinator, Core Member)
router.post(
  "/",
  protect,
  roleAuth("admin", "club-coordinator", "club-core"),
  validate(createEventSchema),
  createEvent
);

// Update Event (Admin, Coordinator, Core Member)
router.put(
  "/:id",
  protect,
  roleAuth("admin", "club-coordinator", "club-core"),
  validate(updateEventSchema),
  updateEvent
);

// Delete Event (Admin, Coordinator)
router.delete(
  "/:id",
  protect,
  roleAuth("admin", "club-coordinator"),
  deleteEvent
);

// Register for Event (Students only)
router.post(
  "/register",
  protect,
  roleAuth("student"),
  validate(registerEventSchema),
  registerForEvent
);

// Get registrations for event (Admin, Coordinator, Core Member of same club)
router.get(
  "/:id/registrations",
  protect,
  roleAuth("admin", "club-coordinator", "club-core"),
  getRegistrations
);

module.exports = router;
