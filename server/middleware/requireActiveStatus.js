const Cafe = require("../models/cafe");
const errorResponse = require("../utils/errorResponse");

/**
 * requireActiveStatus middleware
 *
 * Ensures the authenticated cafe account has been approved by an admin
 * (activeStatus === true) before allowing access to cafe management endpoints.
 *
 * Must be used AFTER authenticate + requireRole("cafe").
 */
const requireActiveStatus = async (req, res, next) => {
  try {
    const cafe = await Cafe.findOne({ ownerId: req.user.id });

    if (!cafe) {
      return res.status(404).json(
        errorResponse("CAFE_NOT_FOUND", "No cafe profile found for this account")
      );
    }

    if (!cafe.activeStatus) {
      return res.status(403).json(
        errorResponse(
          "CAFE_PENDING_APPROVAL",
          "Your cafe account is pending admin approval. You cannot access management features yet."
        )
      );
    }

    // Attach cafe to request so route handlers don't need to re-query
    req.cafe = cafe;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = requireActiveStatus;
