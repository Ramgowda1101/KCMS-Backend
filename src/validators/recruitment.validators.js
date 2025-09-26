// src/validators/recruitment.validators.js
const Joi = require("joi");

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message("Invalid id format");

const createRecruitmentSchema = Joi.object({
  club: objectId.required(),
  role: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().allow("").max(2000),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
}).custom((value, helpers) => {
  // ensure startDate < endDate
  if (new Date(value.startDate) >= new Date(value.endDate)) {
    return helpers.message("startDate must be before endDate");
  }
  return value;
});

const applyRecruitmentSchema = Joi.object({
  recruitmentId: objectId.required(),
});

const reviewApplicationSchema = Joi.object({
  applicationId: objectId.required(),
  status: Joi.string().valid("accepted", "rejected").required(),
  notes: Joi.string().allow("").max(2000),
});

module.exports = {
  createRecruitmentSchema,
  applyRecruitmentSchema,
  reviewApplicationSchema,
};
