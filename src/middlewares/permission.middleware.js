const roles = require("../models/role.model");
const { errorResponse } = require("../utils/responseHelper");

/**
 * Permission + scope-based authorization middleware
 * @param {string} permission - Permission required
 */
const authorize = (permission) => {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) {
      return errorResponse(res, "Not authorized", 403);
    }

    const userRoles = req.user.roles;

    // Collect all permissions and scopes
    let userPermissions = [];
    let userScopes = [];

    userRoles.forEach((role) => {
      if (roles[role]) {
        userPermissions = [...userPermissions, ...roles[role].permissions];
        userScopes.push(roles[role].scope);
      }
    });

    // Check if user has the required permission
    if (!userPermissions.includes(permission)) {
      return errorResponse(res, "Forbidden: insufficient permissions", 403);
    }

    // Attach scopes to req for controller logic
    req.user.scopes = userScopes;

    next();
  };
};

module.exports = authorize;
