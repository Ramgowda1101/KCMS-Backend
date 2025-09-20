const Joi = require("joi");

// ================== CREATE EVENT ==================
const createEventSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().min(10).max(1000).required(),
  date: Joi.date().iso().required(), // ISO format (yyyy-mm-dd)
  time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(), // HH:mm format
  venue: Joi.string().min(3).max(100).required(),
  posterUrl: Joi.string().uri().optional(),
  club: Joi.string().hex().length(24).required(), // MongoDB ObjectId
});

// ================== UPDATE EVENT ==================
const updateEventSchema = Joi.object({
  title: Joi.string().min(3).max(100).optional(),
  description: Joi.string().min(10).max(1000).optional(),
  date: Joi.date().iso().optional(),
  time: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  venue: Joi.string().min(3).max(100).optional(),
  posterUrl: Joi.string().uri().optional(),
});

// ================== REGISTER FOR EVENT ==================
const registerEventSchema = Joi.object({
  eventId: Joi.string().hex().length(24).required(),
});

module.exports = {
  createEventSchema,
  updateEventSchema,
  registerEventSchema,
};
