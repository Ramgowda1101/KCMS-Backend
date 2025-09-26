// src/routes/notifications.routes.js
const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth.middleware");
const { getMyNotifications, markAsRead } = require("../controllers/notifications.controller");

// All endpoints require authentication
router.get("/", protect, getMyNotifications);
router.post("/:id/read", protect, markAsRead);

module.exports = router;
