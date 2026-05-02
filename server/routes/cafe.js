const express = require("express");
const authenticate = require("../middleware/authenticate");
const requireRole = require("../middleware/requireRole");
const requireActiveStatus = require("../middleware/requireActiveStatus");
const CupService = require("../services/CupService");
const OrderService = require("../services/OrderService");
const RewardCatalogueService = require("../services/RewardCatalogueService");
const errorResponse = require("../utils/errorResponse");

const router = express.Router();

router.use(authenticate, requireRole("cafe"), requireActiveStatus);

// GET /api/cafe/inventory
router.get("/inventory", async (req, res, next) => {
  try {
    const { cups, summary } = await CupService.getCafeInventory(req.cafe._id);
    return res.status(200).json({ cafe: { id: req.cafe._id, name: req.cafe.name }, summary, cups });
  } catch (err) {
    next(err);
  }
});

// GET /api/cafe/orders/pending
router.get("/orders/pending", async (req, res, next) => {
  try {
    const orders = await OrderService.getCafePendingOrders(req.cafe._id);
    return res.status(200).json({ count: orders.length, orders });
  } catch (err) {
    next(err);
  }
});

// PUT /api/cafe/orders/:orderId/complete
router.put("/orders/:orderId/complete", async (req, res, next) => {
  try {
    const order = await OrderService.completeOrder(req.params.orderId, req.cafe._id);
    return res.status(200).json({
      message: `Order completed. ${order.rewardPointsEarned} loyalty point(s) awarded to the consumer.`,
      order: { id: order._id, type: order.type, status: order.status, rewardPointsEarned: order.rewardPointsEarned, completedAt: order.completedAt }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/cafe/transactions/walk-in
router.post("/transactions/walk-in", async (req, res, next) => {
  try {
    const { customerEmail, type, barcode } = req.body;
    const fields = {};

    if (!customerEmail || typeof customerEmail !== "string" || customerEmail.trim().length === 0)
      fields.customerEmail = "Customer email is required";

    const validTypes = ["buy", "rent", "own_cup"];
    if (!type || !validTypes.includes(type))
      fields.type = `type must be one of: ${validTypes.join(", ")}`;

    if ((type === "buy" || type === "rent") && (!barcode || typeof barcode !== "string" || barcode.trim().length === 0))
      fields.barcode = `barcode is required for "${type}" transactions`;

    if (Object.keys(fields).length > 0)
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid input", fields));

    const { order, consumer } = await OrderService.walkIn({ customerEmail: customerEmail.trim(), cafeId: req.cafe._id, type, barcode: barcode?.trim() });
    const LOYALTY_POINTS = { buy: 5, rent: 10, own_cup: 15 };

    return res.status(201).json({
      message: `Transaction completed. ${LOYALTY_POINTS[type]} loyalty point(s) awarded to ${consumer.firstName} ${consumer.lastName}.`,
      transaction: { id: order._id, type: order.type, status: order.status, rewardPointsEarned: order.rewardPointsEarned, completedAt: order.completedAt },
      consumer
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/cafe/rewards
router.get("/rewards", async (req, res, next) => {
  try {
    const rewards = await RewardCatalogueService.getCafeRewards(req.cafe._id);
    return res.status(200).json({ count: rewards.length, rewards });
  } catch (err) {
    next(err);
  }
});

// POST /api/cafe/rewards
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

    const reward = await RewardCatalogueService.createCafeReward(req.cafe._id, { title, description, type, pointsCost, discountPercentage, itemName, validFrom, validUntil });
    return res.status(201).json({ message: "Reward created successfully", reward });
  } catch (err) {
    next(err);
  }
});

// PUT /api/cafe/rewards/:rewardId
router.put("/rewards/:rewardId", async (req, res, next) => {
  try {
    const reward = await RewardCatalogueService.updateCafeReward(req.params.rewardId, req.cafe._id, req.body);
    return res.status(200).json({ message: "Reward updated", reward });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/cafe/rewards/:rewardId
router.delete("/rewards/:rewardId", async (req, res, next) => {
  try {
    await RewardCatalogueService.deleteCafeReward(req.params.rewardId, req.cafe._id);
    return res.status(200).json({ message: "Reward deleted" });
  } catch (err) {
    next(err);
  }
});

// PUT /api/cafe/redemptions/:redemptionId/use
router.put("/redemptions/:redemptionId/use", async (req, res, next) => {
  try {
    const redemption = await RewardCatalogueService.markRedemptionUsed(req.params.redemptionId, req.cafe._id);
    return res.status(200).json({ message: "Redemption marked as used", redemption });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
