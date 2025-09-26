const jwt = require("jsonwebtoken");
const { errorResponse } = require("../utils/responseHelper");

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(res, "No token provided", 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // attach canonical user shape for controllers: both id and _id present
    req.user = {
      id: decoded.id,
      _id: decoded.id,
      roleNumber: decoded.roleNumber || null,
      roles: decoded.roles || [],
    };

    next();
  } catch (err) {
    return errorResponse(res, "Invalid or expired token", 401);
  }
};

module.exports = authMiddleware;
