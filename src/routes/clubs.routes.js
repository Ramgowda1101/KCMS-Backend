const express = require("express");
const {
  createClub,
  getAllClubs,
  getClubById,
  updateClub,
  deleteClub,
} = require("../controllers/clubs.controller");

const validate = require("../middlewares/validate.middleware");
const { createClubSchema, updateClubSchema } = require("../validators/club.validators");
const protect = require("../middlewares/auth.middleware");
const roleAuth = require("../middlewares/role.middleware");

const router = express.Router();

// Public
router.get("/", getAllClubs);
router.get("/:id", getClubById);

// Admin or Coordinator can create/delete
router.post("/", protect, roleAuth("admin", "club-coordinator"), validate(createClubSchema), createClub);
router.delete("/:id", protect, roleAuth("admin", "club-coordinator"), deleteClub);

// Admin or Core Member can update
router.put("/:id", protect, updateClub); 

module.exports = router;
