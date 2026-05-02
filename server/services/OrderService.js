const mongoose = require("mongoose");
const CupTransaction = require("../models/cupTransaction");
const User = require("../models/user");
const Cup = require("../models/cup");
const Reward = require("../models/reward");

// Fixed loyalty points awarded per order type
const LOYALTY_POINTS = {
  buy: 10,
  rent: 5,
  own_cup: 15
};

class OrderService {
  /**
   * Walk-in transaction — cashier settles a transaction on the spot
   * without a pre-existing order from the consumer.
   *
   * Creates the order and immediately completes it in a single atomic operation.
   * Loyalty points are awarded to the consumer right away.
   *
   * @param {Object} params
   * @param {string} params.customerEmail - Used to look up the consumer account
   * @param {string} params.cafeId
   * @param {string} params.type - "buy" | "rent" | "own_cup"
   * @param {string} [params.barcode] - Required for "buy" and "rent"
   * @returns {Promise<{ order: CupTransaction, consumer: Object }>}
   */
  async walkIn({ customerEmail, cafeId, type, barcode }) {
    const session = await mongoose.startSession();

    try {
      let result;

      await session.withTransaction(async () => {
        // --- Look up consumer by email ---
        const consumer = await User.findOne({
          email: customerEmail.toLowerCase(),
          role: "consumer"
        }).session(session);

        if (!consumer) {
          const err = new Error(`No consumer account found with email "${customerEmail}"`);
          err.status = 404;
          err.code = "CONSUMER_NOT_FOUND";
          throw err;
        }

        if (consumer.accountStatus === "inactive") {
          const err = new Error("This consumer account has been deactivated");
          err.status = 403;
          err.code = "ACCOUNT_INACTIVE";
          throw err;
        }

        // --- Validate cup for buy/rent ---
        let cup = null;
        if (type === "buy" || type === "rent") {
          cup = await Cup.findOne({
            barcode,
            currentCafeId: cafeId,
            status: "available"
          }).session(session);

          if (!cup) {
            const err = new Error(
              "No available cup with that barcode was found at this cafe"
            );
            err.status = 404;
            err.code = "CUP_NOT_AVAILABLE";
            throw err;
          }

          // Update cup state immediately
          await Cup.findByIdAndUpdate(
            cup._id,
            { status: "in_use", currentUserId: consumer._id, lastUsedAt: new Date() },
            { session }
          );
        }

        const pointsEarned = LOYALTY_POINTS[type];

        // --- Create and immediately complete the transaction ---
        const [order] = await CupTransaction.create(
          [{
            cupId: cup?._id || null,
            userId: consumer._id,
            cafeId,
            type,
            status: "completed",
            rewardPointsEarned: pointsEarned,
            completedAt: new Date()
          }],
          { session }
        );

        // --- Award loyalty points ---
        await User.findByIdAndUpdate(
          consumer._id,
          { $inc: { loyaltyPoints: pointsEarned } },
          { session }
        );

        // --- Record reward entry ---
        await Reward.create(
          [{
            userId: consumer._id,
            points: pointsEarned,
            source: type,
            transactionId: order._id
          }],
          { session }
        );

        result = {
          order,
          consumer: {
            id: consumer._id,
            firstName: consumer.firstName,
            lastName: consumer.lastName,
            email: consumer.email,
            loyaltyPointsAfter: consumer.loyaltyPoints + pointsEarned
          }
        };
      });

      return result;
    } finally {
      session.endSession();
    }
  }

  /**
   * Create a pending order for a consumer.
   * For "buy" and "rent", a specific cup barcode must be provided.
   * For "own_cup", no cup is needed — the consumer brings their own.
   *
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} params.cafeId
   * @param {string} params.type - "buy" | "rent" | "own_cup"
   * @param {string} [params.barcode] - Required for "buy" and "rent"
   * @returns {Promise<CupTransaction>}
   */
  async createOrder({ userId, cafeId, type, barcode }) {
    let cup = null;

    if (type === "buy" || type === "rent") {
      cup = await Cup.findOne({ barcode, currentCafeId: cafeId, status: "available" });

      if (!cup) {
        const err = new Error(
          "No available cup with that barcode was found at this cafe"
        );
        err.status = 404;
        err.code = "CUP_NOT_AVAILABLE";
        throw err;
      }
    }

    const order = await CupTransaction.create({
      cupId: cup?._id || null,
      userId,
      cafeId,
      type,
      status: "pending",
      rewardPointsEarned: LOYALTY_POINTS[type]
    });

    return order;
  }

  /**
   * Complete a pending order. Called by the cafe when the consumer arrives and pays.
   * Awards loyalty points to the consumer and updates cup state for buy/rent orders.
   *
   * @param {string} orderId
   * @param {string} cafeId - Must match the order's cafeId (ownership check)
   * @returns {Promise<CupTransaction>}
   */
  async completeOrder(orderId, cafeId) {
    const session = await mongoose.startSession();

    try {
      let completedOrder;

      await session.withTransaction(async () => {
        const order = await CupTransaction.findById(orderId).session(session);

        if (!order) {
          const err = new Error("Order not found");
          err.status = 404;
          err.code = "ORDER_NOT_FOUND";
          throw err;
        }

        if (order.cafeId.toString() !== cafeId.toString()) {
          const err = new Error("This order does not belong to your cafe");
          err.status = 403;
          err.code = "FORBIDDEN";
          throw err;
        }

        if (order.status === "completed") {
          const err = new Error("This order has already been completed");
          err.status = 409;
          err.code = "ORDER_ALREADY_COMPLETED";
          throw err;
        }

        // Update cup state for buy/rent orders
        if (order.cupId) {
          if (order.type === "rent") {
            await Cup.findByIdAndUpdate(
              order.cupId,
              { status: "in_use", currentUserId: order.userId, lastUsedAt: new Date() },
              { session }
            );
          } else if (order.type === "buy") {
            // Bought cups leave the cafe inventory
            await Cup.findByIdAndUpdate(
              order.cupId,
              { status: "in_use", currentUserId: order.userId, lastUsedAt: new Date() },
              { session }
            );
          }
        }

        // Award loyalty points to the consumer
        await User.findByIdAndUpdate(
          order.userId,
          { $inc: { loyaltyPoints: order.rewardPointsEarned } },
          { session }
        );

        // Record the reward entry
        await Reward.create(
          [{
            userId: order.userId,
            points: order.rewardPointsEarned,
            source: order.type,
            transactionId: order._id
          }],
          { session }
        );

        // Mark order as completed
        order.status = "completed";
        order.completedAt = new Date();
        await order.save({ session });

        completedOrder = order;
      });

      return completedOrder;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get all orders for a consumer, optionally filtered by status.
   * @param {string} userId
   * @param {string} [status] - "pending" | "completed"
   * @returns {Promise<CupTransaction[]>}
   */
  async getConsumerOrders(userId, status) {
    const filter = { userId };
    if (status) filter.status = status;

    return CupTransaction.find(filter)
      .populate("cafeId", "name location")
      .populate("cupId", "barcode materialType")
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Get all pending orders for a cafe.
   * @param {string} cafeId
   * @returns {Promise<CupTransaction[]>}
   */
  async getCafePendingOrders(cafeId) {
    return CupTransaction.find({ cafeId, status: "pending" })
      .populate("userId", "firstName lastName email")
      .populate("cupId", "barcode materialType")
      .sort({ createdAt: 1 })
      .lean();
  }
}

module.exports = new OrderService();
