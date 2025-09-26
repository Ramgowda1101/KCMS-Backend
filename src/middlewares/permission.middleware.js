const rolesDef = require("../models/role.model");
const { errorResponse } = require("../utils/responseHelper");

/**
 * authorize(permission)
 *  - checks if any of user's roles provide the permission
 *  - attaches scopes to req.user.scopes for downstream controllers
 */
const authorize = (permission) => {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) {
      return errorResponse(res, "Not authorized", 403);
    }

    const userRoles = req.user.roles;

    // aggregate permissions & scopes
    const userPermissions = new Set();
    const userScopes = new Set();

    userRoles.forEach((role) => {
      const def = rolesDef[role];
      if (def) {
        (def.permissions || []).forEach((p) => userPermissions.add(p));
        userScopes.add(def.scope);
      }
    });

    if (!userPermissions.has(permission)) {
      return errorResponse(res, "Forbidden: insufficient permissions", 403);
    }

    // expose scope to controller for fine-grained checks
    req.user.scopes = Array.from(userScopes);
    next();
  };
};


const roleAuth = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) return errorResponse(res, "Not authorized", 403);
    const has = req.user.roles.some(r => allowedRoles.includes(r));
    if (!has) return errorResponse(res, "Forbidden: insufficient role", 403);
    next();
  };
};
module.exports = { authorize, roleAuth };
