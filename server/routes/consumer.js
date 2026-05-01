const express = require("express");
const authenticate = require("../middleware/authenticate");
const requireRole = require("../middleware/requireRole");
const CafeService = require("../services/CafeService");
const errorResponse = require("../utils/errorResponse");

const router = express.Router();

// All consumer routes require a valid JWT with role "consumer"
router.use(authenticate, requireRole("consumer"));

/**
 * GET /api/consumer/cafes
 *
 * Returns all active cafes. Supports optional location-based filtering.
 *
 * Query params (all required together for location search):
 *   lat    - Origin latitude  (number, -90 to 90)
 *   lng    - Origin longitude (number, -180 to 180)
 *   radius - Search radius in kilometres (number, > 0)
 *
 * Examples:
 *   GET /api/consumer/cafes                          → all active cafes
 *   GET /api/consumer/cafes?lat=-27.47&lng=153.02&radius=5  → cafes within 5 km
 *
 * Responses:
 *   200 - Array of cafe objects with distance included when location search is used
 *   400 - Partial or invalid location query params
 */
router.get("/cafes", async (req, res, next) => {
  try {
    const { lat, lng, radius } = req.query;

    // Determine if the caller wants a location-based search
    const hasLocation = lat !== undefined || lng !== undefined || radius !== undefined;

    if (hasLocation) {
      // All three params must be present together
      const fields = {};

      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
      const parsedRadius = parseFloat(radius);

      if (lat === undefined || isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
        fields.lat = "A valid latitude between -90 and 90 is required";
      }
      if (lng === undefined || isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
        fields.lng = "A valid longitude between -180 and 180 is required";
      }
      if (radius === undefined || isNaN(parsedRadius) || parsedRadius <= 0) {
        fields.radius = "Radius must be a positive number (kilometres)";
      }

      if (Object.keys(fields).length > 0) {
        return res.status(400).json(
          errorResponse("VALIDATION_ERROR", "Invalid location parameters", fields)
        );
      }

      const cafes = await CafeService.getActiveCafes({
        lat: parsedLat,
        lng: parsedLng,
        radius: parsedRadius
      });

      return res.status(200).json({
        count: cafes.length,
        searchOrigin: { lat: parsedLat, lng: parsedLng, radiusKm: parsedRadius },
        cafes
      });
    }

    // No location params — return all active cafes
    const cafes = await CafeService.getActiveCafes();

    return res.status(200).json({
      count: cafes.length,
      cafes
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
