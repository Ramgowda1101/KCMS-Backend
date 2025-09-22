const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  register,
  login,
  refreshToken,
  logout,
} = require("../controllers/auth.controller");
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
} = require("../validators/auth.validators");

const router = express.Router();

// Register
router.post("/register", validate(registerSchema), register);

// Login (allow roleNumber OR email)
router.post("/login", validate(loginSchema), login);

// Refresh access token (uses refresh token in body)
router.post("/refresh-token", validate(refreshSchema), refreshToken);

// Logout (requires valid access token; also expects refresh token in body to revoke)
router.post("/logout", authMiddleware, validate(logoutSchema), logout);

module.exports = router;
