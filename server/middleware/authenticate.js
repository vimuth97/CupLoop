const jwt = require("jsonwebtoken");
const errorResponse = require("../utils/errorResponse");

/**
 * authenticate middleware
 *
 * Extracts and verifies the JWT from the Authorization: Bearer <token> header.
 * On success, attaches req.user = { id, role } and calls next().
 * On failure, returns HTTP 401.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json(
      errorResponse("MISSING_TOKEN", "Authorization token is required")
    );
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json(
        errorResponse("TOKEN_EXPIRED", "Access token has expired")
      );
    }
    return res.status(401).json(
      errorResponse("INVALID_TOKEN", "Access token is invalid")
    );
  }
};

module.exports = authenticate;
