const Joi = require("joi");

// Keep roleNumber pattern same as your model
const roleNumberPattern = /^[0-9]{2}[Bb][Dd][A-Za-z0-9]{6}$/;

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  roleNumber: Joi.string().pattern(roleNumberPattern).required()
    .messages({ "string.pattern.base": "Invalid role number format" }),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(128).required(),
});

const loginSchema = Joi.object({
  roleNumber: Joi.string().pattern(roleNumberPattern).optional()
    .messages({ "string.pattern.base": "Invalid role number format" }),
  email: Joi.string().email().optional(),
  password: Joi.string().min(6).required(),
}).or("roleNumber", "email") // require at least one of roleNumber or email
  .messages({ "object.missing": "Provide either roleNumber or email to login" });

const refreshSchema = Joi.object({
  token: Joi.string().required().messages({ "any.required": "Refresh token is required" }),
});

const logoutSchema = Joi.object({
  token: Joi.string().required().messages({ "any.required": "Refresh token is required" }),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
};
