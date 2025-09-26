// src/routes/recruitment.routes.js
const express = require("express");
const router = express.Router();
const validate = require("../middlewares/validate.middleware");
const { authorize } = require("../middlewares/permission.middleware");

const {
  createRecruitment,
  getAllRecruitments,
  applyToRecruitment,
  reviewApplication,
  exportApplicants,
} = require("../controllers/recruitment.controller");

const {
  createRecruitmentSchema,
  applyRecruitmentSchema,
  reviewApplicationSchema,
} = require("../validators/recruitment.validators");

// Create recruitment
router.post("/", authorize("recruitment:create"), validate(createRecruitmentSchema), createRecruitment);

// List recruitments (with pagination + filtering)
router.get("/", getAllRecruitments);

// Apply
router.post("/apply", authorize("recruitment:apply"), validate(applyRecruitmentSchema), applyToRecruitment);

// Review
router.post("/review", authorize("recruitment:review"), validate(reviewApplicationSchema), reviewApplication);

// Export applicants
router.get("/:id/applicants/export", authorize("recruitment:export"), exportApplicants);

module.exports = router;
