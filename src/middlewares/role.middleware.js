const roleAuth = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      return res.status(403).json({ success: false, message: "Forbidden: insufficient role" });
    }

    next();
  };
};

module.exports = roleAuth;
