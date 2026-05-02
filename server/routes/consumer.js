const express = require("express");
const authenticate = require("../middleware/authenticate");
const requireRole = require("../middleware/requireRole");
const CafeService = require("../services/CafeService");
const OrderService = require("../services/OrderService");
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

/**
 * GET /api/consumer/cafes/:cafeId
 *
 * Returns a single active cafe and its full menu.
 *
 * Params:
 *   cafeId - MongoDB ObjectId of the cafe
 *
 * Responses:
 *   200 - Cafe detail and menu items
 *   404 - Cafe not found or not active
 */
router.get("/cafes/:cafeId", async (req, res, next) => {
  try {
    const { cafeId } = req.params;

    const { cafe, menu } = await CafeService.getCafeWithMenu(cafeId);

    return res.status(200).json({ cafe, menu });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/consumer/orders
 *
 * Create a pending order. The transaction is completed when the consumer
 * visits the cafe and pays in person.
 *
 * Order types and loyalty points awarded on completion:
 *   buy      →  5 pts  (consumer buys a reusable cup from the cafe)
 *   rent     → 10 pts  (consumer rents a cup, to be returned later)
 *   own_cup  → 15 pts  (consumer brings their own reusable cup)
 *
 * Body:
 *   {
 *     cafeId:   string,           - Target cafe
 *     type:     "buy"|"rent"|"own_cup",
 *     barcode?: string            - Required for "buy" and "rent"
 *   }
 *
 * Responses:
 *   201 - Order created (pending)
 *   400 - Validation error
 *   404 - Cup not available at cafe
 */
router.post("/orders", async (req, res, next) => {
  try {
    const { cafeId, type, barcode } = req.body;

    const fields = {};

    if (!cafeId || typeof cafeId !== "string" || cafeId.trim().length === 0) {
      fields.cafeId = "cafeId is required";
    }

    const validTypes = ["buy", "rent", "own_cup"];
    if (!type || !validTypes.includes(type)) {
      fields.type = `type must be one of: ${validTypes.join(", ")}`;
    }

    if ((type === "buy" || type === "rent") && (!barcode || typeof barcode !== "string" || barcode.trim().length === 0)) {
      fields.barcode = `barcode is required for "${type}" orders`;
    }

    if (Object.keys(fields).length > 0) {
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid input", fields));
    }

    const order = await OrderService.createOrder({
      userId: req.user.id,
      cafeId: cafeId.trim(),
      type,
      barcode: barcode?.trim()
    });

    const LOYALTY_POINTS = { buy: 5, rent: 10, own_cup: 15 };

    return res.status(201).json({
      message: "Order created. Visit the cafe to complete your purchase and earn loyalty points.",
      order: {
        id: order._id,
        type: order.type,
        status: order.status,
        cafeId: order.cafeId,
        cupId: order.cupId,
        loyaltyPointsOnCompletion: LOYALTY_POINTS[type],
        createdAt: order.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/consumer/orders
 *
 * Get all orders for the authenticated consumer.
 *
 * Query params:
 *   status - "pending" | "completed" (optional, returns all if omitted)
 *
 * Responses:
 *   200 - List of orders
 */
router.get("/orders", async (req, res, next) => {
  try {
    const { status } = req.query;

    if (status && !["pending", "completed"].includes(status)) {
      return res.status(400).json(
        errorResponse("VALIDATION_ERROR", "Invalid input", {
          status: 'status must be "pending" or "completed"'
        })
      );
    }

    const orders = await OrderService.getConsumerOrders(req.user.id, status);

    return res.status(200).json({ count: orders.length, orders });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
