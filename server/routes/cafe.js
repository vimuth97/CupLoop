const express = require("express");
const authenticate = require("../middleware/authenticate");
const requireRole = require("../middleware/requireRole");
const requireActiveStatus = require("../middleware/requireActiveStatus");
const CupService = require("../services/CupService");
const OrderService = require("../services/OrderService");
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

module.exports = router;
