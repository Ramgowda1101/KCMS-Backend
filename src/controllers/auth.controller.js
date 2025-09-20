const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { successResponse, errorResponse } = require("../utils/responseHelper");

// @desc Register user
exports.register = asyncHandler(async (req, res) => {
  const { name, roleNumber, email, password } = req.body;

  // Check duplicates
  const existingUser = await User.findOne({ $or: [{ roleNumber }, { email }] });
  if (existingUser) {
    res.status(400);
    throw new Error('User with this role number or email already exists');
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Create user
  const user = await User.create({
    name,
    roleNumber,
    email,
    passwordHash,
    roles: ['student'],
    verificationStatus: 'verified',
  });

  // Token
  const token = jwt.sign(
    { id: user._id, roleNumber: user.roleNumber, roles: user.roles },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );

  successResponse(res, "User registered successfully", {
  token,
  user: {
    id: user._id,
    name: user.name,
    roleNumber: user.roleNumber,
    email: user.email,
    roles: user.roles,
    },
  }, 201);
});

// @desc Login user
exports.login = asyncHandler(async (req, res) => {
  const { roleNumber, password } = req.body;

  const user = await User.findOne({ roleNumber });
  if (!user) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  const token = jwt.sign(
    { id: user._id, roleNumber: user.roleNumber, roles: user.roles },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );

  successResponse(res, "User registered successfully", {
  token,
  user: {
    id: user._id,
    name: user.name,
    roleNumber: user.roleNumber,
    email: user.email,
    roles: user.roles,
    },
  }, 201);
});
