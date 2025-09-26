// src/routes/admin.routes.js
const express = require("express");
const { ExpressAdapter } = require("@bull-board/express");
const { createBullBoard } = require("@bull-board/api");
const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");

const { queue } = require("../queues/notification.queue");
const { authorize } = require("../middlewares/permission.middleware");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

// Bull-board setup
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(queue)],
  serverAdapter,
});

// Protect with RBAC: only admins can view
router.use(
  "/queues",
  authMiddleware,
  authorize("admin:access"),
  serverAdapter.getRouter()
);

module.exports = router;
