const Joi = require("joi");

const roleNumberRegex = /^[0-9]{2}[Bb][Dd][A-Za-z0-9]{6}$/;

exports.registerSchema = Joi.object({
  name: Joi.string().min(3).max(50).required(),
  roleNumber: Joi.string().pattern(roleNumberRegex).required(),
  email: Joi.string().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Invalid email format",
  }),
  password: Joi.string().min(6).max(30).required(),
});

exports.loginSchema = Joi.object({
  roleNumber: Joi.string().pattern(roleNumberRegex).required(),
  password: Joi.string().required(),
});
