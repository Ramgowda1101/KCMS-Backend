const Joi = require("joi");

exports.createClubSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().min(10).required(),
  category: Joi.string()
    .valid("technical", "cultural", "literary", "arts", "social")
    .required(),
  facultyCoordinator: Joi.string().min(3).required(),
});

exports.updateClubSchema = Joi.object({
  name: Joi.string().min(3).max(100),
  description: Joi.string().min(10),
  category: Joi.string().valid("technical", "cultural", "literary", "arts", "social"),
  facultyCoordinator: Joi.string().min(3),
  isActive: Joi.boolean(),
});
