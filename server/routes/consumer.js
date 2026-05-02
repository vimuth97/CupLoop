const express = require("express");
const authenticate = require("../middleware/authenticate");
const requireRole = require("../middleware/requireRole");
const CafeService = require("../services/CafeService");
const OrderService = require("../services/OrderService");
const LoyaltyService = require("../services/LoyaltyService");
const RewardCatalogueService = require("../services/RewardCatalogueService");
const errorResponse = require("../utils/errorResponse");

const router = express.Router();

router.use(authenticate, requireRole("consumer"));

// GET /api/consumer/cafes
router.get("/cafes", async (req, res, next) => {
  try {
    const { lat, lng, radius } = req.query;
    const hasLocation = lat !== undefined || lng !== undefined || radius !== undefined;

    if (hasLocation) {
      const fields = {};
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
      const parsedRadius = parseFloat(radius);

      if (lat === undefined || isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90)
        fields.lat = "A valid latitude between -90 and 90 is required";
      if (lng === undefined || isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180)
        fields.lng = "A valid longitude between -180 and 180 is required";
      if (radius === undefined || isNaN(parsedRadius) || parsedRadius <= 0)
        fields.radius = "Radius must be a positive number (kilometres)";

      if (Object.keys(fields).length > 0)
        return res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid location parameters", fields));

      const cafes = await CafeService.getActiveCafes({ lat: parsedLat, lng: parsedLng, radius: parsedRadius });
      return res.status(200).json({ count: cafes.length, searchOrigin: { lat: parsedLat, lng: parsedLng, radiusKm: parsedRadius }, cafes });
    }

    const cafes = await CafeService.getActiveCafes();
    return res.status(200).json({ count: cafes.length, cafes });
  } catch (err) {
    next(err);
  }
});

// GET /api/consumer/cafes/:cafeId
router.get("/cafes/:cafeId", async (req, res, next) => {
  try {
    const { cafe, menu } = await CafeService.getCafeWithMenu(req.params.cafeId);
    return res.status(200).json({ cafe, menu });
  } catch (err) {
    next(err);
  }
});

// GET /api/consumer/cafes/:cafeId/rewards
router.get("/cafes/:cafeId/rewards", async (req, res, next) => {
  try {
    const rewards = await RewardCatalogueService.getActiveRewardsForCafe(req.params.cafeId);
    return res.status(200).json({ count: rewards.length, rewards });
  } catch (err) {
    next(err);
  }
});

// POST /api/consumer/orders
router.post("/orders", async (req, res, next) => {
  try {
    const { cafeId, type, barcode } = req.body;
    const fields = {};

    if (!cafeId || typeof cafeId !== "string" || cafeId.trim().length === 0)
      fields.cafeId = "cafeId is required";

    const validTypes = ["buy", "rent", "own_cup"];
    if (!type || !validTypes.includes(type))
      fields.type = `type must be one of: ${validTypes.join(", ")}`;

    if ((type === "buy" || type === "rent") && (!barcode || typeof barcode !== "string" || barcode.trim().length === 0))
      fields.barcode = `barcode is required for "${type}" orders`;

    if (Object.keys(fields).length > 0)
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid input", fields));

    const order = await OrderService.createOrder({ userId: req.user.id, cafeId: cafeId.trim(), type, barcode: barcode?.trim() });
    const LOYALTY_POINTS = { buy: 5, rent: 10, own_cup: 15 };

    return res.status(201).json({
      message: "Order created. Visit the cafe to complete your purchase and earn loyalty points.",
      order: { id: order._id, type: order.type, status: order.status, cafeId: order.cafeId, cupId: order.cupId, loyaltyPointsOnCompletion: LOYALTY_POINTS[type], createdAt: order.createdAt }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/consumer/orders
router.get("/orders", async (req, res, next) => {
  try {
    const { status } = req.query;

    if (status && !["pending", "completed"].includes(status))
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid input", { status: 'status must be "pending" or "completed"' }));

    const orders = await OrderService.getConsumerOrders(req.user.id, status);
    return res.status(200).json({ count: orders.length, orders });
  } catch (err) {
    next(err);
  }
});

// GET /api/consumer/loyalty
router.get("/loyalty", async (req, res, next) => {
  try {
    const result = await LoyaltyService.getLoyaltySummary(req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/consumer/rewards/redeem
router.post("/rewards/redeem", async (req, res, next) => {
  try {
    const { cafeRewardId } = req.body;

    if (!cafeRewardId || typeof cafeRewardId !== "string" || cafeRewardId.trim().length === 0)
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid input", { cafeRewardId: "cafeRewardId is required" }));

    const redemption = await RewardCatalogueService.redeemReward(req.user.id, cafeRewardId.trim());
    return res.status(201).json({ message: "Reward redeemed. Present this to the cafe to claim it.", redemption });
  } catch (err) {
    next(err);
  }
});

// GET /api/consumer/rewards/redemptions
router.get("/rewards/redemptions", async (req, res, next) => {
  try {
    const redemptions = await RewardCatalogueService.getConsumerRedemptions(req.user.id);
    return res.status(200).json({ count: redemptions.length, redemptions });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
