const express = require("express");
const {
  getMyProfile,
  updateMyProfile,
  getAllUsers,
  updateUserRoles,
  deactivateUser,
} = require("../controllers/users.controller");

const protect = require("../middlewares/auth.middleware");
const { roleAuth } = require("../middlewares/permission.middleware");

const router = express.Router();

// Student
router.get("/me", protect, getMyProfile);
router.put("/me", protect, updateMyProfile);

// Admin only
router.get("/", protect, roleAuth("admin"), getAllUsers);
router.put("/:id/roles", protect, roleAuth("admin"), updateUserRoles);
router.put("/:id/deactivate", protect, roleAuth("admin"), deactivateUser);

module.exports = router;
