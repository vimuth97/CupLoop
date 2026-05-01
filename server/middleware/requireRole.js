const errorResponse = require("../utils/errorResponse");

/**
 * requireRole(role) — RBAC middleware factory
 *
 * Returns an Express middleware that allows the request to proceed only if
 * req.user.role matches the required role.
 *
 * Must be used AFTER the authenticate middleware.
 *
 * @param {string} role - Required role ("consumer" | "cafe" | "admin")
 * @returns {Function} Express middleware
 *
 * @example
 *   router.put("/approve/:id", authenticate, requireRole("admin"), handler)
 */
const requireRole = (role) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(
      errorResponse("MISSING_TOKEN", "Authorization token is required")
    );
  }

  if (req.user.role !== role) {
    return res.status(403).json(
      errorResponse("FORBIDDEN", `Access restricted to ${role} accounts`)
    );
  }

  next();
};

module.exports = requireRole;
