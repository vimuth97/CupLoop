const mongoose = require("mongoose");
const CafeReward = require("../models/cafeReward");
const Redemption = require("../models/redemption");
const User = require("../models/user");
const Reward = require("../models/reward");

class RewardCatalogueService {
  // ─── Cafe: manage their reward catalogue ────────────────────────────────────

  /**
   * Create a new redeemable reward/discount for a cafe.
   * @param {string} cafeId
   * @param {Object} data
   * @returns {Promise<CafeReward>}
   */
  async createCafeReward(cafeId, data) {
    const { title, description, type, pointsCost, discountPercentage, itemName, validFrom, validUntil } = data;

    if (type === "discount" && (!discountPercentage || discountPercentage < 1 || discountPercentage > 100)) {
      const err = new Error("discountPercentage must be between 1 and 100 for discount rewards");
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    if (type === "free_item" && (!itemName || itemName.trim().length === 0)) {
      const err = new Error("itemName is required for free_item rewards");
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    return CafeReward.create({
      cafeId,
      title: title.trim(),
      description: description?.trim(),
      type,
      pointsCost,
      discountPercentage: type === "discount" ? discountPercentage : undefined,
      itemName: type === "free_item" ? itemName.trim() : undefined,
      validFrom: new Date(validFrom),
      validUntil: new Date(validUntil),
      active: true
    });
  }

  /**
   * Get all rewards for a cafe (including inactive ones — for cafe management view).
   * @param {string} cafeId
   * @returns {Promise<CafeReward[]>}
   */
  async getCafeRewards(cafeId) {
    return CafeReward.find({ cafeId }).sort({ createdAt: -1 }).lean();
  }

  /**
   * Update a cafe reward. Only the owning cafe can update it.
   * @param {string} rewardId
   * @param {string} cafeId
   * @param {Object} updates
   * @returns {Promise<CafeReward>}
   */
  async updateCafeReward(rewardId, cafeId, updates) {
    const reward = await CafeReward.findOne({ _id: rewardId, cafeId });

    if (!reward) {
      const err = new Error("Reward not found or does not belong to your cafe");
      err.status = 404;
      err.code = "REWARD_NOT_FOUND";
      throw err;
    }

    const allowed = ["title", "description", "pointsCost", "discountPercentage", "itemName", "validFrom", "validUntil", "active"];
    for (const key of allowed) {
      if (updates[key] !== undefined) reward[key] = updates[key];
    }

    return reward.save();
  }

  /**
   * Delete a cafe reward.
   * @param {string} rewardId
   * @param {string} cafeId
   */
  async deleteCafeReward(rewardId, cafeId) {
    const result = await CafeReward.deleteOne({ _id: rewardId, cafeId });

    if (result.deletedCount === 0) {
      const err = new Error("Reward not found or does not belong to your cafe");
      err.status = 404;
      err.code = "REWARD_NOT_FOUND";
      throw err;
    }
  }

  // ─── Consumer: browse and redeem ────────────────────────────────────────────

  /**
   * Get all currently active rewards available to consumers at a specific cafe.
   * @param {string} cafeId
   * @returns {Promise<CafeReward[]>}
   */
  async getActiveRewardsForCafe(cafeId) {
    const now = new Date();
    return CafeReward.find({
      cafeId,
      active: true,
      validFrom:  { $lte: now },
      validUntil: { $gte: now }
    }).sort({ pointsCost: 1 }).lean();
  }

  /**
   * Redeem a reward for a consumer.
   * Deducts loyalty points and creates a Redemption record (status: pending).
   * The cafe marks it as "used" when the consumer presents it in person.
   *
   * @param {string} userId
   * @param {string} cafeRewardId
   * @returns {Promise<Redemption>}
   */
  async redeemReward(userId, cafeRewardId) {
    const session = await mongoose.startSession();

    try {
      let redemption;

      await session.withTransaction(async () => {
        const now = new Date();

        // Load and validate the reward
        const cafeReward = await CafeReward.findOne({
          _id: cafeRewardId,
          active: true,
          validFrom:  { $lte: now },
          validUntil: { $gte: now }
        }).session(session);

        if (!cafeReward) {
          const err = new Error("This reward is not available or has expired");
          err.status = 404;
          err.code = "REWARD_NOT_AVAILABLE";
          throw err;
        }

        // Check consumer has enough points
        const user = await User.findById(userId).session(session);

        if (user.loyaltyPoints < cafeReward.pointsCost) {
          const err = new Error(
            `Insufficient loyalty points. You have ${user.loyaltyPoints} but need ${cafeReward.pointsCost}`
          );
          err.status = 400;
          err.code = "INSUFFICIENT_POINTS";
          throw err;
        }

        // Deduct points
        await User.findByIdAndUpdate(
          userId,
          { $inc: { loyaltyPoints: -cafeReward.pointsCost } },
          { session }
        );

        // Record the deduction in the Reward ledger
        await Reward.create(
          [{
            userId,
            points: -cafeReward.pointsCost,
            source: "redemption"
          }],
          { session }
        );

        // Create the redemption record
        const [created] = await Redemption.create(
          [{
            userId,
            cafeRewardId: cafeReward._id,
            cafeId: cafeReward.cafeId,
            pointsSpent: cafeReward.pointsCost,
            status: "pending"
          }],
          { session }
        );

        redemption = created;
      });

      // Return populated redemption
      return Redemption.findById(redemption._id)
        .populate("cafeRewardId", "title type discountPercentage itemName")
        .populate("cafeId", "name location.address")
        .lean();
    } finally {
      session.endSession();
    }
  }

  /**
   * Get all redemptions for a consumer.
   * @param {string} userId
   * @returns {Promise<Redemption[]>}
   */
  async getConsumerRedemptions(userId) {
    return Redemption.find({ userId })
      .populate("cafeRewardId", "title type discountPercentage itemName pointsCost")
      .populate("cafeId", "name location.address")
      .sort({ redeemedAt: -1 })
      .lean();
  }

  /**
   * Mark a redemption as used — called by the cafe when the consumer presents it.
   * @param {string} redemptionId
   * @param {string} cafeId - Ownership check
   * @returns {Promise<Redemption>}
   */
  async markRedemptionUsed(redemptionId, cafeId) {
    const redemption = await Redemption.findOne({ _id: redemptionId, cafeId });

    if (!redemption) {
      const err = new Error("Redemption not found or does not belong to your cafe");
      err.status = 404;
      err.code = "REDEMPTION_NOT_FOUND";
      throw err;
    }

    if (redemption.status === "used") {
      const err = new Error("This redemption has already been used");
      err.status = 409;
      err.code = "REDEMPTION_ALREADY_USED";
      throw err;
    }

    redemption.status = "used";
    redemption.usedAt = new Date();
    return redemption.save();
  }
}

module.exports = new RewardCatalogueService();
