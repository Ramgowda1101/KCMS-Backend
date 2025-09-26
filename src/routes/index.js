// src/routes/index.js
const express = require("express");
const router = express.Router();

// ===== Import feature routes =====
const authRoutes = require("./auth.routes");
const userRoutes = require("./users.routes");
const clubRoutes = require("./clubs.routes");
const eventRoutes = require("./events.routes");
const adminRoutes = require("./routes/admin.routes");
const recruitmentRoutes = require("./recruitments.routes");
const notificationsRoutes = require('./routes/notifications.routes');

// ===== Mount feature routes =====
router.use("/auth", authRoutes);             // /api/v1/auth/*
router.use("/users", userRoutes);            // /api/v1/users/*
router.use("/clubs", clubRoutes);            // /api/v1/clubs/*
router.use("/events", eventRoutes);          // /api/v1/events/*
router.use("/admin", adminRoutes);           // /api/v1/admin/*
router.use("/recruitments", recruitmentRoutes); // /api/v1/recruitments/*
app.use('/api/v1/notifications', notificationsRoutes);

// ===== Default / Fallback =====
router.get("/", (req, res) => {
  res.json({ message: "Welcome to KMIT Club Management System API v1 🚀" });
});

module.exports = router;
