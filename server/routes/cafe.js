const express = require("express");
const authenticate = require("../middleware/authenticate");
const requireRole = require("../middleware/requireRole");
const requireActiveStatus = require("../middleware/requireActiveStatus");
const CupService = require("../services/CupService");
const OrderService = require("../services/OrderService");
const RewardCatalogueService = require("../services/RewardCatalogueService");
const errorResponse = require("../utils/errorResponse");

const router = express.Router();

// All cafe routes require a valid JWT with role "cafe" and an approved cafe account
router.use(authenticate, requireRole("cafe"), requireActiveStatus);

/**
 * GET /api/cafe/inventory
 *
 * Returns all cups currently assigned to the authenticated cafe,
 * along with a status breakdown summary.
 *
 * The cafe is identified from the JWT — no cafeId param needed.
 *
 * Responses:
 *   200 - Full cup inventory with summary
 *   403 - Cafe not yet approved
 */
router.get("/inventory", async (req, res, next) => {
  try {
    // req.cafe is attached by requireActiveStatus middleware
    const { cups, summary } = await CupService.getCafeInventory(req.cafe._id);

    return res.status(200).json({
      cafe: {
        id: req.cafe._id,
        name: req.cafe.name
      },
      summary,
      cups
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/cafe/orders/pending
 *
 * Get all pending orders for this cafe — consumers who have placed an order
 * and are expected to arrive to complete the transaction.
 *
 * Responses:
 *   200 - List of pending orders
 */
router.get("/orders/pending", async (req, res, next) => {
  try {
    const orders = await OrderService.getCafePendingOrders(req.cafe._id);
    return res.status(200).json({ count: orders.length, orders });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/cafe/orders/:orderId/complete
 *
 * Complete a pending order when the consumer arrives and pays.
 * This awards loyalty points to the consumer and updates cup state.
 *
 * Loyalty points awarded:
 *   buy      →  5 pts
 *   rent     → 10 pts
 *   own_cup  → 15 pts
 *
 * Params:
 *   orderId - MongoDB ObjectId of the order
 *
 * Responses:
 *   200 - Order completed, loyalty points awarded
 *   403 - Order does not belong to this cafe
 *   404 - Order not found
 *   409 - Order already completed
 */
router.put("/orders/:orderId/complete", async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const order = await OrderService.completeOrder(orderId, req.cafe._id);

    return res.status(200).json({
      message: `Order completed. ${order.rewardPointsEarned} loyalty point(s) awarded to the consumer.`,
      order: {
        id: order._id,
        type: order.type,
        status: order.status,
        rewardPointsEarned: order.rewardPointsEarned,
        completedAt: order.completedAt
      }
    });
  } catch (err) {
    next(err);
  }
});

// ─── Reward catalogue management ────────────────────────────────────────────

/**
 * GET /api/cafe/rewards
 * List all rewards for this cafe (including inactive — for management view).
 */
router.get("/rewards", async (req, res, next) => {
  try {
    const rewards = await RewardCatalogueService.getCafeRewards(req.cafe._id);
    return res.status(200).json({ count: rewards.length, rewards });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/cafe/rewards
 *
 * Create a new redeemable reward or discount for consumers.
 *
 * Body:
 *   {
 *     title:               string,
 *     description?:        string,
 *     type:                "discount" | "free_item",
 *     pointsCost:          number (min 1),
 *     discountPercentage?: number (1–100, required when type="discount"),
 *     itemName?:           string  (required when type="free_item"),
 *     validFrom:           ISO date string,
 *     validUntil:          ISO date string
 *   }
 */
router.post("/rewards", async (req, res, next) => {
  try {
    const { title, description, type, pointsCost, discountPercentage, itemName, validFrom, validUntil } = req.body;

    const fields = {};
    if (!title || typeof title !== "string" || title.trim().length === 0)
      fields.title = "Title is required";
    if (!["discount", "free_item"].includes(type))
      fields.type = 'type must be "discount" or "free_item"';
    if (!pointsCost || typeof pointsCost !== "number" || pointsCost < 1)
      fields.pointsCost = "pointsCost must be a number of at least 1";
    if (!validFrom || isNaN(Date.parse(validFrom)))
      fields.validFrom = "A valid validFrom date is required";
    if (!validUntil || isNaN(Date.parse(validUntil)))
      fields.validUntil = "A valid validUntil date is required";
    if (validFrom && validUntil && new Date(validFrom) >= new Date(validUntil))
      fields.validUntil = "validUntil must be after validFrom";

    if (Object.keys(fields).length > 0)
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid input", fields));

    const reward = await RewardCatalogueService.createCafeReward(req.cafe._id, {
      title, description, type, pointsCost, discountPercentage, itemName, validFrom, validUntil
    });

    return res.status(201).json({ message: "Reward created successfully", reward });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/cafe/rewards/:rewardId
 * Update an existing reward.
 */
router.put("/rewards/:rewardId", async (req, res, next) => {
  try {
    const reward = await RewardCatalogueService.updateCafeReward(
      req.params.rewardId,
      req.cafe._id,
      req.body
    );
    return res.status(200).json({ message: "Reward updated", reward });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/cafe/rewards/:rewardId
 * Remove a reward from the catalogue.
 */
router.delete("/rewards/:rewardId", async (req, res, next) => {
  try {
    await RewardCatalogueService.deleteCafeReward(req.params.rewardId, req.cafe._id);
    return res.status(200).json({ message: "Reward deleted" });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/cafe/redemptions/:redemptionId/use
 *
 * Mark a consumer's redemption as used when they present it at the cafe.
 */
router.put("/redemptions/:redemptionId/use", async (req, res, next) => {
  try {
    const redemption = await RewardCatalogueService.markRedemptionUsed(
      req.params.redemptionId,
      req.cafe._id
    );
    return res.status(200).json({ message: "Redemption marked as used", redemption });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
